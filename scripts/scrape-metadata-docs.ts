/**
 * Playwright-based web scraper for Salesforce Metadata API Developer Guide
 *
 * This script navigates to Salesforce documentation pages and extracts metadata type
 * information including fields, descriptions, and types to generate metadata_types_map.json
 *
 * Usage:
 *   npm run scrape:metadata -- --url <url> [--output <file>]
 *   npm run scrape:metadata -- --batch <config-file>
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface MetadataField {
  Description: string;
  'Field Name': string;
  'Field Type': string;
}

interface MetadataType {
  fields: MetadataField[];
  short_description: string;
  url: string;
}

interface MetadataMap {
  [key: string]: MetadataType;
}

interface ScraperConfig {
  metadataTypes: Array<{
    name: string;
    url: string;
  }>;
}

/**
 * Extracts metadata type information from a documentation page
 */
async function scrapeMetadataPage(page: Page, url: string): Promise<MetadataType | null> {
  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Handle cookie consent if present
    try {
      const acceptButton = page.locator(
        'button:has-text("Accept"), button:has-text("Accept All"), button:has-text("Agree")'
      );
      await acceptButton.click({ timeout: 3000 });
      console.log('Accepted cookies');
      await page.waitForTimeout(1000);
    } catch {
      // No cookie banner or already accepted
    }

    // Wait for the main content and tables to load (content is loaded dynamically)
    try {
      // Wait for tables to appear - this indicates the content has loaded
      await page.waitForSelector('table', { timeout: 15000 });
      console.log('Content loaded successfully');
    } catch {
      console.warn('Table content not found, page may not have loaded properly');
    }

    // Give extra time for all dynamic content to render
    await page.waitForTimeout(3000);

    // Extract the short description (usually the first paragraph after the h1 title)
    const shortDescription = await page.evaluate(() => {
      // Try to find the first meaningful paragraph after the main heading
      const mainContent =
        document.querySelector('main') ||
        document.querySelector('.content') ||
        document.querySelector('article') ||
        document.body;

      // Look for the first p tag that has substantial content
      const paragraphs = Array.from(mainContent.querySelectorAll('p'));
      for (const p of paragraphs) {
        const text = p.textContent?.trim() || '';
        // Skip short paragraphs, navigation, and cookie/consent text
        if (
          text.length > 50 &&
          !text.toLowerCase().includes('in this section') &&
          !text.toLowerCase().includes('cookie') &&
          !text.toLowerCase().includes('required, functional, and advertising')
        ) {
          return text;
        }
      }

      return '';
    });

    // Extract fields from the table
    const fields = await page.evaluate(() => {
      const fieldsData: Array<{
        Description: string;
        'Field Name': string;
        'Field Type': string;
      }> = [];

      // Find the fields table - it usually has headers like "Field", "Type", "Description"
      // or "Field Name", "Field Type", "Description"
      const mainContent =
        document.querySelector('main') ||
        document.querySelector('.content') ||
        document.querySelector('article') ||
        document.body;
      const tables = Array.from(mainContent.querySelectorAll('table'));

      for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('th')).map(
          (th: HTMLTableCellElement) => th.textContent?.trim().toLowerCase() || ''
        );

        // Check if this looks like a fields table
        const hasFieldColumn = headers.some(h => h.includes('field') || h === 'name');
        const hasTypeColumn = headers.some(h => h.includes('type') || h === 'data type');
        const hasDescColumn = headers.some(h => h.includes('description') || h.includes('detail'));

        if (hasFieldColumn && hasTypeColumn && hasDescColumn) {
          // Found the fields table
          const rows = Array.from(table.querySelectorAll('tbody tr'));

          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 3) {
              // Typically: Field Name, Type, Description
              // But order might vary, so we need to map by header index

              const fieldNameIdx = headers.findIndex(
                h => (h.includes('field') && h.includes('name')) || h === 'field' || h === 'name'
              );
              const typeIdx = headers.findIndex(h => h.includes('type') || h === 'data type');
              const descIdx = headers.findIndex(h => h.includes('description') || h.includes('detail'));

              const fieldName = cells[fieldNameIdx >= 0 ? fieldNameIdx : 0]?.textContent?.trim() || '';
              const fieldType = cells[typeIdx >= 0 ? typeIdx : 1]?.textContent?.trim() || '';
              const description = cells[descIdx >= 0 ? descIdx : 2]?.textContent?.trim() || '';

              if (fieldName && fieldType && description) {
                fieldsData.push({
                  Description: description,
                  'Field Name': fieldName,
                  'Field Type': fieldType
                });
              }
            }
          }

          // If we found fields, break (use the first matching table)
          if (fieldsData.length > 0) {
            break;
          }
        }
      }

      return fieldsData;
    });

    if (fields.length === 0) {
      console.warn(`No fields found for URL: ${url}`);
    }

    return {
      fields,
      short_description: shortDescription,
      url
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

/**
 * Scrapes a single metadata type URL
 */
async function scrapeSingleUrl(url: string, outputFile?: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const result = await scrapeMetadataPage(page, url);

    if (result) {
      // Extract metadata type name from URL
      // e.g., meta_classes.htm -> ApexClass (would need manual mapping)
      // For now, we'll use a generic name
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      const typeName = filename.replace('.htm', '').replace('meta_', '');

      const output = {
        [typeName]: result
      };

      const outputPath =
        outputFile || path.join(__dirname, '../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

      console.log(`\nScraped data:`);
      console.log(`- Short description: ${result.short_description.substring(0, 100)}...`);
      console.log(`- Number of fields: ${result.fields.length}`);
      console.log(`\nWriting to: ${outputPath}`);

      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log('Done!');
    }
  } finally {
    await browser.close();
  }
}

/**
 * Scrapes multiple metadata types from a config file
 */
async function scrapeBatch(configFile: string, outputFile?: string): Promise<void> {
  const configPath = path.resolve(configFile);

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const config: ScraperConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results: MetadataMap = {};
  let successCount = 0;
  let failCount = 0;

  try {
    for (const metadataType of config.metadataTypes) {
      console.log(
        `\n[${successCount + failCount + 1}/${config.metadataTypes.length}] Processing: ${metadataType.name}`
      );

      const result = await scrapeMetadataPage(page, metadataType.url);

      if (result) {
        results[metadataType.name] = result;
        successCount++;
        console.log(`✓ Successfully scraped ${metadataType.name} (${result.fields.length} fields)`);
      } else {
        failCount++;
        console.log(`✗ Failed to scrape ${metadataType.name}`);
      }

      // Add a small delay to be respectful to the server
      await page.waitForTimeout(1000);
    }

    const outputPath =
      outputFile || path.join(__dirname, '../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

    console.log(`\n=== Summary ===`);
    console.log(`Total: ${config.metadataTypes.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`\nWriting results to: ${outputPath}`);

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log('Done!');
  } finally {
    await browser.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Salesforce Metadata API Documentation Scraper

Usage:
  Single URL mode:
    npm run scrape:metadata -- --url <url> [--output <file>]

  Batch mode:
    npm run scrape:metadata -- --batch <config-file> [--output <file>]

Examples:
  npm run scrape:metadata -- --url https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm
  npm run scrape:metadata -- --batch ./scripts/metadata-scraper-config.json
  npm run scrape:metadata -- --batch ./scripts/metadata-scraper-config.json --output ./output.json
    `);
    return;
  }

  const urlIndex = args.indexOf('--url');
  const batchIndex = args.indexOf('--batch');
  const outputIndex = args.indexOf('--output');

  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  if (urlIndex >= 0 && urlIndex + 1 < args.length) {
    const url = args[urlIndex + 1];
    await scrapeSingleUrl(url, outputFile);
  } else if (batchIndex >= 0 && batchIndex + 1 < args.length) {
    const configFile = args[batchIndex + 1];
    await scrapeBatch(configFile, outputFile);
  } else {
    console.error('Error: Missing required arguments. Use --help for usage information.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
