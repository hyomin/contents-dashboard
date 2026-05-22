'use client'

import { useEffect, useState } from 'react'
import { seedWorkspaceIfEmpty } from '@/lib/dashboard/dashboard-storage'

export function useWorkspaceSeed() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    seedWorkspaceIfEmpty()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
