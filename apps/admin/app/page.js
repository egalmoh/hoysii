"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (n || 0) / 100,
  );
export default function Dashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = () =>
    apiFetch("/v1/admin/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    let active = true;
    apiFetch("/v1/admin/dashboard")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const metrics = data
    ? [
        ["Hotels", data.hotels, "/hotels"],
        ["Rooms", data.rooms, "/hotels"],
        ["Travelers", data.travelers, "/users"],
        ["Active stays", data.active_stays, "/bookings"],
        [
          "Awaiting hotel acknowledgement",
          data.awaiting_acknowledgement,
          "/operations",
        ],
        [
          "Overdue acknowledgements",
          data.overdue_acknowledgements,
          "/operations",
        ],
        ["Open exceptions", data.open_exceptions, "/operations"],
        ["Refunds requiring action", data.pending_refunds, "/operations"],
      ]
    : [];
  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hoysii dashboard</h1>
          <p>
            Operations and recorded funds
            {data ? ` · ${data.day} · Somalia time` : ""}
          </p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p>Loading overview…</p>
      ) : (
        <>
          {data.stakeholder_testing && <p className="rounded-xl bg-amber-50 p-4 text-amber-900">Stakeholder testing is enabled for all signed-in travelers. New reservations and money actions are simulated.</p>}
          <p>{data.test_bookings || 0} stakeholder test bookings · excluded from real financial totals.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([label, value, href]) => (
              <Link key={label} href={href} className="rounded-2xl border p-5">
                <p>{label}</p>
                <p className="text-3xl font-semibold mt-2">{value}</p>
              </Link>
            ))}
          </div>
          <section className="rounded-2xl border p-5">
            <h2 className="text-xl font-semibold">
              Recorded funds · all time · USD
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              {[
                ["Payments received", data.received_cents],
                ["Completed refunds", data.refunded_cents],
                ["Net received", data.net_received_cents],
                ["Hotel payouts recorded paid", data.paid_out_cents],
              ].map(([label, value]) => (
                <div key={label}>
                  <p>{label}</p>
                  <strong className="text-2xl">{money(value)}</strong>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Based on payment, refund and manual payout records. Net received
              is payments minus completed refunds; it is not profit or the bank
              balance. Mock previews and unreconciled legacy payments are
              excluded.
            </p>
            <Link href="/payouts" className="text-blue-600">
              Manage payout records
            </Link>
          </section>
          {[
            ["Today’s arrivals", data.arrivals],
            ["Today’s departures", data.departures],
          ].map(([label, rows]) => (
            <section key={label} className="rounded-2xl border p-5">
              <h2 className="text-xl font-semibold">{label}</h2>
              {rows.length === 0 ? (
                <p className="mt-3">None today.</p>
              ) : (
                rows.map((b) => (
                  <Link
                    key={b.id}
                    href={`/bookings/${b.id}`}
                    className="block border-b py-3"
                  >
                    {b.is_test ? "[Test] " : ""}{b.reference} · {b.check_in_date} → {b.check_out_date} ·{" "}
                    {b.booking_status.replaceAll("_", " ")}
                  </Link>
                ))
              )}
            </section>
          ))}
          <Link href="/operations" className="inline-block text-blue-600">
            Open operations and exception queue →
          </Link>
        </>
      )}
    </main>
  );
}
