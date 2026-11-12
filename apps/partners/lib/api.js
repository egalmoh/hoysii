"use client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8787" : "https://api.hoysii.com")
).replace(/\/$/, "");
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/partner-auth`,
  plugins: [emailOTPClient()],
  fetchOptions: { credentials: "include" },
});
export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(
        body.error || body.message || `Request failed (${response.status}).`,
      ),
      { status: response.status },
    );
  return body;
}
