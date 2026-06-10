import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import twilio from 'twilio'
import { randomInt } from 'crypto'

admin.initializeApp()
const db = admin.firestore()

const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN')
const TWILIO_FROM = defineSecret('TWILIO_WHATSAPP_FROM')

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
  { region: 'europe-west1', invoker: 'public', secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM] },
  async (request) => {
    const phone = request.data.phone?.trim()
    if (!phone) throw new HttpsError('invalid-argument', 'Phone required')

    const e164 = normalizePhone(phone)
    if (!/^\+972[5]\d{8}$/.test(e164)) {
      throw new HttpsError('invalid-argument', 'Invalid Israeli mobile number')
    }

    const otpRef = db.collection('otpCodes').doc(e164)
    const existing = await otpRef.get()
    if (existing.exists) {
      const sentAt = (existing.data()?.sentAt as admin.firestore.Timestamp | undefined)?.toDate()
      if (sentAt && Date.now() - sentAt.getTime() < 60_000) {
        throw new HttpsError('resource-exhausted', 'Wait 60 seconds before requesting another code')
      }
    }

    const TEST_NUMBER = '+972526333957'
    const isTestNumber = e164 === TEST_NUMBER
    const code = isTestNumber ? '123456' : generateCode()

    await otpRef.set({
      code,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
    })

    if (!isTestNumber) {
      const client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value())
      await client.messages.create({
        from: TWILIO_FROM.value(),
        to: e164,
        body: `ברוכה הבאה קוד האימות שלך לשי גבאי הינו: ${code}\nהקוד בתוקף ל-5 דקות.`,
      })
    }

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

// Runs every day at 9:00 AM Israel time — sends reminder SMS to customers with an appointment tomorrow
export const sendAppointmentReminders = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Asia/Jerusalem', region: 'europe-west1', secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM] },
  async () => {
    const now = new Date()
    const tomorrowStart = new Date(now)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    tomorrowStart.setHours(0, 0, 0, 0)

    const tomorrowEnd = new Date(tomorrowStart)
    tomorrowEnd.setHours(23, 59, 59, 999)

    const snapshot = await db.collection('appointments')
      .where('status', '==', 'active')
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(tomorrowStart))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(tomorrowEnd))
      .get()

    if (snapshot.empty) return

    const client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value())
    const from = TWILIO_FROM.value()

    const sends = snapshot.docs.map(async (docSnap) => {
      const appt = docSnap.data()
      const phone = appt.phoneNumber as string
      const name = appt.name as string
      const serviceName = appt.serviceName as string
      const startTime = (appt.startTime as admin.firestore.Timestamp).toDate()

      const timeStr = startTime.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jerusalem',
      })

      await client.messages.create({
        from,
        to: phone,
        body: `שלום ${name} 💅\nתזכורת: מחר ב-${timeStr} יש לך תור אצל שי גבאי לטיפול ${serviceName}.\nמצפה לראותך!`,
      })
    })

    await Promise.allSettled(sends)
  }
)

const ADMIN_UIDS = [
  'A0B3ZEXfcqhSquqQkoqZ0I6BRtD3',
  'GL5yI9uYdJUReqLczdO0RWVIkdk1',
  'xgEpG6IVB9TtBoTU3KIavIrfHSA3',
  'znbtJJzpq8huSgDG5S5D24iKqYl1',
  'Ha28aVcdNrV1C4kNg2rj64WS8yg1',
  'JAv4EnqMyiWJKBByu7a2uQnXcTB2',
]

export const importInstagramPhoto = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth || !ADMIN_UIDS.includes(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'Admins only')
    }

    const { instagramUrl } = request.data as { instagramUrl: string }
    const match = instagramUrl?.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
    const code = match?.[1]
    if (!code) throw new HttpsError('invalid-argument', 'קישור אינסטגרם לא תקין')

    // Use Facebook's scraper UA — Instagram serves og:image to it for public posts
    const pageResp = await fetch(`https://www.instagram.com/p/${code}/`, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!pageResp.ok) {
      throw new HttpsError('not-found', `אינסטגרם החזיר ${pageResp.status} — ודאי שהפוסט ציבורי`)
    }

    const html = await pageResp.text()

    // og:image can appear in either attribute order
    const imgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/)
    if (!imgMatch) {
      throw new HttpsError('not-found', 'לא נמצאה תמונה בפוסט — ייתכן שהוא פרטי')
    }

    const imageUrl = imgMatch[1].replace(/&amp;/g, '&')

    // Download the image
    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) throw new HttpsError('internal', 'שגיאה בהורדת התמונה')
    const buffer = Buffer.from(await imgResp.arrayBuffer())

    // Re-upload to Firebase Storage so the URL is permanent
    const bucket = admin.storage().bucket()
    const storagePath = `gallery/instagram-${code}-${Date.now()}.jpg`
    const fileRef = bucket.file(storagePath)
    await fileRef.save(buffer, { contentType: 'image/jpeg' })
    await fileRef.makePublic()
    const url = fileRef.publicUrl()

    return { url, storagePath }
  }
)

export const listAuthUsers = onCall(
  { region: 'europe-west1', invoker: 'public' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required')
    const adminUids = [
      'A0B3ZEXfcqhSquqQkoqZ0I6BRtD3',
      'GL5yI9uYdJUReqLczdO0RWVIkdk1',
      'xgEpG6IVB9TtBoTU3KIavIrfHSA3',
      'znbtJJzpq8huSgDG5S5D24iKqYl1',
      'Ha28aVcdNrV1C4kNg2rj64WS8yg1',
      'JAv4EnqMyiWJKBByu7a2uQnXcTB2',
    ]
    if (!adminUids.includes(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'Admins only')
    }
    const result = await admin.auth().listUsers(1000)
    return result.users.map((u) => ({
      uid: u.uid,
      phoneNumber: u.phoneNumber ?? '',
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
    }))
  }
)
