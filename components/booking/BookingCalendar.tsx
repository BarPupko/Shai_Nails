'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addHours } from 'date-fns'
import { he } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { TimeSlotGrid } from './TimeSlotGrid'
import { BookingConfirmDialog } from './BookingConfirmDialog'
import { BookingSuccess } from './BookingSuccess'
import {
  getBookedSlots,
  getUserActiveAppointment,
  createAppointment,
  cancelAppointment,
} from '@/lib/firebase/appointments'
import { useAuthStore } from '@/lib/store/authStore'
import type { Appointment } from '@/types'

interface BookingCalendarProps {
  userName: string
}

export function BookingCalendar({ userName }: BookingCalendarProps) {
  const user = useAuthStore((s) => s.user)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [bookedSlots, setBookedSlots] = useState<Date[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)
  const [existingAppointment, setExistingAppointment] = useState<Appointment | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [bookedResult, setBookedResult] = useState<{ startTime: Date; endTime: Date; name: string } | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const fetchSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true)
    const start = new Date(date); start.setHours(0, 0, 0, 0)
    const end = new Date(date); end.setHours(23, 59, 59, 999)
    try {
      setBookedSlots(await getBookedSlots(start, end))
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  const fetchExisting = useCallback(async () => {
    if (!user) return
    setExistingAppointment(await getUserActiveAppointment(user.uid))
  }, [user])

  useEffect(() => { fetchSlots(selectedDate) }, [selectedDate, fetchSlots])
  useEffect(() => { fetchExisting() }, [fetchExisting])

  async function handleConfirmBooking() {
    if (!user || !selectedSlot) return
    setBookingLoading(true)
    try {
      await createAppointment(user.uid, user.phoneNumber ?? '', userName, selectedSlot)
      setBookedResult({ startTime: selectedSlot, endTime: addHours(selectedSlot, 1), name: userName })
      setConfirmOpen(false)
      await Promise.all([fetchExisting(), fetchSlots(selectedDate)])
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'EXISTING_APPOINTMENT') {
        await fetchExisting()
      }
    } finally {
      setBookingLoading(false)
    }
  }

  async function handleCancelExisting() {
    if (!existingAppointment) return
    setCancelLoading(true)
    try {
      await cancelAppointment(existingAppointment.id)
      setExistingAppointment(null)
    } finally {
      setCancelLoading(false)
    }
  }

  if (bookedResult) {
    return (
      <BookingSuccess
        startTime={bookedResult.startTime}
        endTime={bookedResult.endTime}
        name={bookedResult.name}
        onBookAnother={() => setBookedResult(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Existing appointment banner */}
      {existingAppointment && (
        <div className="bg-white rounded-3xl shadow-sm border border-amber-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-xl shrink-0">
              📅
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#1d1d1f] text-sm">יש לך תור קרוב</p>
              <p className="text-[#6e6e73] text-sm mt-0.5" dir="ltr">
                {format(
                  (existingAppointment.startTime as Timestamp).toDate(),
                  'EEEE, d MMM — HH:mm',
                  { locale: he }
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 -mr-2"
                onClick={handleCancelExisting}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'מבטל…' : 'ביטול התור'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Date picker */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-base font-semibold text-[#1d1d1f]">בחרי תאריך</h2>
        </div>
        <div className="flex justify-center pb-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            disabled={(date) => {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              return date < today
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Time slots */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">
          שעות פנויות
        </h2>
        <p className="text-sm text-[#6e6e73] mb-4">
          {format(selectedDate, 'EEEE, d בMMMM', { locale: he })}
        </p>

        {slotsLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-12 rounded-2xl bg-[#f5f5f7] animate-pulse" />
            ))}
          </div>
        ) : (
          <TimeSlotGrid
            selectedDate={selectedDate}
            bookedSlots={bookedSlots}
            onSelectSlot={(slot) => { setSelectedSlot(slot); setConfirmOpen(true) }}
          />
        )}
      </div>

      {selectedSlot && (
        <BookingConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          slot={selectedSlot}
          hasExistingAppointment={!!existingAppointment}
          loading={bookingLoading}
          onConfirm={handleConfirmBooking}
        />
      )}
    </div>
  )
}
