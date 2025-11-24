# Naming Conventions

## Quick Reference
- **When to use**: Naming any variable, function, file, or type in the codebase
- **Enforcement**: Required - inconsistent naming causes confusion
- **Impact if violated**: Medium - readability and maintainability issues

## The Rule

Use consistent naming conventions based on the element type:
- **camelCase** for variables, functions, and most file names
- **PascalCase** for types, interfaces, classes, and constructors
- **SCREAMING_SNAKE_CASE** for true constants only
- **kebab-case** avoided in TypeScript projects (use camelCase for files)

## Naming Styles Explained

### camelCase
**Pattern**: First letter lowercase, subsequent words capitalized

**Used for**:
- Variables: `userName`, `isActive`, `hasPermission`
- Functions: `fetchUserData`, `calculateTotal`, `validateInput`
- File names: `lambdaStyleGuide.md`, `apiHelpers.ts`, `userService.ts`
- Object properties: `user.firstName`, `config.maxRetries`
- Function parameters: `function greet(firstName, lastName)`

### PascalCase
**Pattern**: First letter uppercase, subsequent words capitalized

**Used for**:
- TypeScript interfaces: `interface UserProfile`, `interface ApiResponse`
- Type aliases: `type UserId = string`, `type ConfigOptions`
- Classes: `class DataTransformer`, `class YTDlpWrap`
- Enums: `enum Status`, `enum ErrorCode`
- React/Vue components: `UserDashboard`, `NavigationBar`

### SCREAMING_SNAKE_CASE
**Pattern**: All uppercase letters with underscores

**Used for**:
- Mathematical/physical constants: `PI`, `SPEED_OF_LIGHT`
- True application constants: `MAX_RETRIES`, `DEFAULT_TIMEOUT`
- **Deprecated for**: Module-level environment variables (use CamelCase instead)

### kebab-case
**Pattern**: All lowercase with hyphens

**Avoid in TypeScript projects** - use camelCase for file names instead
- ❌ Avoid: `user-service.ts`
- ✅ Prefer: `userService.ts`

**Acceptable for**:
- CSS files: `user-profile.css`
- URL slugs: `/api/user-profile`
- Package names: `my-awesome-package`

## Examples

### ✅ Correct

```typescript
// Variables and functions (camelCase)
const userName = 'John';
const isLoggedIn = true;
function calculateTotalPrice(basePrice: number, taxRate: number) {
  return basePrice * (1 + taxRate);
}

// Types and interfaces (PascalCase)
interface UserProfile {
  firstName: string;
  lastName: string;
  emailAddress: string;
}

type UserId = string;
type UserStatus = 'active' | 'inactive';

class UserService {
  private apiEndpoint: string;

  constructor(endpoint: string) {
    this.apiEndpoint = endpoint;
  }

  async fetchUserData(userId: UserId): Promise<UserProfile> {
    // Implementation
  }
}

// Constants (SCREAMING_SNAKE_CASE)
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// File names (camelCase)
// userService.ts
// apiHelpers.ts
// lambdaHandler.ts
```

### ❌ Incorrect

```typescript
// Wrong: PascalCase for variables
const UserName = 'John';  // Should be userName

// Wrong: snake_case for functions
function calculate_total_price() {}  // Should be calculateTotalPrice

// Wrong: camelCase for interfaces
interface userProfile {}  // Should be UserProfile

// Wrong: lowercase for classes
class userservice {}  // Should be UserService

// Wrong: camelCase for constants
const maxRetries = 3;  // Should be MAX_RETRIES (if truly constant)

// Wrong: kebab-case for TypeScript files
// user-service.ts  // Should be userService.ts
```

## Special Cases

### Environment Variables
In Lambda functions, use CamelCase for module-level constants:
```typescript
// ✅ Correct - Module-level env var constant
const BucketName = process.env.BUCKET_NAME!;
const TableName = process.env.TABLE_NAME!;

// ❌ Incorrect - SCREAMING_SNAKE_CASE deprecated for env vars
const BUCKET_NAME = process.env.BUCKET_NAME!;
```

### Acronyms and Initialisms
Treat acronyms as words:
```typescript
// ✅ Correct
const apiUrl = 'https://api.example.com';
const xmlParser = new XmlParser();
const userId = '123';
class HttpClient {}

// ❌ Incorrect
const APIURL = 'https://api.example.com';
const XMLParser = new XMLParser();
const userID = '123';
class HTTPClient {}
```

### Private Properties
Use underscore prefix for private properties (optional):
```typescript
class Example {
  private _count: number;  // Optional underscore
  private apiKey: string;  // Also acceptable
}
```

### Boolean Variables
Use descriptive prefixes:
```typescript
// ✅ Good boolean names
const isActive = true;
const hasPermission = false;
const canEdit = true;
const shouldRetry = false;
const wasDeleted = true;

// ❌ Poor boolean names
const active = true;  // Unclear if boolean
const permission = false;  // Sounds like an object
```

## Rationale

Consistent naming conventions:
1. **Improve readability** - Developers immediately understand element types
2. **Reduce cognitive load** - No need to guess or remember special cases
3. **Enable tooling** - IDEs can better understand and refactor code
4. **Facilitate collaboration** - Team members use same patterns
5. **Prevent bugs** - Clear distinction between types and values

## Enforcement

### Automated Checks
```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "interface",
        "format": ["PascalCase"]
      },
      {
        "selector": "typeAlias",
        "format": ["PascalCase"]
      },
      {
        "selector": "class",
        "format": ["PascalCase"]
      },
      {
        "selector": "variable",
        "format": ["camelCase", "UPPER_CASE"]
      },
      {
        "selector": "function",
        "format": ["camelCase"]
      }
    ]
  }
}
```

### Manual Review
During code review, check for:
- Consistent application of conventions
- Clear, descriptive names
- Appropriate use of each naming style
- No mixing of styles within same category

### Quick Check Script
```bash
# Find potential naming violations
# PascalCase variables (likely wrong)
grep -r "const [A-Z][a-zA-Z]*" --include="*.ts"

# snake_case functions (likely wrong)
grep -r "function [a-z_]*_" --include="*.ts"

# kebab-case TypeScript files (discouraged)
find . -name "*-*.ts" -not -path "*/node_modules/*"
```

## Migration Guide

When updating existing code:
1. Update variables and functions to camelCase
2. Update interfaces and types to PascalCase
3. Update file names from kebab-case to camelCase
4. Keep true constants as SCREAMING_SNAKE_CASE
5. Update imports after renaming files
6. Run tests to ensure nothing breaks

## Exceptions

The only acceptable exceptions:
1. **External API compatibility** - When matching external API field names
2. **Database fields** - When database requires specific naming
3. **Legacy code** - During gradual migration (document timeline)
4. **Generated code** - Auto-generated files may have different conventions

All exceptions should be documented with comments explaining why.

## Related Patterns

- [Import Organization](Import-Organization.md) - How to organize and name imports
- [File Organization](../Infrastructure/File-Organization.md) - How to structure and name files
- [Git Workflow](Git-Workflow.md) - Commit message naming conventions
- [Variable Naming](../Bash/Variable-Naming.md) - Bash-specific naming rules

---

*This convention ensures code readability and consistency across all TypeScript projects. Follow it strictly for new code and migrate existing code gradually.*