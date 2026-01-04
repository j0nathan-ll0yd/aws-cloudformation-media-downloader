/**
 * import-order
 * MEDIUM: Lambda handler imports should be grouped and ordered consistently
 *
 * Mirrors: src/mcp/validation/rules/import-order.ts
 *
 * Order: node builtins -> aws-lambda types -> external packages -> entities -> vendor -> types -> utilities -> relative
 */

/**
 * Import categories in expected order.
 *
 * Note: Order of patterns matters - vendor must come before utilities
 * since #lib/vendor/ would also match #lib/.
 */
const IMPORT_CATEGORIES = [
  {name: 'node-builtins', patterns: [/^node:/, /^fs$/, /^path$/, /^url$/]},
  {name: 'aws-lambda-types', patterns: [/^aws-lambda$/]},
  {name: 'external-packages', patterns: [/^[^#./]/, /^@[^/]+\//]},
  {name: 'entities', patterns: [/#entities\//, /src\/entities\//]},
  {name: 'vendor', patterns: [/#lib\/vendor\//, /src\/lib\/vendor\//]},
  {name: 'types', patterns: [/#types\//, /src\/types\//]},
  // Utilities includes all other internal imports: #lib/, #util/, #config/
  {name: 'utilities', patterns: [/#lib\//, /src\/lib\//, /#util\//, /src\/util\//, /#config\//, /src\/config\//]},
  {name: 'relative', patterns: [/^\.\//]}
]

function categorizeImport(moduleSpecifier) {
  for (const category of IMPORT_CATEGORIES) {
    if (category.patterns.some((p) => p.test(moduleSpecifier))) {
      return category.name
    }
  }
  return 'unknown'
}

function getCategoryIndex(category) {
  const index = IMPORT_CATEGORIES.findIndex((c) => c.name === category)
  return index === -1 ? IMPORT_CATEGORIES.length : index
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce Lambda handler import order',
      category: 'Stylistic Issues',
      recommended: false
    },
    messages: {
      wrongOrder: "Import '{{module}}' ({{category}}) should come before {{lastCategory}} imports. Expected order: node builtins -> aws-lambda -> external -> #entities/ -> #lib/vendor/ -> #types/ -> utilities -> relative",
      notGrouped: "{{category}} imports should be grouped together"
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Only apply to Lambda handler files
    if (!filename.includes('/lambdas/') || !filename.endsWith('/src/index.ts')) {
      return {}
    }

    let lastCategory = ''
    let lastCategoryIndex = -1
    const seenCategories = []

    return {
      ImportDeclaration(node) {
        const moduleSpecifier = node.source.value
        const category = categorizeImport(moduleSpecifier)
        const categoryIndex = getCategoryIndex(category)

        // Check if this category comes before a previously seen category
        if (categoryIndex < lastCategoryIndex && lastCategory !== category) {
          context.report({
            node,
            messageId: 'wrongOrder',
            data: {
              module: moduleSpecifier,
              category,
              lastCategory
            }
          })
        }

        // Check for mixed categories (same category appearing non-consecutively)
        if (seenCategories.includes(category) && lastCategory !== category) {
          context.report({
            node,
            messageId: 'notGrouped',
            data: {
              category
            }
          })
        }

        if (lastCategory !== category) {
          seenCategories.push(category)
        }
        lastCategory = category
        lastCategoryIndex = categoryIndex
      },
      'Program:exit'() {
        // Reset state for next file
        lastCategory = ''
        lastCategoryIndex = -1
        seenCategories.length = 0
      }
    }
  }
}
