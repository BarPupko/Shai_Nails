import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import twilio from 'twilio'
import { randomInt } from 'crypto'

admin.initializeApp()
const db = admin.firestore()

const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN')
const TWILIO_WHATSAPP_FROM = defineSecret('TWILIO_WHATSAPP_FROM')

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('972')) return '+' + digits
  if (digits.startsWith('0')) return '+972' + digits.slice(1)
  return '+972' + digits
}

function generateCode(): string {
  return randomInt(100000, 1000000).toString()
}

export const sendOTP = onCall<{ phone: string }>(
  { region: 'europe-west1', invoker: 'public', secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM] },
  async (request) => {
    const phone = request.data.phone?.trim()
    if (!phone) throw new HttpsError('invalid-argument', 'Phone required')

    const e164 = normalizePhone(phone)
    if (!/^\+972[5]\d{8}$/.test(e164)) {
      throw new HttpsError('invalid-argument', 'Invalid Israeli mobile number')
    }

    // Rate-limit: one send per 60 seconds per number
    const otpRef = db.collection('otpCodes').doc(e164)
    const existing = await otpRef.get()
    if (existing.exists) {
      const sentAt = (existing.data()?.sentAt as admin.firestore.Timestamp | undefined)?.toDate()
      if (sentAt && Date.now() - sentAt.getTime() < 60_000) {
        throw new HttpsError('resource-exhausted', 'Wait 60 seconds before requesting another code')
      }
    }

    const code = generateCode()
    await otpRef.set({
      code,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
    })

    const client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value())
    await client.messages.create({
      from: TWILIO_WHATSAPP_FROM.value(),
      to: e164,
      body: `קוד האימות שלך ל-Shai Nails: ${code}\nהקוד בתוקף ל-5 דקות.`,
    })

    return { success: true }
  }
)

export const verifyOTP = onCall<{ phone: string; code: string }>(
  { region: 'europe-west1', invoker: 'public' },
  async (request) => {
    const phone = request.data.phone?.trim()
    const code = request.data.code?.trim()
    if (!phone || !code) throw new HttpsError('invalid-argument', 'Phone and code required')

    const e164 = normalizePhone(phone)
    const otpRef = db.collection('otpCodes').doc(e164)
    const otpDoc = await otpRef.get()

    if (!otpDoc.exists) throw new HttpsError('not-found', 'No OTP found for this number')

    const data = otpDoc.data()!
    const expiresAt = (data.expiresAt as admin.firestore.Timestamp).toDate()
    if (Date.now() > expiresAt.getTime()) {
      await otpRef.delete()
      throw new HttpsError('deadline-exceeded', 'Code expired')
    }

    const attempts = data.attempts as number
    if (attempts >= 3) {
      await otpRef.delete()
      throw new HttpsError('resource-exhausted', 'Too many failed attempts')
    }

    if (data.code !== code) {
      await otpRef.update({ attempts: admin.firestore.FieldValue.increment(1) })
      throw new HttpsError('unauthenticated', 'Invalid code')
    }

    // Code is valid — clean up and create/fetch user
    await otpRef.delete()

    let uid: string
    try {
      const user = await admin.auth().getUserByPhoneNumber(e164)
      uid = user.uid
    } catch {
      const newUser = await admin.auth().createUser({ phoneNumber: e164 })
      uid = newUser.uid
    }

    const token = await admin.auth().createCustomToken(uid)
    return { token }
  }
)
