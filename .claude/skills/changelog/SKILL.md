---
name: changelog
description: Polish the automated CHANGELOG for a release branch. Removes GUS refs, categorizes under-the-cover changes, improves customer-facing descriptions. Use when preparing/reviewing the changelog on a release branch, or when user mentions changelog quality.
---

# Changelog Polish

Improve the automated changelog generated on release branches (`release/vM.m.P`).

Scope: the all-extensions release changelog at `packages/salesforcedx-vscode/CHANGELOG.md`. Root `CHANGELOG.md` is a pointer only — do not edit. Per-package `CHANGELOG.md` files (e.g. `packages/salesforcedx-vscode-i18n/CHANGELOG.md`) are scoped to their own package and out of scope here.

## When to use

- User invokes `/changelog` or asks to prepare/review the changelog
- On a release branch with a `chore: generated CHANGELOG` commit

## File location

`packages/salesforcedx-vscode/CHANGELOG.md`

## Workflow

1. **Read** the current changelog file
2. **Identify** the automated commit: `git log --oneline -- packages/salesforcedx-vscode/CHANGELOG.md | grep "generated CHANGELOG"`
3. **For each entry**, fetch PR context: `gh pr view <number> --json title,body,commits,labels`. In the body, look for a **"What issues does this PR fix or reference?"** section and extract any issue or discussion numbers linked there.
4. **Apply** the rules below to produce a polished draft
5. **Present** the revised changelog to the user for approval before writing

## Rules

### 1. Remove GUS work item references

Strip any `W-NNNNNNN` or `- W-NNNNNNN` text from entries. These are internal tracking IDs not meaningful to customers.

Before: `- Add a Max Rows input to SOQL Builder UI - W-22199672 ([PR #7261](...`
After: `- We added a **Max Rows** input to SOQL Builder UI so you can limit the number of rows retrieved. ([PR #7261](...`

### 2. Classify entries as customer-facing or under-the-cover

**Under-the-cover** (not visible to users):
- Test infrastructure (E2E suites, unit tests, test utilities)
- Internal telemetry/observability (span attributes, logging)
- Refactoring with no behavior change
- CI/CD pipeline changes
- Dependency bumps with no user-visible effect
- Internal API changes between packages

**Customer-facing** (visible to users):
- New commands, UI elements, or features
- Bug fixes that affected user workflows
- Performance improvements users would notice
- Behavior changes in existing features

Use PR commits, title, body, and labels to decide. When uncertain, check the diff: `gh pr diff <number> --name-only` to see which files changed.

Under-the-cover entries go under a dedicated `## Under the Hood` section (no package sub-headers needed). Consolidate all under-the-cover PRs into one or a few lines:
`- We made some under the hood changes. ([PR #NNNN](...), [PR #MMMM](...))`.

### 3. Deduplicate multi-package entries

The automation lists the same PR under every package it touched. Consolidate to the **most relevant user-facing package**. If a change touched `salesforcedx-vscode-services` plus a feature extension, list it under the feature extension only.

### 4. Improve customer-facing descriptions

- Write from the user's perspective: "We added...", "We fixed...", "You can now..."
- Describe what the user can do or what changed for them, not the implementation
- Start with `We added…`, `We fixed a bug where…`, `We improved…`, `We reverted…`, or `The <X> now…`. Full sentences ending in `.`
- **Bold** user-facing names: extensions (**Salesforce Metadata Visualizer**), commands (**SFDX: Create Project**), UI elements (**Run** button, **Org Differences** view, **Ready for Review**)
- Backticks for code identifiers, file names, config keys: `jsconfig.json`, `sourceApiVersion`, `MetadataRegistryService`, `.soql`
- Keep entries to 1-2 sentences max
- For opaque/internal fixes where customer impact is unclear: `We made some changes under the hood.`
- For reverts: `We reverted <X> because <reason>.`
- For setting/option additions: name the setting in **bold**, describe default behavior
- For extension-pack additions: include extension id in parens, e.g. `**Salesforce Live Preview** (salesforce.salesforcedx-vscode-ui-preview)`
- Prefer `VS Code` over `VSCode`; `on Windows` not `in Windows`
- After the PR link(s), append issue and discussion links found in the **"What issues does this PR fix or reference?"** section of the PR body:
  - Issues: `[ISSUE #NNNN](https://github.com/forcedotcom/salesforcedx-vscode/issues/NNNN)`
  - Discussions: `[DISCUSSION #NNNN](https://github.com/forcedotcom/salesforcedx-vscode/discussions/NNNN)`
  - Format: `([PR #7517](...), [ISSUE #4065](...))`
  - Only include issues/discussions explicitly listed in that section; do not infer from commit messages or other body text

