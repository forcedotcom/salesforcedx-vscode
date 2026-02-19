---
name: pr-draft
description: Draft PRs with conventional commit-style titles and Gus work item refs. Use when drafting PRs, PR titles, PR descriptions, opening PRs, or Git2Gus workflows.
---

# PR Draft

Draft PR titles and bodies per salesforcedx-vscode conventions. Requires a Gus work item number.

## Work item

1. If branch name contains `W-XXXXX`, confirm it exists in GUS, resemble the work done on the branch, and use that
2. Else ask: "Do you have a Gus work item (W-XXXXX) for this PR?"
3. If yes → try to find it using [gus-cli/SKILL.md](../gus-cli/SKILL.md). Confirm with the user that you got it right, or ask them to choose if several could be right.
4. If no → offer to create via Gus. Follow [gus-cli/SKILL.md](../gus-cli/SKILL.md); put it in In Progress status confirm before `sf data create record`
5. Offer to put the WI in Ready for Review status

## Title format

`type(scope): description W-XXXXX`

- **Types**: feat, fix, docs, style, refactor, perf, test, ci, chore
- **Scope**: optional
- **Work item**: `W-XXXXX` at end

## Body format

- Write body content per [concise/SKILL.md](../concise/SKILL.md)
- Include `@W-XXXXX@` in "What issues does this PR fix or reference?" per [.github/PULL_REQUEST_TEMPLATE.md](../../../.github/PULL_REQUEST_TEMPLATE.md):
- Delete the before/after section if you have nothing to say there

```
### What issues does this PR fix or reference?
#<GitHub Issue>, @W-XXXXX@
```
