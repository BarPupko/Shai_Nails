import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <span className="text-6xl mb-6">💅</span>
      <h1 className="text-2xl font-bold text-[#1d1d1f] mb-2">הדף לא נמצא</h1>
      <p className="text-[#6e6e73] mb-8">הדף שחיפשת אינו קיים</p>
      <Link
        href="/"
        className="bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-md shadow-rose-200"
      >
        חזרה לדף הבית
      </Link>
    </main>
  )
}
