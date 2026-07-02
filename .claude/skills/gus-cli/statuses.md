# Status\_\_c values

Full picklist + the open-vs-terminal split. Consulted on demand; the create/update set + duplicate handling stay inline because every write touches them.

## For create / update

Only use: `New, In Progress, Ready for Review, QA In Progress, Fixed, Waiting, Closed`. Completing a WI → `Closed`.

**Duplicate:** set `Status__c='Duplicate'` + link the original via `Related_Work__c` (label "Duplicate Of"). `Closed - Duplicate` does NOT persist — a trigger reverts it to `Duplicate` — so use `Duplicate` directly. `Duplicate` is terminal.

## Flow

New → Acknowledged → Triaged → In Progress → Ready for Review → Fixed → QA In Progress → Completed/Closed

## Open queries: WHITELIST, never blacklist

For "open / unfinished" queries use `Status__c IN (<open list>)`, **not** `NOT IN (<terminal list>)`. Legacy/inactive records carry statuses absent from the current picklist (seen: `Closed-U/Ftest`, `Closed-Untested`, `Tested`) — a `NOT IN` exclusion silently lets these terminal records through. A whitelist can't.

**Open (work pending):** `New | Acknowledged | Triaged | In Progress | Investigating | More Info Reqd from Support | Waiting On Customer | Waiting On 3rd Party | Waiting | Ready for Review | Fixed | QA In Progress | Integrate | Pending Release | Deferred`

(`Fixed`/`Ready for Review`/`QA In Progress` are open — PR not merged yet, per [work-item-sequencing](../work-item-sequencing/SKILL.md). Everything else — any `Closed*`, `Completed`, `Tested`, the Bug-no-fix set, and any unrecognized value — is terminal.)

## Terminal value lists

**Blocked (still open):** Investigating | More Info Reqd from Support | Waiting On Customer | Waiting On 3rd Party | Waiting | Deferred | Integrate | Pending Release

**Closed (terminal):** Closed | Completed | Closed - Defunct | Closed - Duplicate | Closed - Eng Internal | Closed - Known Bug Exists | Closed - New Bug Logged | Closed - Resolved With Internal Tools | Closed - Resolved Without Code Change | Closed - Doc/Usability | Closed - Resolved with DB Script | Closed - No Fix - Working as Documented | Closed - No Fix - Working as Designed | Closed - No Fix - Feature Request | Closed - No Fix - Will Not Fix | Closed - Transitioned to Incident | Closed - Resolved by 3rd Party

**Bug no-fix (terminal despite no "Closed" prefix):** Duplicate | Inactive | Never | Not a bug | Not Reproducible | Rejected | Eng Internal
