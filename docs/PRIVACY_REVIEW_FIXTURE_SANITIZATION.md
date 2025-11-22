# Privacy Review: Fixture Sanitization Requirements

## Purpose

This document outlines the privacy and security requirements for automated fixture extraction from production CloudWatch Logs. It serves as a checklist for security audits and ensures sensitive data never leaks into version control.

## Threat Model

### Data Classification

**Highly Sensitive** (Must NEVER appear in fixtures):
- Authentication credentials (passwords, API keys, tokens)
- Personally Identifiable Information (PII): names, emails, phone numbers
- Financial data (credit cards, bank accounts)
- Health information (PHI/HIPAA data)
- Government IDs (SSN, passport numbers)

**Moderately Sensitive** (Should be redacted):
- User IDs (UUIDs)
- Device identifiers
- IP addresses
- Session tokens
- OAuth codes

**Low Sensitivity** (Context-dependent):
- Timestamps
- Generic error messages
- Public URLs
- File sizes/counts

### Attack Vectors

1. **Accidental Commit**: Sensitive data in extracted fixtures committed to git
2. **PR Review Bypass**: Sensitive data not caught during code review
3. **Regex Evasion**: Sensitive fields with unexpected naming bypass sanitization patterns
4. **Nested Data**: Deeply nested objects escape sanitization
5. **Encoded Data**: Base64-encoded sensitive data not detected
6. **Log Injection**: Malicious input crafted to appear as fixture marker

## Current Sanitization Implementation

### Automated Sanitization (`bin/process-fixture-markers.js`)

**Case-Insensitive Pattern Matching**:
```javascript
const SENSITIVE_PATTERNS = [
  /authorization/i,
  /^x-api-key$/i,
  /apikey/i,
  /^token$/i,
  /authtoken/i,
  /authorizationcode/i,
  /devicetoken/i,
  /appleuserid/i,
  /userid/i,
  /^email$/i,
  /identitytoken/i,
  /principalid/i,
  /password/i,
  /secret/i,
  /^key$/i,
  /accesskey/i,
  /privatekey/i,
  /sessiontoken/i
]
```

**Recursive Sanitization**:
- Handles deeply nested objects and arrays
- Preserves object structure
- Replaces sensitive values with `REDACTED_{FIELD_NAME}`

### Manual Review Checkpoints

**Before Moving Fixtures to Production**:

1. ✅ Visual inspection of extracted fixtures
2. ✅ Search for email patterns: `grep -r "@" src/lambdas/*/test/fixtures/extracted/`
3. ✅ Search for phone numbers: `grep -rE '\+?[0-9]{10,}' src/lambdas/*/test/fixtures/extracted/`
4. ✅ Search for credit cards: `grep -rE '[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}' src/lambdas/*/test/fixtures/extracted/`
5. ✅ Search for SSN patterns: `grep -rE '[0-9]{3}-[0-9]{2}-[0-9]{4}' src/lambdas/*/test/fixtures/extracted/`
6. ✅ Search for JWT tokens: `grep -rE 'eyJ[A-Za-z0-9_-]+\.' src/lambdas/*/test/fixtures/extracted/`
7. ✅ Search for AWS keys: `grep -rE 'AKIA[0-9A-Z]{16}' src/lambdas/*/test/fixtures/extracted/`

### Provenance Metadata

Every extracted fixture includes:
```json
{
  "_metadata": {
    "source": "production-cloudwatch",
    "extractedAt": "2025-11-20T12:00:00Z",
    "logGroup": "/aws/lambda/WebhookFeedly",
    "sanitized": true,
    "fixtureType": "INCOMING",
    "contentHash": "a1b2c3d4"
  }
}
```

This allows auditing of fixture provenance and verification of sanitization.

## Privacy Review Checklist

### Pre-Deployment Review (Required before first extraction)

- [ ] **Security Team Approval**: Fixture extraction plan reviewed by security team
- [ ] **Pattern Completeness**: All sensitive fields in production payloads identified
- [ ] **Test Coverage**: Sanitization tested with realistic production-like data
- [ ] **Access Control**: Limited AWS permissions for fixture extraction workflow
- [ ] **Audit Logging**: GitHub Actions workflow logs retained for 90 days

