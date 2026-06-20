'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isBefore, startOfDay, addMonths } from 'date-fns'
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
import {
  getWeeklySchedule,
  getBlockedDatesForRange,
  getEffectiveHours,
} from '@/lib/firebase/availability'
import { useAuthStore } from '@/lib/store/authStore'
import { OWNER_PHONE } from '@/lib/constants'
import type { Appointment, Service, WeeklySchedule, BlockedDate } from '@/types'

interface BookingCalendarProps {
  userName: string
  service: Service
}

export function BookingCalendar({ userName, service }: BookingCalendarProps) {
  const user = useAuthStore((s) => s.user)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [bookedRanges, setBookedRanges] = useState<{ start: Date; end: Date }[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)
  const [existingAppointment, setExistingAppointment] = useState<Appointment | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [bookedResult, setBookedResult] = useState<{
    startTime: Date; endTime: Date; name: string
    serviceName: string; servicePrice: number | null; servicePriceNote: string
  } | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [availLoading, setAvailLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    Promise.all([
      getWeeklySchedule(),
      getBlockedDatesForRange(today, addMonths(today, 6)),
    ]).then(([schedule, blocked]) => {
      setWeeklySchedule(schedule)
      setBlockedDates(blocked)
      setAvailLoading(false)
    })
  }, [])

  const fetchSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true)
    const start = new Date(date); start.setHours(0, 0, 0, 0)
    const end = new Date(date); end.setHours(23, 59, 59, 999)
    try {
      setBookedRanges(await getBookedSlots(start, end))
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
      await createAppointment(user.uid, user.phoneNumber ?? '', userName, selectedSlot, {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
      })
      const endTime = new Date(selectedSlot.getTime() + service.durationMinutes * 60 * 1000)
      setBookedResult({
        startTime: selectedSlot,
        endTime,
        name: userName,
        serviceName: service.name,
        servicePrice: service.price,
        servicePriceNote: service.priceNote,
      })
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
        serviceName={bookedResult.serviceName}
        servicePrice={bookedResult.servicePrice}
        servicePriceNote={bookedResult.servicePriceNote}
        onBookAnother={() => setBookedResult(null)}
      />
    )
  }

  const effectiveHours =
    !availLoading && weeklySchedule
      ? getEffectiveHours(selectedDate, weeklySchedule, blockedDates)
      : undefined

  const isWithin24h = !!existingAppointment &&
    (existingAppointment.startTime as Timestamp).toDate().getTime() - Date.now() < 24 * 60 * 60 * 1000

  function isDateDisabled(date: Date): boolean {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return true
    if (weeklySchedule) {
      return getEffectiveHours(date, weeklySchedule, blockedDates) === null
    }
    return false
  }

  return (
    <div className="space-y-4">
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
              {existingAppointment.serviceName && (
                <p className="text-[#6e6e73] text-xs mt-0.5">{existingAppointment.serviceName}</p>
              )}
              {isWithin24h ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs font-medium text-rose-600">
                    לא ניתן לבטל תוך 24 שעות מהתור
                  </p>
                  <a
                    href={`tel:${OWNER_PHONE}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    📞 לביטול, צרי קשר עם שי: {OWNER_PHONE}
                  </a>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 -mr-2"
                  onClick={handleCancelExisting}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? 'מבטל…' : 'ביטול התור'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-base font-semibold text-[#1d1d1f]">בחרי תאריך</h2>
        </div>
        <div className="flex justify-center pb-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            disabled={isDateDisabled}
            className="w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">שעות פנויות</h2>
        <p className="text-sm text-[#6e6e73] mb-4">
          {format(selectedDate, 'EEEE, d בMMMM', { locale: he })}
        </p>

        {availLoading || slotsLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-12 rounded-2xl bg-[#f5f5f7] animate-pulse" />
            ))}
          </div>
        ) : (
          <TimeSlotGrid
            selectedDate={selectedDate}
            bookedRanges={bookedRanges}
            effectiveHours={effectiveHours ?? null}
            serviceMinutes={service.durationMinutes}
            onSelectSlot={(slot) => { setSelectedSlot(slot); setConfirmOpen(true) }}
          />
        )}
      </div>

      {selectedSlot && (
        <BookingConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          slot={selectedSlot}
          service={service}
          hasExistingAppointment={!!existingAppointment}
          loading={bookingLoading}
          onConfirm={handleConfirmBooking}
        />
      )}
    </div>
  )
}
