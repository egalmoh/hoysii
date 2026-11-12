'use client'

import { createAuthClient } from 'better-auth/react'

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8787' : 'https://api.hoysii.com')).replace(/\/$/, '')

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/admin-auth`,
  fetchOptions: { credentials: 'include' },
})
