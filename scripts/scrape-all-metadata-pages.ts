/**
 * Salesforce Metadata API scraper
 * Produces JSON output with all metadata types from the Salesforce Metadata API documentation
 *
 * Usage:
 *   npm run scrape:all:pages
 *   npm run scrape:all:pages -- --output custom-output.json
 *   npm run scrape:all:pages -- --visible  (runs with visible browser for debugging)
 *
 * Environment Variables:
 *   BATCH_SIZE=20           - Number of metadata types to scrape in parallel (default: 20)
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loadMetadataPage, extractMetadataFromPage, MetadataType } from './scrapeUtils';

type MetadataMap = {
  [key: string]: MetadataType;
};

/**
 * Scrape a single metadata type (may return multiple if page has multiple tables)
 */
const scrapeMetadataType = async (
  page: Page,
  name: string,
  url: string,
  isVisible: boolean
): Promise<Array<{ name: string; data: MetadataType }>> => {
  console.log(`  📄 ${name}`);
  console.log(`     Loading: ${url}`);

  const { success, contentFrame } = await loadMetadataPage(page, url);

  if (!success || !contentFrame) {
    console.log(`     ❌ Content failed to load`);
    return [];
  }

  console.log(`     ✓ Content loaded`);

  const results = await extractMetadataFromPage(contentFrame, url, name);

  if (results.length === 0) {
    console.log(`     ⚠️  No fields found`);

    // In visible mode, pause to let user inspect
    if (isVisible) {
      console.log(`     Press Ctrl+C when ready to continue...`);
      await page.waitForTimeout(30000);
    }

    return [];
  }

  return results;
};

/** Discovers metadata types from the Salesforce Metadata API JSON documentation endpoint */
const discoverMetadataTypes = async (page: Page): Promise<Array<{ name: string; url: string }>> => {
  const JSON_DOC_URL = 'https://developer.salesforce.com/docs/get_document/atlas.en-us.api_meta.meta';
  const BASE_DOC_URL = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/';

  console.log('\n🔍 Discovering metadata types from JSON documentation...');
  console.log(`   Fetching: ${JSON_DOC_URL}`);

  try {
    // Fetch the JSON document directly (no browser needed for this part!)
    const response = await page.context().request.get(JSON_DOC_URL);
    if (!response.ok()) {
      throw new Error(`Failed to fetch JSON document: ${response.status()} ${response.statusText()}`);
    }

    const docData = await response.json();
    console.log(`   ✓ JSON document loaded successfully`);

    // Navigate to: .toc[] -> find "Reference" -> .children[] -> find "Metadata Types" -> .children[]
    const toc = docData.toc ?? [];
    const referenceSection = toc.find((section: any) => section.text === 'Reference');

    if (!referenceSection?.children) {
      throw new Error('Could not find "Reference" section in TOC');
    }

    const metadataTypesSection = referenceSection.children.find((section: any) => section.text === 'Metadata Types');

    if (!metadataTypesSection?.children) {
      throw new Error('Could not find "Metadata Types" section in TOC');
    }

    // Sections to exclude (intro pages, overview pages, etc.)
    const excludedPages = [
      'metadata components and types',
      'metadata coverage report',
      'unsupported metadata types',
      'special behavior in metadata api deployments',
      'meta_objects_intro',
      'meta_coverage_report',
      'meta_unsupported_types',
      'meta_special_behavior',
      '_intro',
      '_overview',
      '_calls'
    ];

    // Recursively extract metadata type entries (including nested subtypes)
    const metadataTypes: Array<{ name: string; url: string }> = [];

    const extractMetadataType = (entry: any, depth: number = 0): void => {
      const name = entry.text;
      const href = entry.a_attr?.href;
      const id = entry.id;

      if (!name || !href) {
        return;
      }

      // Filter out excluded pages
      const nameLower = name.toLowerCase();
      const hrefLower = href.toLowerCase();
      const idLower = id?.toLowerCase() ?? '';

      const isExcluded = excludedPages.some(
        excluded => nameLower.includes(excluded) || hrefLower.includes(excluded) || idLower.includes(excluded)
      );

      // Only include if it looks like a valid metadata type page
      const isValidMetadataType =
        !isExcluded && name.length > 0 && name.length < 200 && href.endsWith('.htm') && !href.includes('#');

      if (isValidMetadataType) {
        // Construct full URL
        const fullUrl = href.startsWith('http') ? href : `${BASE_DOC_URL}${href}`;
        metadataTypes.push({ name, url: fullUrl });
      }

      // Recursively process children (subtypes like CustomField, HistoryRetentionPolicy, etc.)
      if (entry.children && Array.isArray(entry.children)) {
        for (const child of entry.children) {
          extractMetadataType(child, depth + 1);
        }
      }
    };

    // Process all metadata type entries
    for (const entry of metadataTypesSection.children) {
      extractMetadataType(entry);
    }

    console.log(`   ✅ Discovered ${metadataTypes.length} metadata types from JSON!\n`);

    // Print all discovered metadata types
    if (metadataTypes.length > 0) {
      console.log('   📋 All metadata types discovered:');
      metadataTypes.forEach((type, index) => {
        console.log(`      ${String(index + 1).padStart(4)}. ${type.name}`);
      });
      console.log('');
    }

    return metadataTypes.length > 0 ? metadataTypes : [];
  } catch (error) {
    console.error(`   ❌ Discovery failed:`, error);
    console.log(`   📋 Using fallback list...\n`);
    return [];
  }
};

