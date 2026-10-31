'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { OperationForm, cardClass, inputClass } from '@/components/operation-form'

const noteField = { name: 'note', label: 'Reason / supporting note', type: 'textarea' }
const money = (cents, currency = 'USD') => `${currency} ${(cents / 100).toFixed(2)}`
const localTime = (value) => value ? new Date(`${value.replace(' ', 'T').replace(/Z$/, '')}Z`).toLocaleString('en-GB', { timeZone: 'Africa/Mogadishu' }) : '—'

function ReplacementForm({ booking, onSaved }) {
  const [hotels, setHotels] = useState([])
  const [rooms, setRooms] = useState([])
  const [error, setError] = useState('')
  const [hotelId, setHotelId] = useState('')
  useEffect(() => { apiFetch('/v1/admin/hotels').then(setHotels).catch((error) => setError(error.message)) }, [])
  useEffect(() => {
    if (!hotelId) return
    let active = true
    apiFetch(`/v1/admin/hotels/${encodeURIComponent(hotelId)}`).then((data) => { if (active) setRooms(data.rooms) }).catch((error) => { if (active) setError(error.message) })
    return () => { active = false }
  }, [hotelId])
  return <section className={`${cardClass} space-y-4`}><h2 className="text-lg font-semibold">Arrange a replacement stay</h2><p className="text-sm text-slate-500">Agree the replacement with the traveler first. Their paid total and saved cancellation terms are preserved.</p><label className="block text-sm">Replacement hotel<select value={hotelId} onChange={(event) => { setRooms([]); setError(''); setHotelId(event.target.value) }} className={inputClass}><option value="">Choose hotel</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label>{error && <p role="alert" className="text-red-600">{error}</p>}{rooms.length > 0 && <OperationForm key={hotelId} title="Replacement room" fields={[{ name: 'room_id', label: 'Room', options: rooms.map((room) => ({ value: room.id, label: `${room.name} · ${room.total_units} total units` })) }, noteField]} submitLabel="Assign replacement" onSubmit={(body) => apiFetch(`/v1/admin/bookings/${booking.id}/reassign`, { method: 'POST', body: JSON.stringify(body) })} onSaved={onSaved} />}</section>
}

