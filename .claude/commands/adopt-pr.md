---
description: Adopt community PR — replay commits onto develop, review, create WI, push, open new PR, close original
---

# Adopt PR

Adopt PR `$ARGUMENTS` (number/URL). Self-contained — no auto-build-wi handoff.

Glossary: [Adopted PR](.claude/CONTEXT.md).

## Inputs

- `$ARGUMENTS`: PR# or URL
- Repo: `forcedotcom/salesforcedx-vscode`

## Phases

Sequential. AskUserQuestion at marked steps.

### 1. Fetch PR

```
gh pr view <PR#> --repo forcedotcom/salesforcedx-vscode \
  --json number,title,body,author,baseRefName,headRefName,headRefOid,headRepositoryOwner,state,commits,files
```

Capture: `number, title, body, author.login, baseRefName, headRefName, headRefOid, headRepositoryOwner.login, commits[].oid, files`.

- `state != OPEN` → abort, print state.
- `baseRefName != develop` → log: `user targeted <X>; retargeting to develop`.

### 2. Runner identity

Per [gus-cli](.claude/skills/gus-cli/SKILL.md) "Runner identity". Need: `userId, ownerPrefix, githubLogin`.

### 3. Worktree

Slug: lowercase title, `[^a-z0-9]+ → -`, trim, slice 40.

- Branch: `<ownerPrefix>/adopt-<PR#>-<slug>`
- Path: `../vscode-auto-wt/<ownerPrefix>-adopt-<PR#>-<slug>`

```
git fetch origin develop
git worktree add -b <branch> <path> origin/develop --no-track
cd <path> && npm install
```

`npm install` wires husky.

### 4. Cherry-pick

```
git fetch https://github.com/<headRepositoryOwner.login>/salesforcedx-vscode.git <headRefName>
```

Cherry-pick each `oid` oldest-first: `git cherry-pick <oid>`.

Conflict:

1. Apply [merge-conflicts](.claude/skills/merge-conflicts/SKILL.md) best-effort.
2. Still conflicted → AskUserQuestion: "Cherry-pick `<oid>` conflicts in `<files>`. Resolve in `<path>`, say continue. Or abort."
3. Continue → `git cherry-pick --continue`. Abort → `git cherry-pick --abort && git worktree remove <path> --force`. Stop.

After each pick: `git log -1 --format='%an <%ae>'` matches user.

### 5. Skill review fan-out

Diff size: `git diff --shortstat origin/develop...HEAD`.

Skills:

- Always: `typescript, concise, paths`
- Diff > 20 lines: add `ls .claude/skills/` minus denylist `changelog feature-branch grill-me gus-cli merge-conflicts pr-draft release shipped-issues query-app-insights span-file-export`

Parallel `Agent` calls — one per skill + thermo + effect-advocate. Single message.

Per-skill prompt:
> Skill `<name>` apply to diff in `<path>`? Read `.claude/skills/<name>/SKILL.md`. Examine `git diff origin/develop...HEAD` from `<path>`. Return JSON `{applies: bool, findings: [{severity: critical|high|medium|low, file, line, suggestion}]}`. Apply but no findings → `findings: []`.

Thermo: invoke [thermonuclear-code-quality-review](.claude/skills/thermonuclear-code-quality-review/SKILL.md) skill. Same JSON shape.

Effect-advocate: `subagent_type: 'effect-advocate'`. JSON `{verdict, findings: [{severity: must|should|consider, file, line, suggestion, citation}]}`.

### 6. Show + ask

Group by severity. Print: severity, file:line, suggestion.

AskUserQuestion: "Apply fixes? (1) all (2) critical+high only (3) skip (4) abort".

### 7. Apply fixes

Picked 1/2: spawn Agent in `<path>` to apply selected. Stack on top — never amend user commits.

Commit subject: `fix: address review findings - W-XXXXXXXX` (W- placeholder, amend in step 9 after WI exists).

Co-Authored-By trailer: current model name.

### 8. Create WI

Per [gus-cli](.claude/skills/gus-cli/SKILL.md).

8a. Create:

```
sf data create record -s ADM_Work__c -o gus -v \
  "Subject__c='Adopt #<PR#>: <escaped title>' \
   Assignee__c='<runner.userId>' \
   QA_Engineer__c='<runner.userId>' \
   Status__c='In Progress' \
   Story_Points__c=2 \
   Product_Tag__c=a1aB000000005G3IAI \
   Scrum_Team__c=a00B0000000w9xPIAQ \
   RecordTypeId=0129000000006gDAAQ"
```