/**
 * Scrapes a single metadata type with its own page instance
 */
const scrapeMetadataTypeWithContext = async (
  context: any,
  type: { name: string; url: string },
  index: number,
  total: number,
  isVisible: boolean
): Promise<{ success: boolean; results: Array<{ name: string; data: MetadataType }> }> => {
  const page = await context.newPage();

  // Comprehensive anti-detection
  await page.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Mock chrome object
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {}
    };

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'prompt' } as PermissionStatus)
        : originalQuery(parameters);

    // Override the headless property
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel'
    });
  });

  try {
    console.log(`[${index + 1}/${total}] ${type.name}`);
    const pageResults = await scrapeMetadataType(page, type.name, type.url, isVisible);

    if (pageResults.length > 0) {
      console.log(`     ✓ ${type.name} completed successfully`);
      return { success: true, results: pageResults };
    } else {
      console.log(`     ⚠️  ${type.name} returned no results`);
      return { success: false, results: [] };
    }
  } catch (error: any) {
    console.log(`     ❌ ${type.name} failed: ${error.message}`);
    return { success: false, results: [] };
  } finally {
    await page.close();
  }
};

/**
 * Process metadata types in parallel batches
 */
const scrapeInBatches = async (
  context: any,
  typesToScrape: Array<{ name: string; url: string }>,
  isVisible: boolean,
  batchSize: number = 20
): Promise<{ results: MetadataMap; successCount: number; failCount: number }> => {
  const results: MetadataMap = {};
  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let i = 0; i < typesToScrape.length; i += batchSize) {
    const batch = typesToScrape.slice(i, Math.min(i + batchSize, typesToScrape.length));
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(typesToScrape.length / batchSize);

    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} types)...`);

    // Process batch in parallel
    const batchPromises = batch.map((type, batchIndex) =>
      scrapeMetadataTypeWithContext(context, type, i + batchIndex, typesToScrape.length, isVisible)
    );

    const batchResults = await Promise.all(batchPromises);

    // Collect results
    for (const batchResult of batchResults) {
      if (batchResult.success && batchResult.results.length > 0) {
        for (const { name, data } of batchResult.results) {
          results[name] = data;
        }
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(
      `✓ Batch ${batchNumber} complete (Success: ${batchResults.filter(r => r.success).length}, Failed: ${batchResults.filter(r => !r.success).length})`
    );

    // Be respectful between batches
    if (i + batchSize < typesToScrape.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { results, successCount, failCount };
};

/**
 * Main scraping function
 */
const scrapeAll = async (outputFile?: string, isVisible: boolean = false): Promise<void> => {
  console.log(`🚀 Starting Salesforce Metadata API scraper${isVisible ? ' (VISIBLE MODE)' : ''}...\n`);

  const browser = await chromium.launch({
    headless: !isVisible,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    }
  });

  const page = await context.newPage();

  // Comprehensive anti-detection for discovery page
  await page.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Mock chrome object
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {}
    };

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'prompt' } as PermissionStatus)
        : originalQuery(parameters);

    // Override the headless property
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel'
    });
  });

  // Step 1: Discover all metadata types from documentation
  const metadataTypes = await discoverMetadataTypes(page);
  await page.close(); // Close the discovery page

  const batchSize = parseInt(process.env.BATCH_SIZE ?? '20');
  const typesToScrape = metadataTypes;

  console.log(`📋 Will scrape ${typesToScrape.length} metadata types in parallel batches of ${batchSize}\n`);

  try {
    // Scrape in parallel batches
    const { results, successCount, failCount } = await scrapeInBatches(context, typesToScrape, isVisible, batchSize);

    // Save results
    const outputPath =
      outputFile ?? path.join(__dirname, '../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

    console.log(`\n=== Summary ===`);
    console.log(`Discovered: ${metadataTypes.length} metadata types`);
    console.log(`Attempted: ${typesToScrape.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`\n💾 Writing results to: ${outputPath}`);

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log('✅ Done!');
  } finally {
    await browser.close();
  }
};

/**
 * Main entry point
 */
const main = async () => {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Salesforce Metadata Scraper

Usage:
  npm run scrape:all:pages                          # Headless mode
  npm run scrape:all:pages -- --visible             # Visible browser (for debugging)
  npm run scrape:all:pages -- --output file.json    # Custom output

Options:
  --visible        Run with visible browser (useful for debugging)
  --output <file>  Custom output file path
  --help           Show this help

Environment Variables:
  BATCH_SIZE=20                       # Number of types to scrape in parallel (default: 20)

Examples:
  BATCH_SIZE=50 npm run scrape:all:pages            # Use 50 parallel workers
    `);
    return;
  }

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const isVisible = args.includes('--visible');

  await scrapeAll(outputFile, isVisible);
};

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
