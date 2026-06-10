'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getGalleryItems,
  addGalleryItem,
  addInstagramItem,
  addDirectUrlItem,
  updateGalleryItem,
  deleteGalleryItem,
  instagramShortcode,
} from '@/lib/firebase/gallery'
import type { GalleryItem, GalleryCategory } from '@/types'

const CAT_LABELS: Record<GalleryCategory, string> = {
  gel: "ג'ל",
  classic: 'קלאסי',
  art: 'עיטורים',
  acrylic: 'אקריל',
}

type AddMode = 'upload' | 'instagram' | 'url'

export function GalleryAdmin() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<AddMode>('upload')
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<GalleryCategory>('gel')
  // upload
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // instagram
  const [igUrl, setIgUrl] = useState('')
  // direct url
  const [directUrl, setDirectUrl] = useState('')
  // edit existing
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editCategory, setEditCategory] = useState<GalleryCategory>('gel')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    getGalleryItems()
      .then(setItems)
      .catch(() => alert('שגיאה בטעינת הגלריה'))
      .finally(() => setLoading(false))
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
  }

  const canSave =
    label.trim() &&
    (mode === 'upload'
      ? !!file
      : mode === 'instagram'
      ? !!instagramShortcode(igUrl)
      : directUrl.startsWith('https://'))

  async function handleAdd() {
    if (!canSave) return
    setSaving(true)
    try {
      let newItem: GalleryItem
      if (mode === 'upload') {
        newItem = await addGalleryItem(file!, label.trim(), category, items.length)
      } else if (mode === 'instagram') {
        newItem = await addInstagramItem(igUrl.trim(), label.trim(), category, items.length)
      } else {
        newItem = await addDirectUrlItem(directUrl.trim(), label.trim(), category, items.length)
      }
      setItems((prev) => [newItem, ...prev])
      resetForm()
    } catch (e: any) {
      alert(e?.message ?? 'שגיאה בשמירה. נסי שוב.')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setAdding(false)
    setLabel('')
    setCategory('gel')
    setIgUrl('')
    setDirectUrl('')
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleEditOpen(item: GalleryItem) {
    setEditingItem(item)
    setEditLabel(item.label)
    setEditCategory(item.category)
    setAdding(false)
  }

  async function handleEditSave() {
    if (!editingItem || !editLabel.trim()) return
    setEditSaving(true)
    try {
      await updateGalleryItem(editingItem.id, editLabel.trim(), editCategory)
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id ? { ...i, label: editLabel.trim(), category: editCategory } : i
        )
      )
      setEditingItem(null)
    } catch {
      alert('שגיאה בשמירת השינויים')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(item: GalleryItem) {
    if (!confirm(`למחוק את "${item.label}"?`)) return
    try {
      await deleteGalleryItem(item)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch {
      alert('שגיאה במחיקת התמונה.')
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white animate-pulse shadow-sm aspect-square" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6e6e73]">{items.length} תמונות</p>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="h-9 px-4 bg-gradient-to-r from-sky-500 to-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow-blue-200 transition-all active:scale-[0.98]"
        >
          + הוסף תמונה
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-3xl shadow-sm border-[1.5px] border-sky-200 p-5 flex flex-col gap-4">
          <p className="font-semibold text-[#1d1d1f]">הוספת תמונה חדשה</p>

          {/* mode toggle */}
          <div className="flex gap-1 bg-[#f5f5f7] rounded-xl p-1">
            {([
              { key: 'upload', label: '📷 קובץ' },
              { key: 'instagram', label: '📸 אינסטגרם' },
              { key: 'url', label: '🔗 כתובת URL' },
            ] as { key: AddMode; label: string }[]).map(({ key, label: lbl }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${
                  mode === key
                    ? 'bg-white shadow-sm text-[#1d1d1f]'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {mode === 'upload' && (
            <label className="border-2 border-dashed border-[#e5e5e5] rounded-2xl bg-[#f5f5f7] h-32 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-sky-300 hover:bg-sky-50 transition-colors overflow-hidden">
              {preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="text-3xl">📷</span>
                  <span className="text-sm text-[#6e6e73]">גרירה לכאן או לחיצה לבחירת קובץ</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}

          {mode === 'instagram' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1d1d1f]">קישור לפוסט באינסטגרם</label>
              <input
                type="url"
                dir="ltr"
                placeholder="https://www.instagram.com/p/..."
                value={igUrl}
                onChange={(e) => setIgUrl(e.target.value)}
                className="h-11 rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] px-3 text-sm focus:bg-white focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
              />
              {igUrl && !instagramShortcode(igUrl) && (
                <p className="text-xs text-red-500">קישור לא תקין — העתיקי את הקישור מהפוסט באינסטגרם</p>
              )}
              <p className="text-[11px] text-[#6e6e73]">
                אם מקבלת שגיאה, נסי &quot;כתובת URL&quot; — לחצי לחיצה ארוכה על התמונה באינסטגרם ← &quot;העתיקי כתובת תמונה&quot;
              </p>
            </div>
          )}

          {mode === 'url' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1d1d1f]">כתובת ישירה לתמונה</label>
              <input
                type="url"
                dir="ltr"
                placeholder="https://..."
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                className="h-11 rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] px-3 text-sm focus:bg-white focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
              />
              {directUrl && !directUrl.startsWith('https://') && (
                <p className="text-xs text-red-500">כתובת URL חייבת להתחיל ב-https://</p>
              )}
              <p className="text-[11px] text-[#6e6e73]">
                לאינסטגרם: לחיצה ארוכה על תמונה בפוסט ← &quot;העתיקי כתובת תמונה&quot;
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1d1d1f]">כותרת העבודה</label>
            <input
              type="text"
              placeholder="לדוגמה: בנייה ג'ל ורוד"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-11 rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] px-3 text-sm focus:bg-white focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#1d1d1f]">קטגוריה</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(CAT_LABELS) as [GalleryCategory, string][]).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCategory(k)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-sm transition-all ${
                    category === k
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canSave || saving}
              className="flex-1 h-11 bg-gradient-to-r from-sky-500 to-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-blue-200 transition-all active:scale-[0.98]"
            >
              {saving ? 'שומר…' : 'שמור תמונה'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="h-11 px-5 bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium rounded-xl hover:bg-[#e5e5e5] transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <div className="text-center py-16 text-[#6e6e73]">
          <p className="text-4xl mb-3">🖼</p>
          <p className="font-semibold text-[#1d1d1f]">הגלריה ריקה</p>
          <p className="text-sm mt-1">הוסיפי תמונות מהעבודות שלך</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {items.map((item) => {
            const isEditing = editingItem?.id === item.id
            return (
              <div
                key={item.id}
                className={`relative rounded-2xl overflow-hidden shadow-sm aspect-square bg-[#f5f5f7] transition-all ${isEditing ? 'ring-2 ring-blue-500' : ''}`}
              >
                <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                {item.instagramUrl && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                    <span className="text-[10px]">📸</span>
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col justify-between p-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => isEditing ? setEditingItem(null) : handleEditOpen(item)}
                      className="w-6 h-6 rounded-full bg-black/45 text-white text-xs flex items-center justify-center hover:bg-blue-500/80 transition-colors leading-none"
                      title="ערוך כיתוב"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="w-6 h-6 rounded-full bg-black/45 text-white text-sm flex items-center justify-center hover:bg-red-500/80 transition-colors leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="bg-black/45 rounded-md px-1.5 py-0.5">
                    <span className="text-white text-[10px] font-semibold leading-tight block">
                      {item.label}
                    </span>
                    <span className="text-white/60 text-[9px] leading-tight block">
                      {CAT_LABELS[item.category]}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Inline edit panel */}
      {editingItem && (
        <div className="bg-white rounded-3xl shadow-sm border-[1.5px] border-blue-300 p-5 flex flex-col gap-4">
          <p className="font-semibold text-[#1d1d1f] text-sm">עריכת כיתוב</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#6e6e73]">כותרת</label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              autoFocus
              placeholder="כותרת התמונה"
              className="h-11 rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] px-3 text-sm focus:bg-white focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[#6e6e73]">קטגוריה</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(CAT_LABELS) as [GalleryCategory, string][]).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEditCategory(k)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-sm transition-all ${
                    editCategory === k
                      ? 'bg-blue-700 text-white'
                      : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleEditSave}
              disabled={!editLabel.trim() || editSaving}
              className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 shadow-sm transition-all active:scale-[0.98]"
            >
              {editSaving ? 'שומר…' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="h-10 px-5 bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium rounded-xl hover:bg-[#e5e5e5] transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
