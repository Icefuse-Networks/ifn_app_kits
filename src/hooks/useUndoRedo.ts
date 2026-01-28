/**
 * useUndoRedo Hook
 *
 * Provides undo/redo functionality with history management.
 * Used by the Kit Manager for state history.
 */

import { useState, useCallback } from 'react'

/** Maximum number of history entries to keep */
const MAX_HISTORY = 50

export interface UndoRedoState<T> {
  /** Current state value */
  current: T
  /** Update state and add to history */
  setState: (newState: T | ((prev: T) => T)) => void
  /** Undo to previous state */
  undo: () => void
  /** Redo to next state */
  redo: () => void
  /** Whether undo is available */
  canUndo: boolean
  /** Whether redo is available */
  canRedo: boolean
  /** Reset history with new initial state */
  reset: (newState: T) => void
  /** Current history index */
  historyIndex: number
  /** Total history length */
  historyLength: number
}

/**
 * Hook for managing state with undo/redo history
 *
 * @param initialState - Initial state value
 * @returns UndoRedoState object with state and controls
 *
 * @example
 * const { current, setState, undo, redo, canUndo, canRedo } = useUndoRedo({ count: 0 })
 */
export function useUndoRedo<T>(initialState: T): UndoRedoState<T> {
  const [history, setHistory] = useState<T[]>([initialState])
  const [currentIndex, setCurrentIndex] = useState(0)

  // Current value is the state at current index
  const current = history[currentIndex]

  // Update state and add to history
  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setHistory((prev) => {
        const currentValue = prev[currentIndex]
        const nextValue =
          typeof newState === 'function'
            ? (newState as (prev: T) => T)(currentValue)
            : newState

        // Remove any future history (we're creating new timeline)
        const newHistory = prev.slice(0, currentIndex + 1)

        // Add new state
        newHistory.push(nextValue)

        // Trim to max history size
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift()
          // Adjust current index since we removed from the start
          setCurrentIndex((idx) => Math.max(0, idx))
        }

        return newHistory
      })

      // Move to the new state
      setCurrentIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1))
    },
    [currentIndex]
  )

  // Undo to previous state
  const undo = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }, [])

  // Redo to next state
  const redo = useCallback(() => {
    setCurrentIndex((prev) => Math.min(history.length - 1, prev + 1))
  }, [history.length])

  // Reset history with new initial state
  const reset = useCallback((newState: T) => {
    setHistory([newState])
    setCurrentIndex(0)
  }, [])

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1

  return {
    current,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    historyIndex: currentIndex,
    historyLength: history.length,
  }
}

export default useUndoRedo
