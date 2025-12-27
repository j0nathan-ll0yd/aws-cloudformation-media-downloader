/**
 * Git history query handler for MCP server
 * Provides semantic git history queries for tracking symbol evolution
 *
 * Features:
 * - File history with semantic annotations
 * - Symbol evolution tracking across commits
 * - Pattern-based commit search
 * - Semantic blame (who last modified a function)
 */

import {Project} from 'ts-morph'
import {type CommitInfo, getBlame, getCommitFiles, getFileAtRef, getFileHistory, searchCommits} from '../shared/git-utils.js'

export type GitHistoryQueryType = 'file' | 'symbol' | 'pattern' | 'blame_semantic'

export interface GitHistoryArgs {
  query: GitHistoryQueryType
  target: string
  since?: string
  limit?: number
}

interface SymbolHistory {
  symbol: string
  kind: 'function' | 'interface' | 'type' | 'class' | 'variable'
  commits: Array<{hash: string; date: string; author: string; message: string; changeType: 'added' | 'modified' | 'removed' | 'unchanged'}>
}

interface SemanticBlame {
  symbol: string
  kind: string
  lastModifiedBy: string
  lastModifiedDate: string
  lastModifiedCommit: string
  lineRange: {start: number; end: number}
}

/**
 * Extract exported symbols from source code
 * @param content
 * @param filePath
 */
function extractSymbols(content: string, filePath: string): Map<string, {kind: string; startLine: number; endLine: number}> {
  const symbols = new Map<string, {kind: string; startLine: number; endLine: number}>()

  try {
    const project = new Project({useInMemoryFileSystem: true, compilerOptions: {strict: true}})
    const sourceFile = project.createSourceFile(filePath, content)

    // Functions
    for (const fn of sourceFile.getFunctions()) {
      if (fn.isExported()) {
        const name = fn.getName()
        if (name) {
          symbols.set(name, {kind: 'function', startLine: fn.getStartLineNumber(), endLine: fn.getEndLineNumber()})
        }
      }
    }

    // Interfaces
    for (const iface of sourceFile.getInterfaces()) {
      if (iface.isExported()) {
        symbols.set(iface.getName(), {kind: 'interface', startLine: iface.getStartLineNumber(), endLine: iface.getEndLineNumber()})
      }
    }

    // Type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (typeAlias.isExported()) {
        symbols.set(typeAlias.getName(), {kind: 'type', startLine: typeAlias.getStartLineNumber(), endLine: typeAlias.getEndLineNumber()})
      }
    }

    // Classes
    for (const cls of sourceFile.getClasses()) {
      if (cls.isExported()) {
        const name = cls.getName()
        if (name) {
          symbols.set(name, {kind: 'class', startLine: cls.getStartLineNumber(), endLine: cls.getEndLineNumber()})
        }
      }
    }

    // Variables
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const varStmt = varDecl.getVariableStatement()
      if (varStmt?.isExported()) {
        symbols.set(varDecl.getName(), {kind: 'variable', startLine: varStmt.getStartLineNumber(), endLine: varStmt.getEndLineNumber()})
      }
    }
  } catch {
    // Parsing failed, return empty map
  }

  return symbols
}

/**
 * Annotate file history with semantic changes
 * @param filePath
 * @param limit
 */
