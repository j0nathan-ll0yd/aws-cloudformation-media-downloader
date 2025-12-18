/**
 * Tests for cascade-delete-order ESLint rule
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/cascade-delete-order.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('cascade-delete-order', rule, {
  valid: [
    // Allowed: Promise.allSettled with deletes
    {
      code: `await Promise.allSettled([
        UserFiles.delete({userId}).go(),
        UserDevices.delete({userId}).go()
      ])`
    },
    // Allowed: Promise.all without deletes
    {
      code: `await Promise.all([
        Users.get({userId}).go(),
        Files.query.byUser({userId}).go()
      ])`
    },
    // Allowed: Sequential deletes (not in Promise.all)
    {
      code: `
        await UserFiles.delete({userId}).go()
        await Users.delete({userId}).go()
      `
    },
    // Allowed: Promise.all with non-delete operations
    {
      code: `await Promise.all([
        fetch('/api/users'),
        fetch('/api/files')
      ])`
    }
  ],
  invalid: [
    // Forbidden: Promise.all with .delete() operations
    {
      code: `await Promise.all([
        UserFiles.delete({userId}).go(),
        Users.delete({userId}).go()
      ])`,
      errors: [{messageId: 'promiseAll'}]
    },
    // Forbidden: Promise.all with .remove() operations
    {
      code: `await Promise.all([
        collection.remove({id}),
        anotherCollection.remove({id})
      ])`,
      errors: [{messageId: 'promiseAll'}]
    },
    // Forbidden: Promise.all with batchWrite
    {
      code: `await Promise.all([
        batchWrite(deleteRequests),
        batchWrite(moreDeletes)
      ])`,
      errors: [{messageId: 'promiseAll'}]
    }
  ]
})

console.log('cascade-delete-order: All tests passed!')
