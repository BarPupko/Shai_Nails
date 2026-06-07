'use client'

import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { downloadICS, generateGoogleCalendarURL } from '@/lib/calendarExport'

interface BookingSuccessProps {
  startTime: Date
  endTime: Date
  name: string
  serviceName?: string
  servicePrice?: number | null
  servicePriceNote?: string
  onBookAnother?: () => void
}

export function BookingSuccess({
  startTime,
  endTime,
  name,
  serviceName,
  servicePrice,
  servicePriceNote,
  onBookAnother,
}: BookingSuccessProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-4xl mx-auto mb-5 shadow-lg shadow-emerald-100">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-[#1d1d1f] mb-1">התור אושר בהצלחה! 🎉</h2>
        <p className="text-rose-500 font-semibold text-base mb-1">{name}</p>
        {serviceName && (
          <p className="text-[#1d1d1f] font-medium text-sm mb-1">{serviceName}</p>
        )}
        <p className="text-[#6e6e73] text-sm mb-1">
          {format(startTime, 'EEEE, d בMMMM yyyy', { locale: he })}
        </p>
        <p className="text-rose-600 font-bold text-xl" dir="ltr">
          {format(startTime, 'HH:mm')} — {format(endTime, 'HH:mm')}
        </p>
        {servicePrice != null ? (
          <p className="text-emerald-600 font-semibold mt-1">₪{servicePrice}</p>
        ) : servicePriceNote ? (
          <p className="text-[#6e6e73] text-sm mt-1">{servicePriceNote}</p>
        ) : null}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-[#f0f0f0] p-5">
        <p className="text-sm font-semibold text-[#6e6e73] text-center mb-4">
          הוסיפי לי ליומן שלך
        </p>
        <div className="flex flex-col gap-2.5">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-[#e5e5e5] hover:bg-[#f5f5f7] font-medium gap-2 text-[#1d1d1f]"
            onClick={() => downloadICS(startTime, endTime)}
          >
            <span>🍎</span>
            <span>הוסף ליומן Apple</span>
          </Button>
          <Button
            className="w-full h-12 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] font-medium gap-2"
            onClick={() => window.open(generateGoogleCalendarURL(startTime, endTime), '_blank')}
          >
            <span>📅</span>
            <span>הוסף ל-Google Calendar</span>
          </Button>
        </div>
      </div>

      {onBookAnother && (
        <button
          type="button"
          onClick={onBookAnother}
          className="w-full text-sm text-[#6e6e73] hover:text-rose-500 transition-colors py-3 text-center"
        >
          + קביעת תור נוסף
        </button>
      )}
    </div>
  )
}
