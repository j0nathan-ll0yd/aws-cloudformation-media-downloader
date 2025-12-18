/**
 * use-electrodb-mock-helper
 * ERROR: Test files must use createElectroDBEntityMock() helper
 *
 * Mirrors: src/mcp/validation/rules/electrodb-mocking.ts
 */

const ENTITY_NAMES = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications', 'FileDownloads']

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce using createElectroDBEntityMock() in tests for ElectroDB entity mocking',
      category: 'Testing',
      recommended: true
    },
    messages: {
      manualMock: "Manual entity mock detected for '{{path}}'. Use createElectroDBEntityMock() from test/helpers/electrodb-mock.ts instead."
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
    if (filename.includes('electrodb-mock')) {
      return {}
    }

    return {
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

                if (!mockImpl.includes('createElectroDBEntityMock')) {
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
