# Ready-for-Review handoff

Runs only after the PR exists and the user opts into requesting review. Confirm each GUS write first (see [SKILL.md ## Work item](./SKILL.md#work-item)).

Ask: "Put WI in Ready for Review? Who should review?"

## Pick the reviewer

- **Named:** user picks one (e.g. "Shane", "Daphne") → match first/full name to [gus-cli Team members](../gus-cli/SKILL.md#team-members-assigneec-qa_engineerc), use Id.
- **Random (Gus Spinner):** pick one at random from team members, excluding the current `Assignee__c`.

## Update the WI

Set `Status__c='Ready for Review'`, `QA_Engineer__c='<selected userId>'`. **Before updating:** show the user `Status__c` + `QA_Engineer__c`, confirm, then run `sf data update record` (per [gus-cli](../gus-cli/SKILL.md)).

## Reassign the GitHub reviewer

Immediately after the GUS update, replace auto-assigned reviewers with the selected QA person:

1. `gh pr view <url> --json reviewRequests --jq '.reviewRequests[].login'`
2. Remove each: `gh pr edit <url> --remove-reviewer <login>`
3. Add selected: `gh pr edit <url> --add-reviewer <github_login>` (login from [gus-cli Team members](../gus-cli/SKILL.md#team-members-assigneec-qa_engineerc)).

## Slack ping

After reassignment, message `#ide-exp-code-review` (channel `C054SJJAB24`) tagging the QA person (Slack ID from [gus-cli Team members](../gus-cli/SKILL.md#team-members-assigneec-qa_engineerc)):

```
<@SLACK_ID> PR ready for review: <pr_url|PR #NNNN> (<gus_wi_url|W-XXXXX>)
```

Slack MCP unavailable → tell the user: "Slack MCP is not configured — manually ping `<@SLACK_ID>` in `#ide-exp-code-review` with the PR and WI links. To enable this automatically, set up the Slack MCP."
