'use client'

import { useEffect } from 'react'
import api from '@/lib/axios'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const SYNC_INTERVAL_MS = 60 * 1000
const ACTIVITY_PERSIST_INTERVAL_MS = 15 * 1000
const LAST_ACTIVITY_KEY = 'petmatch_last_activity'
const LAST_REFRESH_KEY = 'petmatch_last_token_refresh'

function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
  localStorage.removeItem('petmatch_shop_selected_pet')
  localStorage.removeItem(LAST_ACTIVITY_KEY)
  localStorage.removeItem(LAST_REFRESH_KEY)
}

export default function IdleSessionGuard() {
  useEffect(() => {
    let logoutTimer: ReturnType<typeof setTimeout> | undefined
    let hasActiveSession = Boolean(localStorage.getItem('accessToken'))
    let lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
    let lastPersistedActivityAt = lastActivityAt
    let lastRefreshAt = Number(localStorage.getItem(LAST_REFRESH_KEY)) || 0

    const logout = () => {
      if (!hasActiveSession) return
      hasActiveSession = false
      clearSession()
      sessionStorage.setItem(
        'auth_notice',
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      )
      window.dispatchEvent(new Event('auth-change'))
      window.location.replace('/login')
    }

    const scheduleLogout = () => {
      clearTimeout(logoutTimer)
      if (!hasActiveSession) return

      const persistedActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0
      lastActivityAt = Math.max(lastActivityAt, persistedActivity)
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt)
      if (remaining <= 0) logout()
      else logoutTimer = setTimeout(scheduleLogout, remaining)
    }

    const recordActivity = () => {
      if (!hasActiveSession) return

      const now = Date.now()
      lastActivityAt = now

      if (now - lastPersistedActivityAt >= ACTIVITY_PERSIST_INTERVAL_MS) {
        lastPersistedActivityAt = now
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
        scheduleLogout()
      }

      if (now - lastRefreshAt < SYNC_INTERVAL_MS) return
      lastRefreshAt = now
      localStorage.setItem(LAST_REFRESH_KEY, String(now))
      void api.post<{ accessToken: string }>('/auth/refresh').then(({ data }) => {
        if (hasActiveSession) localStorage.setItem('accessToken', data.accessToken)
      }).catch(() => undefined)
    }

    const handleAuthChange = () => {
      hasActiveSession = Boolean(localStorage.getItem('accessToken'))
      if (hasActiveSession) {
        const now = Date.now()
        lastActivityAt = now
        lastPersistedActivityAt = now
        lastRefreshAt = 0
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
        localStorage.removeItem(LAST_REFRESH_KEY)
      } else {
        localStorage.removeItem(LAST_ACTIVITY_KEY)
        localStorage.removeItem(LAST_REFRESH_KEY)
      }
      scheduleLogout()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'accessToken') {
        hasActiveSession = Boolean(event.newValue)
      } else if (event.key === LAST_ACTIVITY_KEY) {
        const storedActivity = Number(event.newValue) || 0
        lastActivityAt = Math.max(lastActivityAt, storedActivity)
        lastPersistedActivityAt = Math.max(lastPersistedActivityAt, storedActivity)
      } else if (event.key === LAST_REFRESH_KEY) {
        lastRefreshAt = Number(event.newValue) || 0
        return
      } else {
        return
      }
      scheduleLogout()
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('auth-change', handleAuthChange)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', scheduleLogout)

    if (hasActiveSession && !localStorage.getItem(LAST_ACTIVITY_KEY)) {
      const now = Date.now()
      lastActivityAt = now
      lastPersistedActivityAt = now
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
    }
    scheduleLogout()

    return () => {
      clearTimeout(logoutTimer)
      events.forEach((event) => window.removeEventListener(event, recordActivity))
      window.removeEventListener('auth-change', handleAuthChange)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', scheduleLogout)
    }
  }, [])

  return null
}
