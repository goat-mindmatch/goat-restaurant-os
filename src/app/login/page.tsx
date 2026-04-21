import { Suspense } from 'react'
import LoginClient from './LoginClient'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-4xl">🍜</div>
      </div>
    }>
      <LoginClient />
    </Suspense>
  )
}
