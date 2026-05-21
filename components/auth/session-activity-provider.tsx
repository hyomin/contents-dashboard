'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { HEARTBEAT_MIN_INTERVAL_MS, SESSION_IDLE_MS } from '@/lib/auth/constants'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

interface SessionActivityContextValue {
  remainingMs: number
  recordActivity: () => void
}

const SessionActivityContext = createContext<SessionActivityContextValue | null>(null)

export function useSessionActivity(): SessionActivityContextValue {
  const ctx = useContext(SessionActivityContext)
  if (!ctx) {
    throw new Error('useSessionActivity must be used within SessionActivityProvider')
  }
  return ctx
}

export function SessionActivityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now())
  const [remainingMs, setRemainingMs] = useState(SESSION_IDLE_MS)
  const lastHeartbeatRef = useRef(0)
  const isLoggingOutRef = useRef(false)

  const recordActivity = useCallback(() => {
    setLastActivityAt(Date.now())
  }, [])

  const forceLogout = useCallback(
    async (reason: 'idle' | 'expired') => {
      if (isLoggingOutRef.current) return
      isLoggingOutRef.current = true

      try {
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        /* ignore */
      }

      const query = reason === 'idle' ? '?reason=idle' : '?reason=expired'
      router.replace(`/login${query}`)
      router.refresh()
    },
    [router],
  )

  const sendHeartbeat = useCallback(async () => {
    const now = Date.now()
    if (now - lastHeartbeatRef.current < HEARTBEAT_MIN_INTERVAL_MS) return
    lastHeartbeatRef.current = now

    try {
      const res = await fetch('/api/auth/heartbeat', { method: 'POST' })
      if (res.status === 401) {
        await forceLogout('expired')
      }
    } catch {
      /* ignore */
    }
  }, [forceLogout])

  useEffect(() => {
    function onActivity() {
      recordActivity()
      void sendHeartbeat()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    const idleCheck = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityAt
      if (elapsed >= SESSION_IDLE_MS) {
        void forceLogout('idle')
      }
    }, 30_000)

    const heartbeatInterval = window.setInterval(() => {
      void sendHeartbeat()
    }, HEARTBEAT_MIN_INTERVAL_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      window.clearInterval(idleCheck)
      window.clearInterval(heartbeatInterval)
    }
  }, [forceLogout, lastActivityAt, recordActivity, sendHeartbeat])

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - lastActivityAt
      const left = Math.max(0, SESSION_IDLE_MS - elapsed)
      setRemainingMs(left)
      if (left === 0) {
        void forceLogout('idle')
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [forceLogout, lastActivityAt])

  const value = useMemo(
    () => ({ remainingMs, recordActivity }),
    [remainingMs, recordActivity],
  )

  return (
    <SessionActivityContext.Provider value={value}>{children}</SessionActivityContext.Provider>
  )
}
