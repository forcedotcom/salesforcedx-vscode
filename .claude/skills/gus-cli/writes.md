# Create / update mechanics

CLI gotchas for `sf data create record` / `sf data update record` against `ADM_Work__c`. Loaded only when actually writing. Confirm with the user first (see [SKILL.md ## Safety](./SKILL.md#safety)).

## Create fields

Always set `Story_Points__c=2`, `Product_Tag__c=a1aB000000005G3IAI`, `RecordTypeId` (User Story `0129000000006gDAAQ`). Include `Subject__c`, `Assignee__c`, `Scrum_Team__c=a00B0000000w9xPIAQ`. Optional: `Epic__c`, `QA_Engineer__c`, `Details__c`. Leave `Sprint__c` blank; never modify it.

`Details__c` body content: write concisely — fragments/bullets, minimal words (see [concise](../concise/SKILL.md)). Field rules + ≥20-char validation live in [SKILL.md ## Work items](./SKILL.md#work-items-adm_work__c).

## The space-split trap (why create is two steps)

Two CLI bugs force a create-then-update split:

- **`-v` + `--flags-dir` don't combine on create** — `-v` wins; flags-dir values are dropped.
- **Values strings space-split, even in single quotes** — both `-v` and the `--flags-dir` `values` file split on spaces inside quotes (this CLI version), truncating any multi-word `Subject__c`/`Details__c` at the first space. Often surfaces as the misleading <20-char error.

Working recipe:

1. **Create** with no-space placeholder tokens via `-v` (underscores, no quotes):
   `-v "Subject__c=temp Details__c=Consolidate_..._20+_chars RecordTypeId=... Assignee__c=... Scrum_Team__c=... Story_Points__c=2 Product_Tag__c=... Epic__c=..."`
2. **Find Id:** `sf data query --query "SELECT Id,Name FROM ADM_Work__c WHERE Subject__c='temp' ORDER BY CreatedDate DESC LIMIT 1" -o gus --json`
3. **Update** real `Subject__c` + HTML `Details__c` via `--flags-dir` (next section). The update path tolerates spaces in the single-line value.

## Details\_\_c HTML formatting

`Details__c` is a Rich Text Area (`extraTypeInfo: richtextarea`) — use HTML, not markdown. Set via `--flags-dir` with a `values` file ([ref](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_flag_values_in_files.htm)):

1. `mkdir -p /tmp/gus-flags`
2. Create `values` with one line:
   `Subject__c='...' Details__c='<p><strong>Section</strong></p><p>Content. <code>inline code</code></p><ul><li>item</li></ul><p><strong>Ref:</strong> <a href=&quot;https://...&quot;>url</a></p>'`
3. `sf data update record -s ADM_Work__c -i <id> -o gus --flags-dir /tmp/gus-flags`

Constraints: file single-line (flags-dir treats each line as a separate flag invocation); values in single quotes; HTML tags `<p>`, `<strong>`, `<code>`, `<ul><li>`, `<a href="...">`; escape `"` inside the value as `&quot;`.

**SF strips external hrefs on save:** `<a href=&quot;https://github.com/...discussions/5867&quot;>discussions/5867</a>` persists as `<a href="">discussions/5867</a>` — link text survives, href empties. Write the full `href` regardless; the surviving `discussions/NNN`|`issues/NNN` path text lets auto-build reconstruct the PR URL. Prefer link text that IS the path (`discussions/5867`), not a label.

## After create

1. Provide the WI link: `https://gus.lightning.force.com/lightning/r/ADM_Work__c/<recordId>/view` (recordId = Id from create output, e.g. `a07EE00002V3a8YYAR`).
2. **Query the `Name` (W-XXXXX)** — the `Id` returned by create is NOT the `W-XXXXX`. Required to append to PR titles as ` - W-XXXXX`:
   `sf data query --query "SELECT Name FROM ADM_Work__c WHERE Id = '<id_from_create>'" -o gus --json`

## Update

```
sf data update record -s ADM_Work__c -i <recordId> -o gus -v "Status__c='In Progress' Subject__c='...' Details__c='...'"
```

- If a User Story has null `Story_Points__c`, set `Story_Points__c=2`. Never modify `Sprint__c`. `Details__c` can store PR links/notes.
- **Verify the target Id before AND after.** `sf data update record -i <id>` echoes only `success`, never the record's `Name`/`Subject__c` — a wrong Id silently overwrites the wrong WI (worse with `--flags-dir`, whose value file carries no Id). Before: query `SELECT Name, Subject__c FROM ADM_Work__c WHERE Id='<id>'` to confirm intent. After: re-query to confirm the write. Match the W-NNNNN, not just "an update succeeded."
