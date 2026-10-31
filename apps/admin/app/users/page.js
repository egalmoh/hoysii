"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Ban, Loader2, Pencil, Trash2, Unlock, UserPlus } from "lucide-react";

const emptyForm = { full_name: "", email: "", phone_number: "" };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      setUsers(await apiFetch("/v1/admin/users"));
    } catch (cause) {
      setError(cause.message || "Could not load travelers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/v1/admin/users')
      .then((data) => { if (active) setUsers(data); })
      .catch((cause) => { if (active) setError(cause.message || 'Could not load travelers.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const creating = !form.id;
      await apiFetch(creating ? "/v1/admin/users" : `/v1/admin/users/${encodeURIComponent(form.id)}`, {
        method: creating ? "POST" : "PATCH",
        body: JSON.stringify({ full_name: form.full_name.trim(), email: form.email.trim(), phone_number: form.phone_number.trim() }),
      });
      setNotice(creating ? `Invitation sent to ${form.email.trim()}.` : "Traveler details updated.");
      setForm(null);
      await refresh();
    } catch (cause) {
      setError(cause.message || "Could not save traveler.");
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async (user) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_blocked: !user.is_blocked }),
      });
      setNotice(user.is_blocked ? `${user.email} is unblocked.` : `${user.email} is blocked and signed out.`);
      await refresh();
    } catch (cause) {
      setError(cause.message || "Could not change block status.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (user) => {
    if (!window.confirm(`Delete ${user.email}? Account access and contact details will be removed. Booking and payment records will be kept without the guest's identity.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/v1/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      setNotice(`${user.email} was deleted.`);
      await refresh();
    } catch (cause) {
      setError(cause.message || "Could not delete traveler.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-slate-800 dark:bg-gray-900 dark:text-slate-100 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="mt-1 text-sm text-slate-500">Manage travelers. Admin accounts are separate.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">Total: {users.length}</span>
            <button type="button" onClick={() => { setError(""); setForm({ ...emptyForm }); }} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"><UserPlus size={16} /> Create user</button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

        {loading ? <div className="flex justify-center rounded-xl bg-white p-12 dark:bg-gray-800"><Loader2 className="animate-spin" /></div> :
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800">
                <tr><th className="px-5 py-4">Traveler</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Added</th><th className="px-5 py-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30">
                    <td className="px-5 py-4"><div className="font-medium">{user.full_name || "Unnamed traveler"}</div><div className="text-xs text-slate-500">{user.source === "legacy" ? "Imported customer" : user.source === "invited" ? "Invitation" : "Traveler account"}</div></td>
                    <td className="px-5 py-4"><div>{user.email}</div>{user.phone_number && <div className="text-xs text-slate-500">{user.phone_number}</div>}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.is_blocked ? "bg-red-100 text-red-700" : user.source !== "user" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>{user.is_blocked ? "Blocked" : user.source === "invited" ? "Invited" : user.source === "legacy" ? "Imported" : "Active"}</span></td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Edit ${user.email}`} title="Edit" disabled={busy} onClick={() => { setError(""); setForm({ id: user.id, full_name: user.full_name || "", email: user.email, phone_number: user.phone_number || "" }); }} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-gray-700"><Pencil size={16} /></button>
                      <button type="button" aria-label={`${user.is_blocked ? "Unblock" : "Block"} ${user.email}`} title={user.is_blocked ? "Unblock" : "Block"} disabled={busy} onClick={() => toggleBlock(user)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50 disabled:opacity-50">{user.is_blocked ? <Unlock size={16} /> : <Ban size={16} />}</button>
                      <button type="button" aria-label={`Delete ${user.email}`} title="Delete" disabled={busy} onClick={() => remove(user)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="p-10 text-center text-slate-500">No travelers found.</p>}
          </div>}
      </div>

      {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
          <h2 className="text-xl font-semibold">{form.id ? "Edit traveler" : "Create user"}</h2>
          <p className="text-sm text-slate-500">{form.id ? "Email cannot be edited because it owns the account and booking history." : "We will email an invitation. The traveler chooses their own password in the app."}</p>
          <label className="block text-sm font-medium">Full name<input required maxLength={120} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" /></label>
          <label className="block text-sm font-medium">Email<input type="email" required disabled={!!form.id} maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white" /></label>
          <label className="block text-sm font-medium">Phone number (optional)<input type="tel" maxLength={50} value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" /></label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" disabled={busy} onClick={() => setForm(null)} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Saving…" : form.id ? "Save changes" : "Send invitation"}</button>
          </div>
        </form>
      </div>}
    </main>
  );
}
