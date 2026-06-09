# Shai Nails — Project Handoff

## What this is
Hebrew RTL appointment booking web app for a nail salon. Mobile-first.
Users sign in with phone number (SMS OTP), pick a service + time slot, and book.
Owner (admin) manages services, weekly schedule, and blocked dates via a dashboard.

## Tech Stack
- **Vite + React 18 + TypeScript** (migrated FROM Next.js 15 — do not reference Next.js conventions)
- **React Router v6** for routing (`BrowserRouter` in `src/main.tsx`, routes in `src/App.tsx`)
- **Firebase 10.x** — Phone Auth (SMS OTP), Firestore
- **Tailwind CSS + shadcn/ui** — brand color: rose/pink
- **Zustand** — auth state (`store/authStore.ts`)
- **date-fns** — date formatting
- **Deployed on Hostinger** (Apache static hosting, `dist/` output)

## Environment variables (.env.local)
All prefixed `NEXT_PUBLIC_` (kept from Next.js migration — vite.config.ts maps them):
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=shainails.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shainails
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
NEXT_PUBLIC_ADMIN_UIDS=A0B3ZEXfcqhSquqQkoqZ0I6BRtD3,xgEpG6IVB9TtBoTU3KIavIrfHSA3
```

## Key files
| File | Purpose |
|------|---------|
| `vite.config.ts` | Maps `NEXT_PUBLIC_*` env vars to `process.env.*` |
| `firebase/config.ts` | Firebase init + `initializeRecaptchaConfig(auth)` for phone auth |
| `components/auth/PhoneAuthForm.tsx` | SMS OTP login — 2-min countdown, one resend |
| `components/ui/switch.tsx` | Has `dir="ltr"` on root — required for RTL layout |
| `public/.htaccess` | SPA fallback for Apache (Hostinger) |
| `firestore.rules` | Admin UIDs hardcoded in `isAdmin()` function |

## Routes
- `/` — Home page (`src/pages/Home.tsx`)
- `/book` — Booking flow (`src/pages/Book.tsx`) — multi-step via `?step=` query param
- `/admin` — Admin dashboard (`src/pages/Admin.tsx`) — protected, redirects non-admins

## Firebase project
- **Project ID:** `shainails`
- **Auth domain:** `shainails.firebaseapp.com`
- **Hosting domain:** `darkslategray-hedgehog-901546.hostingersite.com`
- **Firestore collections:** `appointments`, `services`, `settings` (weeklySchedule), `blockedDates`
- **Admin UIDs** (must be in BOTH `.env.local` AND `firestore.rules`):
  - `A0B3ZEXfcqhSquqQkoqZ0I6BRtD3`
  - `xgEpG6IVB9TtBoTU3KIavIrfHSA3`
  - (plus others in firestore.rules)
- **Blaze plan** (paid — SMS auth enabled)

## Firestore rules
Deployed with `firebase deploy --only firestore:rules --project shainails`.
The `isAdmin()` function has UIDs hardcoded — if a new admin is added, update BOTH `firestore.rules` AND `.env.local`.

---

## Bugs fixed (for reference, don't re-fix)
- **Switch thumb outside track in RTL** → `dir="ltr"` on `SwitchPrimitives.Root` in `components/ui/switch.tsx`
- **Admin writes failing silently** → try/catch + `alert()` added to all write operations in `ServicesTab` and `AvailabilityTab`
- **Admin UID missing from Firestore rules** → added to `isAdmin()` list
- **Direct URL `/book` gives 404** → `public/.htaccess` with Apache SPA rewrite rule
- **`RecaptchaVerifier` null error on resend** → lazy creation inside `sendOTP()`, not in `useEffect`

---

## Auth flow replaced: Custom WhatsApp OTP via Twilio (2026-06-09)

Firebase Phone Auth (SMS) was removed entirely. Auth now uses custom Cloud Functions + Twilio WhatsApp.

### Architecture
1. Frontend calls `sendOTP` Cloud Function with `{ phone }` → Cloud Function generates 6-digit code, stores in `otpCodes/{e164}` Firestore collection (5-min expiry, 3-attempt limit, 60s rate-limit), sends via Twilio WhatsApp.
2. Frontend calls `verifyOTP` Cloud Function with `{ phone, code }` → Cloud Function validates, creates/finds Firebase user by phone number, returns a **Custom Auth Token**.
3. Frontend calls `signInWithCustomToken(auth, token)` to log in.

### Files
| File | Change |
|------|--------|
| `functions/src/index.ts` | Two Cloud Functions: `sendOTP`, `verifyOTP` |
| `functions/package.json` | firebase-admin, firebase-functions, twilio |
| `firebase.json` | Added `functions` config (source: `functions/`, region: `europe-west1`) |
| `firebase/config.ts` | Removed reCAPTCHA init; added `getFunctions(app, 'europe-west1')` export |
| `components/auth/PhoneAuthForm.tsx` | Replaced RecaptchaVerifier + signInWithPhoneNumber with httpsCallable + signInWithCustomToken |
| `firestore.rules` | Added `otpCodes` collection rule: `allow read, write: if false` |

### Deploy checklist
1. Set Twilio secrets:
   ```
   firebase functions:secrets:set TWILIO_ACCOUNT_SID --project shainails
   firebase functions:secrets:set TWILIO_AUTH_TOKEN --project shainails
   firebase functions:secrets:set TWILIO_WHATSAPP_FROM --project shainails
   ```
   (Value for `TWILIO_WHATSAPP_FROM`: `whatsapp:+14155238886` for Twilio Sandbox, or approved WhatsApp Business number for production)

2. For Twilio WhatsApp Sandbox testing: the user's phone must first send "join <sandbox-keyword>" to +14155238886 on WhatsApp (one-time activation per number).

3. Deploy functions + rules:
   ```
   cd functions && npm run build
   firebase deploy --only functions,firestore:rules --project shainails
   ```

4. Deploy frontend as usual:
   ```
   npm run build
   ```
   Then upload `dist/` to Hostinger.

### Status
**Implemented, not yet deployed.**

---

## Previous struggle: SMS OTP not delivered (resolved by replacing Firebase Phone Auth)

### Symptoms
- Firebase Usage shows SMS "sent" (7 logged)
- User's phone receives nothing
- App shows OTP screen (Firebase returned `ConfirmationResult` — no error thrown)
- Console: `POST https://www.google.com/recaptcha/api2/pat?k=6LcMZR0U... 401 Unauthorized`

