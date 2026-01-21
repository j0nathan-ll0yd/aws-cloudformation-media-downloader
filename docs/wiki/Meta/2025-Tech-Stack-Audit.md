---
last_updated: 2025-12-21
next_review: 2026-12-21
status: current
---

# 2025 Tech Stack Audit

**Date:** December 21, 2025
**Auditor:** Gemini CLI Agent

## Executive Summary
This project employs a cutting-edge, "paranoid-security" stack (Node 22, pnpm 10, OpenTofu, Better Auth) that aligns with or exceeds 2025 industry best practices. 

## Detailed Findings

### 1. Infrastructure & Runtime
- **OpenTofu (Verified):** The project uses OpenTofu as a drop-in replacement for Terraform.
  - *Status:* ✅ **Safe**. Current compatibility is high.
  - *Action:* Maintain a "Feature Parity Watchlist" in `docs/wiki/Infrastructure/OpenTofu-Patterns.md` to monitor divergence (e.g., state encryption features).
- **Node.js 22 (Verified):** Project explicitly targets `node22`.
  - *Cold Start Risk:* Node 22 has known initial cold start regressions with `http` loading.
  - *Mitigation:* We use `esbuild` with `external: [aws-sdk]` to utilize the Lambda runtime's pre-loaded SDK, effectively mitigating bundle-size related cold starts.
  - *Status:* ✅ **Optimized**.

### 2. Build System
- **Bundler (Verified):** Uses `esbuild` (`config/esbuild.config.ts`).
  - *Cleanup:* Removed leftover `.webpackCache` directory to prevent confusion.
  - *Pattern:* "Lightweight Monorepo" using `package.json` Subpath Imports (`#entities/*`) instead of heavy workspaces. This is an efficient pattern for single-deployment serverless apps.

### 3. Security
- **Supply Chain (Verified):** `pnpm` v10 configuration adheres to "Deny by Default" for lifecycle scripts.
  - *Configuration:* `.npmrc` blocks scripts; `package.json` allowlists only `@lancedb/lancedb`.
  - *Verdict:* 🛡️ **Best-in-Class**. This protects against `postinstall` malware vectors.
- **Authentication:** Uses Better Auth with a custom Drizzle adapter for Aurora DSQL.
  - *Verdict:* Align with "Lambda as Orchestrator" pattern.

### 4. Testing Strategy
- **"Remocal" Testing:** The project uses local scripts (`bin/test-remote-*.sh`) to invoke remote AWS resources.
  - *Observation:* This matches the "Remocal" (Remote + Local) testing trend for 2025.
  - *Recommendation:* Formalize this terminology in `docs/wiki/Testing/Integration-Testing.md` to distinguish it from pure LocalStack tests.

### 5. API Definition
- **TypeSpec:** Used as the Single Source of Truth (SSOT).
  - *Trend:* Matches 2025 "TypeSpec -> OpenAPI" generation flow.
  - *Status:* ✅ **Future-Proof**.

## Recommendations
1.  **Documentation Update:** Formalize "Remocal Testing" in the testing guide.
2.  **Maintenance:** Periodically review OpenTofu release notes for divergence.
