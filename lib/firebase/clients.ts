import { httpsCallable } from 'firebase/functions'
import { collection, getDocs } from 'firebase/firestore'
import { functions, db } from '@/firebase/config'
import type { Appointment } from '@/types'

const listAuthUsersFn = httpsCallable<void, { uid: string; phoneNumber: string }[]>(
  functions,
  'listAuthUsers'
)

export interface ClientRecord {
  userId: string
  name: string
  phoneNumber: string
  hasRealName: boolean
}

/** Merges Firebase Auth users + saved names + appointment history into one lookup list of known clients. */
export async function fetchClientDirectory(appointments: Appointment[]): Promise<ClientRecord[]> {
  const [authRes, firestoreSnap] = await Promise.all([
    listAuthUsersFn(),
    getDocs(collection(db, 'users')),
  ])

  const nameMap: Record<string, string> = {}
  firestoreSnap.docs.forEach((d) => {
    if (d.data().name) nameMap[d.id] = d.data().name
  })

  const map: Record<string, ClientRecord> = {}
  for (const u of authRes.data) {
    map[u.uid] = {
      userId: u.uid,
      name: nameMap[u.uid] || u.phoneNumber,
      phoneNumber: u.phoneNumber,
      hasRealName: !!nameMap[u.uid],
    }
  }
  for (const appt of appointments) {
    if (appt.status === 'cancelled') continue
    if (!map[appt.userId]) {
      map[appt.userId] = {
        userId: appt.userId,
        name: appt.name || appt.phoneNumber,
        phoneNumber: appt.phoneNumber,
        hasRealName: !!appt.name,
      }
    } else if (appt.name && !map[appt.userId].hasRealName) {
      map[appt.userId].name = appt.name
      map[appt.userId].hasRealName = true
    }
  }

  return Object.values(map)
}
