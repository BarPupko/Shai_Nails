export const BUSINESS_HOURS = {
  start: 9,
  end: 18,
} as const

export const SLOT_DURATION_HOURS = 1
export const SLOT_STEP_MINUTES = 15

export const ADMIN_UIDS: string[] = (process.env.NEXT_PUBLIC_ADMIN_UIDS ?? '')
  .split(',')
  .map((uid) => uid.trim())
  .filter(Boolean)

// Price per appointment in NIS — change via NEXT_PUBLIC_SERVICE_PRICE env var
export const SERVICE_PRICE_NIS = Number(process.env.NEXT_PUBLIC_SERVICE_PRICE ?? '150')
