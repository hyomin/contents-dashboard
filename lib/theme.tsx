'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'soft' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'soft' | 'dark'

interface ThemeCtx {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyThemeClasses(t: Theme): ResolvedTheme {
  const root = document.documentElement
  root.classList.remove('dark', 'soft')

  if (t === 'light') return 'light'
  if (t === 'soft') {
    root.classList.add('dark', 'soft')
    return 'soft'
  }
  if (t === 'dark') {
    root.classList.add('dark')
    return 'dark'
  }
  if (getSystemDark()) {
    root.classList.add('dark')
    return 'dark'
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) ?? 'system'
    setThemeState(saved)
    setResolvedTheme(applyThemeClasses(saved))

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if ((localStorage.getItem('theme') ?? 'system') === 'system') {
        setResolvedTheme(applyThemeClasses('system'))
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = (t: Theme) => {
    localStorage.setItem('theme', t)
    setThemeState(t)
    setResolvedTheme(applyThemeClasses(t))
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const RESOLVED_THEME_LABELS: Record<ResolvedTheme, string> = {
  light: 'Light',
  soft: 'Soft (회색)',
  dark: 'Dark',
}
