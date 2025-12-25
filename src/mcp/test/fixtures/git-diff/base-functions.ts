/**
 * Base version of functions for semantic diff testing
 * This file represents the "before" state
 */

// Function that will be removed (breaking change)
export function deprecatedFunction(input: string): string {
  return input.toUpperCase()
}

// Function that will have signature changed (breaking change)
export function processData(data: string): string {
  return data.trim()
}

// Function that will have optional param added (non-breaking)
export function formatOutput(value: number): string {
  return value.toString()
}

// Function that will remain unchanged
export function stableFunction(x: number, y: number): number {
  return x + y
}

// Interface that will have required member added (breaking)
export interface UserConfig {
  name: string
  email: string
}

// Interface that will have optional member added (non-breaking)
export interface Settings {
  theme: string
}

// Type alias that will change (breaking)
export type Status = 'pending' | 'complete'

// Constant that will be removed (breaking)
export const API_VERSION = '1.0.0'
