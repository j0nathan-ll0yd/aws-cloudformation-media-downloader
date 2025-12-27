/**
 * use-entity-mock-helper
 * ERROR: Test files must use createEntityMock() helper
 *
 * Mirrors: src/mcp/validation/rules/entity-mocking.ts
 */

const ENTITY_NAMES = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications', 'FileDownloads']

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce using createEntityMock() in tests for entity mocking',
      category: 'Testing',
      recommended: true
    },
    messages: {
      manualMock: "Manual entity mock detected for '{{path}}'. Use createEntityMock() from test/helpers/entity-mock.ts instead."
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Only apply to test files
    if (!filename.includes('.test.') && !filename.includes('/test/')) {
      return {}
    }

    // Skip the helper file itself
    if (filename.includes('entity-mock') || filename.includes('electrodb-mock')) {
      return {}
    }

    // Track variables created with createEntityMock (or legacy createElectroDBEntityMock)
    const helperVariables = new Set()

    return {
      VariableDeclarator(node) {
        // Track: const fooMock = createEntityMock(...) or createElectroDBEntityMock(...)
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          (node.init.callee.name === 'createEntityMock' || node.init.callee.name === 'createElectroDBEntityMock') &&
          node.id.type === 'Identifier'
        ) {
          helperVariables.add(node.id.name)
        }
      },

      CallExpression(node) {
        const callee = node.callee

        // Check for jest.unstable_mockModule or jest.mock
        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'jest' &&
          (callee.property.name === 'unstable_mockModule' || callee.property.name === 'mock')
        ) {
          if (node.arguments.length >= 2) {
            const modulePath = node.arguments[0]
            if (modulePath.type === 'Literal' && typeof modulePath.value === 'string') {
              const pathValue = modulePath.value

              // Check if mocking an entity
              const isEntityMock = pathValue.includes('entities/') || ENTITY_NAMES.some((e) => pathValue.includes(e))

              if (isEntityMock) {
                const sourceCode = context.sourceCode || context.getSourceCode()
                const mockImpl = sourceCode.getText(node.arguments[1])

                // Check if mock uses createEntityMock (or legacy) directly or via a tracked variable
                const usesHelper = mockImpl.includes('createEntityMock') || mockImpl.includes('createElectroDBEntityMock')
                const usesHelperVariable = Array.from(helperVariables).some((varName) => mockImpl.includes(varName + '.entity'))

                if (!usesHelper && !usesHelperVariable) {
                  context.report({
                    node,
                    messageId: 'manualMock',
                    data: {path: pathValue}
                  })
                }
              }
            }
          }
        }
      }
    }
  }
}
