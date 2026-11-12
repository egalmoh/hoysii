"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BedDouble, Building2, CalendarCheck, CalendarDays, Clock, RefreshCw, RotateCcw, ShieldAlert, TriangleAlert, Users, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ManagementShell } from "@/components/management-shell";

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((n || 0) / 100);

export default function Dashboard() {
  const [data, setData] = useState(null), [error, setError] = useState(""), [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    setRefreshing(true);
    try { setData(await apiFetch("/v1/admin/dashboard")); setError(""); }
    catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  };
  useEffect(() => {
    let active = true;
    apiFetch("/v1/admin/dashboard").then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const metrics = data ? [
    ["Hotels", data.hotels, "/hotels", Building2],
    ["Rooms", data.rooms, "/hotels", BedDouble],
    ["Travelers", data.travelers, "/users", Users],
    ["Active stays", data.active_stays, "/bookings", CalendarCheck],
    ["Awaiting acknowledgement", data.awaiting_acknowledgement, "/operations", Clock],
    ["Overdue acknowledgements", data.overdue_acknowledgements, "/operations", TriangleAlert],
    ["Open exceptions", data.open_exceptions, "/operations", ShieldAlert],
    ["Refunds requiring action", data.pending_refunds, "/operations", RotateCcw],
  ] : [];
  return (
    <ManagementShell title="Hoysii dashboard" subtitle={`Your properties, stays and recorded funds${data ? ` · ${data.day} · Somalia time` : ""}`} error={error}
      actions={<button className="ui-button ui-button-secondary" disabled={refreshing} onClick={load}><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Refreshing…" : "Refresh overview"}</button>}>
      {!data ? <div className="ui-empty"><RefreshCw size={24} className="animate-spin" /><p>Loading overview…</p></div> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="ui-muted">A snapshot of the business and the stays that need your attention.</p>
          <span className={`ui-badge ${data.stakeholder_testing ? "ui-badge-warning" : ""}`}>{data.test_bookings || 0} test bookings · excluded from real funds</span>
        </div>
        <div className="ui-metric-grid">
          {metrics.map(([label, value, href, Icon]) => <Link key={label} href={href} className="ui-metric">
            <div className="ui-metric-top"><span className="ui-metric-label">{label}</span><span className="ui-icon-tile"><Icon size={18} /></span></div>
            <div className="flex items-end justify-between gap-3"><strong className="ui-metric-value">{value}</strong><ArrowUpRight size={17} className="text-slate-400" aria-hidden="true" /></div>
          </Link>)}
        </div>
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div className="flex items-start gap-3"><span className="ui-icon-tile"><Wallet size={19} /></span><div><h2>Recorded funds</h2><p>All time · USD · real recorded transactions</p></div></div>
            <Link href="/payouts" className="ui-link">Payout records <ArrowUpRight size={16} /></Link>
          </div>
          <div className="ui-funds-grid">
            {[["Payments received", data.received_cents], ["Completed refunds", data.refunded_cents], ["Net received", data.net_received_cents], ["Hotel payouts recorded paid", data.paid_out_cents]].map(([label, value]) => <div key={label}><p className="ui-metric-label">{label}</p><strong className="ui-fund-value">{money(value)}</strong></div>)}
          </div>
          <p className="ui-muted mt-6 border-t border-slate-100 pt-4 dark:border-slate-700">Based on payment, refund and manual payout records. Net received is payments minus completed refunds; it is not profit or the bank balance. Mock previews and unreconciled legacy payments are excluded.</p>
        </section>
        <div className="ui-two-columns">
          {[["Today’s arrivals", data.arrivals], ["Today’s departures", data.departures]].map(([label, rows]) => <section key={label} className="ui-panel">
            <div className="ui-panel-header"><div className="flex items-center gap-3"><span className="ui-icon-tile"><CalendarDays size={19} /></span><h2>{label}</h2></div><span className="ui-badge">{rows.length} stays</span></div>
            {rows.length === 0 ? <div className="ui-empty"><CalendarDays size={26} /><p>None today.</p></div> : rows.map(b => <Link key={b.id} href={`/bookings/${b.id}`} className="ui-list-row">
              <div><strong>{b.reference}</strong>{Boolean(b.is_test) && <span className="ui-badge ui-badge-warning ml-2">Test</span>}<p className="ui-muted">{b.check_in_date} → {b.check_out_date}</p></div>
              <span className="ui-badge self-start">{b.booking_status.replaceAll("_", " ")}</span>
            </Link>)}
          </section>)}
        </div>
        <Link href="/operations" className="ui-link self-start">Open operations and exception queue <ArrowRight size={16} /></Link>
      </>}
    </ManagementShell>
  );
}
