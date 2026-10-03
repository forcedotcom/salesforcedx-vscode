# packages/

Monorepo members. For the big picture see `../CONTEXT-MAP.md`, `../docs/README.md`, `../docs/architecture/CodeReuse.md`.

Type legend: `ext` ships a VS Code extension (`engines.vscode`). `lib` is imported. `tool` is build/test/automation, not shipped to users.

## Extensions (user-facing)

| Directory | npm name | Purpose | Use when / not when |
| --- | --- | --- | --- |
| `salesforcedx-vscode/` | `salesforcedx-vscode` | Salesforce Extension Pack (21 members) | Install list. Not code. See `salesforcedx-vscode-expanded/` for full pack. |
| `salesforcedx-vscode-expanded/` | `salesforcedx-vscode-expanded` | Expanded pack (26 members + prettier, xml, graphql) | Install list. Not code. |
| `salesforcedx-vscode-core/` | `salesforcedx-vscode-core` | CLI integration, legacy shared services (frozen per `docs/adr/0006-core-api-frozen-sunset.md`) | CLI commands only. Do not add new shared services here; use `salesforcedx-vscode-services/`. |
| `salesforcedx-vscode-services/` | `salesforcedx-vscode-services` | Shared Effect services host (connection, deploy, FS, observability) | New cross-extension code goes here. See `.claude/skills/services-extension-consumption/SKILL.md`. |
| `salesforcedx-vscode-org/` | `salesforcedx-vscode-org` | Org auth/management commands | Org picker, default org. Not metadata browse (see `org-browser/`). |
| `salesforcedx-vscode-org-browser/` | `salesforcedx-vscode-org-browser` | View/retrieve org metadata | Metadata tree. Model for `services-extension-consumption` (`src/services/extensionProvider.ts`). |
| `salesforcedx-vscode-apex/` | `salesforcedx-vscode-apex` | Apex code-editing features | Language features. Not the JS library (`salesforcedx-apex/`) or test runner (`apex-testing/`). |
| `salesforcedx-vscode-apex-testing/` | `salesforcedx-vscode-apex-testing` | Apex test run/manage | Test execution only. Not anonymous Apex (see `apex-log/`). |
| `salesforcedx-vscode-apex-log/` | `salesforcedx-vscode-apex-log` | Anonymous Apex, logs, trace flags | Execute-anonymous + log retrieval. Not test runs. |
| `salesforcedx-vscode-apex-oas/` | `salesforcedx-vscode-apex-oas` | OpenAPI generation for Apex REST / AuraEnabled | OAS only. |
| `salesforcedx-vscode-apex-debugger/` | `salesforcedx-vscode-apex-debugger` | Interactive Apex debugger UI | Debug UI. Protocol adapter lives in `salesforcedx-apex-debugger/`. |
| `salesforcedx-vscode-apex-replay-debugger/` | `salesforcedx-vscode-apex-replay-debugger` | Replay Apex from debug logs | Replay UI. Adapter lives in `salesforcedx-apex-replay-debugger/`. |
| `salesforcedx-vscode-lwc/` | `salesforcedx-vscode-lwc` | LWC code-editing | LWC. Server lives in `salesforcedx-lwc-language-server/`. |
| `salesforcedx-vscode-lightning/` | `salesforcedx-vscode-lightning` | Aura component bundles | Aura. Not LWC. |
| `salesforcedx-vscode-visualforce/` | `salesforcedx-vscode-visualforce` | Visualforce syntax highlighting | Visualforce. Server lives in `salesforcedx-visualforce-language-server/`. |
| `salesforcedx-vscode-metadata/` | `salesforcedx-vscode-metadata` | Metadata operations views | Metadata commands. Not org auth (see `org/`). |
| `salesforcedx-vscode-soql/` | `salesforcedx-vscode-soql` | SOQL extension host (custom editor) | SOQL workbench UI host. Parsing in `soql-common/`, model in `soql-model/`, browser UI in `soql-builder-ui/`. |

## Language servers and debug adapters (`ext`, headless)

