# Dependency Security Configuration

## Overview

This project implements comprehensive supply chain security using pnpm 10.27+ features.

## Configuration Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Security settings (minimumReleaseAge, trustPolicy, etc.) |
| `.npmrc` | Legacy script blocking + performance settings |
| `package.json` | Overrides for known CVEs |

## Security Layers

### Layer 1: Lifecycle Script Protection
**Settings**: `strictDepBuilds: true` + `allowBuilds` map in `pnpm-workspace.yaml`

All lifecycle scripts (preinstall, postinstall, etc.) are blocked by default.
Packages requiring scripts must be explicitly allowlisted:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  "@lancedb/lancedb": true
  "onnxruntime-node": true
```

### Layer 2: Release Cooldown
**Setting**: `minimumReleaseAge: 1440` (24 hours)

New package versions must be published for at least 24 hours before installation.
This provides time for the community to detect malicious packages.

**Bypass for critical patches**:
```yaml
minimumReleaseAgeExclude:
  - critical-security-patch@1.2.3
```

### Layer 3: Trust Policy
**Setting**: `trustPolicy: no-downgrade`

Blocks installation if a package version has weaker provenance than previous versions.
Trust levels: Trusted Publisher > Provenance > No Evidence

**Bypass for legitimate migrations**:
```yaml
trustPolicyExclude:
  - package-that-migrated-cicd@1.2.3
```

### Layer 4: Exotic Subdep Blocking
**Setting**: `blockExoticSubdeps: true`

Prevents transitive dependencies from using git repositories or direct tarball URLs.
Only direct dependencies can use exotic sources.

## Audit Process

1. **CI Check**: `pnpm audit --audit-level=high` runs on every PR
2. **Weekly Updates**: Dependabot opens PRs for security updates
3. **Manual Audit**: Run `pnpm audit` before major releases

## Current Allowlist

| Package | Reason | Last Audited |
|---------|--------|--------------|
| @lancedb/lancedb | Native bindings for vector DB | 2025-01-02 |
| onnxruntime-node | ML inference runtime | 2025-01-02 |

## Updating the Allowlist

1. Verify the package genuinely needs lifecycle scripts
2. Audit the package source code for malicious behavior
3. Add to `allowBuilds` in `pnpm-workspace.yaml`
4. Document in this table with audit date
5. Commit with clear rationale

## References

- [pnpm Supply Chain Security](https://pnpm.io/supply-chain-security)
- [pnpm Settings](https://pnpm.io/settings)
- [CIS Supply Chain Security Benchmark](https://www.cisecurity.org/)
