# Health-Check Deep Dive Prompts

These prompts are designed for use in **separate Claude Code instances** to deeply investigate each area covered by the `/health-check` command. Each prompt is self-contained and can be run independently.

---

## 1. Testing Infrastructure Deep Dive

```
Perform a comprehensive audit of the testing infrastructure in this iOS TCA codebase.

Investigate:
1. **Framework compliance**: Verify ALL tests use Swift Testing (`import Testing`, `@Test`, `#expect`) NOT XCTest
2. **TCA test patterns**: Check TestStore usage, exhaustive state assertions, @MainActor annotations
3. **CI workflow**: Review `.github/workflows/` for test execution, coverage reporting, and failure handling
4. **Test coverage gaps**: Identify features/reducers without corresponding tests
5. **Mock/stub quality**: Evaluate dependency mocking patterns in tests

For each finding, provide file:line references. Flag any XCTest usage as CRITICAL.
```

---

## 2. Documentation System Deep Dive

```
Audit the documentation system for accuracy and completeness.

Investigate:
1. **AGENTS.md accuracy**: Does it reflect current codebase reality? Check each claim against actual code
2. **CLAUDE.md accuracy**: Verify migration status claims, architecture descriptions, and code examples
3. **Wiki cross-references**: Check any wiki or doc links for accuracy
4. **Conventions documentation**: Are coding patterns/conventions captured somewhere?
5. **Stale documentation**: Find docs that reference removed/changed code

Read ALL markdown files in the repo. For each inaccuracy, provide the doc location and what needs updating.
```

---

## 3. TCA Architecture Deep Dive

```
Validate TCA pattern compliance across the entire codebase.

Investigate:
1. **@Reducer macro usage**: All features must use @Reducer, not manual Reducer conformance
2. **@ObservableState**: All State structs should use @ObservableState for iOS 17+ observation
3. **Delegate actions**: Child-to-parent communication should use .delegate pattern, not direct parent action calls
4. **Cancel ID management**: Async effects should have proper cancellation IDs
5. **Child feature scoping**: Verify store.scope() usage is correct
6. **Feature hierarchy**: Document the complete feature tree from RootFeature down

Run: Scripts/validate-tca-patterns.sh and report any violations. Check for @State/@StateObject/@ObservedObject in TCA views.
```

---

## 4. Shell Scripts Deep Dive

```
Audit all shell scripts for quality, safety, and correctness.

Investigate:
1. **Safety headers**: ALL scripts must have `set -euo pipefail` at the top
2. **Script inventory**: List all scripts in Scripts/ directory with their purposes
3. **Pattern validation scripts**: Test validate-tca-patterns.sh, validate-ios-version.sh, check-build-warnings.sh
4. **Git hooks**: Check if hooks are set up correctly in .git/hooks or via configuration
5. **Error handling**: Do scripts provide useful error messages?
6. **Shellcheck compliance**: Identify any potential shellcheck warnings

Execute each script and report outputs. Flag scripts without safety headers as HIGH priority.
```

---

## 5. Dependencies (SPM) Deep Dive

```
Verify all Swift Package Manager dependencies for versions, security, and hygiene.

Investigate:
1. **Package.swift analysis**: Read MyPackage/Package.swift, check all dependency declarations
2. **TCA version**: Must be 1.22.2+ (check for exact pinning vs ranges)
3. **Valet version**: Check for latest stable version
4. **Dependabot configuration**: Is .github/dependabot.yml configured for Swift?
5. **Transitive dependencies**: Run `swift package show-dependencies` to see full tree
6. **Security audit**: Check for any known CVEs in dependencies
7. **Deprecated packages**: Flag any packages that are archived or deprecated

Provide specific version recommendations for any outdated packages.
```

---

## 6. AI Agent Helpers Deep Dive

```
Audit the .claude/ directory for command quality and completeness.

Investigate:
1. **Command inventory**: List all files in .claude/commands/ with their purposes
2. **Workflow coverage**: Do commands exist for: validate, build, test, commit, PR creation?
3. **AGENTS.md review**: Is it complete? Does it help new Claude sessions understand the project?
4. **TCA templates**: Check if any code templates are accurate to current TCA patterns
5. **Hook configuration**: Review .claude/settings.json for post-edit hooks
6. **Command consistency**: Do commands follow similar structure and patterns?

Read every file in .claude/ recursively. Suggest missing commands that would improve workflow.
```

---

## 7. Source Code Architecture Deep Dive

```
Review the source code organization and architectural patterns.

Investigate:
1. **@DependencyClient usage**: All external dependencies should use this pattern
2. **Naming conventions**: Are Features, Views, Clients consistently named?
3. **Vendor encapsulation**: Are third-party libraries (Valet, TCA) properly wrapped?
4. **File organization**: Is the folder structure consistent and logical?
5. **Code duplication**: Identify any significant duplication between MVVM and TCA versions
6. **Missing abstractions**: Are there common patterns that should be extracted?

Map out the complete folder structure of OfflineMediaDownloaderCompostable. Compare organization to MVVM version.
```

---

## 8. Security Deep Dive

```
Perform a security audit of the codebase.

Investigate:
1. **Keychain usage**: Verify Valet is used correctly, check for SecureEnclaveValet where appropriate
2. **Hardcoded secrets**: Search for API keys, passwords, tokens in source code (grep for common patterns)
3. **Secrets in xcconfig**: Verify Development.xcconfig is gitignored if it contains real values
4. **Certificate pinning**: Check if network calls implement certificate pinning
5. **Auth token storage**: How are authentication tokens stored and refreshed?
6. **Sign in with Apple**: Verify SIWA implementation follows best practices
7. **Logging safety**: Ensure no sensitive data is logged

Search for patterns: "password", "secret", "apikey", "token", "bearer". Flag any findings as CRITICAL.
```

---

## 9. Build & Bundling Deep Dive

```
Check build configuration and warnings.

Investigate:
1. **Build warnings**: Run `Scripts/check-build-warnings.sh` or build and capture warnings
2. **Deployment targets**: Verify iOS 18.0+ is consistent across all targets and Package.swift
3. **Code signing**: Check signing configuration in .xcodeproj
4. **Asset catalogs**: Review asset organization and completeness
5. **Info.plist**: Verify required keys (push notifications, background modes, etc.)
6. **Build settings**: Check for any unusual or deprecated build settings
7. **Scheme configuration**: Review .xcscheme files for test/build/run configurations

Build the project and capture ALL output. Any warnings should be catalogued with file:line references.
```

---

## 10. Swift 6 Concurrency & Observability Deep Dive

```
Validate Swift 6 concurrency safety and modern observability patterns.

Investigate:
1. **@Sendable annotations**: All async closures passed across actor boundaries must be @Sendable
2. **@MainActor correctness**: UI-related code should be properly annotated
3. **Actor isolation**: Check for data races or improper cross-actor access
4. **Structured logging**: Is os.Logger or similar being used consistently?
5. **Performance metrics**: Any use of os.signpost for performance tracking?
6. **Correlation IDs**: Are requests traceable through the system?
7. **Strict concurrency**: Check if SWIFT_STRICT_CONCURRENCY is enabled

Enable strict concurrency checking if not already enabled. Report all warnings.
```

---

## Usage Instructions

1. Start a new Claude Code session in the same repository
2. Copy-paste ONE prompt from above
3. Let Claude perform the deep investigation
4. Collect findings and action items
5. Repeat for each area you want to investigate

Each prompt is designed to take 5-15 minutes depending on codebase size and will produce specific, actionable findings with file references.
