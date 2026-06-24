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

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const MEDALS = ['🥇', '🥈', '🥉']

function Bar({ pct, className }: { pct: number; className: string }) {
  const s = { '--w': `${Math.max(4, pct)}%` } as React.CSSProperties
  // eslint-disable-next-line react/forbid-dom-props
  return <div className={`${className} transition-all duration-700 w-[var(--w)]`} style={s} />
}

export function RevenueTab({ appointments }: RevenueTabProps) {
  const stats = useMemo(() => {
    const cutoff = new Date()
    const active = appointments.filter((a) => a.status === 'active')
    const past = active.filter((a) => (a.startTime as Timestamp).toDate() < cutoff)
    const future = active.filter((a) => (a.startTime as Timestamp).toDate() >= cutoff)

    const earned = past.reduce((sum, a) => sum + apptPrice(a), 0)
    const upcoming = future.reduce((sum, a) => sum + apptPrice(a), 0)
    const avgPrice = past.length > 0 ? Math.round(earned / past.length) : 0

    // Monthly breakdown (all active)
    const monthMap: Record<string, { count: number; income: number }> = {}
    for (const appt of active) {
      const key = format((appt.startTime as Timestamp).toDate(), 'yyyy-MM')
      if (!monthMap[key]) monthMap[key] = { count: 0, income: 0 }
      monthMap[key].count++
      monthMap[key].income += apptPrice(appt)
    }
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        key,
        label: format(new Date(key + '-01'), "MMM 'yy", { locale: he }),
        labelFull: format(new Date(key + '-01'), 'MMMM yyyy', { locale: he }),
        ...val,
      }))
    const bestMonth = byMonth.reduce(
      (best, m) => (m.income > (best?.income ?? 0) ? m : best),
      byMonth[0] ?? null
    )

    // Services (all active appointments)
    const serviceMap: Record<string, { name: string; count: number; income: number }> = {}
    for (const appt of active) {
      const key = appt.serviceId ?? '__none__'
      const name = appt.serviceName ?? 'שירות לא ידוע'
      if (!serviceMap[key]) serviceMap[key] = { name, count: 0, income: 0 }
      serviceMap[key].count++
      serviceMap[key].income += apptPrice(appt)
      if (appt.serviceName) serviceMap[key].name = appt.serviceName
    }
    const byService = Object.values(serviceMap).sort((a, b) => b.count - a.count)

    // Top customers (all active appointments)
    const customerMap: Record<string, { name: string; count: number; income: number }> = {}
    for (const appt of active) {
      if (!customerMap[appt.userId]) {
        customerMap[appt.userId] = {
          name: appt.name || appt.phoneNumber,
          count: 0,
          income: 0,
        }
      }
      customerMap[appt.userId].count++
      customerMap[appt.userId].income += apptPrice(appt)
      if (appt.name) customerMap[appt.userId].name = appt.name
    }
    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Day of week (all active)
    const dayCount: Record<number, number> = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [i, 0])
    )
    for (const appt of active) {
      dayCount[(appt.startTime as Timestamp).toDate().getDay()]++
    }

    return {
      earned,
      upcoming,
      total: earned + upcoming,
      avgPrice,
      pastCount: past.length,
      futureCount: future.length,
      byMonth,
      bestMonth,
      byService,
      topCustomers,
      dayCount,
    }
  }, [appointments])

  const maxMonthIncome = Math.max(...stats.byMonth.map((m) => m.income), 1)
  const maxServiceCount = Math.max(...stats.byService.map((s) => s.count), 1)
  const maxDayCount = Math.max(...Object.values(stats.dayCount), 1)

  return (
    <div className="space-y-4" dir="rtl">

      {/* Top 3 KPI cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#f0f0f0] text-center">
          <p className="text-[10px] text-[#6e6e73] mb-1">התקבל</p>
          <p className="text-xl font-bold text-emerald-600">₪{stats.earned.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#f0f0f0] text-center">
          <p className="text-[10px] text-[#6e6e73] mb-1">צפוי</p>
          <p className="text-xl font-bold text-blue-600">₪{stats.upcoming.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#f0f0f0] text-center">
          <p className="text-[10px] text-[#6e6e73] mb-1">ממוצע לתור</p>
          <p className="text-xl font-bold text-violet-600">₪{stats.avgPrice}</p>
        </div>
      </div>

      {/* Total + quick counters */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0] text-center">
        <p className="text-xs text-[#6e6e73]">סה&quot;כ (כולל צפוי)</p>
        <p className="text-3xl font-bold text-blue-700 mt-0.5">₪{stats.total.toLocaleString()}</p>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#f5f5f7]">
          <div>
            <p className="text-lg font-bold text-[#1d1d1f]">{stats.pastCount}</p>
            <p className="text-[10px] text-[#6e6e73]">הושלמו</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[#1d1d1f]">{stats.futureCount}</p>
            <p className="text-[10px] text-[#6e6e73]">קרובים</p>
          </div>
          <div>
            <p className="text-sm font-bold text-[#1d1d1f] truncate">
              {stats.bestMonth?.label ?? '—'}
            </p>
            <p className="text-[10px] text-[#6e6e73]">חודש מוביל</p>
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      {stats.byMonth.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-5">הכנסות לפי חודש</p>
          <div className="flex items-end gap-1.5 h-28 mb-2">
            {stats.byMonth.map((m) => {
              const pct = Math.round((m.income / maxMonthIncome) * 100)
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
                  <span className="text-[8px] font-semibold text-emerald-600 leading-none w-full text-center truncate">
                    ₪{m.income}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-sky-400 transition-all duration-500 h-[var(--bar-h)]"
                    // eslint-disable-next-line react/forbid-component-props
                    style={{ '--bar-h': `${Math.max(4, pct)}%` } as React.CSSProperties}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex gap-1.5">
            {stats.byMonth.map((m) => (
              <div key={m.key} className="flex-1 text-center min-w-0">
                <span className="text-[8px] text-[#6e6e73] block truncate">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most popular services */}
      {stats.byService.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-4">שירותים מבוקשים</p>
          <div className="space-y-3.5">
            {stats.byService.map((svc, i) => {
              const pct = Math.round((svc.count / maxServiceCount) * 100)
              return (
                <div key={svc.name + i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">
                        {i < 3 ? MEDALS[i] : `${i + 1}.`}
                      </span>
                      <span className="text-sm font-medium text-[#1d1d1f] truncate">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mr-2">
                      <span className="text-xs text-[#6e6e73]">{svc.count} תורים</span>
                      <span className="text-xs font-semibold text-emerald-600">
                        ₪{svc.income.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                    <Bar
                      pct={pct}
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top customers */}
      {stats.topCustomers.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-4">לקוחות מובילות</p>
          <div className="space-y-3">
            {stats.topCustomers.map((c, i) => (
              <div key={c.name + i} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center shrink-0">
                  {i < 3 ? MEDALS[i] : <span className="text-sm text-[#6e6e73]">{i + 1}</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1d1d1f] truncate">{c.name}</p>
                  <p className="text-xs text-[#6e6e73]">{c.count} תורים</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 shrink-0">
                  ₪{c.income.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busiest days of week */}
      {appointments.some((a) => a.status === 'active') && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-4">ימים עמוסים</p>
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const count = stats.dayCount[day] ?? 0
              const pct = Math.round((count / maxDayCount) * 100)
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs text-[#6e6e73] w-12 text-right shrink-0">
                    {DAYS_HE[day]}
                  </span>
                  <div className="flex-1 h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                    <Bar
                      pct={pct}
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-500"
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#1d1d1f] w-4 text-left shrink-0">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Monthly text breakdown — most recent first */}
      {stats.byMonth.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#1d1d1f] mb-4">פירוט חודשי</p>
          <div className="space-y-3">
            {[...stats.byMonth].reverse().map((m) => (
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
