'use client'

import { inputClass } from './operation-form'

export function HotelPolicyFields({ value, onChange }) {
  return <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2 dark:border-gray-700">
    <legend className="px-2 font-semibold">Stay times and agreed cancellation terms</legend>
    {['check_in_time', 'check_out_time'].map((name) => <label key={name} className="space-y-1 text-sm"><span>{name === 'check_in_time' ? 'Check-in time' : 'Check-out time'} (Somalia)</span><input type="time" value={value[name] || (name === 'check_in_time' ? '14:00' : '12:00')} onChange={(event) => onChange({ [name]: event.target.value })} className={inputClass} required /></label>)}
    <label className="space-y-1 text-sm md:col-span-2"><span>Hotel cancellation terms</span><textarea maxLength={2000} value={value.cancellation_policy ?? 'Contact Hoysii support for cancellation terms.'} onChange={(event) => onChange({ cancellation_policy: event.target.value })} className={inputClass} /></label>
    <label className="space-y-1 text-sm"><span>Free cancellation: hours before check-in</span><input type="number" min="0" max="8760" placeholder="Leave empty for manual review" value={value.free_cancellation_hours ?? ''} onChange={(event) => onChange({ free_cancellation_hours: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></label>
    <label className="space-y-1 text-sm"><span>Penalty after cutoff (% of total)</span><input type="number" min="0" max="100" value={value.cancellation_penalty_percent ?? 100} onChange={(event) => onChange({ cancellation_penalty_percent: Number(event.target.value) })} className={inputClass} /></label>
    <p className="text-xs text-slate-500 md:col-span-2">Enter the terms agreed with the hotel. Each new booking saves its own copy.</p>
  </fieldset>
}
