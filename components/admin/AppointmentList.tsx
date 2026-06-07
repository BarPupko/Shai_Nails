'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { cancelAppointment } from '@/lib/firebase/appointments'
import { downloadBulkICS, generateGoogleCalendarURL } from '@/lib/calendarExport'
import type { Appointment } from '@/types'

interface AppointmentListProps {
  appointments: Appointment[]
  onRefresh: () => void
}

export function AppointmentList({ appointments, onRefresh }: AppointmentListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const upcoming = appointments.filter(
    (a) => a.status === 'active' && (a.startTime as Timestamp).toDate() >= new Date()
  )

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      await cancelAppointment(id)
      onRefresh()
    } finally {
      setCancellingId(null)
    }
  }

  function handleExportApple() {
    const events = upcoming.map((a) => ({
      startTime: (a.startTime as Timestamp).toDate(),
      endTime: (a.endTime as Timestamp).toDate(),
      name: a.name || a.phoneNumber,
    }))
    downloadBulkICS(events)
  }

  if (upcoming.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] py-16 text-center">
        <p className="text-5xl mb-4">📭</p>
        <p className="font-semibold text-[#1d1d1f]">אין תורים קרובים</p>
        <p className="text-sm text-[#6e6e73] mt-1">כשיהיו תורים הם יופיעו כאן</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk export */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 rounded-xl border-[#e5e5e5] gap-1.5 text-xs font-medium"
          onClick={handleExportApple}
        >
          🍎 ייצוא ל-Apple Calendar
        </Button>
        <Button
          size="sm"
          className="flex-1 h-10 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] gap-1.5 text-xs font-medium"
          onClick={() => {
            upcoming.forEach((a, i) => {
              setTimeout(() => {
                window.open(
                  generateGoogleCalendarURL(
                    (a.startTime as Timestamp).toDate(),
                    (a.endTime as Timestamp).toDate()
                  ),
                  '_blank'
                )
              }, i * 300)
            })
          }}
        >
          📅 הוסף ל-Google Calendar
        </Button>
      </div>

      <p className="text-xs text-[#6e6e73] px-1">{upcoming.length} תורים קרובים</p>

      {/* Appointment cards */}
      {upcoming.map((appt) => {
        const start = (appt.startTime as Timestamp).toDate()
        const end = (appt.endTime as Timestamp).toDate()
        return (
          <div key={appt.id} className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
            <div className="flex items-center gap-4">
              {/* Date badge */}
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-rose-50 flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-rose-400 uppercase leading-none">
                  {format(start, 'MMM', { locale: he })}
                </span>
                <span className="text-2xl font-bold text-rose-600 leading-tight">
                  {format(start, 'd')}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1d1d1f]">{appt.name || '—'}</p>
                <p className="text-[#6e6e73] text-sm">{format(start, 'EEEE', { locale: he })}</p>
                <p className="text-[#6e6e73] text-sm" dir="ltr">
                  {format(start, 'HH:mm')} — {format(end, 'HH:mm')}
                </p>
                <a
                  href={`tel:${appt.phoneNumber}`}
                  className="text-rose-400 text-xs font-mono hover:text-rose-600 transition-colors"
                  dir="ltr"
                >
                  {appt.phoneNumber}
                </a>
              </div>

              {/* Cancel */}
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-9 text-xs rounded-xl border-red-100 text-red-500 hover:bg-red-50"
                onClick={() => handleCancel(appt.id)}
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
