# Salesforce Metadata API Documentation Scraper

This tool uses Playwright to scrape the Salesforce Metadata API Developer Guide and generate the `metadata_types_map.json` file used by the VSCode extension.

## Overview

The scraper extracts information from Salesforce documentation pages including:

- Field names, types, and descriptions
- Short descriptions of metadata types
- Source URLs for reference

## Prerequisites

1. Install dependencies (from the workspace root):

   ```bash
   npm install
   ```

2. Install Playwright browsers (first time only):
   ```bash
   npx playwright install chromium
   ```

## Usage

### Single URL Mode

Scrape a single metadata type from a specific URL:

```bash
npm run scrape:metadata -- --url <documentation-url>
```

**Example:**

```bash
npm run scrape:metadata -- --url https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm
```

### Batch Mode

Scrape multiple metadata types using a configuration file:

```bash
npm run scrape:metadata -- --batch <config-file>
```

**Example:**

```bash
npm run scrape:metadata -- --batch ./scripts/metadata-scraper-config.json
```

### Custom Output Location

You can specify a custom output file location:

```bash
npm run scrape:metadata -- --url <url> --output <output-file>
npm run scrape:metadata -- --batch <config-file> --output <output-file>
```

**Example:**

```bash
npm run scrape:metadata -- --batch ./scripts/metadata-scraper-config.json --output ./custom-output.json
```

### Get Help

```bash
npm run scrape:metadata -- --help
```

## Configuration File Format

The batch mode requires a JSON configuration file with the following structure:

```json
{
  "metadataTypes": [
    {
      "name": "ApexClass",
      "url": "https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm"
    },
    {
      "name": "ApexComponent",
      "url": "https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_apexcomponent.htm"
    }
  ]
}
```

A sample configuration file is provided at `scripts/metadata-scraper-config.json`.

## Output Format

The scraper generates JSON output in the following format:

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
  }
}
```

## Output Location

By default, scraped data is written to:

```
packages/salesforcedx-vscode-core/metadata_types_map_scraped.json
```

You can merge this with the existing `metadata_types_map.json` file manually, or specify a different output location using the `--output` flag.

## Finding Documentation URLs

To find documentation URLs for metadata types:

1. Visit the [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_intro.htm)
2. Navigate to the "Metadata Types" section
3. Find the specific metadata type you want to scrape
4. Copy the URL from your browser's address bar

Common URL patterns:

- `meta_classes.htm` - ApexClass
- `meta_apexcomponent.htm` - ApexComponent
- `meta_apexpage.htm` - ApexPage
- `customobject.htm` - CustomObject
- And so on...

## Troubleshooting

### Playwright Browser Not Found

If you get an error about missing browsers:

```bash
npx playwright install chromium
```

### No Fields Found

If the scraper reports "No fields found":

1. Check if the documentation page structure has changed
2. Verify the URL is correct and accessible
3. The page might not have a fields table (some metadata types don't have explicit field tables)

### TypeScript Compilation Errors

If you get TypeScript errors when running the script:

```bash
npm run compile
```

## Technical Details

### How It Works

1. **Navigation**: The scraper uses Playwright to navigate to the documentation page
2. **Content Extraction**:
   - Finds the main content area
   - Extracts the first substantial paragraph as the short description
   - Locates tables with headers matching "Field Name", "Type", and "Description"
3. **Data Processing**: Extracts field information from table rows
4. **Output Generation**: Writes the data to a JSON file

### Page Structure Requirements

The scraper expects documentation pages to have:

- A main content area with paragraphs
- A table with columns for:
  - Field Name (or "Field" or "Name")
  - Type (or "Data Type" or "Field Type")
  - Description (or "Details")

### Customization

To modify the scraper behavior:

1. Edit `scripts/scrape-metadata-docs.ts`
2. Adjust the selectors in the `page.evaluate()` calls
3. Modify the field extraction logic as needed

## Examples

### Scrape ApexClass Only

```bash
npm run scrape:metadata -- --url https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm
```

### Scrape All Common Metadata Types

```bash
npm run scrape:metadata -- --batch ./scripts/metadata-scraper-config.json
```

### Scrape and Save to Custom Location

```bash
npm run scrape:metadata -- --batch ./scripts/metadata-scraper-config.json --output ./my-metadata.json
```

## Maintenance

When Salesforce updates their documentation:

1. Update the URLs in `metadata-scraper-config.json` if they change
2. If the page structure changes significantly, you may need to update the scraper logic
3. Run the scraper periodically to keep the metadata map up to date

## Contributing

When adding new metadata types to scrape:

1. Add the entry to `metadata-scraper-config.json`
2. Run the batch scraper
3. Verify the output is correct
4. Merge the results into the main `metadata_types_map.json` file
