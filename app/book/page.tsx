'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { useAuthStore } from '@/lib/store/authStore'
import { PhoneAuthForm } from '@/components/auth/PhoneAuthForm'
import { BookingCalendar } from '@/components/booking/BookingCalendar'
import { ServiceSelector } from '@/components/booking/ServiceSelector'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import type { Service } from '@/types'

function BookPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const step = searchParams.get('step') // null | 'service' | 'calendar'

  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const [name, setName] = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  // Restore saved name from localStorage when user logs in
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`shai-name-${user.uid}`)
      if (saved) {
        setName(saved)
        setNameConfirmed(true)
      }
    }
  }, [user])

  // Once name is confirmed and we're at the root step, move to service selection
  useEffect(() => {
    if (user && nameConfirmed && !step) {
      router.replace('/book?step=service')
    }
  }, [user, nameConfirmed, step, router])

  // Restore selected service from sessionStorage on calendar step
  useEffect(() => {
    if (step === 'calendar' && !selectedService) {
      const saved = sessionStorage.getItem('shai-selected-service')
      if (saved) {
        setSelectedService(JSON.parse(saved))
      } else {
        router.replace('/book?step=service')
      }
    }
  }, [step, selectedService, router])

  function handleNameConfirm() {
    if (!name.trim() || !user) return
    localStorage.setItem(`shai-name-${user.uid}`, name.trim())
    setNameConfirmed(true)
    router.push('/book?step=service')
  }

  function handleServiceSelect(svc: Service) {
    setSelectedService(svc)
    sessionStorage.setItem('shai-selected-service', JSON.stringify(svc))
    router.push('/book?step=calendar')
  }

  function handleSignOut() {
    if (user) localStorage.removeItem(`shai-name-${user.uid}`)
    sessionStorage.removeItem('shai-selected-service')
    signOut(auth)
    setName('')
    setNameConfirmed(false)
    setSelectedService(null)
    router.replace('/book')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-[#6e6e73]">טוען…</p>
        </div>
      </main>
    )
  }

  const showLogin = !user
  const showName = user && !nameConfirmed
  const showService = user && nameConfirmed && step === 'service'
  const showCalendar = user && nameConfirmed && step === 'calendar' && !!selectedService

  return (
    <main className="min-h-screen bg-[#f5f5f7]">
      <header className="bg-white/80 backdrop-blur-md border-b border-[#f0f0f0] sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">💅</span>
            <span className="font-bold text-[#1d1d1f]">שי גבאי</span>
          </Link>
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5e5] px-3 py-1.5 rounded-full transition-colors"
            >
              התנתקות
            </button>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Step 1 — Login */}
        {showLogin && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#1d1d1f]">קביעת תור</h1>
              <p className="text-sm text-[#6e6e73] mt-1">התחברי עם מספר הטלפון שלך להמשך</p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-6">
              <PhoneAuthForm />
            </div>
          </>
        )}

        {/* Step 2 — Name */}
        {showName && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#1d1d1f]">קביעת תור</h1>
              <p className="text-sm text-[#6e6e73] mt-1">שלב 1 — פרטים אישיים</p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-6 space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 mb-4">
                  <span className="text-3xl">👋</span>
                </div>
                <h2 className="text-xl font-bold text-[#1d1d1f]">איך קוראים לך?</h2>
                <p className="text-sm text-[#6e6e73] mt-1">השם יופיע באישור התור שלך</p>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); handleNameConfirm() }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[#1d1d1f] font-medium">שם מלא</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="לדוגמה: שרה כהן"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="h-12 text-base rounded-xl border-[#e5e5e5] bg-[#f5f5f7] focus:bg-white transition-colors"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-sm font-semibold"
                  disabled={!name.trim()}
                >
                  המשך לבחירת שירות ←
                </Button>
              </form>
            </div>
          </>
        )}

        {/* Step 3 — Service selection */}
        {showService && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-[#1d1d1f]">שלום, {name} 👋</h1>
                <p className="text-sm text-[#6e6e73] mt-0.5">בחרי את השירות הרצוי</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (user) localStorage.removeItem(`shai-name-${user.uid}`)
                  setNameConfirmed(false)
                  router.push('/book')
                }}
                className="text-xs text-[#6e6e73] hover:text-rose-500 transition-colors"
              >
                שנה שם
              </button>
            </div>
            <ServiceSelector onSelect={handleServiceSelect} />
          </>
        )}

        {/* Step 4 — Date + time */}
        {showCalendar && selectedService && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-[#1d1d1f]">בחרי זמן</h1>
                <p className="text-sm text-rose-500 font-medium mt-0.5">{selectedService.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedService(null)
                  sessionStorage.removeItem('shai-selected-service')
                  router.push('/book?step=service')
                }}
                className="text-xs text-[#6e6e73] hover:text-rose-500 transition-colors bg-[#f5f5f7] px-3 py-1.5 rounded-full"
              >
                ← שנה שירות
              </button>
            </div>
            <BookingCalendar userName={name} service={selectedService} />
          </>
        )}

      </div>
    </main>
  )
}

// Suspense boundary required by Next.js for useSearchParams
export default function BookPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 animate-pulse" />
      </main>
    }>
      <BookPageContent />
    </Suspense>
  )
}
