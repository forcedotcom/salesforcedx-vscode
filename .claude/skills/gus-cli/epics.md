# Epics (ADM_Epic\_\_c): create & bulk-populate

Companion to [SKILL.md](./SKILL.md). Safety rules apply: **don't write until user confirms.**

**Body field differs by object:** epic = `Description__c`; work item = `Details__c` (SKILL.md). Never both on one record.

## Fields

| Field | Type | Notes |
| --- | --- | --- |
| `Name` | text | Epic title. Plain text, NOT autonumber. |
| `Team__c` | lookup | `a00B0000000w9xPIAQ`. |
| `Health__c` | picklist | On Track, Watch, Blocked, Not Started, On Hold, Completed, Canceled. New → `Not Started`. |
| `Scheduled_Build__c` | lookup → `ADM_Build__c` | **Always set** — epics without it miss build-scoped views. |
| `Description__c` | HTML | Optional. HTML rules: SKILL.md "Details\_\_c formatting". |

## Scheduled_Build\_\_c

Set by **Id** (e.g. build `264` = `a06EE000004rIFtYAM`). Find current build — what active team epics share:

```bash
sf data query --query "SELECT Scheduled_Build__c, Scheduled_Build__r.Name FROM ADM_Epic__c WHERE Team__c = 'a00B0000000w9xPIAQ' AND Health__c NOT IN ('Completed','Canceled') AND Scheduled_Build__c != null ORDER BY LastModifiedDate DESC LIMIT 10" -o gus --result-format json
```

Most-shared Id = current. Set on create, or later: `sf data update record -s ADM_Epic__c -i <epicId> -o gus -v "Scheduled_Build__c=<buildId>"`

## Create

```bash
sf data create record -s ADM_Epic__c -o gus \
  -v "Name='My Epic' Team__c='a00B0000000w9xPIAQ' Health__c='Not Started' Scheduled_Build__c=a06EE000004rIFtYAM"
```

HTML `Description__c` can't go in `-v` (quotes/spaces break the parser). Create plain, then add via `--flags-dir`.

Link: `https://gus.lightning.force.com/lightning/r/ADM_Epic__c/<epicId>/view`

## Gotchas

- **CLI update warning corrupts JSON.** `sf` writes `Warning: @salesforce/cli update available…` to stderr; `2>&1` into a parser throws `Expecting value: line 1 column 1` though **the write succeeded**. Parse stdout only (`2>/dev/null`). Re-running makes duplicates.
- **Verify before retry.** Query by Name first: `... WHERE Name LIKE 'My Epic%' ORDER BY CreatedDate`.
- **No epic delete rights** (`INSUFFICIENT_ACCESS_OR_READONLY`). Neutralize a dupe: `Health__c='Canceled'` + rename `DUPLICATE - do not use - …`.

## Bulk-create work items

Numbering + deps: [work-item-sequencing](../work-item-sequencing/SKILL.md). Fields: SKILL.md "Create". `[ai-auto]`: SKILL.md tag section (explicit request only).

**`Details__c` must be ≥ 20 chars** — else GUS rejects (`Description must be at least 20 characters…`); in a loop the failure looks like a hang. Pass plain-text `Details__c` at create (HTML breaks `-v`); enrich via `--flags-dir` after.

```bash
EPIC=<epicId>; TEAM=a00B0000000w9xPIAQ
PROD=a1aB000000005G3IAI; RT=0129000000006gDAAQ; ASSIGN=005B0000000GIODIA4
create() { # $1=Subject  $2=Details (>=20 chars)
  sf data create record -s ADM_Work__c -o gus \
    -v "Subject__c='$1' Details__c='$2' Story_Points__c=2 Product_Tag__c=$PROD RecordTypeId=$RT Epic__c=$EPIC Scrum_Team__c=$TEAM Assignee__c=$ASSIGN" \
    --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'] if d.get('status')==0 else 'ERR')"
}
create "1.0 [ai-auto] First task" "Description, at least twenty chars."
create "1.1 [ai-auto] Second task" "Another, also twenty-plus chars."
```

Confirm count + W-numbers after: `SELECT Name, Subject__c FROM ADM_Work__c WHERE Epic__c='<epicId>'`.
