'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function AdminSetupPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const match = window.location.hash.match(/^#token=([A-Za-z0-9_-]{43})$/)
    if (match) queueMicrotask(() => setToken(match[1]))
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const requestLink = async () => {
    setBusy(true)
    setError('')
    try {
      await apiFetch('/v1/admin/setup/request', { method: 'POST' })
      setMessage('If admin setup is available, a link has been sent to the configured admin email.')
    } catch (cause) {
      setError(cause.message || 'Could not send the setup link.')
    } finally {
      setBusy(false)
    }
  }

  const createAccount = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const result = await apiFetch('/v1/admin/setup/complete', { method: 'POST', body: JSON.stringify({ token, password }) })
      setPassword('')
      setConfirmation('')
      setToken('')
      setComplete(true)
      setMessage(result.message)
    } catch (cause) {
      setError(cause.message || 'Could not create the admin account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 via-white to-brand-50 px-4 py-10 dark:from-gray-950 dark:via-gray-900 dark:to-brand-900/30">
      <div className="w-full max-w-md rounded-3xl border border-brand-100 bg-white p-6 shadow-xl shadow-brand-900/10 sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set up admin access</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Admin accounts are separate from traveler accounts.</p>
        {error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">{message}</p>}
        {!token && !complete && (
          <button type="button" onClick={requestLink} disabled={busy} className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white disabled:opacity-50">
            {busy ? 'Sending…' : 'Email me a setup link'}
          </button>
        )}
        {token && !complete && (
          <form onSubmit={createAccount} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New admin password
              <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password
              <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create admin account'}</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm"><Link href="/admin" className="text-brand-600 hover:underline">Back to admin sign in</Link></p>
      </div>
    </main>
  )
}
