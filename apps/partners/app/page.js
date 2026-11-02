"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
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
  return (
    <>
      <header>
        <div className="row">
          <Image
            src="/brand/hoysii-logo.png"
            alt="Hoysii"
            width={140}
            height={44}
            priority
          />
          <span className="badge">Hotel partners</span>
        </div>
        <div className="actions">
          <span>{state.user.name}</span>
          <button className="secondary" disabled={busy} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="row">
          <div>
            <h1>Your property</h1>
            <p className="muted">
              Manage reservations and keep your rooms and rates accurate.
            </p>
          </div>
          <label>
            Assigned hotel
            <select
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} · {h.city}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Property sections">
          {["Reservations", "Rooms & availability", "Property", "Payouts"].map(
            (t) => (
              <button
                key={t}
                aria-current={t === tab ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        {hotelId ? (
          <div key={`${hotelId}:${tab}`}>
            {tab === "Reservations" ? (
              <Reservations hotelId={hotelId} />
            ) : tab === "Rooms & availability" ? (
              <Rooms hotelId={hotelId} />
            ) : tab === "Property" ? (
              <Property hotelId={hotelId} />
            ) : (
              <Payouts hotelId={hotelId} />
            )}
          </div>
        ) : (
          <p>No active hotel assignments. Contact Hoysii.</p>
        )}
        <p className="muted">
          Need help?{" "}
          <a href="https://wa.me/252907275534" target="_blank" rel="noreferrer">
            WhatsApp Hoysii
          </a>
        </p>
      </main>
    </>
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
        <div className="table">
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
                  <td>{r.status}</td>
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
