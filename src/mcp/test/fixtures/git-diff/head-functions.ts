/**
 * Head version of functions for semantic diff testing
 * This file represents the "after" state
 */

// deprecatedFunction was removed (breaking change)

// Function with changed signature - added required param (breaking change)
export function processData(data: string, options: {trim: boolean}): string {
  return options.trim ? data.trim() : data
}

// Function with optional param added (non-breaking)
export function formatOutput(value: number, precision?: number): string {
  return precision ? value.toFixed(precision) : value.toString()
}

// Function unchanged
export function stableFunction(x: number, y: number): number {
  return x + y
}

// New function added (non-breaking)
export function newFeature(input: string[]): string[] {
  return input.map((s) => s.toLowerCase())
}

// Interface with required member added (breaking)
export interface UserConfig {
  name: string
  email: string
  role: string // New required field
}

// Interface with optional member added (non-breaking)
export interface Settings {
  theme: string
  darkMode?: boolean // New optional field
}

// Type alias changed (breaking)
export type Status = 'pending' | 'active' | 'complete' | 'archived'

// API_VERSION removed (breaking)
// New constant added (non-breaking)
export const API_ENDPOINT = '/api/v2'