Capture `id`.

8b. Get Name:

```
sf data query --query "SELECT Name FROM ADM_Work__c WHERE Id='<id>'" -o gus --result-format json
```

Capture `W-XXXXXXXX`.

8c. Details via `--flags-dir` (`-v` + `--flags-dir` don't combine on create):

```
mkdir -p /tmp/adopt-pr-<PR#>
```

`/tmp/adopt-pr-<PR#>/values` (single line):

```
Details__c='<p><strong>Adopted from:</strong> <a href="https://github.com/forcedotcom/salesforcedx-vscode/pull/<PR#>">#<PR#></a> by @<author.login></p><p><strong>Original body:</strong></p><blockquote><ESCAPED_BODY></blockquote>'
```

Escape body: `& → &amp;`, `< → &lt;`, `> → &gt;`, `' → &apos;`.

```
sf data update record -s ADM_Work__c -i <id> -o gus --flags-dir /tmp/adopt-pr-<PR#>
```

### 9. Amend fix commit (if step 7 ran)

Replace placeholder W-XXXXXXXX in fix commit subject with actual `Name`. `git commit --amend` only on the fix commit (most recent — never user commits).

### 10. Push

```
cd <path> && git push -u origin <branch>
```

Hook fail → diagnose, re-commit, retry. Never `--no-verify`.

### 11. Open new PR

Per [pr-draft](.claude/skills/pr-draft/SKILL.md) title format.

- Type: infer from files (feat/fix/docs/...)
- Scope: optional, from path (e.g. `lwc` for `salesforcedx-vscode-lwc`)
- Desc: from original title, conventional-commit shape
- Trail: ` - W-XXXXXXXX`

Body file `/tmp/adopt-pr-<PR#>/body`:

```
<original body verbatim>

---

**Adopted from #<PR#>** by @<author.login> — commits preserved with author credit. Replayed onto develop for internal CI / AI review.

### Reviewer notes

<remaining findings grouped by severity, or "none">

### What issues does this PR fix or reference?

@W-XXXXXXXX@

Co-authored-by: <author.name> <<author.email>>
```

Email: `gh api repos/forcedotcom/salesforcedx-vscode/commits/<headRefOid> --jq '.commit.author.email'`.

```
gh pr create --base develop --head <branch> --title "<title>" --body-file /tmp/adopt-pr-<PR#>/body --repo forcedotcom/salesforcedx-vscode
```

Capture URL + number.

### 12. Update WI with new PR link

1. Query existing `Details__c`.
2. Append: `<p><strong>Adopt PR:</strong> <a href="<newPrUrl>">#<newPrNumber></a></p>`
3. Overwrite `/tmp/adopt-pr-<PR#>/values`.
4. `sf data update record -s ADM_Work__c -i <id> -o gus --flags-dir /tmp/adopt-pr-<PR#>`
5. Re-query, verify "Adopted from" + "Adopt PR" both present.

### 13. Close original

Comment first:

```
gh pr comment <PR#> --repo forcedotcom/salesforcedx-vscode --body "$(cat <<'EOF'
Thanks for the contribution! Adopting as #<NEW_PR> so our internal CI + AI review pipeline can run (forks have limited access).

Your commits preserved with you as Author. Follow #<NEW_PR> for status — we'll merge from there.

GUS WI: W-XXXXXXXX
EOF
)"
```

Then:

```
gh pr close <PR#> --repo forcedotcom/salesforcedx-vscode
```

### 14. Summary

Print:
- New PR URL
- WI Name
- Branch + worktree path
- Findings: applied / remaining counts
- Original closed: y/n

Worktree stays. Runner removes manually.

## Constraints

- Never `--no-verify`
- Never amend user commits (only own fix commit)
- Never tag `[ai-auto]` (triggers auto-build-wi)
- Verify Author preserved post-cherry-pick
- AskUserQuestion = sole pause mechanism

## Failure modes

- Conflict unresolvable → pause or abort clean
- Pre-push fails → root-cause, no bypass
- WI create fails → no rollback (no PR yet), stop
- Original PR comment/close fails → new PR live; surface, runner handles
