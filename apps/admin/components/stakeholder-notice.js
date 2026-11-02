"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function StakeholderNotice() {
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch('/v1/config').then((config) => { if (active) setTesting(config.stakeholder_testing === true); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return testing ? <p role="status" className="bg-amber-50 px-6 py-3 text-sm text-amber-900">Stakeholder testing · New bookings, inventory blocks and payout records are test data. No test money moves or test reservation emails are sent. Property and room edits update shared hotel information.</p> : null;
}
