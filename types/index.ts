import { Timestamp } from 'firebase/firestore'

export type AppointmentStatus = 'active' | 'cancelled'

export interface Appointment {
  id: string
  userId: string
  phoneNumber: string
  name: string
  serviceId?: string
  serviceName?: string
  durationMinutes?: number
  price?: number | null
  startTime: Timestamp
  endTime: Timestamp
  status: AppointmentStatus
  createdAt: Timestamp
}

export interface TimeSlot {
  startTime: Date
  endTime: Date
  isBooked: boolean
  appointmentId?: string
}

export interface DaySchedule {
  open: boolean
  start?: number
  end?: number
}

export interface WeeklySchedule {
  days: Record<string, DaySchedule>
}

export interface BlockedDate {
  date: string  // YYYY-MM-DD
  type: 'closed' | 'custom_hours'
  start?: number
  end?: number
  reason?: string
  createdAt?: Timestamp
}

export interface Service {
  id: string
  name: string
  durationMinutes: number
  price: number | null   // null = variable (shown via priceNote)
  priceNote: string      // e.g. "מחיר לפי הדוגמא"
  isActive: boolean
  order: number
  createdAt?: Timestamp
}
