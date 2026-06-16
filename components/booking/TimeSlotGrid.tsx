'use client'

import { format, isBefore } from 'date-fns'
import { SLOT_STEP_MINUTES } from '@/lib/constants'

interface BookedRange {
  start: Date
  end: Date
}

interface TimeSlotGridProps {
  selectedDate: Date
  bookedRanges: BookedRange[]
  effectiveHours: { start: number; end: number } | null
  serviceMinutes: number
  onSelectSlot: (slot: Date) => void
}

function generateSlots(
  date: Date,
  hours: { start: number; end: number },
  serviceMinutes: number
): Date[] {
  const slots: Date[] = []
  const startMin = hours.start * 60
  const endMin = hours.end * 60
  for (let min = startMin; min <= endMin; min += SLOT_STEP_MINUTES) {
    const slot = new Date(date)
    slot.setHours(Math.floor(min / 60), min % 60, 0, 0)
    slots.push(slot)
  }
  return slots
}

export function TimeSlotGrid({
  selectedDate,
  bookedRanges,
  effectiveHours,
  serviceMinutes,
  onSelectSlot,
}: TimeSlotGridProps) {
  if (effectiveHours === null) {
    return (
      <div className="py-8 text-center">
        <p className="text-3xl mb-3">🚫</p>
        <p className="font-semibold text-[#1d1d1f]">יום זה סגור</p>
        <p className="text-sm text-[#6e6e73] mt-1">בחרי תאריך אחר</p>
      </div>
    )
  }

  const slots = generateSlots(selectedDate, effectiveHours, serviceMinutes)
  const now = new Date()

  if (slots.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-3xl mb-3">😔</p>
        <p className="font-semibold text-[#1d1d1f]">אין שעות פנויות</p>
        <p className="text-sm text-[#6e6e73] mt-1">נסי תאריך אחר</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((slot) => {
          const slotEnd = new Date(slot.getTime() + serviceMinutes * 60 * 1000)
          const isPast = isBefore(slot, now)
          const isBooked = bookedRanges.some(
            ({ start, end }) => slot < end && slotEnd > start
          )
          const isDisabled = isPast || isBooked

          return (
            <button
              key={`${slot.getHours()}-${slot.getMinutes()}`}
              type="button"
              onClick={() => !isDisabled && onSelectSlot(slot)}
              disabled={isDisabled}
              className={[
                'py-3.5 px-2 rounded-2xl text-sm font-semibold transition-all select-none',
                isBooked
                  ? 'bg-[#f5f5f7] text-[#c7c7cc] cursor-not-allowed line-through'
                  : isPast
                  ? 'bg-[#f5f5f7] text-[#d1d1d6] cursor-not-allowed'
                  : 'bg-white border border-sky-100 text-blue-700 hover:bg-sky-50 hover:border-sky-300 active:scale-95 cursor-pointer shadow-sm',
              ].join(' ')}
            >
              {format(slot, 'HH:mm')}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-[#6e6e73] pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white border border-sky-200 inline-block shadow-sm" />
          פנוי
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#f5f5f7] inline-block" />
          תפוס
        </span>
      </div>
    </div>
  )
}
