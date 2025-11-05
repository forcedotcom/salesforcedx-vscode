# Final Metadata Scraper - Complete Solution

## Overview

This script automatically discovers ALL metadata types from the Salesforce documentation sidebar and scrapes each one to produce output **identical** to `metadata_types_map.json`.

## How It Works

1. **Discovery Phase**: Navigates to the main Metadata Types page and extracts all metadata type links from the sidebar/navigation
2. **Scraping Phase**: Visits each discovered link and extracts:
   - Field names, types, and descriptions
   - Short description from meta tags or first paragraph
   - Source URL
3. **Output Phase**: Generates JSON in the exact format of `metadata_types_map.json`

## Usage

### Run the complete scraper (headless/background)

```bash
npm run scrape:all-metadata
```

This will:

- Discover all metadata types automatically
- Scrape each one in the background (no browser window)
- Save to `packages/salesforcedx-vscode-core/metadata_types_map_scraped.json`

### Custom output location

```bash
npm run scrape:all-metadata -- --output ./my-custom-output.json
```

### Get help

```bash
npm run scrape:all-metadata -- --help
```

## Output Format

The output is **identical** to `metadata_types_map.json`:

```json
{
  "ApexClass": {
    "fields": [
      {
        "Description": "The API version for this class...",
        "Field Name": "apiVersion",
        "Field Type": "double"
      }
    ],
    "short_description": "Represents an Apex class...",
    "url": "https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm"
  },
  "ApexComponent": {
    ...
  }
}
```

## Fallback Strategy

If automatic discovery fails (e.g., page structure changes), the scraper automatically falls back to a comprehensive list of 70+ known metadata types, including:

- AIApplication
- ApexClass, ApexComponent, ApexPage, ApexTrigger
- AuraDefinitionBundle
- CustomApplication, CustomField, CustomLabel, CustomMetadata, CustomObject
- Dashboard
- EmailTemplate
- Flow, FlowDefinition
- Layout, ListView
- LightningComponentBundle
- PermissionSet, PermissionSetGroup
- Profile
- QuickAction
- Report, ReportType
- ValidationRule
- Workflow
- And 50+ more!

## Progress Tracking

The scraper provides real-time progress:

```
🚀 Starting comprehensive metadata scraper...

Discovering metadata types from sidebar...
Found 85 metadata type links

📋 Will scrape 85 metadata types

[1/85] AIApplication
  Scraping: AIApplication
  ✓ Found 4 fields
[2/85] ApexClass
  Scraping: ApexClass
  ✓ Found 5 fields
...

=== Summary ===
Total discovered: 85
Successfully scraped: 78
Failed or skipped: 7

💾 Writing results to: packages/salesforcedx-vscode-core/metadata_types_map_scraped.json
✅ Done!
```

## Merging Results

After scraping, you can merge with your existing file:

```bash
# Backup your current file
cp packages/salesforcedx-vscode-core/metadata_types_map.json packages/salesforcedx-vscode-core/metadata_types_map.backup.json

# Review the scraped data
cat packages/salesforcedx-vscode-core/metadata_types_map_scraped.json

# If satisfied, use it
mv packages/salesforcedx-vscode-core/metadata_types_map_scraped.json packages/salesforcedx-vscode-core/metadata_types_map.json
```

Or use Node.js to merge selectively:

```javascript
const fs = require('fs');
const existing = JSON.parse(fs.readFileSync('metadata_types_map.json'));
const scraped = JSON.parse(fs.readFileSync('metadata_types_map_scraped.json'));

// Merge, preferring scraped data for types that exist in both
const merged = { ...existing, ...scraped };

fs.writeFileSync('metadata_types_map.json', JSON.stringify(merged, null, 2));
```

## Features

✅ **Automatic Discovery** - Finds all metadata types from the sidebar
✅ **Identical Format** - Produces exact same structure as metadata_types_map.json
✅ **Headless Mode** - Runs in background, no browser window
✅ **Progress Tracking** - Real-time feedback on what's being scraped
✅ **Fallback List** - Uses known types if discovery fails
✅ **Respectful** - Adds delays between requests
✅ **Error Handling** - Continues even if some types fail
✅ **Summary Report** - Shows success/failure counts

## Troubleshooting

### "No metadata types discovered"

The scraper automatically falls back to a predefined list of 70+ known metadata types.

### "Content not loaded"

Some pages may load slowly. The scraper waits up to 15 seconds per page. If issues persist, try running again or increasing the timeout in the script.

### "No fields found"

Some metadata types may not have field tables in the documentation. These are skipped but logged in the summary.

## Comparison with Other Approaches

| Approach              | Pros                                               | Cons                                              |
| --------------------- | -------------------------------------------------- | ------------------------------------------------- |
| **This Scraper**      | ✅ Automatic<br>✅ Complete<br>✅ Identical format | ⚠️ Depends on page structure                      |
| Manual Config         | ✅ Reliable                                        | ❌ Requires manual URL list                       |
| XSD Parser            | ✅ Authoritative                                   | ❌ Different format<br>❌ Requires transformation |
| Metadata Registry API | ✅ Programmatic                                    | ❌ Limited documentation details                  |

## Next Steps

1. Run the scraper: `npm run scrape:all-metadata`
2. Review the output in `metadata_types_map_scraped.json`
3. Compare with your existing `metadata_types_map.json`
4. Merge or replace as needed

Enjoy your automatically generated, identical-format metadata map! 🎉
