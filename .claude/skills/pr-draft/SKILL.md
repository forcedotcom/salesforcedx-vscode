---
name: pr-draft
description: Draft PRs with conventional commit-style titles and Gus work item refs. Use when drafting PRs, PR titles, PR descriptions, opening PRs, or Git2Gus workflows.
---

# PR Draft

Draft PR titles and bodies per salesforcedx-vscode conventions. Requires a Gus work item number.

## Work item

**Confirmation required:** Never create or update work items without explicit user confirmation. Present proposed fields (Subject, Epic, Details, etc.) and wait for user to approve before any `sf data create record` or `sf data update record`.

1. If branch name contains `W-XXXXX`, confirm it exists in GUS, resembles the work done on the branch, and use that
2. Else ask: "Do you have a Gus work item (W-XXXXX) for this PR?"
3. If yes → try to find it using [gus-cli/SKILL.md](../gus-cli/SKILL.md). Confirm with the user that you got it right, or ask them to choose if several could be right.
4. If no → offer to create via Gus. Follow [gus-cli/SKILL.md](../gus-cli/SKILL.md). **Before creating:** show user Subject, Epic, Details, assignee. Ask: "Create this work item?" Do not run `sf data create record` until user says yes.
5. After PR created: update work item `Details__c` with PR link. Query current `Details__c`, append `"\nPR: <url>"` (or prepend if empty). **Before updating:** show user the new Details\_\_c. Ask: "Update work item with PR link?" Do not run `sf data update record` until user says yes.
6. After PR created: offer Ready for Review. Ask: "Put WI in Ready for Review? Who should review?" Choices:
   - **Named:** user picks one (e.g. "Shane", "Daphne") → match first or full name to [gus-cli Team members](../gus-cli/SKILL.md#team-members-assignee__c-qa_engineer__c), use Id
   - **Random (Gus Spinner):** pick one at random from team members, excluding current `Assignee__c`
     Set `Status__c='Ready for Review'`, `QA_Engineer__c='<selected userId>'`. **Before updating:** show user Status**c, QA_Engineer**c. Ask user to confirm. Do not run `sf data update record` until user says yes.

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
