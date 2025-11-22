#!/usr/bin/env node

/**
 * process-fixture-markers.js
 * Processes raw CloudWatch Logs fixture markers and generates test fixture files
 *
 * Features:
 * - Case-insensitive sanitization of sensitive fields
 * - Content-based deduplication (MD5 hashing)
 * - Fixture validation against schema
 * - Provenance metadata tracking
 *
 * Usage: node bin/process-fixture-markers.js [lambda-name]
 * Example: node bin/process-fixture-markers.js WebhookFeedly
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Constants
const PROJECT_ROOT = path.resolve(__dirname, '..')
const EXTRACTED_DIR = path.join(PROJECT_ROOT, 'fixtures', 'extracted')
const SRC_DIR = path.join(PROJECT_ROOT, 'src', 'lambdas')

// Color constants for terminal output
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const NC = '\x1b[0m' // No Color

// Sensitive field patterns (case-insensitive)
const SENSITIVE_PATTERNS = [
  /authorization/i,
  /^x-api-key$/i,
  /apikey/i,
  /^token$/i,
  /authtoken/i,
  /authorizationcode/i,
  /devicetoken/i,
  /appleuserid/i,
  /userid/i,
  /^email$/i,
  /identitytoken/i,
  /principalid/i,
  /password/i,
  /secret/i,
  /^key$/i,
  /accesskey/i,
  /privatekey/i,
  /sessiontoken/i
]

/**
 * Checks if a field name matches sensitive patterns
 * @param {string} fieldName - The field name to check
 * @returns {boolean} - True if field is sensitive
 */
function isSensitiveField(fieldName) {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName))
}

/**
 * Sanitizes sensitive data from fixture objects (case-insensitive)
 * @param {object|array} obj - The object to sanitize
 * @param {string} fixtureType - The type of fixture
 * @returns {object|array} - Sanitized object
 */
function sanitizeFixture(obj, fixtureType) {
  if (!obj || typeof obj !== 'object') return obj

  const sanitized = Array.isArray(obj) ? [...obj] : {...obj}

  for (const key in sanitized) {
    if (isSensitiveField(key)) {
      // Replace with placeholder using uppercase version of key
      sanitized[key] = `REDACTED_${key.toUpperCase()}`
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeFixture(sanitized[key], fixtureType)
    }
  }

  return sanitized
}

/**
 * Computes MD5 hash of fixture content for deduplication
 * @param {object} data - The fixture data
 * @returns {string} - MD5 hash (8 characters)
 */
function hashFixtureContent(data) {
  const content = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8)
}

/**
 * Validates fixture structure
 * @param {object} fixture - The fixture to validate
 * @param {string} fixtureType - INCOMING, OUTGOING, or INTERNAL
 * @returns {object} - {valid: boolean, errors: string[]}
 */
