---
name: pr-draft
description: Draft PRs with leading [W-XXXXXXXX] in titles (never trailing WI), conventional commit-style remainder, GUS refs in body. Use when drafting PRs, PR titles, PR descriptions, opening PRs, or Git2Gus workflows.
---

# PR Draft

Draft PR titles and bodies per salesforcedx-vscode conventions. Requires a Gus work item number.

## Work item

**Confirmation required:** Never create or update work items without explicit user confirmation. Present proposed fields (Subject, Epic, Details, etc.) and wait for user to approve before any `sf data create record` or `sf data update record`.

**Safety** never use `--no-verify`

1. If branch name contains `W-XXXXX`, confirm it exists in GUS, resembles the work done on the branch, and use that
2. Else ask: "Do you have a Gus work item (W-XXXXX) for this PR?"
3. If yes → try to find it using [gus-cli/SKILL.md](../gus-cli/SKILL.md). Confirm with the user that you got it right, or ask them to choose if several could be right.
4. If no → offer to create via Gus. Follow [gus-cli/SKILL.md](../gus-cli/SKILL.md). **Before creating:** show user Subject, Epic, Details, assignee. Ask: "Create this work item?" Do not run `sf data create record` until user says yes. If user declines creation and still wants to proceed with the PR, include `[skip-validate-pr]` in the PR body.
5. Before creating PR: push current branch to remote if it doesn't already exist (`git push -u origin $(git branch --show-current)` or equivalent). Never push to `develop`/`main`
6. After PR created: update work item `Details__c` with PR link. Query current `Details__c`, append `"\nPR: <url>"` (or prepend if empty). **Before updating:** show user the new Details__c. Ask: "Update work item with PR link?" Do not run `sf data update record` until user says yes.
7. After PR created: offer Ready for Review. Ask: "Put WI in Ready for Review? Who should review?" Choices:
   - **Named:** user picks one (e.g. "Shane", "Daphne") → match first or full name to [gus-cli Team members](../gus-cli/SKILL.md#team-members-assignee__c-qa_engineer__c), use Id
   - **Random (Gus Spinner):** pick one at random from team members, excluding current `Assignee__c`
     Set `Status__c='Ready for Review'`, `QA_Engineer__c='<selected userId>'`. **Before updating:** show user Status__c, QA_Engineer__c. Ask user to confirm. Do not run `sf data update record` until user says yes.
   - **Reviewer Reassignment:** Immediately after the GUS WI update, replace auto-assigned GitHub reviewers with the selected QA person:
     1. Get current review requests: `gh pr view <url> --json reviewRequests --jq '.reviewRequests[].login'`
     2. Remove each existing reviewer: `gh pr edit <url> --remove-reviewer <login>`
     3. Add selected QA person: `gh pr edit <url> --add-reviewer <github_login>` (from [gus-cli Team members](../gus-cli/SKILL.md#team-members-assignee__c-qa_engineer__c))

## Target branch

- Default `develop`
- From other branch (≠ develop, ≠ main)? Use it. Detect: `git reflog show <branch> | tail -1` → "moving from X" / "Created from X"
- Never `main`; inferred main → develop

## Title format

`[W-XXXXXXXX] type(scope): description`

- **Work item first:** The GUS work item must be the leading token in **square brackets** (`[W-21735053]`). This is the `Name` field from GUS, not the Salesforce Record ID (e.g., `a07...`). If you just created the record, query the `Name` first.
- **Types**: feat, fix, docs, style, refactor, perf, test, ci, chore, build
- **Scope**: optional
- Example: `[W-21735053] build(extensions): consolidate apex-tmlanguage via apex-log`
- **Avoid:** trailing WI — `type(scope): description W-21735053`

## Body format

- Base body on branch commits only
- Ignore plans/conversation history (may be stale)
- Write content per [concise/SKILL.md](../concise/SKILL.md)
- Include `@W-XXXXX@` in "What issues does this PR fix or reference?" per [.github/PULL_REQUEST_TEMPLATE.md](../../../.github/PULL_REQUEST_TEMPLATE.md):
- Delete before/after section if empty
- **User declined WI:** If user explicitly declines WI but wants PR, include `[skip-validate-pr]` in body (e.g. at end)

```
### What issues does this PR fix or reference?
#<GitHub Issue>, @W-XXXXX@
```
