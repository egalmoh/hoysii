import { Platform } from 'react-native';
import { API_URL, authClient } from './auth';

export async function apiFetch(path, options = {}) {
  const cookie = Platform.OS === 'web' ? null : await authClient.getCookie();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function availabilityQuery(filters) {
  const values = ['check_in', 'check_out', 'adults']
    .filter((key) => filters[key] !== undefined && filters[key] !== null && filters[key] !== '')
    .map((key) => `${key}=${encodeURIComponent(filters[key])}`);
  return values.length ? `?${values.join('&')}` : '';
}

export async function getUnavailableDates({ roomId, city, from, to, adults = 1 }) {
  const query = [
    `from=${encodeURIComponent(from)}`,
    `to=${encodeURIComponent(to)}`,
    `adults=${encodeURIComponent(adults)}`,
    ...(roomId ? [`room_id=${encodeURIComponent(roomId)}`] : []),
    ...(city ? [`city=${encodeURIComponent(city)}`] : []),
  ].join('&');
  return (await apiFetch(`/v1/availability/calendar?${query}`)).unavailable_dates;
}

export async function checkRoomAvailability(roomId, checkIn, checkOut) {
  const query = availabilityQuery({ check_in: checkIn, check_out: checkOut });
  return (await apiFetch(`/v1/rooms/${encodeURIComponent(roomId)}/availability${query}`)).available;
}

class Query {
  constructor(table) { this.table = table; this.filters = {}; this.action = 'select'; this.payload = null; this.isSingle = false; }
  select() { return this; }
  eq(column, value) { this.filters[column] = value; return this; }
  ilike(column, value) { this.filters[column] = String(value).replaceAll('%', ''); return this; }
  order() { return this; }
  single() { this.isSingle = true; return this; }
  maybeSingle() { this.isSingle = true; return this; }
  insert(value) { this.action = 'insert'; this.payload = value; return this; }
  async execute() {
    try {
      let data;
      if (this.table === 'hotels') {
        if (this.filters.id) {
          data = (await apiFetch(`/v1/hotels/${encodeURIComponent(this.filters.id)}${availabilityQuery(this.filters)}`)).hotel;
        } else {
          const query = [
            ...(this.filters.city ? [`city=${encodeURIComponent(this.filters.city)}`] : []),
            availabilityQuery(this.filters).replace(/^\?/, ''),
          ].filter(Boolean).join('&');
          data = await apiFetch(`/v1/hotels${query ? `?${query}` : ''}`);
        }
      } else if (this.table === 'rooms') {
        data = (await apiFetch(`/v1/hotels/${encodeURIComponent(this.filters.hotel_id)}${availabilityQuery(this.filters)}`)).rooms;
      } else if (this.table === 'users') {
        const result = await apiFetch('/v1/me');
        data = { id: result.user.id, email: result.user.email, full_name: result.profile.full_name || result.user.name, phone_number: result.profile.phone_number };
      } else if (this.table === 'bookings' && this.action === 'insert') {
        const input = Array.isArray(this.payload) ? this.payload[0] : this.payload;
        const key = input.idempotency_key;
        data = [await apiFetch('/v1/bookings', { method: 'POST', headers: { 'X-Idempotency-Key': key }, body: JSON.stringify(input) })];
      } else if (this.table === 'bookings') {
        data = await apiFetch('/v1/trips');
      } else {
        throw new Error(`Unsupported API resource: ${this.table}`);
      }
      return { data: this.isSingle && Array.isArray(data) ? data[0] || null : data, error: null };
    } catch (error) { return { data: null, error }; }
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

export const api = { from: (table) => new Query(table) };

export async function syncUser({ full_name, phone_number }) {
  return apiFetch('/v1/me', { method: 'PATCH', body: JSON.stringify({ full_name, phone_number }) });
}
