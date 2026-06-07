'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import type { Appointment } from '@/types'

interface ClientsTabProps {
  appointments: Appointment[]
}

interface ClientSummary {
  userId: string
  name: string
  phoneNumber: string
  totalBookings: number
  activeBookings: number
  lastDate: Date
}

export function ClientsTab({ appointments }: ClientsTabProps) {
  const clients = useMemo<ClientSummary[]>(() => {
    const map: Record<string, ClientSummary> = {}
    for (const appt of appointments) {
      if (!map[appt.userId]) {
        map[appt.userId] = {
          userId: appt.userId,
          name: appt.name || '—',
          phoneNumber: appt.phoneNumber,
          totalBookings: 0,
          activeBookings: 0,
          lastDate: (appt.startTime as Timestamp).toDate(),
        }
      }
      const c = map[appt.userId]
      c.totalBookings++
      if (appt.status === 'active') c.activeBookings++
      const d = (appt.startTime as Timestamp).toDate()
      if (d > c.lastDate) { c.lastDate = d; c.name = appt.name || c.name }
    }
    return Object.values(map).sort((a, b) => b.totalBookings - a.totalBookings)
  }, [appointments])

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] py-16 text-center">
        <p className="text-5xl mb-4">👥</p>
        <p className="font-semibold text-[#1d1d1f]">אין לקוחות עדיין</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#6e6e73] px-1">{clients.length} לקוחות רשומים</p>
      {clients.map((client) => (
        <div
          key={client.userId}
          className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5"
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-xl shrink-0 font-bold text-rose-400">
              {client.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1d1d1f]">{client.name}</p>
              <p className="text-xs text-[#6e6e73] mt-0.5">
                {client.totalBookings} הזמנות בסה&quot;כ
                {client.activeBookings > 0 && (
                  <span className="text-emerald-500 mr-1">· {client.activeBookings} פעיל</span>
                )}
              </p>
              <p className="text-xs text-[#6e6e73]">
                תור אחרון: {format(client.lastDate, 'd MMM yyyy', { locale: he })}
              </p>
            </div>

            {/* Call button */}
            <a
              href={`tel:${client.phoneNumber}`}
              className="shrink-0 w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"
              title={client.phoneNumber}
            >
              📞
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
