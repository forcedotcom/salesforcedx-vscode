/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect } from 'effect';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, Page } from 'playwright';
import {
  loadMetadataPage,
  extractMetadataFromPage,
  MetadataType,
  MetadataTypesMap,
  BROWSER_LAUNCH_ARGS
} from './scrapeUtils';

const JSON_DOC_URL = 'https://developer.salesforce.com/docs/get_document/atlas.en-us.api_meta.meta';
const BASE_DOC_URL = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/';

/** Calculate elapsed time in minutes and seconds */
const formatElapsedTime = (startTime: number, endTime: number): string => {
  const elapsedSeconds = (endTime - startTime) / 1000;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = Math.floor(elapsedSeconds % 60);
  return `${minutes}m ${seconds}s`;
};

/**
 * Scrape a single metadata type (may return multiple if page has multiple tables)
 */
const scrapeMetadataType = async (
  page: Page,
  name: string,
  url: string,
  isVisible: boolean
): Promise<{ name: string; data: MetadataType }[]> => {
  console.log(`  📄 ${name}`);
  console.log(`     Loading: ${url}`);

  const { success, contentFrame } = await loadMetadataPage(page, url);

  if (!success || !contentFrame) {
    console.log('     ❌ Content failed to load');
    return [];
  }

  console.log('     ✓ Content loaded');

  const results = await extractMetadataFromPage(contentFrame, url, name);

  if (results.length === 0) {
    console.log('     ⚠️  No fields found');

    // In visible mode, pause to let user inspect
    if (isVisible) {
      console.log('     Press Ctrl+C when ready to continue...');
      await page.waitForTimeout(30_000);
    }

    return [];
  }

  return results;
};

