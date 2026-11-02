"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ManagementShell, buttonClass } from "@/components/management-shell";
export default function Reviews() {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch("/v1/admin/reviews")
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const moderate = async (r) => {
    const note = window.prompt("Reason for changing review visibility");
    if (!note) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/admin/reviews/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: !r.hidden, note }),
      });
      setRows(await apiFetch("/v1/admin/reviews"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ManagementShell title="Customer reviews" error={error}>
      <p>
        One review per paid, confirmed or completed booking. Hiding a review
        removes it from the public hotel page and its review average.
      </p>
      {rows.map((r) => (
        <article key={r.id} className="rounded-2xl border p-5 space-y-3">
          <strong>
            {r.hotel_name} · {r.rating}/5
          </strong>
          <p>
            {r.is_test ? "Stakeholder test · never public · " : ""}{r.reference} · {r.hidden ? "Hidden" : "Published"}
          </p>
          <p className="whitespace-pre-wrap break-words">{r.comment}</p>
          {r.moderation_note && <p>Moderation: {r.moderation_note}</p>}
          <button
            disabled={busy}
            className={buttonClass}
            onClick={() => moderate(r)}
          >
            {r.hidden ? "Restore" : "Hide"} review
          </button>
        </article>
      ))}
      {!rows.length && <p>No reviews yet.</p>}
    </ManagementShell>
  );
}
