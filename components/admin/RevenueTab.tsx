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

function apptPrice(a: Appointment): number {
  return a.price != null ? a.price : SERVICE_PRICE_NIS
}

export function RevenueTab({ appointments }: RevenueTabProps) {
  const { earned, upcoming, byMonth } = useMemo(() => {
    const cutoff = new Date()
    const active = appointments.filter((a) => a.status === 'active')
    const past = active.filter((a) => (a.startTime as Timestamp).toDate() < cutoff)
    const future = active.filter((a) => (a.startTime as Timestamp).toDate() >= cutoff)

    const earned = past.reduce((sum, a) => sum + apptPrice(a), 0)
    const upcoming = future.reduce((sum, a) => sum + apptPrice(a), 0)

    // Group past by month
    const monthMap: Record<string, { count: number; income: number }> = {}
    for (const appt of past) {
      const key = format((appt.startTime as Timestamp).toDate(), 'yyyy-MM')
      if (!monthMap[key]) monthMap[key] = { count: 0, income: 0 }
      monthMap[key].count++
      monthMap[key].income += apptPrice(appt)
    }

    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        key,
        label: format(new Date(key + '-01'), 'MMM yy', { locale: he }),
        labelFull: format(new Date(key + '-01'), 'MMMM yyyy', { locale: he }),
        ...val,
      }))

    return { earned, upcoming, byMonth }
  }, [appointments])

  const total = earned + upcoming
  const maxIncome = Math.max(...byMonth.map((m) => m.income), 1)

  return (
    <div className="space-y-4" dir="rtl">
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
      </div>

      {/* Bar chart */}
      {byMonth.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-5">הכנסות לפי חודש</p>

          <div className="flex items-end gap-2 h-32 mb-2">
            {byMonth.map((m) => {
              const pct = Math.max(6, Math.round((m.income / maxIncome) * 100))
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
                  <span className="text-[9px] font-semibold text-emerald-600 leading-none text-center">
                    ₪{m.income}
                  </span>
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-blue-700 to-sky-400 transition-all duration-500 h-[var(--bar-h)]"
                    // eslint-disable-next-line react/forbid-component-props
                    style={{ '--bar-h': `${pct}%` } as React.CSSProperties}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex gap-2">
            {byMonth.map((m) => (
              <div key={m.key} className="flex-1 text-center min-w-0">
                <span className="text-[9px] text-[#6e6e73] block truncate">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly text breakdown — most recent first */}
      {byMonth.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-4">פירוט חודשי</p>
          <div className="space-y-3">
            {[...byMonth].reverse().map((m) => (
              <div key={m.key} className="flex items-center justify-between">
                <span className="text-sm text-[#1d1d1f]">{m.labelFull}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6e6e73]">{m.count} תורים</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    ₪{m.income.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