export default function BookingDetails({ params }) {
  const { id } = use(params)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { setBooking(await apiFetch(`/v1/admin/bookings/${encodeURIComponent(id)}`)); setError('') }
    catch (error) { setError(error.message) }
  }, [id])
  useEffect(() => {
    let active = true
    apiFetch(`/v1/admin/bookings/${encodeURIComponent(id)}`).then((data) => { if (active) setBooking(data) }).catch((error) => { if (active) setError(error.message) })
    return () => { active = false }
  }, [id])
  const act = (action, body) => apiFetch(`/v1/admin/bookings/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(body) })
  const refundTransitions = { requested: ['approved'], approved: ['processing','completed','failed'], processing: ['completed','failed'], failed: ['approved'] }
  return <main className="mx-auto max-w-7xl space-y-6 p-6 text-slate-900 dark:text-white">
    <Link href="/bookings" className="text-brand-600">← Bookings</Link>{error && <p role="alert" className="text-red-600">{error}</p>}
    {!booking ? <p>{error ? 'Booking unavailable.' : 'Loading booking…'}</p> : <>
      <section className={`${cardClass} space-y-3`}><h1 className="break-all text-2xl font-bold">{booking.reference}</h1><p>{booking.guest.name} · {booking.guest.email} · {booking.guest.phone || 'No phone'}</p><p>{booking.hotels?.name} · {booking.rooms?.name}</p><p>{booking.check_in_date} → {booking.check_out_date} · {booking.guests} guests · {money(Math.round(booking.total_price * 100), booking.currency)}</p><div className="flex flex-wrap gap-3 text-sm"><span>Payment: {booking.payment_status}</span><span>Reservation: {booking.internal_status}</span><span>Hotel: {booking.hotel_ack_status}</span></div><p className="text-sm">Acknowledgement due: {localTime(booking.hotel_ack_due_at)}</p><p className="text-sm text-slate-500">{booking.policy?.text || 'Historical terms require manual review.'}</p></section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {booking.payment_status === 'pending' && booking.policy && <OperationForm title="Record a received manual payment" description="Only record funds verified as received. Online gateways are not connected yet." fields={[
          { name: 'provider', label: 'Bank or payment service', value: booking.payment_provider || 'bank_transfer' },
          { name: 'amount', label: 'Amount received (USD)', value: booking.total_price, type: 'number', min: 0.01, step: '0.01' },
          { name: 'reference', label: 'Bank / service transaction reference' }, noteField,
        ]} submitLabel="Record verified receipt of funds" onSubmit={(body) => act('payment', { ...body, amount_cents: Math.round(Number(body.amount) * 100), currency: booking.currency })} onSaved={load} />}
        {booking.internal_status === 'confirmed' && <OperationForm title="Hotel acknowledgement" description="This is internal. The paid traveler already sees Booking confirmed." fields={[{ name: 'status', label: 'Hotel response', options: ['acknowledged','declined'] }, noteField]} onSubmit={(body) => act('acknowledgement', body)} onSaved={load} />}
        <OperationForm title="Staff note" fields={[noteField]} submitLabel="Add note" onSubmit={(body) => act('notes', body)} onSaved={load} />
        {!['cancelled','refunded','completed','checked_in'].includes(booking.internal_status) && <OperationForm title="Cancel reservation" description={`Policy refund estimate: ${booking.estimated_refund_cents == null ? 'manual review needed' : money(booking.estimated_refund_cents)}. Money is returned only when a refund is completed.`} fields={[
          { name: 'hotel_failure', label: 'Cancellation reason', options: [{ value: 'false', label: 'Traveler cancellation — saved policy' }, { value: 'true', label: 'Hotel fulfilment failure — full refund' }] },
          { name: 'refund', label: 'Refund amount in USD (only for terms requiring manual review)', type: 'number', min: 0, step: '0.01', required: false }, noteField,
        ]} submitLabel="Cancel and record refund due" destructive onSubmit={(body) => act('cancel', { note: body.note, hotel_failure: body.hotel_failure === 'true', ...(body.refund !== '' ? { refund_cents: Math.round(Number(body.refund) * 100) } : {}) })} onSaved={load} />}
        {booking.refund && <section className={`${cardClass} space-y-3`}><h2 className="font-semibold">Refund: {money(booking.refund.amount_cents, booking.refund.currency)}</h2><p>Status: {booking.refund.status}</p>{booking.refund.reference && <p>Transaction: {booking.refund.reference}</p>}{refundTransitions[booking.refund.status] && <OperationForm key={booking.refund.status} title="Update refund" description="Completed means funds were actually returned outside Hoysii. Add the real transfer reference when completing." fields={[{ name: 'status', label: 'Next status', options: refundTransitions[booking.refund.status] }, { name: 'reference', label: 'Completed transfer reference', required: false }, noteField]} onSubmit={(body) => apiFetch(`/v1/admin/refunds/${booking.refund.id}`, { method: 'PATCH', body: JSON.stringify(body) })} onSaved={load} />}</section>}
        {booking.payment_status === 'paid' && ['confirmed','recovery_required'].includes(booking.internal_status) && <ReplacementForm booking={booking} onSaved={load} />}
        {booking.hotel_ack_status === 'acknowledged' && ['confirmed','checked_in'].includes(booking.internal_status) && <OperationForm title="Stay progress" fields={[noteField]} submitLabel={booking.internal_status === 'confirmed' ? 'Record check-in' : 'Complete stay'} onSubmit={(body) => act('stay', { ...body, status: booking.internal_status === 'confirmed' ? 'checked_in' : 'completed' })} onSaved={load} />}
        {booking.exceptions.map((issue) => <OperationForm key={`${issue.id}:${issue.status}`} title={issue.kind.replaceAll('_', ' ')} description={issue.note} fields={[{ name: 'status', label: 'Status', options: ['open','resolved'], value: issue.status }, { name: 'owner', label: 'Assigned staff member', value: issue.owner || '', required: false }, noteField]} onSubmit={(body) => apiFetch(`/v1/admin/exceptions/${issue.id}`, { method: 'PATCH', body: JSON.stringify(body) })} onSaved={load} />)}
      </div>
      <section className={cardClass}><h2 className="mb-3 text-lg font-semibold">Payments</h2>{booking.payments.length === 0 ? <p>No payment recorded.</p> : booking.payments.map((payment) => <p key={payment.id} className="break-words text-sm">{money(payment.amount_cents, payment.currency)} · {payment.provider} · {payment.source} · {payment.reference} · {payment.status}</p>)}</section>
      <section className={cardClass}><h2 className="mb-3 text-lg font-semibold">Email notifications</h2>{booking.notifications.map((message) => <p key={message.id} className="text-sm">{message.kind.replaceAll('_', ' ')} · {message.status} · {message.attempts} attempt(s){message.last_error ? ` · ${message.last_error}` : ''}</p>)}</section>
      <section className={cardClass}><h2 className="mb-3 text-lg font-semibold">Activity</h2><ol className="space-y-3">{booking.activity.map((event) => <li key={event.id} className="border-t border-slate-100 pt-2 text-sm dark:border-gray-700"><p className="text-slate-500">{localTime(event.created_at)} · {event.action.replaceAll('_', ' ')}</p><p className="break-words">{event.note}</p></li>)}</ol></section>
    </>}
  </main>
}
