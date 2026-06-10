'use client'

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getServices, formatDuration } from '@/lib/firebase/services'
import { getGalleryItems } from '@/lib/firebase/gallery'
import type { Service, GalleryItem } from '@/types'

interface ServiceSelectorProps {
  onSelect: (service: Service) => void
}

export function ServiceSelector({ onSelect }: ServiceSelectorProps) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [peek, setPeek] = useState<GalleryItem | null>(null)

  useEffect(() => {
    getServices()
      .then((s) => {
        setServices(s.filter((svc) => svc.isActive))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    getGalleryItems()
      .then((items) => setGalleryItems(items.slice(0, 6)))
      .catch(() => {})
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
      {galleryItems.length > 0 && (
        <div className="pb-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">✨ הציצי בעבודות שלנו</h2>
            <Link
              to="/gallery"
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
            >
              לכל הגלריה ←
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {galleryItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeek(item)}
                className="shrink-0 w-24 h-28 rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all relative"
              >
                <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5">
                  <span className="text-white text-[10px] font-semibold block text-right leading-tight">
                    {item.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {peek && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70"
          onClick={() => setPeek(null)}
        >
          <div
            className="relative max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={peek.url}
              alt={peek.label}
              className="w-full rounded-3xl shadow-2xl object-cover max-h-[70vh]"
            />
            <p className="text-center text-white font-semibold mt-3 text-base">{peek.label}</p>
            <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
              {peek.instagramUrl && (
                <a
                  href={peek.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-pink-300 hover:text-pink-200 transition-colors"
                >
                  📸 אינסטגרם
                </a>
              )}
              <Link
                to="/gallery"
                className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
                onClick={() => setPeek(null)}
              >
                לכל הגלריה ←
              </Link>
              <button
                type="button"
                onClick={() => setPeek(null)}
                className="bg-white/15 hover:bg-white/25 text-white text-sm px-6 py-2 rounded-full transition-colors"
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      )}

      {services.map((svc) => (
        <button
          key={svc.id}
          type="button"
          onClick={() => onSelect(svc)}
          className="w-full bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5 text-right hover:border-sky-200 hover:shadow-sky-50 hover:shadow-md active:scale-[0.99] transition-all"
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
                <p className="text-xl font-bold text-blue-700">₪{svc.price}</p>
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
