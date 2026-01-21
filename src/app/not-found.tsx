import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">404</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">عذراً، الصفحة غير موجودة</p>
        <Link 
          href="/"
          className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  )
}
