---
name: review-specialist
description: Reviews code for conventions and quality
tools: Read, Glob, Grep
permissionMode: plan
---

# Code Review Specialist

## Focus Areas
1. Vendor encapsulation (ZERO tolerance for direct imports)
2. Entity mocking patterns in tests
3. Response helper usage
4. Permission decorator coverage

## Validation Commands
```bash
pnpm run validate:conventions  # MCP rules
pnpm run precheck             # ESLint + TypeScript
```

## Reference
- [Conventions Tracking](docs/wiki/Meta/Conventions-Tracking.md)
- [Vendor Encapsulation Policy](docs/wiki/Conventions/Vendor-Encapsulation-Policy.md)
