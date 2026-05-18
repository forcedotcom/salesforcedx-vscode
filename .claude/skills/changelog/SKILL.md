---
name: changelog
description: Polish the automated CHANGELOG for a release branch. Removes GUS refs, categorizes under-the-cover changes, improves customer-facing descriptions. Use when preparing/reviewing the changelog on a release branch, or when user mentions changelog quality.
---

# Changelog Polish

Improve the automated changelog generated on release branches (`release/vM.m.P`).

## When to use

- User invokes `/changelog` or asks to prepare/review the changelog
- On a release branch with a `chore: generated CHANGELOG` commit

## File location

`packages/salesforcedx-vscode/CHANGELOG.md`

## Workflow

1. **Read** the current changelog file
2. **Identify** the automated commit: `git log --oneline -- packages/salesforcedx-vscode/CHANGELOG.md | grep "generated CHANGELOG"`
3. **For each entry**, fetch PR context: `gh pr view <number> --json title,body,commits,labels`
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
- Bold key UI elements: **Run Query**, **SOQL Builder**, **Set a Default Org**
- Keep entries to 1-2 sentences max
- Link related GitHub issues when the PR body references them: `[ISSUE #NNNN](...)`

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
