"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  ManagementShell,
  inputClass,
  buttonClass,
} from "@/components/management-shell";
export default function Partners() {
  const [rows, setRows] = useState([]),
    [hotels, setHotels] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = async () => {
    const [r, h] = await Promise.all([
      apiFetch("/v1/admin/partners"),
      apiFetch("/v1/admin/hotels"),
    ]);
    setRows(r);
    setHotels(h);
  };
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch("/v1/admin/partners"), apiFetch("/v1/admin/hotels")])
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
  const invite = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch("/v1/admin/partners", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setNotice(
        result.email_sent
          ? "Assignment saved and invitation email accepted for sending."
          : "Assignment saved, but email failed. Retry this invitation to resend.",
      );
      await load();
      form.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (r) => {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/admin/partners/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !r.active }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ManagementShell title="Hotel partner access" error={error}>
      <p>
        Assign an email to the hotels it can manage. Partner accounts, passwords
        and sessions are separate from travelers and Hoysii staff. Disabling an
        assignment immediately removes access to that hotel and signs the
        partner out.
      </p>
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={invite}
        className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-3"
      >
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            className={inputClass}
          />
        </label>
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
        <button disabled={busy} className={buttonClass}>
          Assign and email invitation
        </button>
      </form>
      {rows.map((r) => (
        <article
          key={r.id}
          className="rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <strong>{r.email}</strong>
            <p>
              {r.hotel_name} · {r.active ? "Access active" : "Access disabled"}
            </p>
            <p>
              {r.user_id
                ? r.emailVerified
                  ? "Account verified"
                  : "Account awaiting verification"
                : "Account not created yet"}
            </p>
          </div>
          <button
            disabled={busy}
            onClick={() => toggle(r)}
            className={buttonClass}
          >
            {r.active ? "Disable hotel access" : "Restore hotel access"}
          </button>
        </article>
      ))}
      {!rows.length && <p>No partner assignments yet.</p>}
    </ManagementShell>
  );
}
