import { useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ADMIN_UIDS } from '@/lib/constants'
import { useAuthStore } from '@/lib/store/authStore'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clickCount = useRef(0)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleLogoClick() {
    clickCount.current += 1
    if (clickTimer.current) clearTimeout(clickTimer.current)

    if (clickCount.current >= 3) {
      clickCount.current = 0
      if (user && ADMIN_UIDS.includes(user.uid)) {
        navigate('/admin')
      } else {
        navigate('/book')
      }
      return
    }

    clickTimer.current = setTimeout(() => { clickCount.current = 0 }, 1500)
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-sky-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-40 pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-sm text-center">
          <div className="mb-10">
            <button
              type="button"
              onClick={handleLogoClick}
              className="inline-block mb-5 active:scale-95 transition-transform select-none"
              aria-label="לוגו"
            >
              <img src="/logo.png" alt="שי גבאי" className="w-40 h-40 object-contain" />
            </button>
            <p className="text-[#6e6e73] text-sm mt-1">טיפוח ציפורניים מקצועי</p>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-[#1d1d1f] leading-snug mb-3">
              הציפורניים המושלמות
              <br />
              שלך מחכות לך ✨
            </h2>
            <p className="text-[#6e6e73] text-base leading-relaxed">
              חווית יופי מפנקת עם תוצאות מדהימות —<br />
              קבעי תור בקלות ובמהירות
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-10">
            {[
              { icon: '⚡', label: 'מהיר ופשוט' },
              { icon: '🔒', label: 'מאובטח' },
              { icon: '📱', label: 'בכל מכשיר' },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-[#f5f5f7] rounded-2xl py-3 px-2 text-center">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xs text-[#6e6e73] font-medium">{label}</div>
              </div>
            ))}
          </div>

          <Link
            to="/book"
            className="block w-full bg-gradient-to-r from-sky-500 to-blue-700 text-white font-semibold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all active:scale-[0.98]"
          >
            קביעת תור עכשיו 💅
          </Link>
          <p className="mt-4 text-sm text-[#6e6e73]">ללא תשלום • לוקח פחות מדקה</p>

          <Link
            to="/gallery"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors"
          >
            ✨ צפי בגלריית העבודות שלנו
          </Link>

          <p className="mt-10 text-[11px] text-[#c7c7cc] leading-relaxed">
            פותח ועוצב ע"י{' '}
            <a
              href="https://barpopko.com/card.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-semibold hover:underline"
            >
              בר פופקו
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