async function getAnnotatedFileHistory(
  filePath: string,
  limit: number
): Promise<Array<CommitInfo & {symbols: {added: string[]; modified: string[]; removed: string[]}}>> {
  const history = getFileHistory(filePath, limit + 1)
  const annotatedHistory: Array<CommitInfo & {symbols: {added: string[]; modified: string[]; removed: string[]}}> = []

  for (let i = 0; i < Math.min(history.length, limit); i++) {
    const commit = history[i]
    const prevCommit = history[i + 1]

    // Get file content at current and previous commit
    const currentContent = getFileAtRef(filePath, commit.hash)
    const prevContent = prevCommit ? getFileAtRef(filePath, prevCommit.hash) : ''

    const currentSymbols = extractSymbols(currentContent, filePath)
    const prevSymbols = extractSymbols(prevContent, filePath)

    // Compare symbols
    const added: string[] = []
    const modified: string[] = []
    const removed: string[] = []

    for (const [name] of currentSymbols) {
      if (!prevSymbols.has(name)) {
        added.push(name)
      }
    }

    for (const [name] of prevSymbols) {
      if (!currentSymbols.has(name)) {
        removed.push(name)
      } else {
        // Check if modified (simplified - just check if it exists in both)
        // A more thorough check would compare the actual content
        const currentInfo = currentSymbols.get(name)!
        const prevInfo = prevSymbols.get(name)!
        if (currentInfo.endLine - currentInfo.startLine !== prevInfo.endLine - prevInfo.startLine) {
          modified.push(name)
        }
      }
    }

    annotatedHistory.push({...commit, symbols: {added, modified, removed}})
  }

  return annotatedHistory
}

/**
 * Track symbol evolution across commits
 * @param filePath
 * @param symbolName
 * @param limit
 */
async function trackSymbolHistory(filePath: string, symbolName: string, limit: number): Promise<SymbolHistory | null> {
  const history = getFileHistory(filePath, limit)

  if (history.length === 0) {
    return null
  }

  const commits: SymbolHistory['commits'] = []
  let previousExists = false
  let symbolKind: SymbolHistory['kind'] = 'function'

  for (let i = 0; i < history.length; i++) {
    const commit = history[i]
    const content = getFileAtRef(filePath, commit.hash)
    const symbols = extractSymbols(content, filePath)
    const symbolInfo = symbols.get(symbolName)

    if (symbolInfo) {
      symbolKind = symbolInfo.kind as SymbolHistory['kind']

      if (!previousExists) {
        commits.push({hash: commit.hash, date: commit.date, author: commit.author, message: commit.message, changeType: 'added'})
      } else {
        // Check if modified by comparing with next (older) commit
        const nextCommit = history[i + 1]
        if (nextCommit) {
          const nextContent = getFileAtRef(filePath, nextCommit.hash)
          const nextSymbols = extractSymbols(nextContent, filePath)
          const nextSymbolInfo = nextSymbols.get(symbolName)

          if (!nextSymbolInfo) {
            commits.push({hash: commit.hash, date: commit.date, author: commit.author, message: commit.message, changeType: 'added'})
          } else {
            // Symbol existed in both, check if modified
            commits.push({hash: commit.hash, date: commit.date, author: commit.author, message: commit.message, changeType: 'modified'})
          }
        }
      }
      previousExists = true
    } else if (previousExists) {
      commits.push({hash: commit.hash, date: commit.date, author: commit.author, message: commit.message, changeType: 'removed'})
      previousExists = false
    }
  }

  if (commits.length === 0) {
    return null
  }

  return {symbol: symbolName, kind: symbolKind, commits}
}

/**
 * Get semantic blame for symbols in a file
 * @param filePath
 */
function getSemanticBlame(filePath: string): SemanticBlame[] {
  const content = getFileAtRef(filePath, 'HEAD')
  if (!content) {
    return []
  }

  const symbols = extractSymbols(content, filePath)
  const results: SemanticBlame[] = []

  for (const [name, info] of symbols) {
    const blameInfo = getBlame(filePath, info.startLine, info.endLine)

    if (blameInfo.length > 0) {
      // Find the most recent modification
      const sortedBlame = [...blameInfo].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const mostRecent = sortedBlame[0]

      results.push({
        symbol: name,
        kind: info.kind,
        lastModifiedBy: mostRecent.author,
        lastModifiedDate: mostRecent.date,
        lastModifiedCommit: mostRecent.commit,
        lineRange: {start: info.startLine, end: info.endLine}
      })
    }
  }

  return results.sort((a, b) => a.lineRange.start - b.lineRange.start)
}

/**
 * Main handler for git history queries
 * @param args
 */
