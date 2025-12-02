/**
 * Parser for conventions-tracking.md
 * Extracts structured convention data from markdown format
 */

export type ConventionCategory = 'testing' | 'aws' | 'typescript' | 'git' | 'infrastructure' | 'security' | 'meta' | 'patterns' | 'unknown'
export type ConventionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type ConventionStatus = 'pending' | 'documented' | 'proposed' | 'archived'

export interface Convention {
  name: string
  type: string
  category: ConventionCategory
  severity: ConventionSeverity
  status: ConventionStatus
  what: string
  why: string
  wikiPath?: string
  enforcement?: string
  detectedDate?: string
}

interface ParsedConventions {
  conventions: Convention[]
  metadata: {totalCount: number; documentedCount: number; pendingCount: number; lastUpdated?: string}
}

/**
 * Infer category from convention type or wiki path
 */
function inferCategory(type: string, wikiPath?: string): ConventionCategory {
  const typeLower = type.toLowerCase()
  const pathLower = (wikiPath || '').toLowerCase()

  if (typeLower.includes('test') || pathLower.includes('testing')) {
    return 'testing'
  }
  if (typeLower.includes('security') || typeLower.includes('pnpm') || typeLower.includes('supply chain')) {
    return 'security'
  }
  if (pathLower.includes('aws') || typeLower.includes('aws') || typeLower.includes('sdk')) {
    return 'aws'
  }
  if (pathLower.includes('typescript') || typeLower.includes('typescript')) {
    return 'typescript'
  }
  if (pathLower.includes('git') || typeLower.includes('git') || typeLower.includes('commit')) {
    return 'git'
  }
  if (pathLower.includes('infrastructure') || typeLower.includes('script')) {
    return 'infrastructure'
  }
  if (pathLower.includes('meta') || typeLower.includes('convention') || typeLower.includes('standard')) {
    return 'meta'
  }
  if (typeLower.includes('pattern') || typeLower.includes('methodology')) {
    return 'patterns'
  }

  return 'unknown'
}

/**
 * Parse severity from priority string
 */
function parseSeverity(priority?: string): ConventionSeverity {
  if (!priority) {
    return 'MEDIUM'
  }
  const upper = priority.toUpperCase()
  if (upper.includes('CRITICAL')) {
    return 'CRITICAL'
  }
  if (upper.includes('HIGH')) {
    return 'HIGH'
  }
  if (upper.includes('LOW')) {
    return 'LOW'
  }
  return 'MEDIUM'
}

/**
 * Parse a single convention block from markdown
 */