### Root cause
Firebase Phone Auth has two reCAPTCHA systems:
- **Legacy reCAPTCHA v2** — key `6LcMZR0UAAAAALgPMcgHwga7gY5p8QMg1Hj-bmUv` — used by `RecaptchaVerifier`. NOT authorized for the Hostinger domain.
- **reCAPTCHA Enterprise** — key `6LflGhQtAAAAAISrmzA9n2eZCNRZIUYdirBWZBYi` — configured in Firebase Auth Settings. IS authorized (syncs with Firebase Auth Authorized Domains).

The legacy key was generating invalid tokens silently. Firebase accepted the request but may not have sent SMS.

### What was tried
- Added Hostinger domain to Firebase Auth → Authorized Domains ✓
- Changed SMS fraud risk threshold from "Block some (0.5)" to "Don't block" ✓
- Firebase Auth reCAPTCHA enforcement mode: AUDIT ✓
- On Blaze paid plan ✓

### Last deployed fix (2026-06-09, commit `e0f1f6e`)
Added `initializeRecaptchaConfig(auth)` to:
- `firebase/config.ts` — fire-and-forget on app init
- `components/auth/PhoneAuthForm.tsx` — awaited inside `sendOTP()` before `signInWithPhoneNumber`

This switches Firebase from legacy reCAPTCHA v2 (`6LcMZR0U...`) to Enterprise (`6LflGhQt...`).

### Status
**Deployed but not yet confirmed working.** Next session should test on Hostinger and check:
1. Is `6LcMZR0U...` gone from console errors?
2. Is SMS being received?
3. If still broken — check Firebase Console → Authentication → Phone → Test phone numbers as a workaround (add +972XXXXXXXXX with code 123456 to bypass reCAPTCHA entirely for testing)
