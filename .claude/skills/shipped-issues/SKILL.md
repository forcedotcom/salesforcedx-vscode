---
name: shipped-issues
description: Find open GitHub issues whose linked GUS work item is closed AND whose issue number appears in CHANGELOG.md, then close them. Use when user invokes /shipped-issues or asks to clean up shipped issues.
---

# Shipped Issues

Cross-reference open GitHub issues against closed GUS work items and the shipped CHANGELOG to identify issues that were fixed and released, but never closed on GitHub.

## Inputs

- Repo: `forcedotcom/salesforcedx-vscode`
- Changelog: `packages/salesforcedx-vscode/CHANGELOG.md` (on `develop`; pull latest first)
- GUS alias: `gus` (see `.claude/skills/gus-cli/SKILL.md`)

## Workflow

### 1. Get current CHANGELOG from develop

```bash
git fetch origin develop
git show origin/develop:packages/salesforcedx-vscode/CHANGELOG.md > /tmp/shipped-changelog.md
```

Do not switch branches; run from wherever the user is.

### 2. List open issues with W- references

```bash
gh issue list --repo forcedotcom/salesforcedx-vscode --state open --limit 500 --search "W in:body" --json number,title,body,url > /tmp/shipped-issues.json
```

The `W in:body` filter narrows to issues that contain the letter W — overly broad but cheap. Locally extract `W-\d{6,9}` matches per issue (regex; multiple W- per issue is allowed). Drop issues with no match.

### 3. Query GUS for status of each W-

Batch in chunks of ~50 W- names per query to stay under SOQL limits:

```bash
sf data query --query "SELECT Id, Name, Status__c, Last_Modified_Internal_Closed_Date__c FROM ADM_Work__c WHERE Name IN ('W-1234567','W-2345678', ...)" -o gus --json
```

Closed terminal statuses (any of these counts as closed): see `.claude/skills/gus-cli/SKILL.md` § Status\_\_c values "Closed (terminal)".

Quick check: `Status__c LIKE 'Closed%' OR Status__c IN ('Completed','Fixed')`.

### 4. Filter to candidates

Keep an issue only when **every** W- on the issue resolves to a Closed/Completed status in GUS. If any linked W- is still open, skip the issue (work isn't all done).

### 5. Cross-reference CHANGELOG

For each candidate issue number `N`, search `/tmp/shipped-changelog.md` for any of:

- `ISSUE #N` (case-insensitive)
- `issues/N` (link form)
- `#N` only when the surrounding line clearly references an issue, not a PR

If matched → issue is **shipped**. Record the matched CHANGELOG line for the closing comment.

### 6. Present the report

Show a table to the user before closing anything:

| Issue | Title | W- | WI Status | Shipped in (CHANGELOG line) |
| ----- | ----- | -- | --------- | --------------------------- |

Also list any **near-miss** rows separately so the user can review:
- Issues where WIs are all closed but the issue # isn't in the CHANGELOG (maybe under-the-hood / not customer-facing)
- Issues where some W- are still open

### 7. Close issues — only after explicit user confirmation

For each confirmed issue, post a comment then close:

```bash
gh issue close <number> --repo forcedotcom/salesforcedx-vscode --comment "Closing — shipped in <version>. See CHANGELOG entry: <verbatim line>. (Linked work item <W-XXXXXXXX> is closed.)"
```

Do **not** loop-close without user confirmation. If many issues, present the full list and ask "Close all N?" once.

## Edge cases

- **Multiple W- per issue, mixed status**: skip until all W- close.
- **Issue body mentions W- in a quoted error or unrelated context**: rare; surface as candidate anyway, the user reviews the table.
- **CHANGELOG hit on a `## Under the Hood` line**: still counts as shipped — user can opt out per-row.
- **Issue # shows up in CHANGELOG as `[PR #N]`**: not a match. Only `ISSUE #N` / `issues/N` indicate the issue itself.
- **No CHANGELOG match but WI closed long ago**: list as near-miss, don't auto-close.

## Output format

End with a one-line summary: `Closed N issues; M near-misses for review.`
