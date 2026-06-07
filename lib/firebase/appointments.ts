import { db } from '@/firebase/config'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
} from 'firebase/firestore'
import type { Appointment } from '@/types'

export async function getBookedSlots(startOfDay: Date, endOfDay: Date): Promise<Date[]> {
  const q = query(
    collection(db, 'appointments'),
    where('startTime', '>=', Timestamp.fromDate(startOfDay)),
    where('startTime', '<', Timestamp.fromDate(endOfDay)),
    where('status', '==', 'active')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => (d.data().startTime as Timestamp).toDate())
}

export async function getUserActiveAppointment(userId: string): Promise<Appointment | null> {
  const now = Timestamp.now()
  const q = query(
    collection(db, 'appointments'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
    where('startTime', '>', now)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() } as Appointment
}

export async function createAppointment(
  userId: string,
  phoneNumber: string,
  name: string,
  startTime: Date
): Promise<string> {
  const existing = await getUserActiveAppointment(userId)
  if (existing) throw new Error('EXISTING_APPOINTMENT')

  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
  const docRef = await addDoc(collection(db, 'appointments'), {
    userId,
    phoneNumber,
    name,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: 'active',
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  await updateDoc(doc(db, 'appointments', appointmentId), { status: 'cancelled' })
}

export async function getAllUpcomingAppointments(): Promise<Appointment[]> {
  const now = Timestamp.now()
  const q = query(
    collection(db, 'appointments'),
    where('status', '==', 'active'),
    where('startTime', '>', now),
    orderBy('startTime', 'asc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAllAppointmentsAdmin(): Promise<Appointment[]> {
  const q = query(
    collection(db, 'appointments'),
    orderBy('startTime', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))
}
