'use client'

import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/firebase/services'
import type { Service } from '@/types'

interface BookingConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: Date
  service: Service
  hasExistingAppointment: boolean
  loading: boolean
  onConfirm: () => void
}

export function BookingConfirmDialog({
  open,
  onOpenChange,
  slot,
  service,
  hasExistingAppointment,
  loading,
  onConfirm,
}: BookingConfirmDialogProps) {
  const endTime = new Date(slot.getTime() + service.durationMinutes * 60 * 1000)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] rounded-3xl border-0 shadow-xl p-6">
        <DialogHeader className="text-right">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-3xl">
              💅
            </div>
          </div>
          <DialogTitle className="text-[#1d1d1f] text-lg text-center">
            {hasExistingAppointment ? 'לא ניתן לקבוע תור' : 'אישור תור'}
          </DialogTitle>
          {!hasExistingAppointment && (
            <DialogDescription asChild>
              <div className="text-center pt-1 space-y-1">
                <p className="text-[#1d1d1f] font-bold text-base">{service.name}</p>
                <p className="text-[#1d1d1f] font-semibold" dir="ltr">
                  {format(slot, 'EEEE, d בMMMM', { locale: he })}
                </p>
                <p className="text-[#6e6e73] text-sm" dir="ltr">
                  {format(slot, 'HH:mm')} — {format(endTime, 'HH:mm')}
                  {' '}({formatDuration(service.durationMinutes)})
                </p>
                {service.price != null ? (
                  <p className="text-rose-600 font-semibold text-base">₪{service.price}</p>
                ) : (
                  <p className="text-[#6e6e73] text-sm">{service.priceNote}</p>
                )}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        {hasExistingAppointment && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-center">
            <p className="font-semibold text-amber-800 mb-1">כבר יש לך תור פעיל</p>
            <p className="text-amber-700 text-sm leading-relaxed">
              יש לבטל את התור הנוכחי לפני קביעת תור חדש
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 mt-2">
          {!hasExistingAppointment && (
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 font-semibold text-base shadow-sm"
            >
              {loading ? 'מזמין…' : 'אישור הזמנה ✓'}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full h-11 rounded-xl text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            {hasExistingAppointment ? 'סגירה' : 'ביטול'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
