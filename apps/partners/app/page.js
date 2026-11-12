"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { BedDouble, Building2, CalendarCheck, ChevronRight, HelpCircle, LogOut, Menu, Wallet, X } from "lucide-react";
import { apiFetch, authClient } from "../lib/api";
import AuthForm from "../components/auth-form";
import Property from "../components/property";
import Rooms from "../components/rooms";
import Reservations from "../components/reservations";
export default function Portal() {
  const [state, setState] = useState(null),
    [hotels, setHotels] = useState([]),
    [hotelId, setHotelId] = useState(""),
    [tab, setTab] = useState("Reservations"),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch("/v1/partner/me")
      .then(async (me) => {
        const rows = await apiFetch("/v1/partner/hotels");
        if (active) {
          setState(me);
          setHotels(rows);
          setHotelId((previous) =>
            rows.some((h) => h.id === previous) ? previous : rows[0]?.id || "",
          );
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setState(false);
          setHotels([]);
          setHotelId("");
          setError(
            e.status === 401
              ? ""
              : "We couldn’t connect to the hotel portal. Please try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [version]);
  const logout = async () => {
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      setState(false);
      setHotels([]);
      setHotelId("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (state === null)
    return (
      <main>
        <p>Loading hotel portal…</p>
      </main>
    );
  if (!state)
    return (
      <>
        <AuthForm
          connectionError={error}
          onSignedIn={() => setVersion((v) => v + 1)}
        />
      </>
    );
  const sections = [
    { name: "Reservations", icon: CalendarCheck, description: "Welcome guests with confidence. Review reservations and keep every stay on track." },
    { name: "Rooms & availability", icon: BedDouble, description: "Keep your room types, nightly rates and available units accurate." },
    { name: "Property", icon: Building2, description: "Show travelers your hotel at its best with accurate details and real photos." },
    { name: "Payouts", icon: Wallet, description: "View payout periods, recorded amounts and transfer status from Hoysii." },
  ];
  const selectedHotel = hotels.find(hotel => hotel.id === hotelId);
  return (
    <div className="portal-layout">
      <aside className={`portal-sidebar${mobileMenuOpen ? " is-open" : ""}`}>
        <div className="portal-brand-row">
          <div className="portal-brand"><Image src="/brand/hoysii-logo.png" alt="Hoysii" width={150} height={48} style={{ height: "auto" }} priority /><span className="ui-badge">Hotel partners</span></div>
          <button className="portal-menu-toggle secondary" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen} aria-controls="partner-navigation" onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <nav id="partner-navigation" className="portal-navigation" aria-label="Property sections">
          <p className="ui-eyebrow">Your workspace</p>
          {sections.map(({ name, icon: Icon }) => <button key={name} aria-current={name === tab ? "page" : undefined} aria-controls="partner-section" onClick={() => { setTab(name); setMobileMenuOpen(false); }}><Icon size={19} /><span>{name}</span>{name === tab && <ChevronRight size={16} className="portal-nav-chevron" />}</button>)}
        </nav>
        <div className="portal-sidebar-bottom">
          <div className="portal-help"><HelpCircle size={20} /><strong>Here to help your team</strong><p>Questions about a reservation? Hoysii is a message away.</p><a href="https://wa.me/252907275534" target="_blank" rel="noreferrer" className="ui-link">WhatsApp Hoysii <ChevronRight size={15} /></a></div>
          <div className="portal-account"><div className="portal-avatar" aria-hidden="true">{state.user.name?.slice(0, 1).toUpperCase() || "H"}</div><div><strong>{state.user.name}</strong><p>Hotel partner</p></div></div>
          <button className="portal-signout secondary" disabled={busy} onClick={logout}><LogOut size={17} />{busy ? "Signing out…" : "Sign out"}</button>
        </div>
      </aside>
      <main className="portal-main">
        <div className="portal-topbar"><div><span className="ui-eyebrow">Partner workspace</span><p>{selectedHotel?.city || "Your assigned properties"}</p></div><label className="portal-hotel-picker">Assigned hotel<select value={hotelId} onChange={event => setHotelId(event.target.value)}>{hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name} · {hotel.city}</option>)}</select></label></div>
        <div className="ui-page-header"><div><h1>{tab}</h1><p>{sections.find(section => section.name === tab)?.description}</p></div>{selectedHotel && <span className="ui-badge"><Building2 size={15} />{selectedHotel.name}</span>}</div>
        {state.stakeholder_testing && <p className="notice testing-notice">Stakeholder testing is enabled. Test reservations and inventory blocks are separate from live inventory. Property and room edits update shared hotel information.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <div id="partner-section" key={`${hotelId}:${tab}`}>
          {hotelId ? tab === "Reservations" ? <Reservations hotelId={hotelId} testing={state.stakeholder_testing} /> : tab === "Rooms & availability" ? <Rooms hotelId={hotelId} /> : tab === "Property" ? <Property hotelId={hotelId} /> : <Payouts hotelId={hotelId} /> : <div className="panel ui-empty"><Building2 size={30} /><p>No active hotel assignments. Contact Hoysii.</p></div>}
        </div>
        <p className="portal-mobile-help muted">Need help? <a href="https://wa.me/252907275534" target="_blank" rel="noreferrer">WhatsApp Hoysii</a></p>
      </main>
    </div>
  );
}

function Payouts({ hotelId }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch(`/v1/partner/hotels/${hotelId}/payouts`)
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [hotelId]);
  return (
    <section className="panel">
      <h2>Payout status</h2>
      <p className="muted">
        Payouts recorded by Hoysii. This portal does not initiate transfers.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!rows ? (
        <p>Loading payouts…</p>
      ) : !rows.length ? (
        <p>No payouts recorded yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Amount · USD</th>
                <th>Status</th>
                <th>Transfer reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.period_start} → {r.period_end}
                  </td>
                  <td>${(r.amount_cents / 100).toFixed(2)}</td>
                  <td><span className={`ui-badge ${r.status === "paid" ? "ui-badge-success" : r.status === "cancelled" ? "ui-badge-danger" : "ui-badge-warning"}`}>{r.status}</span>{Boolean(r.is_test) && <span className="ui-badge ui-badge-warning">Test payout</span>}</td>
                  <td>{r.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