export async function handleGitHistoryQuery(args: GitHistoryArgs) {
  const {query, target, limit = 10} = args

  if (!target) {
    return {
      error: 'Target required',
      examples: [
        {query: 'file', target: 'src/entities/Files.ts'},
        {query: 'symbol', target: 'src/entities/Files.ts:FileEntity'},
        {query: 'pattern', target: 'getRequiredEnv'},
        {query: 'blame_semantic', target: 'src/util/env-validation.ts'}
      ]
    }
  }

  switch (query) {
    case 'file': {
      // Get annotated file history
      const history = await getAnnotatedFileHistory(target, limit)

      if (history.length === 0) {
        return {file: target, message: 'No history found', commits: []}
      }

      return {
        file: target,
        totalCommits: history.length,
        commits: history.map((c) => ({hash: c.hash.substring(0, 8), author: c.author, date: c.date, message: c.message, symbolChanges: c.symbols})),
        summary: {
          totalAdded: history.reduce((sum, c) => sum + c.symbols.added.length, 0),
          totalModified: history.reduce((sum, c) => sum + c.symbols.modified.length, 0),
          totalRemoved: history.reduce((sum, c) => sum + c.symbols.removed.length, 0)
        }
      }
    }

    case 'symbol': {
      // Track symbol evolution: target format is "file:symbol"
      const [filePath, symbolName] = target.includes(':') ? target.split(':') : [target, null]

      if (!symbolName) {
        // List all symbols in the file
        const content = getFileAtRef(filePath, 'HEAD')
        if (!content) {
          return {error: `File not found: ${filePath}`}
        }

        const symbols = extractSymbols(content, filePath)
        return {
          file: filePath,
          symbols: Array.from(symbols.entries()).map(([name, info]) => ({name, kind: info.kind, lines: `${info.startLine}-${info.endLine}`})),
          usage: `Use target: '${filePath}:symbolName' to track a specific symbol`
        }
      }

      const symbolHistory = await trackSymbolHistory(filePath, symbolName, limit)

      if (!symbolHistory) {
        return {file: filePath, symbol: symbolName, message: 'Symbol not found or no history available'}
      }

      return {
        file: filePath,
        symbol: symbolHistory.symbol,
        kind: symbolHistory.kind,
        evolution: symbolHistory.commits.map((c) => ({
          hash: c.hash.substring(0, 8),
          date: c.date,
          author: c.author,
          change: c.changeType,
          message: c.message
        }))
      }
    }

    case 'pattern': {
      // Search commits containing a pattern
      const commits = searchCommits(target, limit)

      if (commits.length === 0) {
        return {pattern: target, message: 'No commits found containing this pattern', commits: []}
      }

      // Get files changed in each commit
      const enrichedCommits = commits.map((c) => {
        const files = getCommitFiles(c.hash)
        return {hash: c.hash.substring(0, 8), author: c.author, date: c.date, message: c.message, filesChanged: files.slice(0, 5), totalFiles: files.length}
      })

      return {pattern: target, totalCommits: commits.length, commits: enrichedCommits}
    }

    case 'blame_semantic': {
      // Get semantic blame for all symbols in a file
      const blameResults = getSemanticBlame(target)

      if (blameResults.length === 0) {
        return {file: target, message: 'No exported symbols found or file not found', symbols: []}
      }

      return {
        file: target,
        totalSymbols: blameResults.length,
        symbols: blameResults.map((b) => ({
          name: b.symbol,
          kind: b.kind,
          lastModifiedBy: b.lastModifiedBy,
          lastModifiedDate: b.lastModifiedDate.split('T')[0],
          commit: b.lastModifiedCommit.substring(0, 8),
          lines: `${b.lineRange.start}-${b.lineRange.end}`
        }))
      }
    }

    default:
      return {
        error: `Unknown query type: ${query}`,
        availableQueries: ['file', 'symbol', 'pattern', 'blame_semantic'],
        examples: [
          {query: 'file', target: 'src/entities/Files.ts', limit: 10},
          {query: 'symbol', target: 'src/entities/Files.ts:FileEntity'},
          {query: 'pattern', target: 'getRequiredEnv'},
          {query: 'blame_semantic', target: 'src/util/env-validation.ts'}
        ]
      }
  }
}
