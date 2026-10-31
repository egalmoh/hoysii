'use client'

import { useState } from 'react'
import Image from 'next/image'
import { authClient } from '@/lib/auth-client'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password })
      if (error) throw new Error(error.message)
      await apiFetch('/v1/admin/session')
      router.replace('/')
    } catch (error) {
      setError(error.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 via-white to-brand-50 px-4 py-10 dark:from-gray-950 dark:via-gray-900 dark:to-brand-900/30">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-brand-900/10 p-6 sm:p-8 border border-brand-100 dark:bg-gray-900 dark:border-gray-800">
          <div className="text-center mb-8">
            <Image src="/brand/hoysii-logo.png" alt="Hoysii" width={1622} height={510} priority className="mx-auto mb-7 h-auto w-52" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Hoysii Admin
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to access the admin panel
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-950 dark:text-white dark:border-gray-700 transition"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-950 dark:text-white dark:border-gray-700 transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link href="/admin/setup" className="text-brand-600 hover:underline">Set up admin access</Link>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            🔒 Secure Admin Access Only
          </div>
        </div>
      </div>
    </div>
  )
}
