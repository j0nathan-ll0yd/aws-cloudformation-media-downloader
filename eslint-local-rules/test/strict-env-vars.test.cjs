/**
 * Tests for strict-env-vars ESLint rule
 */

const rule = require('../rules/strict-env-vars.cjs')

// Mock ESLint context
function createContext(filename = '/src/lambdas/TestFunction/src/index.ts') {
  const errors = []
  return {
    getFilename: () => filename,
    report: (error) => errors.push(error),
    getErrors: () => errors
  }
}

// Test case 1: Direct process.env.CONFIG access
function testDirectEnvAccess() {
  const node = {
    object: {
      type: 'MemberExpression',
      object: {name: 'process'},
      property: {name: 'env'}
    },
    property: {name: 'CONFIG'}
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.MemberExpression(node)
  
  if (context.getErrors().length === 1 && context.getErrors()[0].messageId === 'directEnvAccess') {
    console.log('✅ Test 1 passed: Direct env access detected')
  } else {
    console.error('❌ Test 1 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Test case 2: process.env member access
function testProcessEnvAccess() {
  const node = {
    object: {name: 'process'},
    property: {name: 'env'}
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.MemberExpression(node)
  
  if (context.getErrors().length === 1 && context.getErrors()[0].messageId === 'directEnvAccess') {
    console.log('✅ Test 2 passed: process.env access detected')
  } else {
    console.error('❌ Test 2 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Test case 3: Should allow in test files (returns empty visitor)
function testAllowsInTestFiles() {
  const context = createContext('/src/lambdas/TestFunction/test/index.test.ts')
  const visitor = rule.create(context)

  // Should return empty object for test files
  if (Object.keys(visitor).length === 0) {
    console.log('✅ Test 3 passed: Test files allowed')
  } else {
    console.error('❌ Test 3 failed: Expected empty visitor for test files')
    process.exit(1)
  }
}

// Test case 4: Should not check files outside Lambda directories
function testIgnoresNonLambdaFiles() {
  const node = {
    object: {name: 'process'},
    property: {name: 'env'}
  }
  
  const context = createContext('/src/util/helpers.ts')
  const visitor = rule.create(context)
  
  // Should return empty object for non-Lambda files
  if (Object.keys(visitor).length === 0) {
    console.log('✅ Test 4 passed: Non-Lambda files ignored')
  } else {
    console.error('❌ Test 4 failed')
    process.exit(1)
  }
}

// Test case 5: Valid code without process.env
function testValidCode() {
  const node = {
    object: {name: 'config'},
    property: {name: 'value'}
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.MemberExpression(node)
  
  if (context.getErrors().length === 0) {
    console.log('✅ Test 5 passed: Valid code allowed')
  } else {
    console.error('❌ Test 5 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Run all tests
console.log('Running strict-env-vars rule tests...')
testDirectEnvAccess()
testProcessEnvAccess()
testAllowsInTestFiles()
testIgnoresNonLambdaFiles()
testValidCode()
console.log('✅ All strict-env-vars tests passed')
