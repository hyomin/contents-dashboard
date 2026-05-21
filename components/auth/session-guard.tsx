'use client'

import { SessionActivityProvider } from '@/components/auth/session-activity-provider'

export function SessionGuard({ children }: { children: React.ReactNode }) {
  return <SessionActivityProvider>{children}</SessionActivityProvider>
}
