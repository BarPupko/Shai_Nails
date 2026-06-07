import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { db } from '@/firebase/config'
import { BUSINESS_HOURS } from '@/lib/constants'
import type { WeeklySchedule, BlockedDate } from '@/types'

const DEFAULT_WEEKLY: WeeklySchedule = {
  days: {
    '0': { open: false },
    '1': { open: true, start: BUSINESS_HOURS.start, end: BUSINESS_HOURS.end },
    '2': { open: true, start: BUSINESS_HOURS.start, end: BUSINESS_HOURS.end },
    '3': { open: true, start: BUSINESS_HOURS.start, end: BUSINESS_HOURS.end },
    '4': { open: true, start: BUSINESS_HOURS.start, end: BUSINESS_HOURS.end },
    '5': { open: true, start: BUSINESS_HOURS.start, end: 14 },
    '6': { open: false },
  },
}

export async function getWeeklySchedule(): Promise<WeeklySchedule> {
  const snap = await getDoc(doc(db, 'settings', 'weeklySchedule'))
  if (!snap.exists()) return DEFAULT_WEEKLY
  const data = snap.data()
  return { days: data.days } as WeeklySchedule
}

export async function saveWeeklySchedule(schedule: WeeklySchedule): Promise<void> {
  await setDoc(doc(db, 'settings', 'weeklySchedule'), {
    days: schedule.days,
    updatedAt: serverTimestamp(),
  })
}

export async function getAllBlockedDates(): Promise<BlockedDate[]> {
  const snap = await getDocs(query(collection(db, 'blockedDates'), orderBy('date', 'asc')))
  return snap.docs.map((d) => ({ ...d.data(), date: d.id } as BlockedDate))
}

export async function getBlockedDatesForRange(from: Date, to: Date): Promise<BlockedDate[]> {
  const fromStr = format(from, 'yyyy-MM-dd')
  const toStr = format(to, 'yyyy-MM-dd')
  const snap = await getDocs(
    query(
      collection(db, 'blockedDates'),
      where('date', '>=', fromStr),
      where('date', '<=', toStr)
    )
  )
  return snap.docs.map((d) => ({ ...d.data(), date: d.id } as BlockedDate))
}

export async function addBlockedDate(blocked: Omit<BlockedDate, 'createdAt'>): Promise<void> {
  await setDoc(doc(db, 'blockedDates', blocked.date), {
    ...blocked,
    createdAt: serverTimestamp(),
  })
}

export async function removeBlockedDate(date: string): Promise<void> {
  await deleteDoc(doc(db, 'blockedDates', date))
}

export function getEffectiveHours(
  date: Date,
  schedule: WeeklySchedule,
  blocked: BlockedDate[]
): { start: number; end: number } | null {
  const dateStr = format(date, 'yyyy-MM-dd')

  const override = blocked.find((b) => b.date === dateStr)
  if (override) {
    if (override.type === 'closed') return null
    if (override.type === 'custom_hours' && override.start != null && override.end != null) {
      return { start: override.start, end: override.end }
    }
  }

  const dayKey = date.getDay().toString()
  const daySchedule = schedule.days[dayKey]
  if (!daySchedule) return { start: BUSINESS_HOURS.start, end: BUSINESS_HOURS.end }
  if (!daySchedule.open) return null
  return {
    start: daySchedule.start ?? BUSINESS_HOURS.start,
    end: daySchedule.end ?? BUSINESS_HOURS.end,
  }
}
