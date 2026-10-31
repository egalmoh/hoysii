'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { apiFetch } from '@/lib/api'

export function AuthProvider({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()
  const [authorizedFor, setAuthorizedFor] = useState(null)
  const userId = session?.user?.id

  useEffect(() => {
    if (pathname === '/admin' || pathname === '/admin/setup') return
    if (isPending) return
    if (!userId) {
      router.replace('/admin')
      return
    }
    let active = true
    apiFetch('/v1/admin/session')
      .then(() => { if (active) setAuthorizedFor(userId) })
      .catch(() => { if (active) router.replace('/admin') })
    return () => { active = false }
  }, [pathname, userId, isPending, router])

  if (pathname === '/admin' || pathname === '/admin/setup') return <>{children}</>
  if (isPending || !userId || authorizedFor !== userId) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Checking admin access…</div>
  }
  return <>{children}</>
}
