'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getServices, addService, updateService, deleteService, formatDuration, seedDefaultServices } from '@/lib/firebase/services'
import type { Service } from '@/types'

type EditState = {
  name: string
  durationMinutes: number
  price: string  // empty string = variable
  priceNote: string
  isActive: boolean
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240, 270, 300, 360]

function emptyEdit(): EditState {
  return { name: '', durationMinutes: 90, price: '', priceNote: 'מחיר לפי הדוגמא', isActive: true }
}

export function ServicesTab() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [editState, setEditState] = useState<EditState>(emptyEdit())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    getServices().then(async (s) => {
      if (s.length === 0) {
        await seedDefaultServices()
        const seeded = await getServices()
        setServices(seeded)
      } else {
        setServices(s)
      }
      setLoading(false)
    })
  }, [])

  function startEdit(svc: Service) {
    setEditingId(svc.id)
    setEditState({
      name: svc.name,
      durationMinutes: svc.durationMinutes,
      price: svc.price != null ? String(svc.price) : '',
      priceNote: svc.priceNote,
      isActive: svc.isActive,
    })
  }

  function startNew() {
    setEditingId('new')
    setEditState(emptyEdit())
  }

  async function handleSave() {
    if (!editState.name.trim()) return
    setSaving(true)
    try {
      const data = {
        name: editState.name.trim(),
        durationMinutes: editState.durationMinutes,
        price: editState.price !== '' ? parseFloat(editState.price) : null,
        priceNote: editState.price !== '' ? '' : editState.priceNote,
        isActive: editState.isActive,
        order: editingId === 'new' ? services.length + 1 : (services.find((s) => s.id === editingId)?.order ?? 99),
      }
      if (editingId === 'new') {
        await addService(data)
      } else if (editingId) {
        await updateService(editingId, data)
      }
      setServices(await getServices())
      setEditingId(null)
    } catch (err) {
      console.error('save failed', err)
      alert('שגיאה בשמירת השירות — בדוק הרשאות Firestore')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteService(id)
      setServices((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('delete failed', err)
      alert('שגיאה במחיקת השירות — בדוק הרשאות Firestore')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(svc: Service) {
    const next = !svc.isActive
    setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, isActive: next } : s))
    try {
      await updateService(svc.id, { isActive: next })
    } catch (err) {
      setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, isActive: svc.isActive } : s))
      console.error('toggle failed', err)
      alert('שגיאה בעדכון השירות — בדוק הרשאות Firestore')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-3xl bg-white animate-pulse shadow-sm" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Service cards */}
      {services.map((svc) => (
        <div key={svc.id}>
          {editingId === svc.id ? (
            <EditForm
              state={editState}
              onChange={setEditState}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={['font-bold text-base', svc.isActive ? 'text-[#1d1d1f]' : 'text-[#c7c7cc] line-through'].join(' ')}>
                      {svc.name}
                    </p>
                  </div>
                  <p className="text-sm text-[#6e6e73]">
                    ⏱ עד {formatDuration(svc.durationMinutes)}
                  </p>
                  <p className="text-sm font-semibold text-blue-700 mt-0.5">
                    {svc.price != null ? `₪${svc.price}` : svc.priceNote || 'מחיר לפי הדוגמא'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={svc.isActive}
                    onCheckedChange={() => handleToggleActive(svc)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 rounded-xl text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] text-xs"
                    onClick={() => startEdit(svc)}
                  >
                    ערוך
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl text-[#c7c7cc] hover:text-red-500 hover:bg-red-50"
                    onClick={() => handleDelete(svc.id)}
                    disabled={deletingId === svc.id}
                  >
                    {deletingId === svc.id ? '…' : '✕'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new */}
      {editingId === 'new' ? (
        <EditForm
          state={editState}
          onChange={setEditState}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
          saving={saving}
          isNew
        />
      ) : (
        <Button
          variant="outline"
          className="w-full h-12 rounded-2xl border-dashed border-[#d1d1d6] text-[#6e6e73] hover:border-sky-300 hover:text-blue-600 hover:bg-sky-50"
          onClick={startNew}
        >
          + הוסף שירות חדש
        </Button>
      )}

      <p className="text-xs text-center text-[#c7c7cc] pb-2">
        הפעל/כבה שירות עם המתג · ערוך מחיר ומשך
      </p>
    </div>
  )
}

function EditForm({
  state,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew = false,
}: {
  state: EditState
  onChange: (s: EditState) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
}) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-sky-100 p-5 space-y-3">
      <p className="text-sm font-semibold text-[#1d1d1f]">{isNew ? 'שירות חדש' : 'עריכת שירות'}</p>

      <Input
        placeholder="שם השירות"
        value={state.name}
        onChange={(e) => onChange({ ...state, name: e.target.value })}
        className="h-10 rounded-xl border-[#e5e5e5] text-sm"
        autoFocus
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-[#6e6e73] shrink-0">משך עד:</span>
        <Select
          value={String(state.durationMinutes)}
          onValueChange={(v) => onChange({ ...state, durationMinutes: parseInt(v) })}
        >
          <SelectTrigger className="h-9 flex-1 text-sm rounded-xl border-[#e5e5e5]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {formatDuration(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[#6e6e73] shrink-0 w-10">מחיר:</span>
        <div className="flex-1 relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6e6e73]">₪</span>
          <Input
            type="number"
            placeholder="ריק = מחיר לפי הדוגמא"
            value={state.price}
            onChange={(e) => onChange({ ...state, price: e.target.value })}
            className="h-9 rounded-xl border-[#e5e5e5] text-sm pr-7"
            min={0}
          />
        </div>
      </div>

      {state.price === '' && (
        <Input
          placeholder="הסבר מחיר (לדוגמה: מחיר לפי הדוגמא)"
          value={state.priceNote}
          onChange={(e) => onChange({ ...state, priceNote: e.target.value })}
          className="h-9 rounded-xl border-[#e5e5e5] text-sm"
        />
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm"
          onClick={onSave}
          disabled={saving || !state.name.trim()}
        >
          {saving ? 'שומר…' : 'שמור'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-10 rounded-xl text-[#6e6e73] text-sm"
          onClick={onCancel}
        >
          ביטול
        </Button>
      </div>
    </div>
  )
}
