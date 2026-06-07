'use client'

import { useState, useEffect } from 'react'
import { format, isBefore, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
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
import { BUSINESS_HOURS } from '@/lib/constants'
import type { WeeklySchedule, BlockedDate } from '@/types'

const DAY_NAMES: Record<string, string> = {
  '0': 'ראשון',
  '1': 'שני',
  '2': 'שלישי',
  '3': 'רביעי',
  '4': 'חמישי',
  '5': 'שישי',
  '6': 'שבת',
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7–22

export function AvailabilityTab() {
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

  useEffect(() => {
    getWeeklySchedule().then((s) => { setSchedule(s); setScheduleLoading(false) })
    getAllBlockedDates().then((d) => { setBlockedDates(d); setBlockedLoading(false) })
  }, [])

  async function handleSaveSchedule() {
    if (!schedule) return
    setScheduleSaving(true)
    try {
      await saveWeeklySchedule(schedule)
      setScheduleSaved(true)
      setTimeout(() => setScheduleSaved(false), 2500)
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
          ? { start: parseInt(overrideStart), end: parseInt(overrideEnd) }
          : {}),
        ...(overrideReason.trim() ? { reason: overrideReason.trim() } : {}),
      })
      setBlockedDates(await getAllBlockedDates())
      setSelectedDate(undefined)
      setOverrideReason('')
    } finally {
      setAddingOverride(false)
    }
  }

  async function handleRemoveOverride(date: string) {
    setRemovingDate(date)
    try {
      await removeBlockedDate(date)
      setBlockedDates((prev) => prev.filter((b) => b.date !== date))
    } finally {
      setRemovingDate(null)
    }
  }

  const today = startOfDay(new Date())
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
                : 'bg-rose-500 hover:bg-rose-600',
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
                        onValueChange={(v) => updateDay(dayKey, { start: parseInt(v) })}
                      >
                        <SelectTrigger className="h-8 w-[72px] text-xs rounded-xl border-[#e5e5e5]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-[#6e6e73]">עד</span>
                      <Select
                        value={String(day.end ?? BUSINESS_HOURS.end)}
                        onValueChange={(v) => updateDay(dayKey, { end: parseInt(v) })}
                      >
                        <SelectTrigger className="h-8 w-[72px] text-xs rounded-xl border-[#e5e5e5]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span className="text-xs text-[#c7c7cc]">סגור</span>
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
          />
        </div>

        {selectedDate ? (
          <div className="space-y-3 mt-4 pt-4 border-t border-[#f5f5f7]">
            <p className="text-sm font-semibold text-[#1d1d1f]">
              {format(selectedDate, 'EEEE, d בMMMM', { locale: he })}
            </p>

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
                        {String(h).padStart(2, '0')}:00
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
                        {String(h).padStart(2, '0')}:00
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
              className="w-full h-11 rounded-2xl bg-rose-500 hover:bg-rose-600 font-semibold"
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
                        : `🟡 שעות: ${String(b.start).padStart(2, '0')}:00 – ${String(b.end).padStart(2, '0')}:00`}
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
    </div>
  )
}
