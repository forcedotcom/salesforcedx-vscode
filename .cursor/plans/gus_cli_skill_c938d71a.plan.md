---
name: Gus CLI Skill
overview: 'Create a Claude skill in .claude/skills/ for interacting with the Gus Salesforce org via CLI: validate org, get user ID, query/create/update work items, and query team epics.'
todos: []
isProject: false
---

# Gus CLI Skill

## Discovered Schema (from CLI queries)

| Item             | Value                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org alias        | `gus` (lowercase)                                                                                                                                                                                                |
| Objects          | `ADM_Work__c` (work items), `ADM_Epic__c` (epics) - **no namespace**. Do not use ADM_Theme\_\_c (themes are different).                                                                                          |
| Work item fields | `Assignee__c`, `QA_Engineer__c`, `Scrum_Team__c`, `Epic__c`, `Product_Tag__c`, `Subject__c`, `Status__c`, `Details__c`, `Story_Points__c`, `RecordTypeId`, `RecordType.Name`, `Priority__c`, `Sprint__c`, `Name` |
| Status\_\_c      | See section below (API has no value descriptions)                                                                                                                                                                |
| Epic fields      | `Team__c`, `Name`, `Description__c`, `Health__c` (filter out closed: Completed, Canceled)                                                                                                                        |
| Team ID          | `a00B0000000w9xPIAQ`                                                                                                                                                                                             |
| Product Tag      | `a1aB000000005G3IAI` (always set on work items)                                                                                                                                                                  |
| User ID          | From gus alias `value`                                                                                                                                                                                           |
| RecordTypes      | User Story: `0129000000006gDAAQ`; Bug: `012T00000004MUHIA2`; ToDo: `0129000000006ByAAI`; Investigation: `0129000000006lWAAQ`; Template - User Story: `012EE00000018unYAA`; Template - Bug: `012T00000004NOTIA2`  |
| Team member IDs  | For Assignee**c, QA_Engineer**c – see section below (from WI roles, last 24mo)                                                                                                                                   |

## Skill Location and Structure

Create [.claude/skills/gus-cli/SKILL.md](.claude/skills/gus-cli/SKILL.md) - single file, ~150-250 lines.

## Skill Content

### 1. Prerequisites (gate)

- Run `sf alias list --json`; ensure `result` contains an alias matching `gus` (case-insensitive)
- If missing: instruct user to run `sf org login web -a gus` or similar
- All commands use `-o gus`

### 2. Get User ID

- From step 1: the gus alias entry’s `value` is the username
- `sf data query --query "SELECT Id FROM User WHERE Username = '<username>' LIMIT 1" -o gus --result-format json`
- Parse `result.records[0].Id`

### 3. Constants

- Team ID: `a00B0000000w9xPIAQ`
- Objects: `ADM_Work__c`, `ADM_Epic__c` (not ADM_Theme\_\_c)

### 3b. Team member User IDs (for Assignee**c, QA_Engineer**c)

- Cristina Cañizales: `005EE000008cgrGYAQ` ([cristina.canizales@gus.com](mailto:cristina.canizales@gus.com))
- Daphne Yang: `005EE000005d0jdYAA` ([daphne.yang@gus.com](mailto:daphne.yang@gus.com))
- Jonny Hork: `005B0000004pYWjIAM` ([jhork@gus.com](mailto:jhork@gus.com))
- Kyle Walker: `005EE0000010oCLYAY` ([kyle.walker@gus.com](mailto:kyle.walker@gus.com))
- Madhur Shrivastava: `005EE00000VZK5FYAX` ([madhur.shrivastava@gus.com](mailto:madhur.shrivastava@gus.com))
- Peter Hale: `005B0000000GFvWIAW` ([peter.hale@gus.com](mailto:peter.hale@gus.com))
- Shane McLaughlin: `005B00000024wGBIAY` ([shane.mclaughlin@gus.com](mailto:shane.mclaughlin@gus.com))
- Sonal Budhiraja: `005B0000005ccPnIAI` ([sbudhiraja@gus.com](mailto:sbudhiraja@gus.com))

### 3c. Status**c picklist values (ADM_Work**c)

**Active/flow**: New → Acknowledged → Triaged → In Progress → Ready for Review → Fixed → QA In Progress → Completed/Closed
**Blocked/waiting**: Investigating | More Info Reqd from Support | Waiting On Customer | Waiting On 3rd Party | Waiting | Deferred | Integrate | Pending Release
**Closed (terminal)**: Closed | Completed | Closed - Defunct | Closed - Duplicate | Closed - Eng Internal | Closed - Known Bug Exists | Closed - New Bug Logged | Closed - Resolved With Internal Tools | Closed - Resolved Without Code Change | Closed - Doc/Usability | Closed - Resolved with DB Script | Closed - No Fix - Working as Documented | Closed - No Fix - Working as Designed | Closed - No Fix - Feature Request | Closed - No Fix - Will Not Fix | Closed - Transitioned to Incident | Closed - Resolved by 3rd Party
**Bug-specific (no fix)**: Duplicate | Inactive | Never | Not a bug | Not Reproducible | Rejected | Eng Internal

_(API returns no descriptions; usage inferred from value names. git2gus uses `statusWhenClosed: CLOSED`.)_

### 4. Work Items

- **Query mine**: include `Story_Points__c`, `RecordType.Name` when relevant
- **Create**: always set `Story_Points__c=2`, `Product_Tag__c=a1aB000000005G3IAI`, `RecordTypeId` (e.g. `0129000000006gDAAQ` for User Story). Include `Subject__c`, `Assignee__c`, `Scrum_Team__c`, `Epic__c` (optional), `QA_Engineer__c` (optional), `Details__c` (optional). Leave `Sprint__c` blank; never modify it
- **Update**: when updating a User Story (`RecordType.Name = 'User Story'`) that has null `Story_Points__c`, set `Story_Points__c=2`. Never modify `Sprint__c`
- **Reference**: W-20890801 – User Story with Subject, Details (HTML), Epic, Assignee, Scrum_Team, Story_Points=2

### 5. Epics (ADM_Epic\_\_c)

- **Query team's epics** (exclude closed): `sf data query --query "SELECT Id, Name, Description__c FROM ADM_Epic__c WHERE Team__c = 'a00B0000000w9xPIAQ' AND Health__c NOT IN ('Completed', 'Canceled')" -o gus --result-format json`
- Closed epics = `Health__c` in ('Completed', 'Canceled'); filter them out
- Include `Description__c`; when populated it helps match work items to the right epic

### 6. CLI Patterns

- Use `--result-format json` for machine-readable output
- Strip CLI version warning from stdout before JSON parse: `tail -1` or parse last JSON object
- `sf data create record` / `sf data update record` for single-record writes

## File to Create

- [.claude/skills/gus-cli/SKILL.md](.claude/skills/gus-cli/SKILL.md)

## Reference

- [create-skill SKILL.md](.claude/skills/../create-skill) - structure, YAML frontmatter, description best practices
- [concise SKILL.md](.claude/skills/concise/SKILL.md) - fragments, minimal words
