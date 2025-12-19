/**
 * Fixture loading utility for MCP validation rule tests
 *
 * Loads .fixture.ts files and parses JSDoc metadata for test assertions.
 * Fixtures are TypeScript files containing code patterns to validate.
 */

import {readFileSync, readdirSync} from 'node:fs'
import {join, basename} from 'node:path'
import {Project, SourceFile} from 'ts-morph'

/**
 * Metadata extracted from fixture JSDoc comments
 */
export interface FixtureMetadata {
	/** Type of fixture: 'invalid' or 'valid' */
	fixture: 'invalid' | 'valid'
	/** Name of the validation rule this fixture tests */
	rule: string
	/** Expected severity level */
	severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
	/** Human-readable description */
	description?: string
	/** Expected number of violations (for invalid fixtures) */
	expectedViolations?: number
	/** Simulated file path for the rule to evaluate */
	simulatedPath?: string
}

/**
 * Result of loading a fixture file
 */
export interface LoadedFixture {
	/** ts-morph SourceFile for validation */
	sourceFile: SourceFile
	/** Parsed metadata from JSDoc */
	metadata: FixtureMetadata
	/** Raw file content */
	content: string
	/** Original file path */
	filePath: string
}

// Shared ts-morph project for creating source files
const project = new Project({
	skipFileDependencyResolution: true,
	skipAddingFilesFromTsConfig: true
})

// Cache for loaded fixtures
const fixtureCache = new Map<string, LoadedFixture>()

/**
 * Parse JSDoc metadata from fixture file content
 */
function parseMetadata(content: string): Partial<FixtureMetadata> {
	const metadata: Partial<FixtureMetadata> = {}

	// Match JSDoc block at start of file
	const jsdocMatch = content.match(/^\/\*\*[\s\S]*?\*\//)
	if (!jsdocMatch) {
		return metadata
	}

	const jsdoc = jsdocMatch[0]

	// Parse @fixture tag
	const fixtureMatch = jsdoc.match(/@fixture\s+(invalid|valid)/)
	if (fixtureMatch) {
		metadata.fixture = fixtureMatch[1] as 'invalid' | 'valid'
	}

	// Parse @rule tag
	const ruleMatch = jsdoc.match(/@rule\s+(\S+)/)
	if (ruleMatch) {
		metadata.rule = ruleMatch[1]
	}

	// Parse @severity tag
	const severityMatch = jsdoc.match(/@severity\s+(CRITICAL|HIGH|MEDIUM|LOW)/)
	if (severityMatch) {
		metadata.severity = severityMatch[1] as FixtureMetadata['severity']
	}

	// Parse @description tag
	const descMatch = jsdoc.match(/@description\s+(.+?)(?=\n\s*\*\s*@|\n\s*\*\/)/s)
	if (descMatch) {
		metadata.description = descMatch[1].trim().replace(/\n\s*\*\s*/g, ' ')
	}

	// Parse @expectedViolations tag
	const violationsMatch = jsdoc.match(/@expectedViolations\s+(\d+)/)
	if (violationsMatch) {
		metadata.expectedViolations = parseInt(violationsMatch[1], 10)
	}

	// Parse @simulatedPath tag
	const pathMatch = jsdoc.match(/@simulatedPath\s+(\S+)/)
	if (pathMatch) {
		metadata.simulatedPath = pathMatch[1]
	}

	return metadata
}

/**
 * Get the base directory for fixtures
 */
function getFixturesDir(): string {
	return join(__dirname)
}

/**
 * Load a fixture file and create a ts-morph SourceFile
 *
 * @param fixturePath - Relative path from fixtures directory (e.g., 'invalid/aws-sdk-direct-dynamodb')
 * @returns Loaded fixture with sourceFile and metadata
 */
export function loadFixture(fixturePath: string): LoadedFixture {
	// Normalize path (add .fixture.ts extension if not present)
	const normalizedPath = fixturePath.endsWith('.fixture.ts') ? fixturePath : `${fixturePath}.fixture.ts`

	// Check cache first
	if (fixtureCache.has(normalizedPath)) {
		return fixtureCache.get(normalizedPath)!
	}

	const fullPath = join(getFixturesDir(), normalizedPath)

	// Read file content
	const content = readFileSync(fullPath, 'utf-8')

	// Parse metadata
	const metadata = parseMetadata(content)

	// Infer fixture type from path if not in metadata
	if (!metadata.fixture) {
		if (normalizedPath.includes('/invalid/')) {
			metadata.fixture = 'invalid'
		} else if (normalizedPath.includes('/valid/')) {
			metadata.fixture = 'valid'
		}
	}

	// Validate required metadata
	if (!metadata.fixture) {
		throw new Error(`Fixture ${fixturePath} missing @fixture tag (invalid|valid)`)
	}
	if (!metadata.rule) {
		throw new Error(`Fixture ${fixturePath} missing @rule tag`)
	}

	// Create source file from content
	const fileName = basename(normalizedPath).replace('.fixture.ts', '.ts')
	const sourceFile = project.createSourceFile(fileName, content, {overwrite: true})

	const loaded: LoadedFixture = {
		sourceFile,
		metadata: metadata as FixtureMetadata,
		content,
		filePath: fullPath
	}

	// Cache for reuse
	fixtureCache.set(normalizedPath, loaded)

	return loaded
}

/**
 * Load all fixtures for a specific rule
 *
 * @param ruleName - Name of the validation rule
 * @param type - 'invalid', 'valid', or 'all'
 * @returns Array of loaded fixtures
 */
export function loadFixturesForRule(ruleName: string, type: 'invalid' | 'valid' | 'all' = 'all'): LoadedFixture[] {
	const fixtures: LoadedFixture[] = []
	const dirs = type === 'all' ? ['invalid', 'valid'] : [type]

	for (const dir of dirs) {
		const dirPath = join(getFixturesDir(), dir)
		try {
			const files = readdirSync(dirPath).filter((f) => f.endsWith('.fixture.ts'))

			for (const file of files) {
				try {
					const loaded = loadFixture(`${dir}/${file.replace('.fixture.ts', '')}`)
					if (loaded.metadata.rule === ruleName) {
						fixtures.push(loaded)
					}
				} catch {
					// Skip files that fail to load
				}
			}
		} catch {
			// Directory doesn't exist yet, skip
		}
	}

	return fixtures
}

/**
 * Get default simulated path for a fixture based on its type
 */
export function getDefaultSimulatedPath(fixture: LoadedFixture): string {
	if (fixture.metadata.simulatedPath) {
		return fixture.metadata.simulatedPath
	}

	// Default paths based on fixture type
	if (fixture.metadata.fixture === 'invalid') {
		return 'src/lambdas/TestLambda/src/index.ts'
	}
	return 'src/lambdas/ValidLambda/src/index.ts'
}

/**
 * Clear the fixture cache (useful for testing the loader itself)
 */
export function clearFixtureCache(): void {
	fixtureCache.clear()
}