### 5. Verify categories

- `## Added` — new features, new commands, new UI
- `## Fixed` — bug fixes
- `## Changed` — behavior changes to existing features (add section if needed)
- `## Under the Hood` — internal changes not visible to users (CI, telemetry, refactoring, dep bumps). No package sub-headers needed.
- Remove empty package sections (header with no entries)

## Example transformation

**Automated:**
```markdown
## Added

#### salesforcedx-vscode-metadata

- Filter packageDirs to those containing target folder - W-22049669 ([PR #7225](...))

#### salesforcedx-vscode-services

- Filter packageDirs to those containing target folder - W-22049669 ([PR #7225](...))

- Replace static activationEvents with programmatic activation W-21956120 ([PR #7154](...))
```

**Polished:**
```markdown
## Added

#### salesforcedx-vscode-metadata

- When creating an Apex class or LWC component, the output directory picker now lists only package directories that contain the relevant folder. ([PR #7225](...))

## Under the Hood

- We made some under the hood changes. ([PR #7154](...))
```

## Commit and push

After user approves the polished changelog:

1. Stage **only** the changelog file: `git add packages/salesforcedx-vscode/CHANGELOG.md`
2. Verify no other files are staged: `git diff --cached --name-only` must show only `packages/salesforcedx-vscode/CHANGELOG.md`. If other files appear, unstage them before committing.
3. Commit: `git commit -m "chore: update CHANGELOG.md [skip ci]"`
4. Push: `git push`

Never include other file changes in this commit.

Use these `chore:` subjects for polish commits on the release branch:

- `chore: polish changelog`
- `chore: write into sentences`
- `chore: changelog improvements`
- `chore: update changelog`
- `chore: missing changelog entry`
- `chore: clean up duplicate entries`
- `chore: merge vX.Y.A and vX.Y.B changelogs` (when prior patch's entries need to roll into current)

---

## Reference: how the changelog is generated

These rules describe the auto-generator behavior in `scripts/create-release-notes.ts` + `scripts/change-log-generator-utils.js`. They are background context for understanding what arrives in the auto-generated commit; you don't typically interact with them during a polish pass.

### Generation

- Auto-generated by `Create Release Branch` GHA via `npm run changelog`
- Commit: `chore: generated CHANGELOG for release/vXX.YY.ZZ`
- Human-edited afterward on release branch before publish (this skill)
- If nothing releasable (all `chore`/`ci` etc.), script exits, no entry added

### Format

```
# XX.YY.ZZ - Month DD, YYYY

## Added

#### <package-name>

- <message> ([PR #<num>](https://github.com/forcedotcom/salesforcedx-vscode/pull/<num>))

## Fixed

#### <package-name>

- <message> ([PR #<num>](...))
```

- Top header: `# <version> - <release date>`; date is `+2 days` from branch-cut (Mon cut → Wed release)
- Type sections: only `## Added` (from `feat`) and `## Fixed` (from `fix`). Ignored commit types: `chore`, `style`, `refactor`, `test`, `build`, `ci`, `revert`
- Package sections: `#### <package-name>`, alphabetical within a type
- Bullet entries: `- <message> ([PR #N](url))`; PR url format `https://github.com/forcedotcom/salesforcedx-vscode/pull/<num>`
- Multiple PRs for one entry: comma-separate `([PR #A](...), [PR #B](...), [ISSUE #C](...), [DISCUSSION #D](...))`
- Include `[ISSUE #N](https://github.com/forcedotcom/salesforcedx-vscode/issues/N)` or `[DISCUSSION #N](https://github.com/forcedotcom/salesforcedx-vscode/discussions/N)` when listed in the PR's "What issues does this PR fix or reference?" section

### Package filtering (auto)

- If `salesforcedx-vscode-core` is touched, all other touched packages (except `docs`) are dropped for that commit
- Only packages starting with `salesforce` or `docs` count; `/images/` and `/test/` paths ignored

### Commit parsing (auto)

- Requires conventional `type(scope): message` + trailing `(#PR)` to appear in changelog
- Strips `[W-XXXXXXXX]` GUS refs; uppercases first char
- Skips entries whose PR# already exists in file (rerun-safe)

### Dedupe / merge rules (post-generation)

- Same PR listed under multiple packages: keep under the most user-relevant package, delete others (see Rule 3 above)
- Same PR listed twice in a section: collapse to one bullet
- Empty `#### <package>` subsections: leave in place if auto-generated (keeps structure obvious), or remove during polish — match surrounding style
- Patch release rolling into next: if v66.Y.A shipped but entries were missing, merge into v66.Y.B section and update the header date; see `chore: merge ... changelogs`