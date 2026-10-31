"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, CalendarDays, ExternalLink, CheckCircle, Clock, CreditCard } from "lucide-react";
import Link from "next/link";

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    // Fetch bookings with related data
    const { data, error } = await api
      .from("bookings")
      .select("*, users(full_name, phone_number), hotels(name), rooms(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bookings:", error);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    api.from("bookings").select("*, users(full_name, phone_number), hotels(name), rooms(name)").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Error fetching bookings:", error);
      else setBookings(data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const markAsPaid = async (id) => {
    // Optimistic Update
    setBookings(prev => prev.map(b => b.id === id ? { ...b, payment_status: 'paid' } : b));

    const { error } = await api
      .from("bookings")
      .update({ payment_status: 'paid' })
      .eq("id", id);

    if (error) {
      alert("Error updating payment status: " + error.message);
      fetchBookings(); // Revert
    }
  };

  // Safe access for joined data in case of broken relations or deletions
  const getGuestName = (b) => b.users?.full_name || "Unknown Guest";
  const getGuestPhone = (b) => b.users?.phone_number || "N/A";
  const getHotelName = (b) => b.hotels?.name || "Unknown Hotel";
  const getRoomName = (b) => b.rooms?.name || "Unknown Room";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Bookings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">View and manage all reservations</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 flex justify-center border border-slate-200 dark:border-gray-700">
             <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : bookings.length === 0 ? (
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
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                         <div className="font-medium text-slate-900 dark:text-white">{getGuestName(booking)}</div>
                         <div className="text-xs text-slate-500">{getGuestPhone(booking)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div className="font-medium text-slate-900 dark:text-white">{getHotelName(booking)}</div>
                        <div className="text-xs text-slate-500">{getRoomName(booking)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div><span className="text-xs text-slate-400 uppercase font-semibold w-8 inline-block">In:</span> {new Date(booking.check_in_date).toLocaleDateString()}</div>
                        <div><span className="text-xs text-slate-400 uppercase font-semibold w-8 inline-block">Out:</span> {new Date(booking.check_out_date).toLocaleDateString()}</div>
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
                         {booking.payment_status === 'pending' && (
                           <button
                             onClick={() => markAsPaid(booking.id)}
                             className="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50 px-3 py-1.5 rounded-md font-medium transition-colors"
                           >
                              Mark as Paid
                           </button>
                         )}
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
