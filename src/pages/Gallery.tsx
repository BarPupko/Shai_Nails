import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getGalleryItems } from '@/lib/firebase/gallery'
import type { GalleryItem, GalleryCategory } from '@/types'

const CAT_LABELS: Record<string, string> = {
  all: 'הכל',
  gel: "ג'ל",
  classic: 'קלאסי',
  art: 'עיטורים',
  acrylic: 'אקריל',
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<'all' | GalleryCategory>('all')
  const [zoom, setZoom] = useState<GalleryItem | null>(null)

  useEffect(() => {
    getGalleryItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = cat === 'all' ? items : items.filter((i) => i.category === cat)
  const col0 = filtered.filter((_, i) => i % 2 === 0)
  const col1 = filtered.filter((_, i) => i % 2 === 1)

  return (
    <main className="min-h-screen bg-[#f5f5f7]" dir="rtl">
      <header className="bg-white/80 backdrop-blur-md border-b border-[#f0f0f0] sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.png" alt="שי גבאי" className="h-9 w-auto object-contain" />
          </Link>
          <Link
            to="/"
            className="text-xs text-[#6e6e73] bg-[#f5f5f7] hover:bg-[#e5e5e5] px-3 py-1.5 rounded-full transition-colors"
          >
            ← חזרה
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-[#1d1d1f] mb-1">הגלריה שלנו ✨</h1>
        <p className="text-sm text-[#6e6e73] mb-5">עבודות אמיתיות מהסלון</p>

        <div className="flex gap-2 flex-wrap mb-5">
          {Object.entries(CAT_LABELS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCat(k as 'all' | GalleryCategory)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm transition-all ${
                cat === k
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10">
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-3xl bg-white animate-pulse shadow-sm ${i % 2 === 0 ? 'h-40' : 'h-36'}`}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-[#6e6e73]">
            <p className="text-4xl mb-3">🖼</p>
            <p className="font-semibold">אין עבודות בקטגוריה זו</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-3">
              {col0.map((item) => (
                <GalleryTile key={item.id} item={item} onClick={() => setZoom(item)} />
              ))}
            </div>
            <div className="flex flex-col gap-3 mt-6">
              {col1.map((item) => (
                <GalleryTile key={item.id} item={item} onClick={() => setZoom(item)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 bg-black/82 z-50 flex items-center justify-center p-6"
          onClick={() => setZoom(null)}
        >
          <div className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl overflow-hidden mb-4 bg-[#1d1d1f] max-h-[380px]">
              <img
                src={zoom.url}
                alt={zoom.label}
                className="w-full h-full object-cover max-h-[380px]"
              />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{zoom.label}</p>
              <p className="text-white/70 text-sm mt-1">{CAT_LABELS[zoom.category]}</p>
            </div>
            <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
              {zoom.instagramUrl && (
                <a
                  href={zoom.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-pink-300 hover:text-pink-200 transition-colors"
                >
                  📸 ראי באינסטגרם
                </a>
              )}
              <button
                type="button"
                onClick={() => setZoom(null)}
                className="bg-white/15 text-white text-sm px-8 py-2.5 rounded-full hover:bg-white/25 transition-colors"
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function GalleryTile({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full rounded-3xl overflow-hidden shadow-sm hover:shadow-lg active:scale-[0.98] transition-all group aspect-[4/5]"
    >
      <img
        src={item.url}
        alt={item.label}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2.5 text-right">
        <span className="text-white text-xs font-semibold">{item.label}</span>
      </div>
    </button>
  )
}
