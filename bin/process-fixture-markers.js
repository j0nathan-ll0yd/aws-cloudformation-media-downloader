#!/usr/bin/env node

/**
 * process-fixture-markers.js
 * Processes raw CloudWatch Logs fixture markers and generates test fixture files
 * 
 * Usage: node bin/process-fixture-markers.js [lambda-name]
 * Example: node bin/process-fixture-markers.js WebhookFeedly
 */

import fs from 'fs'
import path from 'path'
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

/**
 * Sanitizes sensitive data from fixture objects
 */
function sanitizeFixture(obj, fixtureType) {
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = Array.isArray(obj) ? [...obj] : {...obj}
  
  // List of fields to redact
  const sensitiveFields = [
    'Authorization',
    'X-Api-Key',
    'ApiKey',
    'token',
    'authorizationCode',
    'deviceToken',
    'appleUserId',
    'userId',
    'email',
    'identityToken',
    'principalId'
  ]
  
  for (const key in sanitized) {
    if (sensitiveFields.includes(key)) {
      // Replace with placeholder
      sanitized[key] = `REDACTED_${key.toUpperCase()}`
    } else if (typeof sanitized[key] === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeFixture(sanitized[key], fixtureType)
    }
  }
  
  return sanitized
}

/**
 * Parses a CloudWatch log message containing fixture data
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
    console.error(`${RED}Error parsing JSON from message${NC}`)
    return null
  }
}

/**
 * Generates a filename for the fixture
 */
function generateFixtureName(fixtureType, serviceName, operationName, index) {
  if (fixtureType === 'INCOMING') {
    return `APIGatewayEvent-extracted-${index}.json`
  } else if (fixtureType === 'OUTGOING') {
    return `APIGatewayResponse-extracted-${index}.json`
  } else if (fixtureType === 'INTERNAL') {
    return `${serviceName}-${operationName}-extracted-${index}.json`
  }
  return `fixture-${index}.json`
}

/**
 * Processes fixtures for a specific Lambda function
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
  
  // Group fixtures by type
  const fixtures = {
    incoming: [],
    outgoing: [],
    internal: []
  }
  
  // Parse each result
  for (const result of rawData.results) {
    const messageField = result.find(field => field.field === '@message')
    if (!messageField) continue
    
    const parsed = parseFixtureMessage(messageField.value)
    if (!parsed) continue
    
    // Sanitize sensitive data
    const sanitized = sanitizeFixture(parsed.data, parsed.fixtureType)
    
    if (parsed.fixtureType === 'INCOMING') {
      fixtures.incoming.push(sanitized)
    } else if (parsed.fixtureType === 'OUTGOING') {
      fixtures.outgoing.push(sanitized)
    } else if (parsed.fixtureType === 'INTERNAL') {
      fixtures.internal.push({
        service: parsed.serviceName,
        operation: parsed.operationName,
        data: sanitized
      })
    }
  }
  
  // Save fixtures to Lambda test directory
  const lambdaTestDir = path.join(SRC_DIR, lambdaName, 'test', 'fixtures', 'extracted')
  fs.mkdirSync(lambdaTestDir, {recursive: true})
  
  let savedCount = 0
  
  // Save incoming fixtures
  fixtures.incoming.forEach((fixture, index) => {
    const filename = generateFixtureName('INCOMING', null, null, index)
    const filepath = path.join(lambdaTestDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(fixture, null, 2))
    savedCount++
  })
  
  // Save outgoing fixtures
  fixtures.outgoing.forEach((fixture, index) => {
    const filename = generateFixtureName('OUTGOING', null, null, index)
    const filepath = path.join(lambdaTestDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(fixture, null, 2))
    savedCount++
  })
  
  // Save internal fixtures
  fixtures.internal.forEach((fixture, index) => {
    const filename = generateFixtureName('INTERNAL', fixture.service, fixture.operation, index)
    const filepath = path.join(lambdaTestDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(fixture.data, null, 2))
    savedCount++
  })
  
  console.log(`${GREEN}  Saved ${savedCount} fixtures to ${lambdaTestDir}${NC}`)
  console.log(`    - Incoming: ${fixtures.incoming.length}`)
  console.log(`    - Outgoing: ${fixtures.outgoing.length}`)
  console.log(`    - Internal: ${fixtures.internal.length}`)
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
}

main()
