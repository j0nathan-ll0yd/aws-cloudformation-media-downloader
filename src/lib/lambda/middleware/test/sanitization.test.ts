import {describe, expect, it} from 'vitest'
import type {APIGatewayProxyEvent} from 'aws-lambda'

describe('Lambda:Middleware:Sanitization', () => {
  // Helper to create a mock Middy request
  function createMockRequest(body: unknown): {event: Partial<APIGatewayProxyEvent>} {
    return {
      event: {
        body: typeof body === 'string' ? body : JSON.stringify(body)
      }
    }
  }

  describe('sanitizeInput', () => {
    describe('XSS protection', () => {
      it('should remove script tags', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          name: '<script>alert("xss")</script>John',
          bio: 'Hello <script src="evil.js"></script>World'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.name).toBe('John')
        expect(parsed.bio).toBe('Hello World')
      })

      it('should remove event handlers', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          content: '<img src="x" onerror="alert(1)">',
          link: '<a href="#" onclick="steal()">Click</a>'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.content).not.toContain('onerror')
        expect(parsed.link).not.toContain('onclick')
      })

      it('should remove javascript URLs', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          url: 'javascript:alert(1)',
          link: '<a href="javascript:void(0)">Link</a>'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.url).not.toContain('javascript:')
        expect(parsed.link).not.toContain('javascript:')
      })

      it('should remove iframe tags', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          content: '<iframe src="evil.com"></iframe>Safe content'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.content).toBe('Safe content')
      })

      it('should remove vbscript URLs', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          content: 'vbscript:msgbox("xss")'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.content).not.toContain('vbscript:')
      })

      it('should remove HTML tags', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          name: '<b>Bold</b> and <i>italic</i>',
          html: '<div class="test">Content</div>'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.name).toBe('Bold and italic')
        expect(parsed.html).toBe('Content')
      })
    })

    describe('control character stripping', () => {
      it('should remove control characters', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          text: 'Hello\x00World\x1FTest'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.text).toBe('HelloWorldTest')
      })

      it('should preserve newlines and tabs', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          text: 'Hello\nWorld\tTest\rEnd'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.text).toBe('Hello\nWorld\tTest\rEnd')
      })

      it('should optionally preserve control characters', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput({stripControlChars: false})

        const request = createMockRequest({
          text: 'Hello\x00World'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.text).toBe('Hello\x00World')
      })
    })

    describe('nested object handling', () => {
      it('should sanitize nested objects', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          user: {
            name: '<script>xss</script>John',
            profile: {
              bio: '<b>Developer</b>'
            }
          }
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.user.name).toBe('John')
        expect(parsed.user.profile.bio).toBe('Developer')
      })

      it('should sanitize arrays', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          tags: ['<script>xss</script>tag1', '<b>tag2</b>', 'tag3']
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.tags).toEqual(['tag1', 'tag2', 'tag3'])
      })

      it('should handle arrays of objects', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          items: [
            {name: '<b>Item 1</b>'},
            {name: '<script>xss</script>Item 2'}
          ]
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.items[0].name).toBe('Item 1')
        expect(parsed.items[1].name).toBe('Item 2')
      })
    })

    describe('skipFields option', () => {
      it('should not sanitize skipped fields', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput({skipFields: ['password', 'token']})

        const request = createMockRequest({
          username: '<script>xss</script>user',
          password: '<script>password123</script>',
          token: '<b>secret-token</b>'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.username).toBe('user')
        expect(parsed.password).toBe('<script>password123</script>')
        expect(parsed.token).toBe('<b>secret-token</b>')
      })
    })

    describe('maxLength option', () => {
      it('should truncate strings exceeding maxLength', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput({maxLength: 10})

        const request = createMockRequest({
          name: 'This is a very long string that exceeds the limit'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.name).toBe('This is a ')
        expect(parsed.name.length).toBe(10)
      })
    })

    describe('stripHtml option', () => {
      it('should optionally preserve HTML', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput({stripHtml: false})

        const request = createMockRequest({
          content: '<b>Bold</b> text'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.content).toBe('<b>Bold</b> text')
      })
    })

    describe('edge cases', () => {
      it('should handle null values', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          name: null,
          value: 'test'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.name).toBeNull()
        expect(parsed.value).toBe('test')
      })

      it('should handle undefined values', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        // JSON.stringify converts undefined to null in objects
        const request = createMockRequest({
          name: 'test'
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.name).toBe('test')
      })

      it('should preserve numbers', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          count: 42,
          price: 19.99
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.count).toBe(42)
        expect(parsed.price).toBe(19.99)
      })

      it('should preserve booleans', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({
          active: true,
          verified: false
        })

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed.active).toBe(true)
        expect(parsed.verified).toBe(false)
      })

      it('should handle empty body', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = {event: {body: null}}

        // Should not throw
        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        expect(request.event.body).toBeNull()
      })

      it('should handle invalid JSON body', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = {event: {body: 'not valid json {'}}

        // Should not throw, body should remain unchanged
        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        expect(request.event.body).toBe('not valid json {')
      })

      it('should handle empty object', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest({})

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed).toEqual({})
      })

      it('should handle empty array', async () => {
        const {sanitizeInput} = await import('../../middleware/sanitization')
        const middleware = sanitizeInput()

        const request = createMockRequest([])

        await middleware.before?.(request as Parameters<NonNullable<ReturnType<typeof sanitizeInput>['before']>>[0])

        const parsed = JSON.parse(request.event.body!)
        expect(parsed).toEqual([])
      })
    })
  })
})
