import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Service } from '@/types'

type ServiceInput = Omit<Service, 'id' | 'createdAt'>

const DEFAULT_SERVICES: ServiceInput[] = [
  { name: 'לק גל רגיל/פרנץ', durationMinutes: 90, price: 120, priceNote: '', isActive: true, order: 1 },
  { name: 'לק גל + דוגמא', durationMinutes: 120, price: null, priceNote: 'מחיר לפי הדוגמא', isActive: true, order: 2 },
  { name: 'בנייה חדשה בגל', durationMinutes: 150, price: 300, priceNote: '', isActive: true, order: 3 },
  { name: 'בנייה חדשה + דוגמא', durationMinutes: 210, price: null, priceNote: 'מחיר לפי הדוגמא', isActive: true, order: 4 },
  { name: 'מילוי בנייה רגיל/פרנץ', durationMinutes: 105, price: 140, priceNote: '', isActive: true, order: 5 },
  { name: 'מילוי בנייה + דוגמאות', durationMinutes: 150, price: null, priceNote: 'מחיר לפי הדוגמא', isActive: true, order: 6 },
  { name: 'השלמה', durationMinutes: 30, price: null, priceNote: '₪10 לציפורן', isActive: true, order: 7 },
]

export async function getServices(): Promise<Service[]> {
  const snap = await getDocs(query(collection(db, 'services'), orderBy('order', 'asc')))
  if (snap.empty) {
    await Promise.all(
      DEFAULT_SERVICES.map((s) => addDoc(collection(db, 'services'), { ...s, createdAt: serverTimestamp() }))
    )
    const snap2 = await getDocs(query(collection(db, 'services'), orderBy('order', 'asc')))
    return snap2.docs.map((d) => ({ id: d.id, ...d.data() } as Service))
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service))
}

export async function addService(service: ServiceInput): Promise<string> {
  const ref = await addDoc(collection(db, 'services'), { ...service, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateService(id: string, updates: Partial<ServiceInput>): Promise<void> {
  await updateDoc(doc(db, 'services', id), updates)
}

export async function deleteService(id: string): Promise<void> {
  await deleteDoc(doc(db, 'services', id))
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דקות`
  if (m === 0) return h === 1 ? 'שעה' : `${h} שעות`
  return `${h}:${String(m).padStart(2, '0')} שעות`
}
