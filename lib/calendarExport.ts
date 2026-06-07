export interface CalendarEvent {
  startTime: Date
  endTime: Date
  name: string
}

export function generateBulkICS(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shai Nails//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:shai-nails-${ev.startTime.getTime()}@shainails.com`,
      `DTSTART:${toICSDate(ev.startTime)}`,
      `DTEND:${toICSDate(ev.endTime)}`,
      `SUMMARY:${ev.name} – שי גבאי`,
      `DTSTAMP:${toICSDate(new Date())}`,
      'END:VEVENT'
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadBulkICS(events: CalendarEvent[]): void {
  const ics = generateBulkICS(events)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'shai-nails-all-appointments.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function generateICS(startTime: Date, endTime: Date): string {
  const uid = `shai-nails-${startTime.getTime()}@shainails.com`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shai Nails//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${toICSDate(startTime)}`,
    `DTEND:${toICSDate(endTime)}`,
    'SUMMARY:Nail Appointment – Shai Nails',
    'DESCRIPTION:Your nail appointment at Shai Nails.',
    `DTSTAMP:${toICSDate(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadICS(startTime: Date, endTime: Date): void {
  const ics = generateICS(startTime, endTime)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'shai-nails-appointment.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateGoogleCalendarURL(startTime: Date, endTime: Date): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Nail Appointment – Shai Nails',
    dates: `${toICSDate(startTime)}/${toICSDate(endTime)}`,
    details: 'Your nail appointment at Shai Nails.',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
