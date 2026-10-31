'use client'

import { API_URL } from './auth-client'

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`)
  return body
}

class Query {
  constructor(table) { this.table = table; this.filters = {}; this.action = 'select'; this.payload = null; this.isSingle = false }
  select() { return this }
  eq(column, value) { this.filters[column] = value; return this }
  order() { return this }
  single() { this.isSingle = true; return this }
  maybeSingle() { this.isSingle = true; return this }
  insert(value) { this.action = 'insert'; this.payload = value; return this }
  update(value) { this.action = 'update'; this.payload = value; return this }
  delete() { this.action = 'delete'; return this }
  async execute() {
    try {
      let data
      if (this.table === 'hotels') {
        if (this.action === 'insert') data = await apiFetch('/v1/admin/hotels', { method: 'POST', body: JSON.stringify(this.payload) })
        else if (this.action === 'update') data = await apiFetch(`/v1/admin/hotels/${encodeURIComponent(this.filters.id)}`, { method: 'PATCH', body: JSON.stringify(this.payload) })
        else if (this.action === 'delete') data = await apiFetch(`/v1/admin/hotels/${encodeURIComponent(this.filters.id)}`, { method: 'DELETE' })
        else if (this.filters.id) data = (await apiFetch(`/v1/hotels/${encodeURIComponent(this.filters.id)}`)).hotel
        else data = await apiFetch('/v1/admin/hotels')
      } else if (this.table === 'rooms') {
        if (this.action === 'insert') data = await apiFetch('/v1/admin/rooms', { method: 'POST', body: JSON.stringify(this.payload) })
        else if (this.action === 'delete') data = await apiFetch(`/v1/admin/rooms/${encodeURIComponent(this.filters.id)}`, { method: 'DELETE' })
        else data = (await apiFetch(`/v1/hotels/${encodeURIComponent(this.filters.hotel_id)}`)).rooms
      } else if (this.table === 'bookings') {
        if (this.action === 'update') data = await apiFetch(`/v1/admin/bookings/${encodeURIComponent(this.filters.id)}/payment`, { method: 'PATCH', body: JSON.stringify(this.payload) })
        else data = await apiFetch('/v1/admin/bookings')
      } else if (this.table === 'users') {
        data = await apiFetch('/v1/admin/users')
      } else throw new Error(`Unsupported API resource: ${this.table}`)
      return { data: this.isSingle && Array.isArray(data) ? data[0] || null : data, error: null }
    } catch (error) { return { data: null, error } }
  }
  then(resolve, reject) { return this.execute().then(resolve, reject) }
}

export const api = { from: (table) => new Query(table) }
