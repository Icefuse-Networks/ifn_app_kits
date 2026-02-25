/**
 * useExitAnimation — Lightweight replacement for framer-motion AnimatePresence
 *
 * Delays unmounting so CSS exit animations can play before the element is removed.
 *
 * @param isVisible - Whether the element should be shown
 * @param duration - How long the exit animation takes (ms). Must match CSS animation duration.
 * @returns { shouldRender, isExiting } - Render while shouldRender is true, apply exit class when isExiting
 *
 * @example
 * const { shouldRender, isExiting } = useExitAnimation(isOpen, 200)
 *
 * {shouldRender && (
 *   <div className={cn('anim-fade-slide-up', isExiting && 'anim-fade-out')}>
 *     {content}
 *   </div>
 * )}
 */

import { useState, useEffect, useRef } from 'react'

export function useExitAnimation(isVisible: boolean, duration = 200) {
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [isExiting, setIsExiting] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isVisible) {
      // Entering: show immediately
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setShouldRender(true)
      setIsExiting(false)
    } else if (shouldRender) {
      // Exiting: start exit animation, then unmount after duration
      setIsExiting(true)
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false)
        setIsExiting(false)
        timeoutRef.current = null
      }, duration)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isVisible, duration, shouldRender])

  return { shouldRender, isExiting }
}
