'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { cardClass, buttonClass } from '@/components/operation-form'

export default function OperationsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await apiFetch('/v1/admin/operations')); setError('') }
    catch (error) { setError(error.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    apiFetch('/v1/admin/operations').then((data) => { if (active) setData(data) }).catch((error) => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  return <main className="mx-auto max-w-7xl space-y-6 p-6 text-slate-900 dark:text-white">
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Operations</h1><p className="text-sm text-slate-500">Today’s stays and reservations that need attention. Times are in Somalia.</p></div><button disabled={loading} className={buttonClass} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {data && <div className="grid gap-6 md:grid-cols-2">
      {[
        ['Check-ins today', data.check_ins], ['Check-outs today', data.check_outs],
        ['Waiting for hotel acknowledgement', data.awaiting_acknowledgement], ['Open exceptions', data.exceptions], ['Refunds to handle', data.refunds],
      ].map(([title, items]) => <section key={title} className={cardClass}><h2 className="mb-4 text-lg font-semibold">{title} ({items.length})</h2><ul className="space-y-3">{items.map((item) => <li key={item.id} className="border-t border-slate-100 pt-3 text-sm dark:border-gray-700"><Link href={`/bookings/${item.booking_id || item.id}`} className="break-all font-semibold text-brand-600">{item.booking_reference || item.reference}</Link>{item.kind && <p>{item.kind.replaceAll('_', ' ')} · {item.owner || 'Unassigned'}</p>}{item.note && <p className="text-slate-500">{item.note}</p>}{item.hotel_ack_due_at && <p>Due: {new Date(`${item.hotel_ack_due_at.replace(' ', 'T')}Z`).toLocaleString('en-GB', { timeZone: 'Africa/Mogadishu' })}</p>}{item.status && <p>{item.status}</p>}</li>)}</ul>{items.length === 0 && <p className="text-sm text-slate-500">Nothing to handle.</p>}</section>)}
    </div>}
  </main>
}
