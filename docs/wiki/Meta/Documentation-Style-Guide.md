# Documentation Style Guide

This wiki follows the [Google Developer Documentation Style Guide](https://developers.google.com/style/) for consistent, clear technical writing.

## Enforcement

Style is enforced via Vale linter:
- **Local**: Run `vale docs/wiki/` before commits
- **CI**: Automatically checked on pull requests (when configured)

### Running Vale Locally

```bash
# Install Vale
brew install vale  # macOS
# or download from https://vale.sh/docs/vale-cli/installation/

# Sync style packages
vale sync

# Lint wiki documentation
vale docs/wiki/

# Lint specific file
vale docs/wiki/Getting-Started.md
```

## Key Principles

### 1. Conversational Tone

Write as if explaining to a colleague. Avoid overly formal or academic language.

| Instead of | Use |
|------------|-----|
| "It is recommended that one should" | "We recommend" or "You should" |
| "The aforementioned functionality" | "This feature" |
| "Utilize" | "Use" |

### 2. Active Voice

Use active voice where the subject performs the action.

| Passive (avoid) | Active (prefer) |
|-----------------|-----------------|
| "The request is processed by Lambda" | "Lambda processes the request" |
| "The file is read by the handler" | "The handler reads the file" |
| "Errors are logged by CloudWatch" | "CloudWatch logs errors" |

### 3. Present Tense

Use present tense for most technical documentation.

| Future (avoid) | Present (prefer) |
|----------------|------------------|
| "This function will return a promise" | "This function returns a promise" |
| "The build will fail if..." | "The build fails if..." |
| "You will see an error" | "You see an error" |

### 4. Second Person

Address the reader directly by using "you" rather than "users" or "developers."

| Third person (avoid) | Second person (prefer) |
|----------------------|------------------------|
| "Users can configure settings" | "You can configure settings" |
| "Developers should run tests" | "Run tests before committing" |
| "The user's request is validated" | "Your request is validated" |

## Common Issues and Fixes

### Jargon Without Explanation

First use of technical terms should include explanation or link.

```markdown
<!-- Avoid -->
The DLQ handles failures.

<!-- Prefer -->
The dead letter queue (DLQ) captures failed messages for later analysis.
```

### Vague Language

Be specific about quantities, actions, and outcomes.

```markdown
<!-- Avoid -->
This may cause issues with performance.

<!-- Prefer -->
Large file uploads (over 100MB) increase Lambda execution time.
```

### Overly Complex Sentences

Break long sentences into shorter, clearer statements.

```markdown
<!-- Avoid -->
When the Lambda function receives an API Gateway event that contains
a user ID in the request context from the custom authorizer, it uses
that ID to query the database for the user's profile information.

<!-- Prefer -->
The Lambda function receives an API Gateway event from the custom
authorizer. This event contains the user ID in the request context.
The function uses this ID to query the user's profile from the database.
```

## Formatting Conventions

### Headings

- Use sentence case: "Creating a new Lambda" not "Creating A New Lambda"
- Keep headings concise (under 60 characters)
- Use descriptive headings that tell what the section covers

### Code Blocks

- Always specify the language for syntax highlighting
- Include comments for non-obvious code
- Show both correct and incorrect examples where helpful

````markdown
```typescript
// Correct: Use vendor wrapper
import { getS3Client } from '#lib/vendor/AWS/S3';
```
````

### Lists

- Use numbered lists for sequential steps
- Use bullet lists for unordered items
- Keep list items parallel in structure

### Links

- Use descriptive link text, not "click here"
- Use relative links for wiki pages
- Verify links work before committing

```markdown
<!-- Avoid -->
For more information, click [here](./Lambda-Patterns.md).

<!-- Prefer -->
See [Lambda Function Patterns](./Lambda-Patterns.md) for handler conventions.
```

## Project-Specific Terminology

Use consistent terminology throughout the wiki:

| Term | Usage |
|------|-------|
| Lambda | Always capitalize "Lambda" when referring to AWS Lambda |
| handler | Lowercase for the function that handles events |
| entity | Lowercase for database entity types |
| OpenTofu | Spell out fully, not "tofu" or "terraform" |
| Drizzle ORM | Include "ORM" on first use |

## Vale Rule Categories

Vale checks documentation against these rule categories:

### From Vale Base

- Spelling errors
- Repeated words
- Sentence length

### From Google Style

- Use of passive voice
- Future tense
- First person plural ("we")
- Heading capitalization
- Acronym usage

## Handling Vale Alerts

### Accepting Suggestions

Most Vale suggestions improve clarity. Accept them unless they:
- Break technical accuracy
- Change the intended meaning
- Conflict with project terminology

### Suppressing False Positives

For legitimate exceptions, use Vale comments:

```markdown
<!-- vale Google.Passive = NO -->
This section describes how requests are processed.
<!-- vale Google.Passive = YES -->
```

Use sparingly and document why the exception is needed.

## Related Documentation

- [Google Developer Documentation Style Guide](https://developers.google.com/style/)
- [Vale Documentation](https://vale.sh/docs/)
- [Documentation Patterns](./Documentation-Patterns.md) - Page structure conventions
- [Convention Capture System](./Convention-Capture-System.md) - How conventions are documented

---

*Good documentation is clear, concise, and consistent. When in doubt, ask: "Would a new team member understand this?"*
