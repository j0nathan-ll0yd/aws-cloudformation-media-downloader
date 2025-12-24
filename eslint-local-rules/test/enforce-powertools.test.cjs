/**
 * Tests for enforce-powertools ESLint rule
 */

const rule = require('../rules/enforce-powertools.cjs')

// Mock ESLint context
function createContext(filename = '/src/lambdas/TestFunction/src/index.ts') {
  const errors = []
  return {
    getFilename: () => filename,
    report: (error) => errors.push(error),
    getErrors: () => errors
  }
}

// Test case 1: Valid handler with withPowertools
function testValidWithPowertools() {
  const node = {
    declaration: {
      type: 'VariableDeclaration',
      declarations: [{
        id: {name: 'handler'},
        init: {
          type: 'CallExpression',
          callee: {name: 'withPowertools'}
        }
      }]
    }
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.ExportNamedDeclaration(node)
  
  if (context.getErrors().length === 0) {
    console.log('✅ Test 1 passed: Valid handler with withPowertools')
  } else {
    console.error('❌ Test 1 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Test case 2: Valid handler with wrapLambdaInvokeHandler
function testValidWithWrapLambdaInvokeHandler() {
  const node = {
    declaration: {
      type: 'VariableDeclaration',
      declarations: [{
        id: {name: 'handler'},
        init: {
          type: 'CallExpression',
          callee: {name: 'wrapLambdaInvokeHandler'}
        }
      }]
    }
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.ExportNamedDeclaration(node)
  
  if (context.getErrors().length === 0) {
    console.log('✅ Test 2 passed: Valid handler with wrapLambdaInvokeHandler')
  } else {
    console.error('❌ Test 2 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Test case 3: Invalid handler without wrapper
function testInvalidHandler() {
  const node = {
    declaration: {
      type: 'VariableDeclaration',
      declarations: [{
        id: {name: 'handler'},
        init: {
          type: 'ArrowFunctionExpression'
        }
      }]
    }
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.ExportNamedDeclaration(node)
  
  if (context.getErrors().length === 1 && context.getErrors()[0].messageId === 'missingPowertools') {
    console.log('✅ Test 3 passed: Invalid handler detected')
  } else {
    console.error('❌ Test 3 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Test case 4: Invalid function declaration
function testInvalidFunctionDeclaration() {
  const node = {
    declaration: {
      type: 'FunctionDeclaration',
      id: {name: 'handler'}
    }
  }
  
  const context = createContext()
  const visitor = rule.create(context)
  visitor.ExportNamedDeclaration(node)
  
  if (context.getErrors().length === 1 && context.getErrors()[0].messageId === 'missingPowertools') {
    console.log('✅ Test 4 passed: Invalid function declaration detected')
  } else {
    console.error('❌ Test 4 failed')
    console.error(context.getErrors())
    process.exit(1)
  }
}

// Test case 5: Should not check files outside Lambda directories
function testIgnoresNonLambdaFiles() {
  const node = {
    declaration: {
      type: 'VariableDeclaration',
      declarations: [{
        id: {name: 'handler'},
        init: {
          type: 'ArrowFunctionExpression'
        }
      }]
    }
  }
  
  const context = createContext('/src/util/helpers.ts')
  const visitor = rule.create(context)
  
  // Should return empty object for non-Lambda files
  if (Object.keys(visitor).length === 0) {
    console.log('✅ Test 5 passed: Non-Lambda files ignored')
  } else {
    console.error('❌ Test 5 failed')
    process.exit(1)
  }
}

// Run all tests
console.log('Running enforce-powertools rule tests...')
testValidWithPowertools()
testValidWithWrapLambdaInvokeHandler()
testInvalidHandler()
testInvalidFunctionDeclaration()
testIgnoresNonLambdaFiles()
console.log('✅ All enforce-powertools tests passed')
