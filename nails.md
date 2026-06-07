Act as a Senior Full-Stack Developer. I want you to build a mobile-first appointment booking web application for a nail salon called "Shai Nails". You will initialize the project, install dependencies, and write all necessary code.

### 1. Tech Stack Requirements
* Frontend: Next.js (App Router), React, TailwindCSS (must be fully mobile-responsive).
* UI Components: shadcn/ui (install and use for calendars, buttons, dialogs, inputs).
* Backend & Database: Firebase (Authentication, Firestore, Firebase Hosting).
* State Management: React Context or Zustand.

### 2. Core Features & Business Logic
* **User Interface (Mobile-First):** - A clean, modern daily/weekly calendar view to browse available 1-hour time slots (e.g., 09:00 to 18:00).
  - Time slots that are already booked must be grayed out and unclickable.
* **Authentication:** - Use Firebase Phone Authentication (SMS OTP) for login.
* **Booking Logic (Crucial):**
  - A user (identified by their verified phone number) can only have ONE active future appointment at a time.
  - If a user with an existing future appointment tries to book another, the system must block them and prompt them to cancel their current appointment first.
* **Post-Booking:**
  - After a successful booking, display "Add to Google Calendar" and "Add to Apple Calendar" (.ics generation) buttons.
* **Admin Dashboard:**
  - A protected route (`/admin`) accessible only to a specific hardcoded UID or Admin Role.
  - The admin can view all upcoming appointments, see the clients' phone numbers, and cancel any appointment (freeing up the slot in real-time).

### 3. Database Schema (Firestore)
* **Collection: `appointments`**
  - Document ID: Auto-generated
  - `userId` (String) - Firebase Auth UID
  - `phoneNumber` (String)
  - `startTime` (Timestamp)
  - `endTime` (Timestamp)
  - `status` (String: 'active' | 'cancelled')
  - `createdAt` (Timestamp)

### 4. Execution Plan
Please execute the following steps sequentially. Ask for my confirmation if you need to run complex install commands.
1. Initialize a new Next.js project with TailwindCSS and TypeScript in the current directory.
2. Set up the basic folder structure (`components`, `lib`, `app`, `firebase`).
3. Install required dependencies (Firebase SDK, date-fns for time manipulation, shadcn/ui components).
4. Create the `firebase/config.ts` file (leave placeholders for environment variables).
5. Implement the Firebase Phone Auth component with recaptcha verifier.
6. Build the booking calendar UI and the Firestore read/write logic.
7. Implement the "One active appointment per user" validation logic before writing to Firestore.
8. Build the `.ics` generator and Google Calendar link generator.
9. Build the protected `/admin` dashboard.

Please start with Step 1 and 2.