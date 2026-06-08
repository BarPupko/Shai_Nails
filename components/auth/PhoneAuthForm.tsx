'use client'

import { useState, useRef, useEffect } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, initializeRecaptchaConfig } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const RESEND_SECONDS = 120

interface PhoneAuthFormProps {
  onSuccess?: () => void
}

export function PhoneAuthForm({ onSuccess }: PhoneAuthFormProps) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Resend state
  const [countdown, setCountdown] = useState(0)
  const [resendUsed, setResendUsed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const confirmationRef = useRef<ConfirmationResult | null>(null)

  useEffect(() => {
    return () => {
      try { recaptchaRef.current?.clear() } catch (_) {}
      recaptchaRef.current = null
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  function startCountdown() {
    setCountdown(RESEND_SECONDS)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function resetRecaptcha() {
    try { recaptchaRef.current?.clear() } catch (_) {}
    recaptchaRef.current = null
    if (containerRef.current) containerRef.current.innerHTML = ''
  }

  async function sendOTP(): Promise<boolean> {
    const e164 = '+972' + phone.replace(/^0/, '')
    try {
      await initializeRecaptchaConfig(auth)
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
      }
      confirmationRef.current = await signInWithPhoneNumber(auth, e164, recaptchaRef.current)
      return true
    } catch (err: unknown) {
      resetRecaptcha()
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('billing-not-enabled')) {
        setError('שירות ה-SMS אינו מופעל. יש להפעיל חיוב בפרויקט Firebase.')
      } else if (msg.includes('invalid-phone-number')) {
        setError('מספר טלפון לא תקין. בדקי שהמספר בפורמט 05XXXXXXXX.')
      } else if (msg.includes('too-many-requests')) {
        setError('מספר זה נחסם זמנית עקב ניסיונות רבים. נסי שוב מאוחר יותר.')
      } else {
        setError('שליחת הקוד נכשלה. בדקי את מספר הטלפון ונסי שוב.')
      }
      return false
    }
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await sendOTP()
    setLoading(false)
    if (ok) {
      setStep('otp')
      setResendUsed(false)
      startCountdown()
    }
  }

  async function handleResend() {
    setError('')
    setResendLoading(true)
    resetRecaptcha()
    const ok = await sendOTP()
    setResendLoading(false)
    if (ok) {
      setResendUsed(true)
      setCountdown(0)
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmationRef.current) return
    setError('')
    setLoading(true)
    try {
      await confirmationRef.current.confirm(otp)
      onSuccess?.()
    } catch {
      setError('קוד שגוי. בדוק ונסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  function formatCountdown(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div id="recaptcha-container" ref={containerRef} />

      {step === 'phone' ? (
        <form onSubmit={handleSendOTP} className="space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 mb-4">
              <span className="text-3xl">📱</span>
            </div>
            <h2 className="text-xl font-bold text-[#1d1d1f]">אימות מספר טלפון</h2>
            <p className="text-sm text-[#6e6e73] mt-1">
              נשלח אליך קוד חד-פעמי לאימות
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-[#1d1d1f] font-medium">מספר טלפון</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="0501112223"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              required
              maxLength={10}
              className="h-12 text-base rounded-xl border-[#e5e5e5] bg-[#f5f5f7] focus:bg-white transition-colors text-left"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-sm shadow-rose-200 font-semibold"
            disabled={loading || phone.length < 9}
          >
            {loading ? 'שולח קוד…' : 'שליחת קוד אימות'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h2 className="text-xl font-bold text-[#1d1d1f]">הזיני את הקוד</h2>
            <p className="text-sm text-[#6e6e73] mt-1">
              קוד נשלח למספר <span className="font-medium text-[#1d1d1f]" dir="ltr">{phone}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="otp" className="text-[#1d1d1f] font-medium">קוד אימות</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              required
              className="h-14 text-2xl rounded-xl border-[#e5e5e5] bg-[#f5f5f7] focus:bg-white transition-colors tracking-[0.4em] text-center font-bold"
              dir="ltr"
              autoComplete="one-time-code"
            />
          </div>

          {/* Resend section */}
          <div className="text-center">
            {resendUsed ? (
              <p className="text-xs text-[#c7c7cc]">הודעה נשלחה שוב — בדקי את הטלפון</p>
            ) : countdown > 0 ? (
              <p className="text-sm text-[#6e6e73]">
                לא קיבלת? שלחי שוב בעוד{' '}
                <span className="font-semibold tabular-nums text-[#1d1d1f]" dir="ltr">
                  {formatCountdown(countdown)}
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50"
              >
                {resendLoading ? 'שולח…' : 'לא קיבלת קוד? שלחי שוב'}
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-sm shadow-rose-200 font-semibold"
            disabled={loading || otp.length !== 6}
          >
            {loading ? 'מאמת…' : 'אימות קוד'}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors py-2"
            onClick={() => {
              setStep('phone')
              setOtp('')
              setError('')
              setCountdown(0)
              setResendUsed(false)
              if (countdownRef.current) clearInterval(countdownRef.current)
            }}
          >
            ← חזרה למספר טלפון
          </button>
        </form>
      )}
    </div>
  )
}
