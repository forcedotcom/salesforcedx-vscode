# .claude Context Glossary

Terminology for tooling under `.claude/` (skills, workflows, commands).

## AI auto WI

GUS WI, `Subject__c` contains `[ai-auto]`. Drained by `auto-build-wi.js`
(claim → plan → build → review → draft PR). Runner opens PR; `Assignee__c` =
human owner.

_Avoid_: "auto WI", "bot WI".

## /ai-auto approve

Magic-string PR comment. Owner posts on own PR after reading diff; peer runner
submits GitHub Approve on owner's behalf (GitHub forbids self-approval).

Match: line-anchored `^/ai-auto approve\b`. Author = PR owner, must be on
gus-cli team list, comment timestamp ≥ current head SHA commit timestamp
(re-comment per push).

_Avoid_: "approved" comment, "lgtm" comment.

## Review thread

GitHub line-anchored PR review comment, part of a submitted review (not
pending). Has `isResolved` state. Sole input to the comment-handling phase
of `auto-build-wi.js` — issue-level PR comments and bot comments are out
of scope. Runner never replies; addresses by code change + resolve, or
bounces to human via 😕 reaction (see [[bounce-reaction]]).

_Avoid_: "PR comment" (ambiguous with issue comments), "review feedback".

## Bounce reaction

😕 (`confused`) reaction by runner on the first comment of a [[review-thread]].
Marker: "runner saw this thread, couldn't address it, DM'd human owner."
Dedup signal — runner skips threads it has 😕'd. Re-engage trigger: any
non-runner reply in the thread after the reaction's `created_at` causes
runner to remove its own 😕 next tick, re-entering the thread for triage.

## Peer approve

Phase in `auto-build-wi.js`. Per tick: scan ai-auto WIs in `Ready for Review`
across team, find ones whose owner ≠ runner left fresh `/ai-auto approve`,
submit `gh pr review --approve`, set `Status__c='Fixed'`, DM owner. Public-repo
trust gate: PR must trace back to GUS WI, not label.

Approve only — does not merge. Owner merges (release-calendar reasons).

_Avoid_: "peer review", "auto-approve".
