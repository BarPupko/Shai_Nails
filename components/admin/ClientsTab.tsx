'use client'

import { useMemo, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { httpsCallable } from 'firebase/functions'
import { doc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore'
import { functions, db } from '@/firebase/config'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Appointment } from '@/types'

const listAuthUsersFn = httpsCallable<void, { uid: string; phoneNumber: string; createdAt: string; lastSignInAt: string }[]>(functions, 'listAuthUsers')

interface UserRecord {
  uid: string
  phoneNumber: string
  lastSeenAt: Date | null
  savedName?: string
}

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
  hasRealName: boolean
}

function buildWhatsAppURL(phone: string, name: string): string {
  const e164 = phone.replace(/\D/g, '').replace(/^0/, '972')
  const msg = encodeURIComponent(`היי ${name} 😊 רק רציתי לוודא שהכל בסדר לקראת התור הקרוב אצלנו. אם יש שאלות אני כאן!`)
  return `https://wa.me/${e164}?text=${msg}`
}

export function ClientsTab({ appointments }: ClientsTabProps) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    // UIDs that have an admin-saved name override — these must not be clobbered by appt.name
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
      // Only use the appointment's name if the admin hasn't set a saved name override
      if (appt.name && !savedNameUids.has(appt.userId)) {
        c.name = appt.name
        c.hasRealName = true
      }
      c.phoneNumber = appt.phoneNumber
    }

    return Object.values(map).sort((a, b) => b.totalBookings - a.totalBookings)
  }, [appointments, users])

  // All appointments for a given user, sorted newest first
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
      {clients.map((client) => {
        const isEditing = editingId === client.userId
        const isExpanded = expandedId === client.userId
        const clientAppts = isExpanded ? appointmentsForUser(client.userId) : []

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
                          <div className="flex items-center gap-2 shrink-0">
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
    </div>
  )
}
