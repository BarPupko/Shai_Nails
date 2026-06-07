import type { Metadata, Viewport } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rubik',
})

export const metadata: Metadata = {
  title: 'שי ניילס — קביעת תור',
  description: 'קביעת תור מקצועית לטיפוח ציפורניים בשי ניילס.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💅</text></svg>",
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${rubik.variable} font-rubik antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