function parseConventionBlock(block: string, defaultStatus: ConventionStatus): Convention | null {
  // Match convention header: "1. **Name** (Type)" or "### Name"
  const headerMatch = block.match(/^\d+\.\s+\*\*(.+?)\*\*\s*\((.+?)\)/m) || block.match(/^###\s+(.+?)$/m)

  if (!headerMatch) {
    return null
  }

  const name = headerMatch[1].trim()
  const type = headerMatch[2]?.trim() || 'Convention'

  // Extract fields using regex
  const whatMatch = block.match(/\*\*What\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)
  const whyMatch = block.match(/\*\*Why\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)
  const targetMatch = block.match(/\*\*(?:Target|Documented)\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)
  const priorityMatch = block.match(/\*\*Priority\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)
  const statusMatch = block.match(/\*\*Status\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)
  const enforcementMatch = block.match(/\*\*Enforcement\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)
  const detectedMatch = block.match(/\*\*Detected\*\*:\s*(.+?)(?=\n\s*-|\n\s*\*\*|$)/s)

  const what = whatMatch?.[1]?.trim() || ''
  const why = whyMatch?.[1]?.trim() || ''
  const wikiPath = targetMatch?.[1]?.trim()

  // Determine actual status from status field or section default
  let status = defaultStatus
  if (statusMatch) {
    const statusText = statusMatch[1].toLowerCase()
    if (statusText.includes('documented') || statusText.includes('✅')) {
      status = 'documented'
    } else if (statusText.includes('pending') || statusText.includes('⏳')) {
      status = 'pending'
    } else if (statusText.includes('proposed')) {
      status = 'proposed'
    }
  }

  return {
    name,
    type,
    category: inferCategory(type, wikiPath),
    severity: parseSeverity(priorityMatch?.[1]),
    status,
    what,
    why,
    wikiPath,
    enforcement: enforcementMatch?.[1]?.trim(),
    detectedDate: detectedMatch?.[1]?.trim()
  }
}

/**
 * Parse conventions-tracking.md content into structured data
 */
export function parseConventions(content: string): ParsedConventions {
  const conventions: Convention[] = []

  // Extract metadata
  const lastUpdatedMatch = content.match(/\*\*Last Updated\*\*:\s*(\d{4}-\d{2}-\d{2})/)
  const totalMatch = content.match(/\*\*Total Conventions\*\*:\s*(\d+)\s*detected,\s*(\d+)\s*documented,\s*(\d+)\s*pending/)

  // Split by sections
  const sections: Array<{pattern: RegExp; status: ConventionStatus}> = [
    {pattern: /## 🟡 Pending Documentation([\s\S]*?)(?=## ✅|## 💭|## 🗄️|## Usage|$)/, status: 'pending'},
    {pattern: /## ✅ Recently Documented([\s\S]*?)(?=## 🟡|## 💭|## 🗄️|## Usage|$)/, status: 'documented'},
    {pattern: /## 💭 Proposed Conventions([\s\S]*?)(?=## 🟡|## ✅|## 🗄️|## Usage|$)/, status: 'proposed'},
    {pattern: /## 🗄️ Archived Conventions([\s\S]*?)(?=## 🟡|## ✅|## 💭|## Usage|$)/, status: 'archived'}
  ]

  for (const {pattern, status} of sections) {
    const sectionMatch = content.match(pattern)
    if (!sectionMatch) {
      continue
    }

    const sectionContent = sectionMatch[1]

    // Split section into convention blocks (numbered items or ### headers)
    const blocks = sectionContent.split(/(?=^\d+\.\s+\*\*|^###\s+)/m).filter((b) => b.trim())

    for (const block of blocks) {
      const convention = parseConventionBlock(block, status)
      if (convention && convention.what) {
        conventions.push(convention)
      }
    }
  }

  return {
    conventions,
    metadata: {
      totalCount: totalMatch ? parseInt(totalMatch[1], 10) : conventions.length,
      documentedCount: totalMatch ? parseInt(totalMatch[2], 10) : conventions.filter((c) => c.status === 'documented').length,
      pendingCount: totalMatch ? parseInt(totalMatch[3], 10) : conventions.filter((c) => c.status === 'pending').length,
      lastUpdated: lastUpdatedMatch?.[1]
    }
  }
}

/**
 * Search conventions by term (searches name, what, why fields)
 */
export function searchConventions(conventions: Convention[], term: string): Convention[] {
  const termLower = term.toLowerCase()
  return conventions.filter((c) =>
    c.name.toLowerCase().includes(termLower) || c.what.toLowerCase().includes(termLower) || c.why.toLowerCase().includes(termLower)
  )
}

/**
 * Filter conventions by category
 */
export function filterByCategory(conventions: Convention[], category: ConventionCategory): Convention[] {
  return conventions.filter((c) => c.category === category)
}

/**
 * Filter conventions by severity
 */
export function filterBySeverity(conventions: Convention[], severity: ConventionSeverity): Convention[] {
  return conventions.filter((c) => c.severity === severity)
}

/**
 * Filter conventions by status
 */
export function filterByStatus(conventions: Convention[], status: ConventionStatus): Convention[] {
  return conventions.filter((c) => c.status === status)
}
