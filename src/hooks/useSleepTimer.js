import { useState, useRef, useCallback, useEffect } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart']

export function useSleepTimer({ active, sleepMsRef }) {
  const [sleeping, setSleeping] = useState(false)
  const sleepTimer = useRef(null)

  const resetSleep = useCallback(() => {
    setSleeping(false)
    clearTimeout(sleepTimer.current)
    sleepTimer.current = setTimeout(() => setSleeping(true), sleepMsRef.current)
  }, [sleepMsRef])

  useEffect(() => {
    if (!active) return
    resetSleep()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetSleep, { passive: true }))
    return () => {
      clearTimeout(sleepTimer.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetSleep))
    }
  }, [active, resetSleep])

  return { sleeping, setSleeping, resetSleep }
}
