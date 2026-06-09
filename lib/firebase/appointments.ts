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

export async function getBookedSlots(
  startOfDay: Date,
  endOfDay: Date
): Promise<{ start: Date; end: Date }[]> {
  const q = query(
    collection(db, 'appointments'),
    where('startTime', '>=', Timestamp.fromDate(startOfDay)),
    where('startTime', '<', Timestamp.fromDate(endOfDay)),
    where('status', '==', 'active')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data()
    const start = (data.startTime as Timestamp).toDate()
    let end: Date
    if (data.endTime) {
      end = (data.endTime as Timestamp).toDate()
    } else if (data.durationMinutes) {
      end = new Date(start.getTime() + data.durationMinutes * 60 * 1000)
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000)
    }
    return { start, end }
  })
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
  startTime: Date,
  service: { id: string; name: string; durationMinutes: number; price: number | null }
): Promise<string> {
  const existing = await getUserActiveAppointment(userId)
  if (existing) throw new Error('EXISTING_APPOINTMENT')

  const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000)
  const docRef = await addDoc(collection(db, 'appointments'), {
    userId,
    phoneNumber,
    name,
    serviceId: service.id,
    serviceName: service.name,
    durationMinutes: service.durationMinutes,
    price: service.price,
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

export async function rescheduleAppointment(
  appointmentId: string,
  newStartTime: Date,
  durationMinutes: number
): Promise<void> {
  const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)
  await updateDoc(doc(db, 'appointments', appointmentId), {
    startTime: Timestamp.fromDate(newStartTime),
    endTime: Timestamp.fromDate(newEndTime),
  })
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
  const q = query(collection(db, 'appointments'), orderBy('startTime', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))
}
