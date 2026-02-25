/**
 * Utility Functions - Icefuse Kit Manager
 *
 * Centralized utilities for class merging and formatting.
 */

/**
 * Merge class names, filtering out falsy values
 *
 * @example
 * cn('base-class', isActive && 'active', disabled && 'disabled')
 * // Returns: 'base-class active' (if isActive is true, disabled is false)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
