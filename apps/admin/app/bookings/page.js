"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, CalendarDays, ExternalLink, CheckCircle, Clock, CreditCard } from "lucide-react";
import Link from "next/link";

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ search: '', date: '', payment: '', acknowledgement: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.from("bookings").select("*, users(full_name, phone_number), hotels(name), rooms(name)").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setBookings(data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  // Safe access for joined data in case of broken relations or deletions
  const getGuestName = (b) => b.users?.full_name || "Unknown Guest";
  const getGuestPhone = (b) => b.users?.phone_number || "N/A";
  const getHotelName = (b) => b.hotels?.name || "Unknown Hotel";
  const getRoomName = (b) => b.rooms?.name || "Unknown Room";

  const filteredBookings = bookings.filter((booking) => {
    const search = `${booking.reference || booking.id} ${getGuestName(booking)} ${getHotelName(booking)}`.toLowerCase();
    return search.includes(filters.search.toLowerCase())
      && (!filters.date || (booking.check_in_date <= filters.date && booking.check_out_date >= filters.date))
      && (!filters.payment || booking.payment_status === filters.payment)
      && (!filters.acknowledgement || booking.hotel_ack_status === filters.acknowledgement);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Bookings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">View and manage all reservations</p>
          </div>
        </div>

        <Link href="/operations" className="inline-block text-brand-600">View operations and exceptions →</Link>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input aria-label="Search bookings" placeholder="Reference, guest, or hotel" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} className="rounded-lg border p-2.5 dark:bg-gray-900" />
          <input aria-label="Stay date" type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} className="rounded-lg border p-2.5 dark:bg-gray-900" />
          <select aria-label="Payment status" value={filters.payment} onChange={(event) => setFilters({ ...filters, payment: event.target.value })} className="rounded-lg border p-2.5 dark:bg-gray-900"><option value="">All payments</option>{['pending','paid','partially_refunded','refunded'].map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <select aria-label="Hotel acknowledgement" value={filters.acknowledgement} onChange={(event) => setFilters({ ...filters, acknowledgement: event.target.value })} className="rounded-lg border p-2.5 dark:bg-gray-900"><option value="">All hotel responses</option>{['not_sent','pending','acknowledged','declined'].map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 flex justify-center border border-slate-200 dark:border-gray-700">
             <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-slate-200 dark:border-gray-700">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium">No bookings found</h3>
            <p className="text-slate-500 dark:text-slate-400">New bookings will appear here.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Guest</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Hotel / Room</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Dates</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Payment</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                         <div className="font-medium text-slate-900 dark:text-white">{getGuestName(booking)}</div><div className="text-xs text-brand-600 break-all">{booking.reference || booking.id}</div>
                         <div className="text-xs text-slate-500">{getGuestPhone(booking)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div className="font-medium text-slate-900 dark:text-white">{getHotelName(booking)}</div>
                        <div className="text-xs text-slate-500">{getRoomName(booking)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div><span className="text-xs text-slate-400 uppercase font-semibold w-8 inline-block">In:</span> {new Date(`${booking.check_in_date}T12:00:00`).toLocaleDateString()}</div>
                        <div><span className="text-xs text-slate-400 uppercase font-semibold w-8 inline-block">Out:</span> {new Date(`${booking.check_out_date}T12:00:00`).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                            booking.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {booking.payment_status === 'paid' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                            {booking.payment_status}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                             <CreditCard className="w-3 h-3" />
                             {booking.payment_provider} - ${booking.total_price}
                          </div>
                          {booking.transaction_reference && (
                            <div className="text-xs text-slate-500 font-mono">
                              Ref: {booking.transaction_reference}
                            </div>
                          )}
                          {booking.payout_held_until && (
                             <div className="text-xs text-slate-500">
                               Held until: {new Date(booking.payout_held_until).toLocaleDateString()}
                             </div>
                          )}
                          {booking.receipt_image_url && (
                             <a
                               href={booking.receipt_image_url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                             >
                                <ExternalLink className="w-3 h-3" />
                                View Receipt
                             </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         {booking.reference ? <Link href={`/bookings/${booking.id}`} className="text-sm font-semibold text-brand-600">Manage booking</Link> : <span className="text-xs text-slate-500">Historical record</span>}
                         {booking.hotel_ack_status && <p className="mt-2 text-xs text-slate-500">Hotel: {booking.hotel_ack_status}</p>}

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
