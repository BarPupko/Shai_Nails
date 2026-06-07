'use client'

import { format, isBefore } from 'date-fns'
import { BUSINESS_HOURS, SLOT_DURATION_HOURS } from '@/lib/constants'

interface TimeSlotGridProps {
  selectedDate: Date
  bookedSlots: Date[]
  onSelectSlot: (slot: Date) => void
}

function generateSlots(date: Date): Date[] {
  const slots: Date[] = []
  for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour += SLOT_DURATION_HOURS) {
    const slot = new Date(date)
    slot.setHours(hour, 0, 0, 0)
    slots.push(slot)
  }
  return slots
}

export function TimeSlotGrid({ selectedDate, bookedSlots, onSelectSlot }: TimeSlotGridProps) {
  const slots = generateSlots(selectedDate)
  const now = new Date()
  const bookedHours = new Set(bookedSlots.map((d) => d.getHours()))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((slot) => {
          const isPast = isBefore(slot, now)
          const isBooked = bookedHours.has(slot.getHours())
          const isDisabled = isPast || isBooked

          return (
            <button
              key={slot.getHours()}
              type="button"
              onClick={() => !isDisabled && onSelectSlot(slot)}
              disabled={isDisabled}
              className={[
                'py-3.5 px-2 rounded-2xl text-sm font-semibold transition-all select-none',
                isBooked
                  ? 'bg-[#f5f5f7] text-[#c7c7cc] cursor-not-allowed line-through'
                  : isPast
                  ? 'bg-[#f5f5f7] text-[#d1d1d6] cursor-not-allowed'
                  : 'bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-300 active:scale-95 cursor-pointer shadow-sm',
              ].join(' ')}
            >
              {format(slot, 'HH:mm')}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-[#6e6e73] pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white border border-rose-200 inline-block shadow-sm" />
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
