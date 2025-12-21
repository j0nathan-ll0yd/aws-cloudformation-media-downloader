# AI-Ready Repository Optimization Plan

## Phase 1: Context Packing (Repomix)
**Objective:** Create a single, compressed artifact of the codebase to maximize "Context Caching" efficiency for both Gemini 1.5 Pro and Claude 3.5 Sonnet.

1.  **Install Repomix:** Add `repomix` to `devDependencies` to ensure version consistency across the team.
2.  **Configuration (`repomix.config.json`):**
    *   **Format:** XML (Structured, strict parsing for agents) or Markdown (Human-readable). *Decision: XML for higher agent precision.*
    *   **Optimization:** Enable `compress: true` (removes comments/whitespace) and `removeEmptyLines`.
    *   **Filtering:** Configure rigorous `.gitignore` usage and custom exclusion patterns (e.g., `coverage/`, `dist/`, `**/*.spec.ts` if irrelevant to architecture).
3.  **Scripts:** Add convenience scripts to `package.json`:
    *   `pnpm run pack:context`: Generates the full context file.
    *   `pnpm run pack:light`: Generates a "lite" version (only source interfaces, no implementation details) for high-level planning.

## Phase 2: Universal Agent Entry Point (`llms.txt`)
**Objective:** Create a standardized "map" for web-based agents or crawlers to instantly understand the project structure without cloning.

1.  **Generate `docs/llms.txt`:**
    *   **Project Summary:** High-level purpose (AWS Media Downloader).
    *   **Architecture Stack:** OpenTofu, TypeScript, AWS Lambda, ElectroDB.
    *   **Key Files:** Direct pointers to `AGENTS.md`, `README.md`, and core entity definitions.
2.  **Generate `docs/llms-full.txt`:** A comprehensive, single-file concatenation of all high-value documentation (Wiki, Architecture constraints).

## Phase 3: "Semantic Memory" (LanceDB Integration) [COMPLETE]
**Objective:** Enable agents to answer "Where is X?" or "How do I Y?" questions using semantic search rather than brute-force file scanning.

1.  **Scaffold LanceDB:** Added `@lancedb/lancedb` and `@xenova/transformers` for local embeddings.
2.  **Update MCP Server:**
    *   Added new MCP tool: `index_codebase`.
    *   Added new MCP tool: `search_codebase_semantics`.
3.  **Indexing Strategy:**
    *   Parsed TypeScript files into AST chunks (Classes, Functions, Interfaces, Variables).
    *   Generated local embeddings using `Xenova/all-MiniLM-L6-v2`.
    *   Stored in a local `.lancedb` directory.

## Phase 4: CI/CD Compliance Automation
**Objective:** Move `AGENTS.md` rules from "Passive Guidance" to "Active Enforcement."

1.  **GitHub Action (`.github/workflows/agent-compliance.yml`):**
    *   Trigger: Pull Requests.
    *   Step 1: Use `ts-morph` (existing dependency) to scan for forbidden patterns (e.g., direct `aws-sdk` imports).
    *   Step 2: Verify that `AGENTS.md` boundaries (e.g., "Never modify file X") are respected.
    *   Step 3: Fail build if violations are found.

## Phase 5: IntelliJ Integration
**Objective:** Ensure the setup works seamlessly within your preferred IDE.

1.  **`.gemini/instructions.md`:** Create this file to provide system-level instructions specifically for the Gemini CLI when running locally.
2.  **External Tool Config:** (Optional) Configure IntelliJ "External Tools" to trigger `repomix` generation on save or via shortcut.

## Phase 6: Automatic Context Loading strategies
**Objective:** Ensure agents automatically ingest the packed context without manual intervention.

1.  **For Claude (CLI/Code):**
    *   Create a shell alias or wrapper script (e.g., `claude-context`) that reads `repomix-output.xml` and pipes it into the Claude CLI start command.
    *   *Example:* `alias claude-dev="claude --system \"$(cat repomix-output.xml)\""` (Implementation depends on specific CLI tool used).
2.  **For Gemini (CLI):**
    *   Update `.gemini/instructions.md` with a high-priority rule: "At the start of the session, look for and read 'repomix-output.xml' to load the full codebase context."
3.  **For IDEs (Projects):**
    *   Document the "Project Knowledge" setup for manual IDEs (Claude Desktop, etc.) in `AGENTS.md`.

---

## Next Steps
1.  **Execute Phase 1 (Repomix):** Install and configure the context packer.
2.  **Execute Phase 2 (llms.txt):** Establish the documentation entry points.
3.  **Review Phase 3:** Assess complexity before implementation.