| Directory | npm name | Purpose |
| --- | --- | --- |
| `salesforcedx-aura-language-server/` | `@salesforce/salesforcedx-aura-language-server` | Aura language server. |
| `salesforcedx-lwc-language-server/` | `@salesforce/salesforcedx-lwc-language-server` | LWC language server. |
| `salesforcedx-lightning-lsp-common/` | `@salesforce/salesforcedx-lightning-lsp-common` | Shared LSP code for aura + LWC servers. |
| `salesforcedx-visualforce-language-server/` | `@salesforce/salesforcedx-visualforce-language-server` | Visualforce language server. |
| `salesforcedx-apex-debugger/` | `@salesforce/salesforcedx-apex-debugger` | Apex Debug Protocol adapter. UI in `salesforcedx-vscode-apex-debugger/`. |
| `salesforcedx-apex-replay-debugger/` | `@salesforce/salesforcedx-apex-replay-debugger` | Apex Replay Debug Protocol adapter. UI in `salesforcedx-vscode-apex-replay-debugger/`. |

## Shared libraries (`lib`, no `engines.vscode`)

| Directory | npm name | Purpose | Use when / not when |
| --- | --- | --- | --- |
| `salesforcedx-apex/` | `@salesforce/apex-node` | JS library for Apex (execute anonymous, tests, logs, trace flags) | Plain Node/CLI use. Inside VS Code prefer `salesforcedx-vscode-services/` API. |
| `salesforcedx-utils/` | `@salesforce/salesforcedx-utils` | Node utils for extensions | Node-only helpers. VS Code API glue lives in `salesforcedx-utils-vscode/`. |
| `salesforcedx-utils-vscode/` | `@salesforce/salesforcedx-utils-vscode` | SFDX library ↔ VS Code glue | VS Code-facing helpers. Not new shared services. |
| `salesforcedx-vscode-services-types/` | `@salesforce/vscode-services` | Types for services extension API | Types only. Runtime lives in `salesforcedx-vscode-services/`. |
| `salesforcedx-vscode-i18n/` | `@salesforce/vscode-i18n` | i18n helpers | Messages. See `.claude/skills/i18n-messages/SKILL.md`. |
| `effect-ext-utils/` | `@salesforce/effect-ext-utils` | Effect helpers (`buildAllServicesLayer`, `ExtensionProviderService`) | Wire `AllServicesLayer` in any Effect extension. |
| `effect-octokit/` | `@salesforce/effect-octokit` | Effect service over Octokit (REST + GraphQL) | GitHub automation. Not extension runtime. |
| `soql-common/` | `@salesforce/soql-common` | SOQL parsing utilities | Parsing only. Model/validation in `soql-model/`. |
| `soql-model/` | `@salesforce/soql-model` | SOQL query model, serialization, field validators | Model only. UI in `soql-builder-ui/`. |
| `soql-builder-ui/` | `@salesforce/soql-builder-ui` | Browser-safe Lit + Effect SOQL Builder foundation | Browser UI. Extension host in `salesforcedx-vscode-soql/`. |

## Tooling, test, fixtures (not shipped)

| Directory | npm name | Purpose |
| --- | --- | --- |
| `eslint-local-rules/` | `@salesforce/eslint-plugin-vscode-extensions` | Custom ESLint rules (ex: `local/no-swallowed-rejection`). |
| `playwright-vscode-ext/` | `@salesforce/playwright-vscode-ext` | Shared Playwright fixtures/page objects. See `.claude/skills/playwright-e2e/SKILL.md`. |
| `drivable-vscode/` | `@salesforce/drivable-vscode` (private) | MCP server + automation for driving VS Code. Not a VS Code extension. |
| `test-workspaces/` | — (no `package.json`) | Fixture workspaces for manual/E2E tests. |

## Confusable pairs

- `salesforcedx-apex/` (lib `@salesforce/apex-node`) vs `salesforcedx-vscode-apex/` (ext language features) vs `salesforcedx-vscode-apex-testing/` / `apex-log/` (ext runners).
- `salesforcedx-apex-debugger/` (adapter) vs `salesforcedx-vscode-apex-debugger/` (ext UI). Same split for `apex-replay-debugger`.
- `salesforcedx-utils/` (node) vs `salesforcedx-utils-vscode/` (VS Code glue).
- `salesforcedx-vscode-services/` (runtime) vs `salesforcedx-vscode-services-types/` (types) vs `salesforcedx-vscode-core/` (legacy frozen, CLI only).
- `salesforcedx-vscode/` (pack, 21) vs `salesforcedx-vscode-expanded/` (pack, 26). Pack members in other repos (agents, einstein-gpt, slds, code-analyzer, ui-preview, metadata-visualizer) are not in `packages/`.
- `soql-common/` (parse) vs `soql-model/` (model) vs `soql-builder-ui/` (browser UI) vs `salesforcedx-vscode-soql/` (ext host).
