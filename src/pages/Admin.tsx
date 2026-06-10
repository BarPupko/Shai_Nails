import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { useAuthStore } from '@/lib/store/authStore'
import { ScheduleView } from '@/components/admin/ScheduleView'
import { RevenueTab } from '@/components/admin/RevenueTab'
import { ClientsTab } from '@/components/admin/ClientsTab'
import { ServicesTab } from '@/components/admin/ServicesTab'
import { AvailabilityTab } from '@/components/admin/AvailabilityTab'
import { GalleryAdmin } from '@/components/gallery/GalleryAdmin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ADMIN_UIDS } from '@/lib/constants'
import { getAllAppointmentsAdmin } from '@/lib/firebase/appointments'
import { downloadBulkICS, generateGoogleCalendarURL } from '@/lib/calendarExport'
import { Button } from '@/components/ui/button'
import { Timestamp } from 'firebase/firestore'
import type { Appointment } from '@/types'

export default function Admin() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()
  const isAdmin = !!user && ADMIN_UIDS.includes(user.uid)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setDataLoading(true)
    try {
      setAppointments(await getAllAppointmentsAdmin())
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate('/', { replace: true })
  }, [user, loading, isAdmin, navigate])

  useEffect(() => {
    if (isAdmin) fetchAll()
  }, [isAdmin, fetchAll])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-sm text-[#6e6e73] animate-pulse">טוען…</p>
      </main>
    )
  }

  if (!isAdmin) return null

  const skeleton3 = (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-3xl bg-white animate-pulse shadow-sm" />
      ))}
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f5f5f7]">
      <header className="bg-white/80 backdrop-blur-md border-b border-[#f0f0f0] sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💅</span>
            <span className="font-bold text-[#1d1d1f]">שי גבאי</span>
            <span className="text-xs bg-sky-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full mr-1">
              ניהול
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] rounded-full"
            onClick={() => signOut(auth)}
          >
            התנתקות
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-2xl font-bold text-[#1d1d1f]">לוח ניהול</h1>
              <p className="text-sm text-[#6e6e73] mt-1">
                {dataLoading ? 'טוען נתונים…' : `${appointments.filter(a => a.status === 'active').length} הזמנות פעילות`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-[#e5e5e5] text-xs font-medium gap-1.5 shrink-0"
              onClick={fetchAll}
              disabled={dataLoading}
            >
              {dataLoading ? '…' : '🔄 סנכרן תורים'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-10 rounded-xl border-[#e5e5e5] text-xs font-medium gap-1.5"
              disabled={dataLoading || appointments.length === 0}
              onClick={() => {
                const upcoming = appointments.filter(
                  (a) => a.status === 'active' && (a.startTime as Timestamp).toDate() >= new Date()
                )
                downloadBulkICS(upcoming.map((a) => ({
                  startTime: (a.startTime as Timestamp).toDate(),
                  endTime: (a.endTime as Timestamp).toDate(),
                  name: a.name || a.phoneNumber,
                })))
              }}
            >
              <img src="/apple.logo.png" alt="Apple" className="w-4 h-4 object-contain" />
              ייצוא
            </Button>
            <Button
              size="sm"
              className="flex-1 h-10 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-xs font-medium gap-1.5"
              disabled={dataLoading || appointments.length === 0}
              onClick={() => {
                const upcoming = appointments.filter(
                  (a) => a.status === 'active' && (a.startTime as Timestamp).toDate() >= new Date()
                )
                upcoming.forEach((a, i) => {
                  setTimeout(() => {
                    window.open(
                      generateGoogleCalendarURL(
                        (a.startTime as Timestamp).toDate(),
                        (a.endTime as Timestamp).toDate()
                      ),
                      '_blank'
                    )
                  }, i * 400)
                })
              }}
            >
              <img src="/google.png" alt="Google" className="w-4 h-4 object-contain" />
              ייצוא
            </Button>
          </div>
        </div>

        <Tabs defaultValue="schedule" dir="rtl">
          <TabsList className="w-full bg-white rounded-2xl shadow-sm border border-[#f0f0f0] p-1 mb-5 h-12 grid grid-cols-6">
            <TabsTrigger value="schedule" className="rounded-xl text-xs font-medium data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              📅 לוח
            </TabsTrigger>
            <TabsTrigger value="revenue" className="rounded-xl text-xs font-medium data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              💰 הכנסות
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-xl text-xs font-medium data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              👥 לקוחות
            </TabsTrigger>
            <TabsTrigger value="services" className="rounded-xl text-xs font-medium data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              💅 שירותים
            </TabsTrigger>
            <TabsTrigger value="availability" className="rounded-xl text-xs font-medium data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              🗓 זמינות
            </TabsTrigger>
            <TabsTrigger value="gallery" className="rounded-xl text-xs font-medium data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              🖼 גלריה
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            {dataLoading ? skeleton3 : (
              <ScheduleView appointments={appointments} onRefresh={fetchAll} />
            )}
          </TabsContent>

          <TabsContent value="revenue">
            {dataLoading ? <div className="h-40 rounded-3xl bg-white animate-pulse shadow-sm" /> : (
              <RevenueTab appointments={appointments} />
            )}
          </TabsContent>

          <TabsContent value="clients">
            {dataLoading ? skeleton3 : (
              <ClientsTab appointments={appointments} />
            )}
          </TabsContent>

          <TabsContent value="services">
            <ServicesTab />
          </TabsContent>

          <TabsContent value="availability">
            <AvailabilityTab />
          </TabsContent>

          <TabsContent value="gallery">
            <GalleryAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
