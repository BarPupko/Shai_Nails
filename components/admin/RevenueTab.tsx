'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import { SERVICE_PRICE_NIS } from '@/lib/constants'
import type { Appointment } from '@/types'

interface RevenueTabProps {
  appointments: Appointment[]
}

export function RevenueTab({ appointments }: RevenueTabProps) {
  const { earned, upcoming, byMonth } = useMemo(() => {
    const cutoff = new Date()
    const active = appointments.filter((a) => a.status === 'active')
    const past = active.filter((a) => (a.startTime as Timestamp).toDate() < cutoff)
    const future = active.filter((a) => (a.startTime as Timestamp).toDate() >= cutoff)

    // Group past by month
    const monthMap: Record<string, number> = {}
    for (const appt of past) {
      const key = format((appt.startTime as Timestamp).toDate(), 'MMM yyyy', { locale: he })
      monthMap[key] = (monthMap[key] ?? 0) + 1
    }

    return {
      earned: past.length * SERVICE_PRICE_NIS,
      upcoming: future.length * SERVICE_PRICE_NIS,
      byMonth: Object.entries(monthMap),
    }
  }, [appointments])

  const total = earned + upcoming

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0] text-center">
          <p className="text-xs text-[#6e6e73] mb-1">התקבל</p>
          <p className="text-2xl font-bold text-emerald-600">₪{earned.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0] text-center">
          <p className="text-xs text-[#6e6e73] mb-1">צפוי</p>
          <p className="text-2xl font-bold text-blue-600">₪{upcoming.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0] text-center">
        <p className="text-xs text-[#6e6e73] mb-1">סה&quot;כ (כולל צפוי)</p>
        <p className="text-3xl font-bold text-blue-700">₪{total.toLocaleString()}</p>
        <p className="text-xs text-[#6e6e73] mt-1">מחיר לתור: ₪{SERVICE_PRICE_NIS}</p>
      </div>

      {/* Monthly breakdown */}
      {byMonth.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-4">פירוט חודשי</p>
          <div className="space-y-3">
            {byMonth.map(([month, count]) => (
              <div key={month} className="flex items-center justify-between">
                <span className="text-sm text-[#1d1d1f]">{month}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6e6e73]">{count} תורים</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    ₪{(count * SERVICE_PRICE_NIS).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-center text-[#6e6e73] pb-2">
        לשינוי מחיר לתור הגדר את <code className="bg-[#f5f5f7] px-1 rounded">NEXT_PUBLIC_SERVICE_PRICE</code> ב-.env.local
      </p>
    </div>
  )
}
