'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './navbar'

export function ConditionalNavbar() {
  const pathname = usePathname()

  // Don't show navbar on admin login page
  if (pathname === '/admin' || pathname === '/admin/setup') {
    return null
  }

  return <Navbar />
}
