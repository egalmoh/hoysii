'use client'

import { useState } from 'react'

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-transparent p-2.5 text-sm dark:border-gray-600'
export const buttonClass = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
export const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900'

export function OperationForm({ title, description, fields, submitLabel = 'Save', onSubmit, onSaved, destructive = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  return <form className={`${cardClass} space-y-4`} onSubmit={async (event) => {
    event.preventDefault()
    if (destructive && !window.confirm('Apply this cancellation and its recorded refund decision?')) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true); setError(''); setNotice('')
    try { await onSubmit(values); await onSaved?.(); setNotice('Saved.') }
    catch (error) { setError(error.message || 'Could not save. Please try again.') }
    finally { setBusy(false) }
  }}>
    <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
    {fields.map((field) => <label key={field.name} className="block space-y-1 text-sm"><span>{field.label}</span>{field.options ? <select name={field.name} defaultValue={field.value ?? ''} required={field.required !== false} className={inputClass}>{field.options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select> : field.type === 'textarea' ? <textarea name={field.name} defaultValue={field.value ?? ''} required={field.required !== false} maxLength={1000} className={inputClass} /> : <input name={field.name} type={field.type || 'text'} defaultValue={field.value ?? ''} required={field.required !== false} min={field.min} max={field.max} step={field.step} maxLength={field.type === 'number' ? undefined : 150} className={inputClass} />}</label>)}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    <button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : submitLabel}</button>
  </form>
}
