'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { OperationForm, buttonClass } from './operation-form'

export function RoomInventoryEditor({ room, onSaved }) {
  const [blocks, setBlocks] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { setBlocks(await apiFetch(`/v1/admin/rooms/${encodeURIComponent(room.id)}/blocks`)); setError('') }
    catch (error) { setError(error.message) }
  }, [room.id])
  useEffect(() => {
    let active = true
    apiFetch(`/v1/admin/rooms/${encodeURIComponent(room.id)}/blocks`).then((data) => { if (active) setBlocks(data) }).catch((error) => { if (active) setError(error.message) })
    return () => { active = false }
  }, [room.id])
  return <div className="space-y-4 border-t border-slate-200 p-4 dark:border-gray-700">
    <p className="break-all text-xs text-slate-500">Room ID: {room.id}</p>
    <OperationForm key={`${room.id}:${room.price}:${room.total_units}`} title={room.name} fields={[
      { name: 'name', label: 'Room name', value: room.name },
      { name: 'price', label: 'Nightly rate (USD)', type: 'number', min: 0.01, step: '0.01', value: room.price },
      { name: 'total_units', label: 'Total rooms of this type', type: 'number', min: 1, max: 10000, value: room.total_units },
      { name: 'capacity_adults', label: 'Adults per room', type: 'number', min: 1, max: 20, value: room.capacity_adults },
    ]} onSubmit={(body) => apiFetch(`/v1/admin/rooms/${encodeURIComponent(room.id)}`, { method: 'PATCH', body: JSON.stringify(body) })} onSaved={onSaved} />
    <OperationForm title="Close rooms or record outside reservations" description="The end date is checkout: rooms become available again that night." fields={[
      { name: 'start_date', label: 'First occupied night', type: 'date' }, { name: 'end_date', label: 'Checkout / reopen date', type: 'date' },
      { name: 'units', label: 'Number of rooms unavailable', type: 'number', value: 1, min: 1, max: room.total_units }, { name: 'reason', label: 'Reason or outside booking reference' },
    ]} submitLabel="Block rooms" onSubmit={(body) => apiFetch(`/v1/admin/rooms/${encodeURIComponent(room.id)}/blocks`, { method: 'POST', body: JSON.stringify(body) })} onSaved={load} />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {blocks.map((block) => <div key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-gray-800"><div>{block.start_date} → {block.end_date}<br />{block.units} room(s) · {block.reason}</div><button className={buttonClass} disabled={busy} onClick={async () => {
      if (!window.confirm('Release this room block?')) return
      setBusy(true)
      try { await apiFetch(`/v1/admin/inventory-blocks/${block.id}`, { method: 'DELETE' }); await load() } catch (error) { setError(error.message) } finally { setBusy(false) }
    }}>Release</button></div>)}
  </div>
}
