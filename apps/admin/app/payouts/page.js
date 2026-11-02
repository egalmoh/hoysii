"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  ManagementShell,
  inputClass,
  buttonClass,
} from "@/components/management-shell";
export default function Payouts() {
  const [rows, setRows] = useState([]),
    [hotels, setHotels] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setRows(await apiFetch("/v1/admin/payouts"));
  };
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch("/v1/admin/payouts"), apiFetch("/v1/admin/hotels")])
      .then(([r, h]) => {
        if (active) {
          setRows(r);
          setHotels(h);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const create = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/v1/admin/payouts", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      await load();
      form.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (r, status) => {
    const note = window.prompt(
      status === "paid"
        ? r.is_test ? "Supporting note for this simulated payout" : "Evidence/note for the payment already made"
        : "Reason for cancelling",
    );
    if (!note) return;
    const reference =
      status === "paid"
        ? r.is_test ? "TEST" : window.prompt("Actual transfer transaction reference")
        : null;
    if (status === "paid" && !reference) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/admin/payouts/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note, reference }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ManagementShell title="Hotel payout records" error={error}>
      <p>
        Record payouts arranged outside Hoysii. These actions never send money.
        The hotel can view the amount, period, status and transfer reference.
        Review your agreement and actual funds before recording payment.
      </p>
      <form
        onSubmit={create}
        className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-2"
      >
        <label>
          Hotel
          <select name="hotel_id" required className={inputClass}>
            <option value="">Select hotel</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount · USD
          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            required
            className={inputClass}
          />
        </label>
        <label>
          Period starts
          <input
            type="date"
            name="period_start"
            required
            className={inputClass}
          />
        </label>
        <label>
          Period ends
          <input
            type="date"
            name="period_end"
            required
            className={inputClass}
          />
        </label>
        <label>
          Supporting note
          <input
            name="note"
            minLength={3}
            maxLength={1000}
            required
            className={inputClass}
          />
        </label>
        <button disabled={busy} className={buttonClass}>
          Record scheduled payout
        </button>
      </form>
      {rows.map((r) => (
        <article key={r.id} className="rounded-2xl border p-5 space-y-2">
          <strong>
            {r.hotel_name} · ${(r.amount_cents / 100).toFixed(2)} USD
          </strong>
          <p>
            {r.period_start} → {r.period_end} · {r.status}
          </p>
          {Boolean(r.is_test) && <p className="text-amber-700">Stakeholder test payout · no transfer occurred</p>}
          <p>{r.note}</p>
          {r.reference && <p>Transfer reference: {r.reference}</p>}
          {r.status === "scheduled" && (
            <div className="flex gap-3">
              <button
                disabled={busy}
                onClick={() => update(r, "paid")}
                className={buttonClass}
              >
                Record completed transfer
              </button>
              <button disabled={busy} onClick={() => update(r, "cancelled")}>
                Cancel record
              </button>
            </div>
          )}
        </article>
      ))}
      {!rows.length && <p>No payout records yet.</p>}
    </ManagementShell>
  );
}
