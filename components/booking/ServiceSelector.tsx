'use client'

import { useState, useEffect } from 'react'
import { getServices, formatDuration } from '@/lib/firebase/services'
import type { Service } from '@/types'

interface ServiceSelectorProps {
  onSelect: (service: Service) => void
}

export function ServiceSelector({ onSelect }: ServiceSelectorProps) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getServices()
      .then((s) => {
        setServices(s.filter((svc) => svc.isActive))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-3xl bg-white animate-pulse shadow-sm" />
        ))}
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] py-16 text-center px-6">
        <p className="text-4xl mb-3">💅</p>
        <p className="font-semibold text-[#1d1d1f]">השירותים יתווספו בקרוב</p>
        <p className="text-sm text-[#6e6e73] mt-2">אנא נסי שוב מאוחר יותר</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {services.map((svc) => (
        <button
          key={svc.id}
          type="button"
          onClick={() => onSelect(svc)}
          className="w-full bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5 text-right hover:border-rose-200 hover:shadow-rose-50 hover:shadow-md active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1d1d1f] text-base leading-tight">{svc.name}</p>
              <p className="text-sm text-[#6e6e73] mt-0.5">
                ⏱ עד {formatDuration(svc.durationMinutes)}
              </p>
            </div>
            <div className="shrink-0 text-left">
              {svc.price != null ? (
                <p className="text-xl font-bold text-rose-600">₪{svc.price}</p>
              ) : (
                <p className="text-xs text-[#6e6e73] max-w-[80px] text-center leading-snug">
                  {svc.priceNote}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
