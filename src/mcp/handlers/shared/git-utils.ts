/**
 * Shared Git utilities for MCP handlers
 * Provides caching, git command execution, and file retrieval at specific refs
 */

import {execSync, spawn} from 'child_process'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

// Cache for git operations
interface GitCache {
  changedFiles: Map<string, string[]>
  fileAtRef: Map<string, string>
  lastUpdate: number
}

const cache: GitCache = {changedFiles: new Map(), fileAtRef: new Map(), lastUpdate: 0}

const CACHE_TTL = 30000 // 30 seconds for git operations

/**
 * Execute a git command and return stdout
 */
export function execGit(args: string[], options: {cwd?: string} = {}): string {
  const cwd = options.cwd || projectRoot
  try {
    return execSync(`git ${args.join(' ')}`, {cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024}).trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Git command failed: git ${args.join(' ')}\n${message}`)
  }
}

/**
 * Execute a git command asynchronously with streaming output
 */
export function execGitAsync(args: string[], options: {cwd?: string} = {}): Promise<string> {
  const cwd = options.cwd || projectRoot
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {cwd})
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`Git command failed (code ${code}): git ${args.join(' ')}\n${stderr}`))
      }
    })
  })
}

/**
 * Get the list of changed files between two refs
 */
export function getChangedFiles(baseRef: string, headRef: string): string[] {
  const cacheKey = `${baseRef}..${headRef}`
  const now = Date.now()

  if (cache.changedFiles.has(cacheKey) && now - cache.lastUpdate < CACHE_TTL) {
    return cache.changedFiles.get(cacheKey)!
  }

  const output = execGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}..${headRef}`])
  const files = output.split('\n').filter((f) => f.length > 0 && f.endsWith('.ts'))

  cache.changedFiles.set(cacheKey, files)
  cache.lastUpdate = now

  return files
}

/**
 * Get file content at a specific git ref
 */
export function getFileAtRef(filePath: string, ref: string): string {
  const cacheKey = `${ref}:${filePath}`

  if (cache.fileAtRef.has(cacheKey)) {
    return cache.fileAtRef.get(cacheKey)!
  }

  try {
    const content = execGit(['show', `${ref}:${filePath}`])
    cache.fileAtRef.set(cacheKey, content)
    return content
  } catch {
    // File might not exist at that ref
    return ''
  }
}

/**
 * Check if a file exists at a specific ref
 */
export function fileExistsAtRef(filePath: string, ref: string): boolean {
  try {
    execGit(['cat-file', '-e', `${ref}:${filePath}`])
    return true
  } catch {
    return false
  }
}

/**
 * Get the current branch name
 */
export function getCurrentBranch(): string {
  return execGit(['rev-parse', '--abbrev-ref', 'HEAD'])
}

/**
 * Get the current commit hash
 */
export function getCurrentCommit(): string {
  return execGit(['rev-parse', 'HEAD'])
}

/**
 * Get the merge base between two refs
 */
export function getMergeBase(ref1: string, ref2: string): string {
  return execGit(['merge-base', ref1, ref2])
}

/**
 * Get the diff for a specific file between two refs
 */
export function getFileDiff(filePath: string, baseRef: string, headRef: string): string {
  try {
    return execGit(['diff', `${baseRef}..${headRef}`, '--', filePath])
  } catch {
    return ''
  }
}

/**
 * Get blame information for a file
 */
export interface BlameInfo {
  line: number
  commit: string
  author: string
  date: string
  content: string
}

/**
 *
 */
export function getBlame(filePath: string, startLine?: number, endLine?: number): BlameInfo[] {
  const lineArgs = startLine !== undefined && endLine !== undefined ? ['-L', `${startLine},${endLine}`] : []

  try {
    const output = execGit(['blame', '--porcelain', ...lineArgs, filePath])
    const lines = output.split('\n')
    const blames: BlameInfo[] = []

    let currentCommit = ''
    let currentAuthor = ''
    let currentDate = ''
    let lineNumber = startLine || 1

    for (const line of lines) {
      if (line.match(/^[0-9a-f]{40}/)) {
        currentCommit = line.substring(0, 40)
      } else if (line.startsWith('author ')) {
        currentAuthor = line.substring(7)
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12), 10)
        currentDate = new Date(timestamp * 1000).toISOString()
      } else if (line.startsWith('\t')) {
        blames.push({line: lineNumber++, commit: currentCommit, author: currentAuthor, date: currentDate, content: line.substring(1)})
      }
    }

    return blames
  } catch {
    return []
  }
}

/**
 * Get commit history for a file
 */
export interface CommitInfo {
  hash: string
  author: string
  date: string
  message: string
}

/**
 *
 */
export function getFileHistory(filePath: string, limit = 10): CommitInfo[] {
  try {
    const output = execGit(['log', '--format=%H|%an|%ai|%s', `-n${limit}`, '--', filePath])
    return output.split('\n').filter(Boolean).map((line) => {
      const [hash, author, date, ...messageParts] = line.split('|')
      return {hash, author, date, message: messageParts.join('|')}
    })
  } catch {
    return []
  }
}

/**
 * Get commits containing a pattern
 */
export function searchCommits(pattern: string, limit = 20): CommitInfo[] {
  try {
    const output = execGit(['log', '--format=%H|%an|%ai|%s', `-n${limit}`, '-S', pattern])
    return output.split('\n').filter(Boolean).map((line) => {
      const [hash, author, date, ...messageParts] = line.split('|')
      return {hash, author, date, message: messageParts.join('|')}
    })
  } catch {
    return []
  }
}

/**
 * Get all TypeScript files that changed in a specific commit
 */
export function getCommitFiles(commit: string): string[] {
  try {
    const output = execGit(['diff-tree', '--no-commit-id', '--name-only', '-r', commit])
    return output.split('\n').filter((f) => f.endsWith('.ts'))
  } catch {
    return []
  }
}

/**
 * Clear the git cache (useful for testing)
 */
export function clearCache(): void {
  cache.changedFiles.clear()
  cache.fileAtRef.clear()
  cache.lastUpdate = 0
}

/**
 * Get the project root path
 */
export function getProjectRoot(): string {
  return projectRoot
}

export type { GitCache }
