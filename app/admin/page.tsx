'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { useAuthStore } from '@/lib/store/authStore'
import { ScheduleView } from '@/components/admin/ScheduleView'
import { RevenueTab } from '@/components/admin/RevenueTab'
import { ClientsTab } from '@/components/admin/ClientsTab'
import { ServicesTab } from '@/components/admin/ServicesTab'
import { AvailabilityTab } from '@/components/admin/AvailabilityTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ADMIN_UIDS } from '@/lib/constants'
import { getAllAppointmentsAdmin } from '@/lib/firebase/appointments'
import { Button } from '@/components/ui/button'
import type { Appointment } from '@/types'

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const router = useRouter()
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
    if (!loading && (!user || !isAdmin)) router.replace('/')
  }, [user, loading, isAdmin, router])

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
            <span className="text-xs bg-rose-100 text-rose-600 font-semibold px-2 py-0.5 rounded-full mr-1">
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
          <h1 className="text-2xl font-bold text-[#1d1d1f]">לוח ניהול</h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            {dataLoading ? 'טוען נתונים…' : `${appointments.length} הזמנות בסה"כ`}
          </p>
        </div>

        <Tabs defaultValue="schedule" dir="rtl">
          <TabsList className="w-full bg-white rounded-2xl shadow-sm border border-[#f0f0f0] p-1 mb-5 h-12 grid grid-cols-5">
            <TabsTrigger value="schedule" className="rounded-xl text-xs font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              📅 לוח
            </TabsTrigger>
            <TabsTrigger value="revenue" className="rounded-xl text-xs font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              💰 הכנסות
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-xl text-xs font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              👥 לקוחות
            </TabsTrigger>
            <TabsTrigger value="services" className="rounded-xl text-xs font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              💅 שירותים
            </TabsTrigger>
            <TabsTrigger value="availability" className="rounded-xl text-xs font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              🗓 זמינות
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
        </Tabs>
      </div>
    </main>
  )
}
