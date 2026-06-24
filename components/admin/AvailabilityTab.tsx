'use client'

import { useState, useEffect } from 'react'
import { format, isBefore, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  getWeeklySchedule,
  saveWeeklySchedule,
  getAllBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from '@/lib/firebase/availability'
import { rescheduleAppointment } from '@/lib/firebase/appointments'
import { BUSINESS_HOURS } from '@/lib/constants'
import { Timestamp } from 'firebase/firestore'
import type { WeeklySchedule, BlockedDate, Appointment } from '@/types'

const DAY_NAMES: Record<string, string> = {
  '0': 'ראשון',
  '1': 'שני',
  '2': 'שלישי',
  '3': 'רביעי',
  '4': 'חמישי',
  '5': 'שישי',
  '6': 'שבת',
}

// 7:00 – 22:00 in 15-minute steps: [7, 7.25, 7.5, 7.75, 8, ...]
const HOURS = Array.from({ length: 61 }, (_, i) => (7 * 60 + i * 15) / 60)

function formatHour(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `972${digits.slice(1)}`
  return digits
}

interface AvailabilityTabProps {
  appointments: Appointment[]
}

export function AvailabilityTab({ appointments }: AvailabilityTabProps) {
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedLoading, setBlockedLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [overrideType, setOverrideType] = useState<'closed' | 'custom_hours'>('closed')
  const [overrideStart, setOverrideStart] = useState(String(BUSINESS_HOURS.start))
  const [overrideEnd, setOverrideEnd] = useState('13')
  const [overrideReason, setOverrideReason] = useState('')
  const [addingOverride, setAddingOverride] = useState(false)
  const [removingDate, setRemovingDate] = useState<string | null>(null)

  const [rescheduledIds, setRescheduledIds] = useState<Set<string>>(new Set())
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>()
  const [rescheduleHour, setRescheduleHour] = useState('9')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleSuccess, setRescheduleSuccess] = useState<Date | null>(null)

  useEffect(() => {
    getWeeklySchedule().then((s) => { setSchedule(s); setScheduleLoading(false) })
    getAllBlockedDates().then((d) => { setBlockedDates(d); setBlockedLoading(false) })
  }, [])

  async function handleSaveSchedule() {
    if (!schedule) return
    const now = new Date()
    const affected = appointments.filter((a) => {
      if (a.status !== 'active') return false
      const date = (a.startTime as Timestamp).toDate()
      if (date <= now) return false
      const dayKey = date.getDay().toString()
      const day = schedule.days[dayKey]
      if (!day || !day.open) return true
      const h = date.getHours() + date.getMinutes() / 60
      return h < (day.start ?? BUSINESS_HOURS.start) || h >= (day.end ?? BUSINESS_HOURS.end)
    })
    if (affected.length > 0) {
      const ok = window.confirm(
        `שמירה תשפיע על ${affected.length} תורים פעילים שחורגים מהשעות החדשות. להמשיך?`
      )
      if (!ok) return
    }
    setScheduleSaving(true)
    try {
      await saveWeeklySchedule(schedule)
      setScheduleSaved(true)
      setTimeout(() => setScheduleSaved(false), 2500)
    } catch (err) {
      console.error('save schedule failed', err)
      alert('שגיאה בשמירת הלוח — בדוק הרשאות Firestore')
    } finally {
      setScheduleSaving(false)
    }
  }

  function updateDay(dayKey: string, changes: Partial<WeeklySchedule['days'][string]>) {
    if (!schedule) return
    setSchedule({
      days: { ...schedule.days, [dayKey]: { ...schedule.days[dayKey], ...changes } },
    })
  }

  async function handleAddOverride() {
    if (!selectedDate) return
    setAddingOverride(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      await addBlockedDate({
        date: dateStr,
        type: overrideType,
        ...(overrideType === 'custom_hours'
          ? { start: parseFloat(overrideStart), end: parseFloat(overrideEnd) }
          : {}),
        ...(overrideReason.trim() ? { reason: overrideReason.trim() } : {}),
      })
      setBlockedDates(await getAllBlockedDates())
      setSelectedDate(undefined)
      setOverrideReason('')
    } catch (err) {
      console.error('add blocked date failed', err)
      alert('שגיאה בהוספת החסימה — בדוק הרשאות Firestore')
    } finally {
      setAddingOverride(false)
    }
  }

  async function handleRemoveOverride(date: string) {
    setRemovingDate(date)
    try {
      await removeBlockedDate(date)
      setBlockedDates((prev) => prev.filter((b) => b.date !== date))
    } catch (err) {
      console.error('remove blocked date failed', err)
      alert('שגיאה בהסרת החסימה — בדוק הרשאות Firestore')
    } finally {
      setRemovingDate(null)
    }
  }

  async function handleReschedule() {
    if (!reschedulingAppt || !rescheduleDate) return
    setRescheduleLoading(true)
    try {
      const h = parseFloat(rescheduleHour)
      const hrs = Math.floor(h)
      const mins = Math.round((h - hrs) * 60)
      const newStart = new Date(rescheduleDate)
      newStart.setHours(hrs, mins, 0, 0)
      await rescheduleAppointment(reschedulingAppt.id, newStart, reschedulingAppt.durationMinutes ?? 60)
      setRescheduledIds((prev) => new Set([...prev, reschedulingAppt.id]))
      setRescheduleSuccess(newStart)
    } catch (err) {
      console.error('reschedule failed', err)
      alert('שגיאה בשינוי התור — בדוק הרשאות Firestore')
    } finally {
      setRescheduleLoading(false)
    }
  }

  function handleCloseReschedule() {
    setReschedulingAppt(null)
    setRescheduleDate(undefined)
    setRescheduleHour('9')
    setRescheduleSuccess(null)
  }

  const today = startOfDay(new Date())

  const appointmentDateSet = new Set(
    appointments
      .filter((a) => a.status === 'active' && !rescheduledIds.has(a.id))
      .filter((a) => (a.startTime as Timestamp).toDate() > new Date())
      .map((a) => format((a.startTime as Timestamp).toDate(), 'yyyy-MM-dd'))
  )

  const selectedDateAffected = selectedDate
    ? appointments.filter((a) => {
        if (a.status !== 'active') return false
        if (rescheduledIds.has(a.id)) return false
        const d = (a.startTime as Timestamp).toDate()
        return d > new Date() && format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
      })
    : []
  const upcomingBlocked = blockedDates.filter(
    (b) => !isBefore(startOfDay(new Date(b.date + 'T00:00:00')), today)
  )

  return (
    <div className="space-y-5">
      {/* ─── Weekly schedule ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">לוח שבועי</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">ימים ושעות עבודה קבועים</p>
          </div>
          <Button
            size="sm"
            className={[
              'h-9 rounded-xl text-xs transition-all',
              scheduleSaved
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-blue-600 hover:bg-blue-700',
            ].join(' ')}
            onClick={handleSaveSchedule}
            disabled={scheduleSaving || !schedule}
          >
            {scheduleSaved ? '✓ נשמר' : scheduleSaving ? 'שומר…' : 'שמור'}
          </Button>
        </div>

        {scheduleLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-[#f5f5f7] animate-pulse" />
            ))}
          </div>
        ) : schedule ? (
          <div className="space-y-3">
            {Object.entries(DAY_NAMES).map(([dayKey, dayName]) => {
              const day = schedule.days[dayKey] ?? { open: false }
              const closedAffected = !day.open
                ? appointments.filter((a) => {
                    if (a.status !== 'active') return false
                    const d = (a.startTime as Timestamp).toDate()
                    return d > new Date() && d.getDay() === parseInt(dayKey)
                  }).length
                : 0
              return (
                <div key={dayKey} className="flex items-center gap-3 min-h-[36px]">
                  <span className="w-14 text-sm font-medium text-[#1d1d1f] shrink-0">
                    {dayName}
                  </span>
                  <Switch
                    checked={!!day.open}
                    onCheckedChange={(open) => updateDay(dayKey, { open })}
                  />
                  {day.open ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Select
                        value={String(day.start ?? BUSINESS_HOURS.start)}
                        onValueChange={(v) => updateDay(dayKey, { start: parseFloat(v) })}
                      >
                        <SelectTrigger className="h-8 w-[72px] text-xs rounded-xl border-[#e5e5e5]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {formatHour(h)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-[#6e6e73]">עד</span>
                      <Select
                        value={String(day.end ?? BUSINESS_HOURS.end)}
                        onValueChange={(v) => updateDay(dayKey, { end: parseFloat(v) })}
                      >
                        <SelectTrigger className="h-8 w-[72px] text-xs rounded-xl border-[#e5e5e5]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {formatHour(h)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#c7c7cc]">סגור</span>
                      {closedAffected > 0 && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg">
                          ⚠️ {closedAffected} תורים פעילים
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* ─── Date override ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">חסימת תאריך</h2>
        <p className="text-xs text-[#6e6e73] mb-4">סגירת יום מסוים או הגבלת שעות עבודה</p>

        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => isBefore(startOfDay(date), today)}
            className="w-full"
            modifiers={{ hasAppointment: (date) => appointmentDateSet.has(format(date, 'yyyy-MM-dd')) }}
            modifiersClassNames={{ hasAppointment: 'day-has-appointment' }}
          />
        </div>

        {selectedDate ? (
          <div className="space-y-3 mt-4 pt-4 border-t border-[#f5f5f7]">
            <p className="text-sm font-semibold text-[#1d1d1f]">
              {format(selectedDate, 'EEEE, d בMMMM', { locale: he })}
            </p>

            {selectedDateAffected.length > 0 && (
              <div className="rounded-2xl border border-amber-100 overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-amber-800">
                    ⚠️ {selectedDateAffected.length} תורים פעילים — ניתן לפנות ללקוחות לשינוי מועד
                  </p>
                </div>
                <div className="bg-white divide-y divide-[#f5f5f7]">
                  {selectedDateAffected.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-[#1d1d1f]">
                            {format((a.startTime as Timestamp).toDate(), 'HH:mm')}
                          </span>
                          {a.serviceName && (
                            <span className="text-xs text-[#6e6e73]">· {a.serviceName}</span>
                          )}
                        </div>
                        <p className="text-sm text-[#1d1d1f]">{a.name}</p>
                        <p className="text-xs text-[#6e6e73] mt-0.5">{a.phoneNumber}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReschedulingAppt(a)
                            setRescheduleDate(undefined)
                            setRescheduleHour('9')
                            setRescheduleSuccess(null)
                          }}
                          className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
                        >
                          📅 שנה תאריך
                        </button>
                        <a
                          href={`https://wa.me/${formatWhatsAppNumber(a.phoneNumber)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-[#1fb956] transition-colors"
                        >
                          💬 WhatsApp
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOverrideType('closed')}
                className={[
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
                  overrideType === 'closed'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#ebebed]',
                ].join(' ')}
              >
                🔴 סגור לחלוטין
              </button>
              <button
                type="button"
                onClick={() => setOverrideType('custom_hours')}
                className={[
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
                  overrideType === 'custom_hours'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#ebebed]',
                ].join(' ')}
              >
                🕐 שעות מותאמות
              </button>
            </div>

            {overrideType === 'custom_hours' && (
              <div className="flex items-center gap-2">
                <Select value={overrideStart} onValueChange={setOverrideStart}>
                  <SelectTrigger className="h-9 flex-1 text-sm rounded-xl border-[#e5e5e5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-[#6e6e73] shrink-0">עד</span>
                <Select value={overrideEnd} onValueChange={setOverrideEnd}>
                  <SelectTrigger className="h-9 flex-1 text-sm rounded-xl border-[#e5e5e5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Input
              placeholder="סיבה (לא חובה) — חופשה, חג, אירוע…"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="h-9 rounded-xl border-[#e5e5e5] text-sm placeholder:text-[#c7c7cc]"
            />

            <Button
              className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-semibold"
              onClick={handleAddOverride}
              disabled={addingOverride}
            >
              {addingOverride ? 'שומר…' : 'הוסף חסימה'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-center text-[#c7c7cc] mt-3 pb-1">
            בחר תאריך בלוח למעלה
          </p>
        )}
      </div>

      {/* ─── Upcoming blocks ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-4">חסימות מתוכננות</h2>

        {blockedLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />
            ))}
          </div>
        ) : upcomingBlocked.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm text-[#c7c7cc]">אין חסימות מתוכננות</p>
          </div>
        ) : (
          <div className="space-y-1">
            {upcomingBlocked.map((b) => {
              const d = new Date(b.date + 'T00:00:00')
              return (
                <div
                  key={b.date}
                  className="flex items-center gap-3 py-3 border-b border-[#f5f5f7] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1d1d1f]">
                      {format(d, 'EEEE, d בMMMM', { locale: he })}
                    </p>
                    <p className="text-xs text-[#6e6e73] mt-0.5">
                      {b.type === 'closed'
                        ? '🔴 סגור לחלוטין'
                        : `🟡 שעות: ${b.start != null ? formatHour(b.start) : '?'} – ${b.end != null ? formatHour(b.end) : '?'}`}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl text-[#c7c7cc] hover:text-red-500 hover:bg-red-50 shrink-0"
                    onClick={() => handleRemoveOverride(b.date)}
                    disabled={removingDate === b.date}
                  >
                    {removingDate === b.date ? '…' : '✕'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={!!reschedulingAppt} onOpenChange={(open) => { if (!open) handleCloseReschedule() }}>
        <DialogContent dir="rtl" className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">
              שינוי תור — {reschedulingAppt?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">בחר תאריך ושעה חדשים לתור</DialogDescription>
          </DialogHeader>

          {rescheduleSuccess ? (
            <div className="space-y-3 pb-1">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="font-semibold text-emerald-800 text-sm">התור שונה בהצלחה!</p>
                <p className="text-sm text-emerald-700 mt-1">
                  {format(rescheduleSuccess, 'EEEE, d בMMMM', { locale: he })} · {format(rescheduleSuccess, 'HH:mm')}
                </p>
              </div>
              <a
                href={`https://wa.me/${formatWhatsAppNumber(reschedulingAppt?.phoneNumber ?? '')}?text=${encodeURIComponent(
                  `שלום ${reschedulingAppt?.name}, התור שלך${reschedulingAppt?.serviceName ? ` עבור ${reschedulingAppt.serviceName}` : ''} שונה ל${format(rescheduleSuccess, 'EEEE d בMMMM', { locale: he })} בשעה ${format(rescheduleSuccess, 'HH:mm')}. מחכים לך 💅`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-11 bg-[#25D366] hover:bg-[#1fb956] text-white font-semibold rounded-2xl transition-colors text-sm"
              >
                💬 שלח הודעת וואטסאפ
              </a>
              <Button variant="outline" className="w-full rounded-2xl" onClick={handleCloseReschedule}>
                סגור
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pb-1">
              <div>
                <p className="text-xs text-[#6e6e73] mb-2 text-right">בחרי תאריך חדש</p>
                <div className="border border-[#f0f0f0] rounded-2xl overflow-hidden">
                  <Calendar
                    mode="single"
                    selected={rescheduleDate}
                    onSelect={setRescheduleDate}
                    disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6e6e73] mb-2 text-right">בחרי שעה</p>
                <Select value={rescheduleHour} onValueChange={setRescheduleHour}>
                  <SelectTrigger className="h-10 rounded-xl border-[#e5e5e5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-semibold"
                onClick={handleReschedule}
                disabled={!rescheduleDate || rescheduleLoading}
              >
                {rescheduleLoading ? 'שומר…' : 'שמור שינוי'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