/** Discovers metadata types from the Salesforce Metadata API JSON documentation endpoint */
const discoverMetadataTypes = async (page: Page): Promise<{ name: string; url: string }[]> => {
  console.log('\n🔍 Discovering metadata types from JSON documentation...');
  console.log(`   Fetching: ${JSON_DOC_URL}`);

  try {
    // Fetch the JSON document directly (no browser needed for this part!)
    const response = await page.context().request.get(JSON_DOC_URL);
    if (!response.ok()) {
      throw new Error(`Failed to fetch JSON document: ${response.status()} ${response.statusText()}`);
    }

    const docData = await response.json();
    console.log('   ✓ JSON document loaded successfully');

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
    const metadataTypes: { name: string; url: string }[] = [];

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
        excluded => nameLower.includes(excluded) ?? hrefLower.includes(excluded) ?? idLower.includes(excluded)
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
    console.error('   ❌ Discovery failed:', error);
    console.log('   📋 Using fallback list...\n');
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
): Promise<{ success: boolean; results: { name: string; data: MetadataType }[] }> => {
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
 * Process metadata types using Effect queue system with concurrency control
 */
const scrapeInBatches = async (
  context: any,
  typesToScrape: { name: string; url: string }[],
  isVisible: boolean,
  concurrencyLimit: number = 20
): Promise<{
  results: MetadataTypesMap;
  successCount: number;
  failCount: number;
  slowestType: { name: string; duration: number } | null;
  fastestType: { name: string; duration: number } | null;
  averageDuration: number;
}> => {
  const results: MetadataTypesMap = {};
  let successCount = 0;
  let failCount = 0;
  let completed = 0;
  const totalMetadataTypes = typesToScrape.length;
  let slowestType: { name: string; duration: number } | null = null;
  let fastestType: { name: string; duration: number } | null = null;
  let totalDuration = 0;

  console.log(
    `\n🚀 Processing ${totalMetadataTypes} metadata types with concurrency limit of ${concurrencyLimit}...\n`
  );

  /** Wrap scraping logic in an Effect */
  const scrapeTypeEffect = (type: { name: string; url: string }, index: number) =>
    Effect.tryPromise({
      try: async () => {
        const typeStartTime = Date.now();
        const result = await scrapeMetadataTypeWithContext(context, type, index, totalMetadataTypes, isVisible);
        const typeEndTime = Date.now();
        const duration = typeEndTime - typeStartTime;

        // Track slowest type
        if (!slowestType || duration > slowestType.duration) {
          slowestType = { name: type.name, duration };
        }

        // Track fastest type
        if (!fastestType || duration < fastestType.duration) {
          fastestType = { name: type.name, duration };
        }

        // Accumulate total duration
        totalDuration += duration;

        completed++;
        const progress = ((completed / totalMetadataTypes) * 100).toFixed(1);
        console.log(
          `📊 Progress: ${completed}/${totalMetadataTypes} (${progress}%) - ${result.success ? '✅' : '❌'} ${type.name}`
        );

        return { type, result };
      },
      catch: _error => new Error(`Failed to scrape ${type.name}: ${String(_error)}`)
    });

  /** Create all effects with concurrency control */
  const effects = typesToScrape.map((type, index) => scrapeTypeEffect(type, index));

  /** Process all types with concurrency control using Effect.all */
  const program = Effect.all(effects, { concurrency: concurrencyLimit }).pipe(
    Effect.map(allResults => {
      // Collect results
      for (const { result } of allResults) {
        if (result.success && result.results.length > 0) {
          for (const { name, data } of result.results) {
            results[name] = data;
          }
          successCount++;
        } else {
          failCount++;
        }
      }
      const averageDuration = totalMetadataTypes > 0 ? totalDuration / totalMetadataTypes : 0;
      return { results, successCount, failCount, slowestType, fastestType, averageDuration };
    }),
    // Catch any errors and return partial results
    Effect.catchAll(_error => {
      const averageDuration = totalMetadataTypes > 0 ? totalDuration / totalMetadataTypes : 0;
      return Effect.succeed({
        results,
        successCount,
        failCount: failCount + (totalMetadataTypes - successCount - failCount),
        slowestType,
        fastestType,
        averageDuration
      });
    })
  );

  // Run the Effect program
  return Effect.runPromise(program);
};

/** Split an array into N roughly equal chunks */
const chunkArray = <T>(array: T[], numChunks: number): T[][] => {
  if (numChunks <= 0 || array.length === 0) return [array];
  if (numChunks >= array.length) return array.map(item => [item]);

  const chunks: T[][] = [];
  const chunkSize = Math.ceil(array.length / numChunks);

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
};

/** Create a browser context with standard configuration */
const createBrowserContext = async (browser: any) => {
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

  return context;
};

/**
 * Main scraping function with multi-browser support
 */
const scrapeAll = async (outputFile?: string, isVisible: boolean = false): Promise<void> => {
  const startTime = Date.now();
  const numBrowsers = parseInt(process.env.NUM_BROWSERS ?? '5', 10);
  const concurrencyPerBrowser = parseInt(process.env.BATCH_SIZE ?? '20', 10);
  const totalConcurrency = numBrowsers * concurrencyPerBrowser;

  console.log(`🚀 Starting Salesforce Metadata API scraper${isVisible ? ' (VISIBLE MODE)' : ''}...\n`);
  console.log(
    `🌐 Configuration: ${numBrowsers} browsers × ${concurrencyPerBrowser} concurrent tabs = ${totalConcurrency} total workers\n`
  );

  // Step 1: Launch a single browser for discovery
  console.log('🔍 Launching discovery browser...');
  const discoveryBrowser = await chromium.launch({
    headless: !isVisible,
    args: BROWSER_LAUNCH_ARGS
  });

  const discoveryContext = await createBrowserContext(discoveryBrowser);
  const discoveryPage = await discoveryContext.newPage();

  // Comprehensive anti-detection for discovery page
  await discoveryPage.addInitScript(() => {
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
  const metadataTypes = await discoverMetadataTypes(discoveryPage);
  await discoveryPage.close();
  await discoveryBrowser.close();
  console.log('✅ Discovery browser closed\n');

  const typesToScrape = metadataTypes;

  if (typesToScrape.length === 0) {
    console.log('⚠️  No metadata types to scrape. Exiting.');
    return;
  }

  console.log(`📋 Will scrape ${typesToScrape.length} metadata types\n`);

  // Step 2: Launch multiple browsers in parallel for scraping
  console.log(`🚀 Launching ${numBrowsers} scraping browsers in parallel...`);
  const launchStartTime = Date.now();

  const browsers = await Promise.all(
    Array.from({ length: numBrowsers }, async (_, i) => {
      const browser = await chromium.launch({
        headless: !isVisible,
        args: BROWSER_LAUNCH_ARGS
      });
      console.log(`   ✓ Browser ${i + 1}/${numBrowsers} launched`);
      return browser;
    })
  );

  const launchEndTime = Date.now();
  const launchTime = formatElapsedTime(launchStartTime, launchEndTime);
  console.log(`✅ All browsers launched in ${launchTime}\n`);

  // Step 3: Create contexts for each browser
  console.log('🔧 Creating browser contexts...');
  const contexts = await Promise.all(
    browsers.map(async (browser, i) => {
      const context = await createBrowserContext(browser);
      console.log(`   ✓ Context ${i + 1}/${numBrowsers} created`);
      return context;
    })
  );
  console.log('✅ All contexts created\n');

  try {
    // Step 4: Split work across browsers
    const workChunks = chunkArray(typesToScrape, numBrowsers);

    console.log('📦 Work distribution:');
    workChunks.forEach((chunk, i) => {
      console.log(
        `   Browser ${i + 1}: ${chunk.length} types (${((chunk.length / typesToScrape.length) * 100).toFixed(1)}%)`
      );
    });
    console.log('');

    // Step 5: Process all chunks in parallel, each browser with its own concurrency
    const scrapeStartTime = Date.now();
    const allResults = await Promise.all(
      workChunks.map(async (chunk, browserIndex) => {
        console.log(`🌐 Browser ${browserIndex + 1} starting with ${chunk.length} types...\n`);
        return scrapeInBatches(contexts[browserIndex], chunk, isVisible, concurrencyPerBrowser);
      })
    );

    const scrapeEndTime = Date.now();

    // Step 6: Merge results from all browsers
    console.log('\n📊 Merging results from all browsers...');
    const mergedResults: MetadataTypesMap = {};
    let totalSuccess = 0;
    let totalFail = 0;
    let globalSlowestType: { name: string; duration: number } | null = null;
    let globalFastestType: { name: string; duration: number } | null = null;
    let totalDuration = 0;
    let totalTypes = 0;

    allResults.forEach((result, browserIndex) => {
      // Merge metadata results
      Object.assign(mergedResults, result.results);

      // Aggregate statistics
      totalSuccess += result.successCount;
      totalFail += result.failCount;
      totalDuration += result.averageDuration * (result.successCount + result.failCount);
      totalTypes += result.successCount + result.failCount;

      // Track global slowest
      if (result.slowestType !== null) {
        if (globalSlowestType === null || result.slowestType.duration > globalSlowestType.duration) {
          globalSlowestType = result.slowestType;
        }
      }

      // Track global fastest
      if (result.fastestType !== null) {
        if (globalFastestType === null || result.fastestType.duration < globalFastestType.duration) {
          globalFastestType = result.fastestType;
        }
      }

      console.log(`   Browser ${browserIndex + 1}: ✅ ${result.successCount} success, ❌ ${result.failCount} failed`);
    });

    const globalAverageDuration = totalTypes > 0 ? totalDuration / totalTypes : 0;

    // Save results
    const outputPath =
      outputFile ?? path.join(__dirname, '../../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

    const endTime = Date.now();
    const totalElapsedTime = formatElapsedTime(startTime, endTime);
    const scrapeElapsedTime = formatElapsedTime(scrapeStartTime, scrapeEndTime);

    console.log('\n=== Summary ===');
    console.log(`🌐 Browsers used: ${numBrowsers}`);
    console.log(`🔄 Concurrency per browser: ${concurrencyPerBrowser}`);
    console.log(`⚡ Total concurrency: ${totalConcurrency}`);
    console.log(`📋 Discovered: ${metadataTypes.length} metadata types`);
    console.log(`🎯 Attempted: ${typesToScrape.length}`);
    console.log(`✅ Success: ${totalSuccess}`);
    console.log(`❌ Failed: ${totalFail}`);
    console.log(`⏱️  Scraping time: ${scrapeElapsedTime}`);
    console.log(`⏱️  Total time: ${totalElapsedTime}`);
    if (globalSlowestType !== null) {
      const slowestTime = formatElapsedTime(0, globalSlowestType.duration);
      console.log(`🐌 Slowest type: ${globalSlowestType.name} (${slowestTime})`);
    }
    if (globalFastestType !== null) {
      const fastestTime = formatElapsedTime(0, globalFastestType.duration);
      console.log(`⚡ Fastest type: ${globalFastestType.name} (${fastestTime})`);
    }
    const avgTime = formatElapsedTime(0, globalAverageDuration);
    console.log(`📊 Average time per type: ${avgTime}`);
    console.log(`\n💾 Writing results to: ${outputPath}`);

    fs.writeFileSync(outputPath, JSON.stringify(mergedResults, null, 2));
    console.log('✅ Done!');
  } finally {
    // Clean up all browsers
    console.log('\n🧹 Closing all browsers...');
    await Promise.all(
      browsers.map(async (browser, i) => {
        await browser.close();
        console.log(`   ✓ Browser ${i + 1}/${numBrowsers} closed`);
      })
    );
    console.log('✅ All browsers closed');
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
  NUM_BROWSERS=5                      # Number of parallel browser instances (default: 5)
  BATCH_SIZE=20                       # Concurrency per browser (default: 20)
                                      # Total concurrency = NUM_BROWSERS × BATCH_SIZE

Examples:
  NUM_BROWSERS=5 BATCH_SIZE=20 npm run scrape:all:pages     # 100 total workers (5 × 20)
  NUM_BROWSERS=10 BATCH_SIZE=10 npm run scrape:all:pages    # 100 total workers (10 × 10)
  NUM_BROWSERS=1 BATCH_SIZE=50 npm run scrape:all:pages     # 50 workers in single browser
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