function validateFixture(fixture, fixtureType) {
  const errors = []

  if (fixtureType === 'INCOMING') {
    // API Gateway event validation
    if (!fixture || typeof fixture !== 'object') {
      errors.push('Fixture must be an object')
    }
    // Most Lambda events have some standard fields, but they vary
    // Basic validation: ensure it's not empty
    if (fixture && Object.keys(fixture).length === 0) {
      errors.push('Fixture is empty')
    }
  } else if (fixtureType === 'OUTGOING') {
    // API Gateway response validation
    if (!fixture || typeof fixture !== 'object') {
      errors.push('Response must be an object')
    } else {
      if (typeof fixture.statusCode !== 'number') {
        errors.push('Response must have numeric statusCode')
      }
      if (fixture.body !== undefined && typeof fixture.body !== 'string') {
        errors.push('Response body must be a string (or undefined)')
      }
    }
  } else if (fixtureType === 'INTERNAL') {
    // AWS SDK response validation (less strict - varies by service)
    if (!fixture || typeof fixture !== 'object') {
      errors.push('Internal fixture must be an object')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Adds provenance metadata to fixture
 * @param {object} fixture - The fixture data
 * @param {object} metadata - Metadata about the fixture source
 * @returns {object} - Fixture with metadata
 */
function addProvenanceMetadata(fixture, metadata) {
  return {
    _metadata: {
      source: 'production-cloudwatch',
      extractedAt: new Date().toISOString(),
      logGroup: metadata.logGroup || 'unknown',
      sanitized: true,
      fixtureType: metadata.fixtureType,
      contentHash: metadata.contentHash
    },
    ...fixture
  }
}

/**
 * Parses a CloudWatch log message containing fixture data
 * @param {string} message - The CloudWatch log message
 * @returns {object|null} - Parsed fixture or null if invalid
 */
function parseFixtureMessage(message) {
  // Extract the marker and JSON data
  const markerMatch = message.match(/\[FIXTURE:(INCOMING|OUTGOING|INTERNAL):([^\]]+)\]/)
  if (!markerMatch) return null

  const [, fixtureType, lambdaInfo] = markerMatch
  const [lambdaName, ...serviceParts] = lambdaInfo.split(':')

  // Extract JSON data after the marker
  const jsonStart = message.indexOf(markerMatch[0]) + markerMatch[0].length
  const jsonStr = message.substring(jsonStart).trim()

  try {
    const data = JSON.parse(jsonStr)
    return {
      fixtureType,
      lambdaName,
      serviceName: serviceParts[0],
      operationName: serviceParts[1],
      data
    }
  } catch (error) {
    console.error(`${RED}Error parsing JSON from message: ${error.message}${NC}`)
    return null
  }
}

/**
 * Generates a filename for the fixture
 * @param {string} fixtureType - INCOMING, OUTGOING, or INTERNAL
 * @param {string} serviceName - AWS service name (for INTERNAL only)
 * @param {string} operationName - AWS operation name (for INTERNAL only)
 * @param {string} hash - Content hash for uniqueness
 * @returns {string} - Generated filename
 */
function generateFixtureName(fixtureType, serviceName, operationName, hash) {
  if (fixtureType === 'INCOMING') {
    return `APIGatewayEvent-extracted-${hash}.json`
  } else if (fixtureType === 'OUTGOING') {
    return `APIGatewayResponse-extracted-${hash}.json`
  } else if (fixtureType === 'INTERNAL') {
    return `${serviceName}-${operationName}-extracted-${hash}.json`
  }
  return `fixture-${hash}.json`
}

/**
 * Checks if a fixture already exists (deduplication)
 * @param {string} directory - Directory to check
 * @param {string} hash - Content hash
 * @returns {boolean} - True if duplicate exists
 */
function isDuplicate(directory, hash) {
  if (!fs.existsSync(directory)) return false

  const files = fs.readdirSync(directory)
  return files.some(file => file.includes(hash))
}

/**
 * Processes fixtures for a specific Lambda function
 * @param {string} lambdaName - Name of the Lambda function
 */
function processLambdaFixtures(lambdaName) {
  const rawFile = path.join(EXTRACTED_DIR, `${lambdaName}_raw.json`)

  if (!fs.existsSync(rawFile)) {
    console.log(`${YELLOW}No raw fixtures found for ${lambdaName}${NC}`)
    return
  }

  console.log(`${BLUE}Processing ${lambdaName}...${NC}`)

  // Read raw CloudWatch query results
  const rawData = JSON.parse(fs.readFileSync(rawFile, 'utf8'))

  if (!rawData.results || rawData.results.length === 0) {
    console.log(`${YELLOW}  No fixture markers found${NC}`)
    return
  }

  // Track processed fixtures
  const processed = {
    incoming: {saved: 0, duplicates: 0, invalid: 0},
    outgoing: {saved: 0, duplicates: 0, invalid: 0},
    internal: {saved: 0, duplicates: 0, invalid: 0}
  }

  // Create output directory
  const lambdaTestDir = path.join(SRC_DIR, lambdaName, 'test', 'fixtures', 'extracted')
  fs.mkdirSync(lambdaTestDir, {recursive: true})

  // Parse and process each result
  for (const result of rawData.results) {
    const messageField = result.find(field => field.field === '@message')
    if (!messageField) continue

    const parsed = parseFixtureMessage(messageField.value)
    if (!parsed) continue

    // Sanitize sensitive data
    const sanitized = sanitizeFixture(parsed.data, parsed.fixtureType)

    // Compute content hash
    const hash = hashFixtureContent(sanitized)

    // Check for duplicates
    if (isDuplicate(lambdaTestDir, hash)) {
      if (parsed.fixtureType === 'INCOMING') processed.incoming.duplicates++
      else if (parsed.fixtureType === 'OUTGOING') processed.outgoing.duplicates++
      else if (parsed.fixtureType === 'INTERNAL') processed.internal.duplicates++
      continue
    }

    // Validate fixture
    const validation = validateFixture(sanitized, parsed.fixtureType)
    if (!validation.valid) {
      console.log(`${YELLOW}  Skipping invalid ${parsed.fixtureType} fixture: ${validation.errors.join(', ')}${NC}`)
      if (parsed.fixtureType === 'INCOMING') processed.incoming.invalid++
      else if (parsed.fixtureType === 'OUTGOING') processed.outgoing.invalid++
      else if (parsed.fixtureType === 'INTERNAL') processed.internal.invalid++
      continue
    }

    // Add provenance metadata
    const fixtureWithMetadata = addProvenanceMetadata(sanitized, {
      logGroup: `/aws/lambda/${lambdaName}`,
      fixtureType: parsed.fixtureType,
      contentHash: hash
    })

    // Generate filename and save
    let filename
    if (parsed.fixtureType === 'INCOMING') {
      filename = generateFixtureName('INCOMING', null, null, hash)
      processed.incoming.saved++
    } else if (parsed.fixtureType === 'OUTGOING') {
      filename = generateFixtureName('OUTGOING', null, null, hash)
      processed.outgoing.saved++
    } else if (parsed.fixtureType === 'INTERNAL') {
      filename = generateFixtureName('INTERNAL', parsed.serviceName, parsed.operationName, hash)
      processed.internal.saved++
    }

    const filepath = path.join(lambdaTestDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(fixtureWithMetadata, null, 2))
  }

  const totalSaved = processed.incoming.saved + processed.outgoing.saved + processed.internal.saved
  const totalDuplicates = processed.incoming.duplicates + processed.outgoing.duplicates + processed.internal.duplicates
  const totalInvalid = processed.incoming.invalid + processed.outgoing.invalid + processed.internal.invalid

  console.log(`${GREEN}  Saved ${totalSaved} unique fixtures to ${lambdaTestDir}${NC}`)
  console.log(`    - Incoming: ${processed.incoming.saved} saved, ${processed.incoming.duplicates} duplicates, ${processed.incoming.invalid} invalid`)
  console.log(`    - Outgoing: ${processed.outgoing.saved} saved, ${processed.outgoing.duplicates} duplicates, ${processed.outgoing.invalid} invalid`)
  console.log(`    - Internal: ${processed.internal.saved} saved, ${processed.internal.duplicates} duplicates, ${processed.internal.invalid} invalid`)

  if (totalDuplicates > 0) {
    console.log(`${YELLOW}  Skipped ${totalDuplicates} duplicate fixtures${NC}`)
  }
  if (totalInvalid > 0) {
    console.log(`${YELLOW}  Skipped ${totalInvalid} invalid fixtures${NC}`)
  }
}

/**
 * Main execution
 */
function main() {
  const lambdaName = process.argv[2]

  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.log(`${RED}Error: Extracted fixtures directory not found${NC}`)
    console.log(`Please run extract-fixtures.sh first`)
    process.exit(1)
  }

  console.log(`${GREEN}Processing fixture markers${NC}`)
  console.log(`Features: Case-insensitive sanitization, deduplication, validation, metadata`)
  console.log(`Output: Lambda test/fixtures/extracted/ directories\n`)

  if (lambdaName) {
    // Process specific Lambda
    processLambdaFixtures(lambdaName)
  } else {
    // Process all raw fixture files
    const files = fs.readdirSync(EXTRACTED_DIR)
    const rawFiles = files.filter(f => f.endsWith('_raw.json'))

    if (rawFiles.length === 0) {
      console.log(`${YELLOW}No raw fixture files found in ${EXTRACTED_DIR}${NC}`)
      process.exit(0)
    }

    for (const file of rawFiles) {
      const lambda = file.replace('_raw.json', '')
      processLambdaFixtures(lambda)
      console.log('')
    }
  }

  console.log(`${GREEN}Processing complete!${NC}`)
  console.log(`\nNext steps:`)
  console.log(`  1. Review extracted fixtures in src/lambdas/*/test/fixtures/extracted/`)
  console.log(`  2. Manually review and sanitize any remaining sensitive data`)
  console.log(`  3. Move validated fixtures to src/lambdas/*/test/fixtures/`)
  console.log(`  4. Update tests to use new fixtures`)
  console.log(`\nNote: Fixtures include _metadata field with provenance tracking`)
}

main()
