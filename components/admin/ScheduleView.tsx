'use client'

import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isToday,
} from 'date-fns'
import { he } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { cancelAppointment } from '@/lib/firebase/appointments'
import type { Appointment } from '@/types'

type View = 'day' | 'week' | 'month'

interface ScheduleViewProps {
  appointments: Appointment[]
  onRefresh: () => void
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

function appointmentsForDay(appointments: Appointment[], day: Date): Appointment[] {
  return appointments.filter(
    (a) => a.status === 'active' && isSameDay((a.startTime as Timestamp).toDate(), day)
  )
}

export function ScheduleView({ appointments, onRefresh }: ScheduleViewProps) {
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(new Date())
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  function navigate(dir: 1 | -1) {
    if (view === 'day') setCursor((d) => (dir === 1 ? addDays(d, 1) : subDays(d, 1)))
    if (view === 'week') setCursor((d) => (dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)))
    if (view === 'month') setCursor((d) => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)))
  }

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      await cancelAppointment(id)
      onRefresh()
    } finally {
      setCancellingId(null)
    }
  }

  const headerLabel = useMemo(() => {
    if (view === 'day') return format(cursor, 'EEEE, d בMMMM yyyy', { locale: he })
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 0 })
      const end = endOfWeek(cursor, { weekStartsOn: 0 })
      return `${format(start, 'd MMM', { locale: he })} – ${format(end, 'd MMM yyyy', { locale: he })}`
    }
    return format(cursor, 'MMMM yyyy', { locale: he })
  }, [view, cursor])

  return (
    <div className="space-y-4">
      {/* View toggle + nav */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-[#f5f5f7] hover:bg-[#ebebed] flex items-center justify-center text-[#1d1d1f] transition-colors"
          >
            ›
          </button>
          <p className="text-sm font-semibold text-[#1d1d1f] text-center flex-1">{headerLabel}</p>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="w-9 h-9 rounded-xl bg-[#f5f5f7] hover:bg-[#ebebed] flex items-center justify-center text-[#1d1d1f] transition-colors"
          >
            ‹
          </button>
        </div>
        <div className="flex rounded-2xl bg-[#f5f5f7] p-1 gap-1">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                'flex-1 py-2 rounded-xl text-sm font-medium transition-all',
                view === v ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#6e6e73]',
              ].join(' ')}
            >
              {v === 'day' ? 'יום' : v === 'week' ? 'שבוע' : 'חודש'}
            </button>
          ))}
        </div>
      </div>

      {/* Day view */}
      {view === 'day' && <DayView day={cursor} appointments={appointments} cancellingId={cancellingId} onCancel={handleCancel} />}

      {/* Week view */}
      {view === 'week' && (
        <WeekView
          cursor={cursor}
          appointments={appointments}
          onDayClick={(d) => { setCursor(d); setView('day') }}
        />
      )}

      {/* Month view */}
      {view === 'month' && (
        <MonthView
          cursor={cursor}
          appointments={appointments}
          onDayClick={(d) => { setCursor(d); setView('day') }}
        />
      )}
    </div>
  )
}

function DayView({
  day,
  appointments,
  cancellingId,
  onCancel,
}: {
  day: Date
  appointments: Appointment[]
  cancellingId: string | null
  onCancel: (id: string) => void
}) {
  const dayAppts = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'active' && isSameDay((a.startTime as Timestamp).toDate(), day))
        .sort((a, b) => (a.startTime as Timestamp).seconds - (b.startTime as Timestamp).seconds),
    [appointments, day]
  )

  if (dayAppts.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] py-16 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="font-semibold text-[#1d1d1f]">אין תורים ביום זה</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#6e6e73] px-1">{dayAppts.length} תורים</p>
      {dayAppts.map((appt) => {
        const start = (appt.startTime as Timestamp).toDate()
        const end = (appt.endTime as Timestamp).toDate()
        return (
          <div key={appt.id} className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-sky-50 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-blue-700 leading-tight" dir="ltr">
                  {format(start, 'HH:mm')}
                </span>
                <span className="text-[10px] text-sky-300" dir="ltr">
                  {format(end, 'HH:mm')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1d1d1f]">{appt.name || '—'}</p>
                {appt.serviceName && (
                  <p className="text-xs text-blue-600 font-medium">{appt.serviceName}</p>
                )}
                <a
                  href={`tel:${appt.phoneNumber}`}
                  className="text-[#6e6e73] text-xs font-mono hover:text-blue-700 transition-colors"
                  dir="ltr"
                >
                  {appt.phoneNumber}
                </a>
                {appt.price != null ? (
                  <p className="text-xs text-emerald-600 font-semibold">₪{appt.price}</p>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-9 text-xs rounded-xl border-red-100 text-red-500 hover:bg-red-50"
                onClick={() => onCancel(appt.id)}
                disabled={cancellingId === appt.id}
              >
                {cancellingId === appt.id ? '…' : 'ביטול'}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekView({
  cursor,
  appointments,
  onDayClick,
}: {
  cursor: Date
  appointments: Appointment[]
  onDayClick: (d: Date) => void
}) {
  const days = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end: addDays(start, 6) })
  }, [cursor])

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-4">
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-semibold text-[#6e6e73] pb-1">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const count = appointmentsForDay(appointments, day).length
          const today = isToday(day)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              className={[
                'flex flex-col items-center justify-center rounded-2xl p-2 min-h-[64px] transition-all hover:bg-[#f5f5f7] active:scale-95',
                today ? 'bg-sky-50 border border-sky-200' : '',
              ].join(' ')}
            >
              <span className={['text-sm font-bold', today ? 'text-blue-700' : 'text-[#1d1d1f]'].join(' ')}>
                {format(day, 'd')}
              </span>
              {count > 0 ? (
                <span className="mt-1 min-w-[20px] h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                  {count}
                </span>
              ) : (
                <span className="mt-1 h-5" />
              )}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-center text-[#c7c7cc] mt-3">לחץ על יום לפרטים</p>
    </div>
  )
}

function MonthView({
  cursor,
  appointments,
  onDayClick,
}: {
  cursor: Date
  appointments: Appointment[]
  onDayClick: (d: Date) => void
}) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor)
    const monthEnd = endOfMonth(cursor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor])

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-4">
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-semibold text-[#6e6e73] pb-1">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const count = appointmentsForDay(appointments, day).length
          const inMonth = isSameMonth(day, cursor)
          const today = isToday(day)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              className={[
                'flex flex-col items-center justify-center rounded-xl p-1 min-h-[44px] transition-all',
                inMonth ? 'hover:bg-[#f5f5f7]' : 'opacity-30',
                today ? 'bg-sky-50 border border-sky-200' : '',
              ].join(' ')}
            >
              <span className={['text-xs font-semibold', today ? 'text-blue-700' : 'text-[#1d1d1f]'].join(' ')}>
                {format(day, 'd')}
              </span>
              {count > 0 && inMonth ? (
                <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {count}
                </span>
              ) : (
                <span className="mt-0.5 h-4" />
              )}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-center text-[#c7c7cc] mt-3">לחץ על יום לפרטים</p>
    </div>
  )
}
