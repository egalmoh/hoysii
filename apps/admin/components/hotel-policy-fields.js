'use client'

import { inputClass } from './operation-form'

export function HotelPolicyFields({ value, onChange }) {
  return <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2 dark:border-gray-700">
    <legend className="px-2 font-semibold">Stay times and cancellation policy</legend>
    {['check_in_time', 'check_out_time'].map((name) => <label key={name} className="space-y-1 text-sm"><span>{name === 'check_in_time' ? 'Check-in time' : 'Check-out time'} (Somalia)</span><input type="time" value={value[name] || (name === 'check_in_time' ? '14:00' : '12:00')} onChange={(event) => onChange({ [name]: event.target.value })} className={inputClass} required /></label>)}
    <p className="text-sm md:col-span-2">Hoysii cancellation policy: free cancellation until 24 hours before check-in. After that: refund minus the first night. The deadline uses the check-in time above, in Somalia time.</p>
    <p className="text-xs text-slate-500 md:col-span-2">This rule applies to new bookings. Existing bookings retain their saved cancellation terms.</p>
  </fieldset>
}
