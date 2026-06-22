import { useState, useEffect, useCallback } from 'react'
import { format, addMonths } from 'date-fns'
import { he } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { TimeSlotGrid } from '@/components/booking/TimeSlotGrid'
import { getServices } from '@/lib/firebase/services'
import { getBookedSlots, adminCreateAppointment } from '@/lib/firebase/appointments'
import {
  getWeeklySchedule,
  getBlockedDatesForRange,
  getEffectiveHours,
} from '@/lib/firebase/availability'
import type { Service, WeeklySchedule, BlockedDate } from '@/types'

interface AddAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AddAppointmentDialog({ open, onOpenChange, onCreated }: AddAppointmentDialogProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [bookedRanges, setBookedRanges] = useState<{ start: Date; end: Date }[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [availLoading, setAvailLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setAvailLoading(true)
    const today = new Date()
    Promise.all([
      getServices(),
      getWeeklySchedule(),
      getBlockedDatesForRange(today, addMonths(today, 6)),
    ]).then(([svcs, schedule, blocked]) => {
      setServices(svcs.filter((s) => s.isActive))
      setWeeklySchedule(schedule)
      setBlockedDates(blocked)
      setAvailLoading(false)
    })
  }, [open])

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

  useEffect(() => {
    if (open) fetchSlots(selectedDate)
  }, [selectedDate, open, fetchSlots])

  function handleDateSelect(date: Date) {
    setSelectedDate(date)
    setSelectedSlot(null)
  }

  function isDateDisabled(date: Date): boolean {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (date < today) return false // admin can book past dates
    if (weeklySchedule) return getEffectiveHours(date, weeklySchedule, blockedDates) === null
    return false
  }

  function handleClose() {
    setName('')
    setPhone('')
    setSelectedServiceId('')
    setSelectedDate(new Date())
    setSelectedSlot(null)
    setError('')
    onOpenChange(false)
  }

  async function handleSubmit() {
    if (!name.trim() || !phone.trim() || !selectedServiceId || !selectedSlot) return
    const service = services.find((s) => s.id === selectedServiceId)
    if (!service) return
    setSubmitting(true)
    setError('')
    try {
      await adminCreateAppointment(phone.trim(), name.trim(), selectedSlot, {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
      })
      onCreated()
      handleClose()
    } catch {
      setError('שגיאה ביצירת התור. נסי שנית.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null

  const effectiveHours =
    !availLoading && weeklySchedule
      ? getEffectiveHours(selectedDate, weeklySchedule, blockedDates)
      : undefined

  const canSubmit = name.trim() && phone.trim() && selectedServiceId && selectedSlot && !submitting

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        dir="rtl"
        className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border-[#f0f0f0]"
      >
        <DialogHeader>
          <DialogTitle className="text-right text-[#1d1d1f]">הוספת תור ידנית</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Customer info */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#6e6e73] mb-1.5">שם הלקוחה</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם מלא"
                className="w-full h-11 px-4 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#1d1d1f] placeholder-[#c7c7cc] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6e6e73] mb-1.5">מספר טלפון</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                dir="ltr"
                className="w-full h-11 px-4 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#1d1d1f] placeholder-[#c7c7cc] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Service selector */}
          <div>
            <label className="block text-xs font-semibold text-[#6e6e73] mb-1.5">שירות</label>
            {availLoading ? (
              <div className="h-11 rounded-2xl bg-[#f5f5f7] animate-pulse" />
            ) : (
              <select
                value={selectedServiceId}
                onChange={(e) => { setSelectedServiceId(e.target.value); setSelectedSlot(null) }}
                className="w-full h-11 px-4 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#1d1d1f] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 appearance-none"
              >
                <option value="">בחרי שירות…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.durationMinutes} דק׳{s.price ? ` — ₪${s.price}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date + time — only show after service is selected */}
          {selectedServiceId && (
            <>
              <div className="bg-[#f9f9fb] rounded-2xl overflow-hidden border border-[#f0f0f0]">
                <p className="text-xs font-semibold text-[#6e6e73] px-4 pt-3 pb-1">תאריך</p>
                <div className="flex justify-center pb-3">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && handleDateSelect(d)}
                    disabled={isDateDisabled}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#6e6e73] mb-2">
                  שעות — {format(selectedDate, 'EEEE, d בMMMM', { locale: he })}
                </p>
                {availLoading || slotsLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-11 rounded-2xl bg-[#f5f5f7] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <TimeSlotGrid
                    selectedDate={selectedDate}
                    bookedRanges={bookedRanges}
                    effectiveHours={effectiveHours ?? null}
                    serviceMinutes={selectedService?.durationMinutes ?? 60}
                    onSelectSlot={(slot) => setSelectedSlot(slot)}
                  />
                )}
                {selectedSlot && (
                  <p className="mt-3 text-sm font-semibold text-blue-700 text-center">
                    נבחר: {format(selectedSlot, 'HH:mm', { locale: he })}
                  </p>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-rose-600 text-center">{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-12 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm"
          >
            {submitting ? 'שומר…' : 'הוסף תור'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
