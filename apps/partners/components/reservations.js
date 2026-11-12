"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
export default function Reservations({ hotelId, testing = false }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("upcoming"),
    [notice, setNotice] = useState("");
  const load = () =>
    apiFetch(`/v1/partner/hotels/${hotelId}/reservations`).then(setRows);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      apiFetch(`/v1/partner/hotels/${hotelId}/reservations`)
        .then((r) => {
          if (active) {
            setRows(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [hotelId]);
  const action = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      await apiFetch(
        `/v1/partner/bookings/${values.booking_id}/${values.action}`,
        {
          method: "POST",
          body: JSON.stringify({ status: values.status, note: values.note }),
        },
      );
      await load();
      setNotice(
        values.status === "declined"
          ? "Your response was sent to Hoysii operations. Hoysii handles the traveler’s replacement or refund."
          : "Reservation updated.",
      );
      form.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Mogadishu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const visible = (rows || []).filter(
    (r) =>
      filter === "all" ||
      (filter === "pending"
        ? r.hotel_ack_status === "pending" && r.booking_status === "confirmed"
        : r.check_out_date >= day &&
          ["confirmed", "checked_in"].includes(r.booking_status)),
  );
  return (
    <>
      <section className="panel">
        <div className="row">
          <h2>Reservation inbox</h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Refresh
          </button>
        </div>
        <p className="muted">Acknowledge each new confirmed booking within 30 minutes. The traveler already sees it as confirmed.</p>
        <label className="reservation-filter">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="upcoming">Upcoming and in-house</option>
            <option value="pending">Awaiting acknowledgement</option>
            <option value="all">All reservations</option>
          </select>
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </section>
      {rows === null ? (
        <p>Loading reservations…</p>
      ) : !visible.length ? (
        <section className="panel">No matching reservations.</section>
      ) : (
        visible.map((r) => (
          <article key={r.id} className="panel reservation-card">
            <div className="row reservation-header">
              <div className="actions"><h2>{r.reference}</h2>{Boolean(r.is_test) && <span className="ui-badge ui-badge-warning">Stakeholder test</span>}</div>
              <span className={`ui-badge ${["confirmed", "checked_in", "completed"].includes(r.booking_status) ? "ui-badge-success" : ""}`}>
                {r.booking_status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="reservation-body">
            <dl className="reservation-details">
              <div><dt>Guest</dt><dd>{r.guest_name}</dd></div>
              <div><dt>Room type</dt><dd>{r.room_name}</dd></div>
              <div><dt>Stay · {r.guests} guests</dt><dd>{r.check_in_date} → {r.check_out_date}</dd></div>
            </dl>
            <p className="muted">Hotel response: <span className={`ui-badge ${r.hotel_ack_status === "declined" ? "ui-badge-danger" : r.hotel_ack_status === "pending" ? "ui-badge-warning" : ""}`}>{r.hotel_ack_status.replaceAll("_", " ")}</span></p>
            {r.hotel_ack_status === "pending" && r.hotel_ack_due_at && (
              <p className="notice">
                Acknowledge by{" "}
                {new Date(
                  r.hotel_ack_due_at.replace(" ", "T") + "Z",
                ).toLocaleString("en-GB", {
                  timeZone: "Africa/Mogadishu",
                })}{" "}
                Somalia time.
              </p>
            )}
            {Boolean(r.is_test) === testing && r.booking_status === "confirmed" && (
              <ActionForm
                bookingId={r.id}
                action="acknowledgement"
                onSubmit={action}
                busy={busy}
                statuses={["acknowledged", "declined"]}
              />
            )}
            {Boolean(r.is_test) === testing && ((r.booking_status === "confirmed" &&
              r.hotel_ack_status === "acknowledged") ||
              r.booking_status === "checked_in") && (
              <ActionForm
                bookingId={r.id}
                action="stay"
                onSubmit={action}
                busy={busy}
                statuses={
                  r.booking_status === "checked_in"
                    ? ["completed"]
                    : ["checked_in"]
                }
              />
            )}
            </div>
          </article>
        ))
      )}
    </>
  );
}
function ActionForm({ bookingId, action, onSubmit, busy, statuses }) {
  return (
    <form onSubmit={onSubmit} className="grid reservation-action" style={{ marginTop: 16 }}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="action" value={action} />
      <label>
        {action === "stay" ? "Stay update" : "Hotel response"}
        <select name="status">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "acknowledged"
                ? "Acknowledge reservation"
                : s === "declined"
                  ? "Unable to fulfill — notify Hoysii"
                  : s === "checked_in"
                    ? "Guest checked in"
                    : "Stay completed"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note
        <input
          name="note"
          minLength={3}
          maxLength={1000}
          required
          placeholder="Add a supporting note"
        />
      </label>
      <button disabled={busy}>
        Save {action === "stay" ? "stay update" : "hotel response"}
      </button>
    </form>
  );
}
