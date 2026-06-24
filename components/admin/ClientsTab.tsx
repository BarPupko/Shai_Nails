'use client'

import { useMemo, useEffect, useState } from 'react'
import { format, isBefore, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { httpsCallable } from 'firebase/functions'
import { doc, setDoc, getDocs, deleteDoc, updateDoc, collection, Timestamp } from 'firebase/firestore'
import { functions, db } from '@/firebase/config'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { rescheduleAppointment } from '@/lib/firebase/appointments'
import type { Appointment } from '@/types'

const listAuthUsersFn = httpsCallable<void, { uid: string; phoneNumber: string; createdAt: string; lastSignInAt: string }[]>(functions, 'listAuthUsers')

const HOURS = Array.from({ length: 61 }, (_, i) => (7 * 60 + i * 15) / 60)

function formatHour(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `972${digits.slice(1)}`
  return digits
}

interface UserRecord {
  uid: string
  phoneNumber: string
  lastSeenAt: Date | null
  savedName?: string
}

interface ClientsTabProps {
  appointments: Appointment[]
  onRefresh: () => void
}

interface ClientSummary {
  userId: string
  name: string
  phoneNumber: string
  totalBookings: number
  activeBookings: number
  lastDate: Date
  hasRealName: boolean
}

function buildWhatsAppURL(phone: string, name: string): string {
  const e164 = phone.replace(/\D/g, '').replace(/^0/, '972')
  const msg = encodeURIComponent(`היי ${name} 😊 רק רציתי לוודא שהכל בסדר לקראת התור הקרוב אצלנו. אם יש שאלות אני כאן!`)
  return `https://wa.me/${e164}?text=${msg}`
}

export function ClientsTab({ appointments, onRefresh }: ClientsTabProps) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>()
  const [rescheduleHour, setRescheduleHour] = useState('9')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleSuccess, setRescheduleSuccess] = useState<Date | null>(null)

  useEffect(() => {
    Promise.all([
      listAuthUsersFn(),
      getDocs(collection(db, 'users')),
    ]).then(([authRes, firestoreSnap]) => {
      const nameMap: Record<string, string> = {}
      firestoreSnap.docs.forEach((d) => {
        if (d.data().name) nameMap[d.id] = d.data().name
      })
      setUsers(authRes.data.map((u) => ({
        uid: u.uid,
        phoneNumber: u.phoneNumber,
        lastSeenAt: u.lastSignInAt ? new Date(u.lastSignInAt) : null,
        savedName: nameMap[u.uid],
      })))
    }).catch(() => {})
  }, [])

  const clients = useMemo<ClientSummary[]>(() => {
    const map: Record<string, ClientSummary> = {}
    const savedNameUids = new Set(users.filter((u) => !!u.savedName).map((u) => u.uid))

    for (const u of users) {
      map[u.uid] = {
        userId: u.uid,
        name: u.savedName || u.phoneNumber,
        phoneNumber: u.phoneNumber,
        totalBookings: 0,
        activeBookings: 0,
        lastDate: u.lastSeenAt ?? new Date(0),
        hasRealName: !!u.savedName,
      }
    }

    for (const appt of appointments) {
      if (appt.status === 'cancelled') continue
      if (!map[appt.userId]) {
        map[appt.userId] = {
          userId: appt.userId,
          name: appt.name || appt.phoneNumber,
          phoneNumber: appt.phoneNumber,
          totalBookings: 0,
          activeBookings: 0,
          lastDate: (appt.startTime as Timestamp).toDate(),
          hasRealName: !!appt.name,
        }
      }
      const c = map[appt.userId]
      c.totalBookings++
      if (appt.status === 'active') c.activeBookings++
      const d = (appt.startTime as Timestamp).toDate()
      if (d > c.lastDate) { c.lastDate = d }
      if (appt.name && !savedNameUids.has(appt.userId)) {
        c.name = appt.name
        c.hasRealName = true
      }
      c.phoneNumber = appt.phoneNumber
    }

    return Object.values(map).sort((a, b) => b.totalBookings - a.totalBookings)
  }, [appointments, users])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/[-\s]/g, '')
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phoneNumber.replace(/[-\s]/g, '').includes(q)
    )
  }, [clients, search])

  const appointmentsForUser = (userId: string): Appointment[] =>
    appointments
      .filter((a) => a.userId === userId)
      .sort((a, b) =>
        (b.startTime as Timestamp).toDate().getTime() -
        (a.startTime as Timestamp).toDate().getTime()
      )

  async function handleSaveName(userId: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'users', userId), { name: editName.trim() }, { merge: true })
      setUsers((prev) => prev.map((u) =>
        u.uid === userId ? { ...u, savedName: editName.trim() } : u
      ))
      setEditingId(null)
    } catch (err) {
      console.error('save name failed', err)
      alert('שגיאה בשמירת השם')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`למחוק את ${name}?\nכל התורים הפעילים שלה יבוטלו.`)) return
    setDeletingId(userId)
    try {
      const futureAppts = appointments.filter(
        (a) => a.userId === userId && a.status === 'active' && (a.startTime as Timestamp).toDate() > new Date()
      )
      await Promise.all(
        futureAppts.map((a) => updateDoc(doc(db, 'appointments', a.id!), { status: 'cancelled' }))
      )
      await deleteDoc(doc(db, 'users', userId))
      setUsers((prev) => prev.filter((u) => u.uid !== userId))
      onRefresh()
    } catch (err) {
      console.error('delete user failed', err)
      alert('שגיאה במחיקת הלקוחה')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCancelAppointment(apptId: string) {
    if (!confirm('לבטל את התור?')) return
    try {
      await updateDoc(doc(db, 'appointments', apptId), { status: 'cancelled' })
      onRefresh()
    } catch (err) {
      console.error('cancel appt failed', err)
      alert('שגיאה בביטול התור')
    }
  }

  async function handleReschedule() {
    if (!reschedulingAppt || !rescheduleDate) return
    setRescheduleLoading(true)
    try {
      const h = parseFloat(rescheduleHour)
      const hrs = Math.floor(h)
      const mins = Math.round((h - hrs) * 60)
      const newStart = new Date(rescheduleDate)
      newStart.setHours(hrs, mins, 0, 0)
      await rescheduleAppointment(reschedulingAppt.id, newStart, reschedulingAppt.durationMinutes ?? 60)
      setRescheduleSuccess(newStart)
      onRefresh()
    } catch (err) {
      console.error('reschedule failed', err)
      alert('שגיאה בשינוי התור')
    } finally {
      setRescheduleLoading(false)
    }
  }

  function handleCloseReschedule() {
    setReschedulingAppt(null)
    setRescheduleDate(undefined)
    setRescheduleHour('9')
    setRescheduleSuccess(null)
  }

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
      <div className="relative">
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c7c7cc] text-base pointer-events-none">🔍</span>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או טלפון…"
          className="w-full h-11 pr-10 rounded-2xl border-[#e5e5e5] bg-white text-sm text-[#1d1d1f] placeholder-[#c7c7cc] focus:border-blue-400"
        />
      </div>
      <p className="text-sm text-[#6e6e73] px-1">
        {search.trim()
          ? `${filteredClients.length} מתוך ${clients.length} לקוחות`
          : `${clients.length} לקוחות רשומים`}
      </p>
      {filteredClients.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] py-12 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="font-semibold text-[#1d1d1f]">לא נמצאו תוצאות</p>
          <p className="text-sm text-[#6e6e73] mt-1">נסי חיפוש אחר</p>
        </div>
      )}
      {filteredClients.map((client) => {
        const isEditing = editingId === client.userId
        const isExpanded = expandedId === client.userId
        const clientAppts = isExpanded ? appointmentsForUser(client.userId) : []
        const isDeleting = deletingId === client.userId

        return (
          <div
            key={client.userId}
            className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5"
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-xl shrink-0 font-bold text-sky-400">
                {client.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : client.userId)}
                    className="font-bold text-[#1d1d1f] hover:text-blue-700 transition-colors text-right"
                  >
                    {client.name}
                    <span className="text-[10px] text-[#c7c7cc] mr-1">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {!client.hasRealName && (
                    <button
                      type="button"
                      onClick={() => { setEditingId(client.userId); setEditName('') }}
                      className="text-[10px] text-amber-500 border border-amber-200 rounded-full px-1.5 py-0.5 hover:bg-amber-50 transition-colors"
                    >
                      + הוסף שם
                    </button>
                  )}
                  {client.hasRealName && (
                    <button
                      type="button"
                      onClick={() => { setEditingId(client.userId); setEditName(client.name) }}
                      className="text-[10px] text-[#c7c7cc] hover:text-[#6e6e73] transition-colors"
                    >
                      ✎
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  {client.totalBookings === 0
                    ? <span className="text-amber-500">טרם קבעה תור</span>
                    : <>{client.totalBookings} הזמנות{client.activeBookings > 0 && <span className="text-emerald-500 mr-1"> · {client.activeBookings} פעיל</span>}</>
                  }
                </p>
                {client.totalBookings > 0 && client.lastDate.getTime() > 0 && (
                  <p className="text-xs text-[#6e6e73]">
                    תור אחרון: {format(client.lastDate, 'd MMM yyyy', { locale: he })}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 shrink-0">
                <a
                  href={`tel:${client.phoneNumber}`}
                  className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"
                  title={client.phoneNumber}
                >
                  📞
                </a>
                <a
                  href={buildWhatsAppURL(client.phoneNumber, client.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-2xl bg-[#e7f9ee] flex items-center justify-center hover:bg-[#d0f4de] transition-colors text-[#25d366] font-bold text-xs"
                  title="שלח WhatsApp"
                >
                  WA
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(client.userId, client.name)}
                  disabled={isDeleting}
                  className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors disabled:opacity-50"
                  title="מחק לקוחה"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Inline name editor */}
            {isEditing && (
              <div className="mt-3 pt-3 border-t border-[#f5f5f7] flex items-center gap-2">
                <Input
                  placeholder="שם הלקוחה"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 rounded-xl border-[#e5e5e5] text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName(client.userId)}
                />
                <Button
                  size="sm"
                  className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold px-4"
                  onClick={() => handleSaveName(client.userId)}
                  disabled={saving || !editName.trim()}
                >
                  {saving ? '…' : 'שמור'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-xl text-[#6e6e73] text-xs"
                  onClick={() => setEditingId(null)}
                >
                  ביטול
                </Button>
              </div>
            )}

            {/* Expanded appointment history */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-[#f5f5f7]">
                <p className="text-xs font-semibold text-[#6e6e73] mb-2">היסטוריית תורים</p>
                {clientAppts.length === 0 ? (
                  <p className="text-xs text-[#c7c7cc] text-center py-2">אין תורים</p>
                ) : (
                  <div className="space-y-2">
                    {clientAppts.map((appt) => {
                      const date = (appt.startTime as Timestamp).toDate()
                      const isPast = date < new Date()
                      const isFutureActive = appt.status === 'active' && !isPast
                      return (
                        <div
                          key={appt.id}
                          className="flex items-center justify-between bg-[#f9f9fb] rounded-2xl px-4 py-2.5 gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#1d1d1f]">
                              {format(date, 'EEEE, d MMM yyyy', { locale: he })}
                            </p>
                            <p className="text-[11px] text-[#6e6e73]">
                              {format(date, 'HH:mm', { locale: he })}
                              {appt.serviceName ? ` · ${appt.serviceName}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {appt.price != null && (
                              <span className="text-xs font-semibold text-emerald-600">₪{appt.price}</span>
                            )}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                appt.status === 'cancelled'
                                  ? 'bg-red-50 text-red-400'
                                  : isPast
                                  ? 'bg-[#f0f0f0] text-[#6e6e73]'
                                  : 'bg-emerald-50 text-emerald-600'
                              }`}
                            >
                              {appt.status === 'cancelled' ? 'בוטל' : isPast ? 'הושלם' : 'פעיל'}
                            </span>
                            {isFutureActive && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReschedulingAppt(appt)
                                    setRescheduleHour(String(date.getHours() + date.getMinutes() / 60))
                                  }}
                                  className="text-[10px] text-blue-500 border border-blue-200 rounded-full px-2 py-0.5 hover:bg-blue-50 transition-colors"
                                >
                                  שנה
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelAppointment(appt.id!)}
                                  className="text-[10px] text-red-400 border border-red-200 rounded-full px-2 py-0.5 hover:bg-red-50 transition-colors"
                                >
                                  בטל
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Reschedule dialog */}
      <Dialog open={!!reschedulingAppt} onOpenChange={(open) => { if (!open) handleCloseReschedule() }}>
        <DialogContent dir="rtl" className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">
              שינוי תור — {reschedulingAppt?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">בחר תאריך ושעה חדשים לתור</DialogDescription>
          </DialogHeader>

          {rescheduleSuccess ? (
            <div className="space-y-3 pb-1">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="font-semibold text-emerald-800 text-sm">התור שונה בהצלחה!</p>
                <p className="text-sm text-emerald-700 mt-1">
                  {format(rescheduleSuccess, 'EEEE, d בMMMM', { locale: he })} · {format(rescheduleSuccess, 'HH:mm')}
                </p>
              </div>
              <a
                href={`https://wa.me/${formatWhatsAppNumber(reschedulingAppt?.phoneNumber ?? '')}?text=${encodeURIComponent(
                  `שלום ${reschedulingAppt?.name}, התור שלך${reschedulingAppt?.serviceName ? ` עבור ${reschedulingAppt.serviceName}` : ''} שונה ל${format(rescheduleSuccess, 'EEEE d בMMMM', { locale: he })} בשעה ${format(rescheduleSuccess, 'HH:mm')}. מחכים לך 💅`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-11 bg-[#25D366] hover:bg-[#1fb956] text-white font-semibold rounded-2xl transition-colors text-sm"
              >
                💬 שלח הודעת וואטסאפ
              </a>
              <Button variant="outline" className="w-full rounded-2xl" onClick={handleCloseReschedule}>
                סגור
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pb-1">
              <div>
                <p className="text-xs text-[#6e6e73] mb-2 text-right">בחרי תאריך חדש</p>
                <div className="border border-[#f0f0f0] rounded-2xl overflow-hidden">
                  <Calendar
                    mode="single"
                    selected={rescheduleDate}
                    onSelect={setRescheduleDate}
                    disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6e6e73] mb-2 text-right">בחרי שעה</p>
                <Select value={rescheduleHour} onValueChange={setRescheduleHour}>
                  <SelectTrigger className="h-10 rounded-xl border-[#e5e5e5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-semibold"
                onClick={handleReschedule}
                disabled={!rescheduleDate || rescheduleLoading}
              >
                {rescheduleLoading ? 'שומר…' : 'שמור שינוי'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
