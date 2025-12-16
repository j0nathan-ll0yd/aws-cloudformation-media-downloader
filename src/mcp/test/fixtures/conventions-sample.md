# Conventions Tracking

Test fixture for convention parser unit tests.

**Last Updated**: 2024-01-15
**Total Conventions**: 6 detected, 4 documented, 2 pending

## 🟡 Pending Documentation

1. **Test Convention One** (Testing Pattern)
   - **What**: Use mock helpers for all entity mocking
   - **Why**: Consistent mocking patterns improve test maintainability
   - **Detected**: During test implementation
   - **Target**: docs/wiki/Testing/Mock-Patterns.md
   - **Priority**: HIGH
   - **Status**: ⏳ Pending
   - **Enforcement**: Code review

2. **Test Convention Two** (AWS SDK usage)
   - **What**: Never import AWS SDK directly
   - **Why**: Encapsulation and testability
   - **Detected**: During SDK migration
   - **Target**: docs/wiki/AWS/SDK-Policy.md
   - **Priority**: CRITICAL
   - **Status**: ⏳ Pending
   - **Enforcement**: Zero-tolerance

## ✅ Recently Documented

1. **Documented Convention One** (Git Rule)
   - **What**: No AI references in commits
   - **Why**: Professional commits only
   - **Detected**: From project setup
   - **Documented**: docs/wiki/Conventions/Git-Workflow.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: Zero-tolerance

2. **Documented Convention Two** (TypeScript Pattern)
   - **What**: Use strict TypeScript configuration
   - **Why**: Catch errors at compile time
   - **Detected**: From initial setup
   - **Documented**: docs/wiki/TypeScript/Config.md
   - **Priority**: MEDIUM
   - **Status**: ✅ Documented
   - **Enforcement**: tsconfig.json

3. **Documented Convention Three** (Security Rule)
   - **What**: Lifecycle scripts disabled by default
   - **Why**: Supply chain attack prevention
   - **Detected**: During pnpm migration
   - **Documented**: docs/wiki/Meta/pnpm-Migration.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: .npmrc configuration

4. **Low Priority Convention** (Infrastructure Script)
   - **What**: Use consistent script naming
   - **Why**: Developer experience
   - **Detected**: During script cleanup
   - **Documented**: docs/wiki/Infrastructure/Scripts.md
   - **Priority**: LOW
   - **Status**: ✅ Documented
   - **Enforcement**: Code review

## 💭 Proposed Conventions

(None currently)

## 🗄️ Archived Conventions

(None currently)

## Usage

This file serves as test data for the convention parser tests.