### Per-Extraction Review (Required for each weekly extraction)

- [ ] **Automated Sanitization**: All fixtures processed through sanitization script
- [ ] **Manual Inspection**: At least 10 random fixtures manually reviewed
- [ ] **Pattern Validation**: No matches for sensitive data patterns (checklist above)
- [ ] **Metadata Verification**: All fixtures have `_metadata.sanitized: true`
- [ ] **Diff Review**: PR diff reviewed for unexpected sensitive data

### Quarterly Audit (Every 3 months)

- [ ] **Pattern Update**: Review and update SENSITIVE_PATTERNS based on new fields
- [ ] **False Negative Check**: Sample production logs for fields not being sanitized
- [ ] **False Positive Check**: Verify legitimate data not over-redacted
- [ ] **Compliance Review**: Ensure compliance with GDPR, CCPA, HIPAA (if applicable)

## Recommended Enhancements

### Short-term (Next Quarter)

1. **Content-based Detection**: Regex patterns for emails, phones, credit cards in VALUES (not just field names)
   ```javascript
   function detectPIIInValue(value) {
     const patterns = {
       email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
       phone: /\b(\+?1?[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/,
       ssn: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/,
       creditCard: /\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/
     }
     for (const [type, pattern] of Object.entries(patterns)) {
       if (pattern.test(value)) return type
     }
     return null
   }
   ```

2. **Base64 Decoding**: Detect and sanitize base64-encoded sensitive data
   ```javascript
   function isBase64Encoded(str) {
     try {
       return btoa(atob(str)) === str
     } catch (err) {
       return false
     }
   }
   ```

3. **Allow/Deny Lists**: Per-Lambda configuration for field allowlists
   ```json
   {
     "WebhookFeedly": {
       "allow": ["fileId", "articleURL", "status"],
       "deny": ["*"] // Default deny all others
     }
   }
   ```

### Long-term (Future Roadmap)

4. **AI-Based Detection**: Use ML model to detect PII patterns not covered by regex
5. **Differential Privacy**: Add noise to numeric values (timestamps, counts) for privacy
6. **Anonymization**: Replace real user IDs with consistent fake IDs across fixtures
7. **Encryption at Rest**: Encrypt extracted fixtures before storing in git

## Compliance Considerations

### GDPR (General Data Protection Regulation)

- **Right to be Forgotten**: Ensure production logs retained ≤7 days; extracted fixtures contain no real user data
- **Data Minimization**: Only extract data necessary for testing
- **Pseudonymization**: Replace user IDs with generated UUIDs

### CCPA (California Consumer Privacy Act)

- **Data Collection Transparency**: Document fixture extraction in privacy policy
- **Opt-Out Mechanism**: Provide user opt-out from test data usage (if applicable)

### HIPAA (Health Insurance Portability and Accountability Act)

- **Not Applicable**: This project does not handle PHI
- **Future**: If health data added, require BAA and PHI-specific sanitization

## Incident Response Plan

### Data Leak Discovered in Fixtures

1. **Immediate Actions**:
   - Revert commit containing sensitive data
   - Force push to remove from git history: `git push --force`
   - Notify security team within 1 hour
   - Rotate compromised credentials

2. **Investigation**:
   - Identify how data bypassed sanitization
   - Update SENSITIVE_PATTERNS to catch similar cases
   - Add test case for this scenario

3. **Remediation**:
   - Run sanitization script retroactively on all historical fixtures
   - Update documentation with new pattern
   - Communicate with affected users (if PII leaked)

4. **Prevention**:
   - Add pre-commit hook to block sensitive patterns
   - Increase manual review rigor
   - Add automated scanning in CI/CD

## Contact Information

**Security Team**: security@example.com
**Privacy Officer**: privacy@example.com
**Incident Reporting**: incidents@example.com

## Document Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-20 | 1.0 | Initial privacy review framework | Claude |

---

**Last Reviewed**: 2025-11-20
**Next Review**: 2026-02-20 (Quarterly)
