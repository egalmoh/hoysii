"use client";
export const inputClass = "w-full rounded-lg border p-3 bg-transparent";
export const buttonClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50";
export function ManagementShell({ title, error, children }) {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-5">
      <h1 className="text-3xl font-bold">{title}</h1>
      {error && (
        <p role="alert" className="rounded-lg border border-red-400 p-3">
          {error}
        </p>
      )}
      {children}
    </main>
  );
}
