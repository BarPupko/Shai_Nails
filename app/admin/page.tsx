'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { useAuthStore } from '@/lib/store/authStore'
import { AppointmentList } from '@/components/admin/AppointmentList'
import { RevenueTab } from '@/components/admin/RevenueTab'
import { ClientsTab } from '@/components/admin/ClientsTab'
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

  return (
    <main className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#f0f0f0] sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💅</span>
            <span className="font-bold text-[#1d1d1f]">שי ניילס</span>
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

        <Tabs defaultValue="appointments" dir="rtl">
          <TabsList className="w-full bg-white rounded-2xl shadow-sm border border-[#f0f0f0] p-1 mb-5 h-12">
            <TabsTrigger value="appointments" className="flex-1 rounded-xl text-sm font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              📅 תורים
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex-1 rounded-xl text-sm font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              💰 הכנסות
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex-1 rounded-xl text-sm font-medium data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              👥 לקוחות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            {dataLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-3xl bg-white animate-pulse shadow-sm" />
                ))}
              </div>
            ) : (
              <AppointmentList appointments={appointments} onRefresh={fetchAll} />
            )}
          </TabsContent>

          <TabsContent value="revenue">
            {dataLoading ? (
              <div className="h-40 rounded-3xl bg-white animate-pulse shadow-sm" />
            ) : (
              <RevenueTab appointments={appointments} />
            )}
          </TabsContent>

          <TabsContent value="clients">
            {dataLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-3xl bg-white animate-pulse shadow-sm" />
                ))}
              </div>
            ) : (
              <ClientsTab appointments={appointments} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
