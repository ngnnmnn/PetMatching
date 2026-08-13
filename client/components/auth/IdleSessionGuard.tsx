'use client'

import { useEffect } from 'react'
import api from '@/lib/axios'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const SYNC_INTERVAL_MS = 60 * 1000
const LAST_ACTIVITY_KEY = 'petmatch_last_activity'

function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
  localStorage.removeItem('petmatch_shop_selected_pet')
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}

export default function IdleSessionGuard() {
  useEffect(() => {
    let logoutTimer: ReturnType<typeof setTimeout>
    let lastSync = 0

    const logout = () => {
      if (!localStorage.getItem('accessToken')) return
      clearSession()
      sessionStorage.setItem(
        'auth_notice',
        'Bạn đã được đăng xuất do không hoạt động trong 30 phút. Vui lòng đăng nhập lại.',
      )
      window.dispatchEvent(new Event('auth-change'))
      window.location.replace('/login')
    }

    const scheduleLogout = () => {
      clearTimeout(logoutTimer)
      if (!localStorage.getItem('accessToken')) return

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity)
      if (remaining <= 0) logout()
      else logoutTimer = setTimeout(logout, remaining)
    }

    const recordActivity = () => {
      if (!localStorage.getItem('accessToken')) return

      const now = Date.now()
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
      scheduleLogout()

      if (now - lastSync < SYNC_INTERVAL_MS) return
      lastSync = now
      void api.post<{ accessToken: string }>('/auth/refresh').then(({ data }) => {
        localStorage.setItem('accessToken', data.accessToken)
      }).catch(() => undefined)
    }

    const handleAuthChange = () => {
      if (localStorage.getItem('accessToken')) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      } else {
        localStorage.removeItem(LAST_ACTIVITY_KEY)
      }
      scheduleLogout()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY || event.key === 'accessToken') scheduleLogout()
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('auth-change', handleAuthChange)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', scheduleLogout)

    if (localStorage.getItem('accessToken') && !localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
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
