export function cancellationCutoff(checkIn, time = '14:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const midnight = new Date(`${checkIn}T00:00:00Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== checkIn) return null;
  return new Date(Date.parse(`${checkIn}T${time}:00+03:00`) - 86400000).toISOString();
}

export function formatCancellationDate(cutoff) {
  if (!cutoff || !Number.isFinite(Date.parse(cutoff))) return '';
  return new Date(cutoff).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Mogadishu',
  });
}
