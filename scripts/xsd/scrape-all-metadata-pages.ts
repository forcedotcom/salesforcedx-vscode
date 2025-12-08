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

    // Pages to exclude completely (skip both the page AND its children - no recursion)
    const excludedPagesAndChildren = [
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

    // Pages to exclude but still process their children (skip page only, continue recursion)
    const excludedPagesOnly = [
      'meta_data_cloud_types',
      'meta_activationplatformactvattr',
      'meta_datasourcetenant',
      'meta_externaldatatransportfieldtemplate',
      'meta_externaldatatransportobjecttemplate',
      'meta_internaldataconnector',
      'meta_appmenu',
      'meta_digitalexperiencebundle_marketing',
      'meta_digitalexperiencebundle_site',
      'meta_flowvaluemap',
      'meta_rparobotpoolmetadata',
      'meta_settings',
      'meta_userprofilesearchscope',
      'meta_webstorebundle'
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

      const nameLower = name.toLowerCase();
      const hrefLower = href.toLowerCase();
      const idLower = id?.toLowerCase() ?? '';

      // Check if this page AND its children should be excluded
      const isExcludedWithChildren = excludedPagesAndChildren.some(
        excluded => nameLower.includes(excluded) || hrefLower.includes(excluded) || idLower.includes(excluded)
      );

      if (isExcludedWithChildren) {
        // Skip this page and all its children (don't recurse)
        return;
      }

      // Check if ONLY this page should be excluded (still process children)
      const isExcludedPageOnly = excludedPagesOnly.some(
        excluded => nameLower.includes(excluded) || hrefLower.includes(excluded) || idLower.includes(excluded)
      );

      // Only include if it looks like a valid metadata type page and not excluded
      const isValidMetadataType =
        !isExcludedPageOnly && name.length > 0 && name.length < 200 && href.endsWith('.htm') && !href.includes('#');

      if (isValidMetadataType) {
        // Construct full URL
        const fullUrl = href.startsWith('http') ? href : `${BASE_DOC_URL}${href}`;
        metadataTypes.push({ name, url: fullUrl });
      }

      // Recursively process children (subtypes like CustomField, HistoryRetentionPolicy, etc.)
      // This happens for both included pages and excludedPagesOnly (but not excludedPagesAndChildren)
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

/** Context pool for dynamic work distribution */
class ContextPool {
  private contexts: any[];
  private availableSlots: number[];

  constructor(contexts: any[], maxSlotsPerContext: number) {
    this.contexts = contexts;
    // Track available slots per context
    this.availableSlots = contexts.map(() => maxSlotsPerContext);
  }

  /** Acquire a context (returns context and its index) */
  public async acquire(): Promise<{ context: any; index: number }> {
    // Find first context with available slots
    while (true) {
      for (let i = 0; i < this.contexts.length; i++) {
        if (this.availableSlots[i] > 0) {
          this.availableSlots[i]--;
          return { context: this.contexts[i], index: i };
        }
      }
      // If no slots available, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /** Release a context slot */
  public release(index: number): void {
    this.availableSlots[index]++;
  }

  /** Get current slot availability for stats */
  public getAvailability(): number[] {
    return [...this.availableSlots];
  }
}

/**
 * Scrapes a single metadata type with dynamic context acquisition
 * Acquires an available context from the pool when the task starts
 */
const scrapeMetadataTypeWithContext = async (
  contextPool: ContextPool,
  type: { name: string; url: string },
  index: number,
  total: number,
  isVisible: boolean
): Promise<{ success: boolean; results: { name: string; data: MetadataType }[]; contextIndex: number }> => {
  // Dynamically acquire an available context when this task starts
  const { context, index: contextIndex } = await contextPool.acquire();

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
    console.log(`[${index + 1}/${total}] ${type.name} → Browser ${contextIndex + 1}`);
    const pageResults = await scrapeMetadataType(page, type.name, type.url, isVisible);

    if (pageResults.length > 0) {
      console.log(`     ✓ ${type.name} completed successfully`);
      return { success: true, results: pageResults, contextIndex };
    } else {
      console.log(`     ⚠️  ${type.name} returned no results`);
      return { success: false, results: [], contextIndex };
    }
  } catch (error: any) {
    console.log(`     ❌ ${type.name} failed: ${error.message}`);
    return { success: false, results: [], contextIndex };
  } finally {
    await page.close();
    // Release context back to pool
    contextPool.release(contextIndex);
  }
};

/**
 * Process metadata types using Effect queue system with dynamic work distribution
 * All browsers share a single queue - work is distributed as capacity becomes available
 * Uses a context pool for true dynamic load balancing
 */
const scrapeInBatches = async (
  contextPool: ContextPool,
  typesToScrape: { name: string; url: string }[],
  isVisible: boolean,
  concurrencyLimit: number = 100
): Promise<{
  results: MetadataTypesMap;
  successCount: number;
  failCount: number;
  slowestType: { name: string; duration: number } | null;
  fastestType: { name: string; duration: number } | null;
  averageDuration: number;
  perBrowserStats: { successCount: number; failCount: number }[];
  failedTypesNoTables: { name: string; url: string }[];
}> => {
  const results: MetadataTypesMap = {};
  let successCount = 0;
  let failCount = 0;
  let completed = 0;
  const totalMetadataTypes = typesToScrape.length;
  let slowestType: { name: string; duration: number } | null = null;
  let fastestType: { name: string; duration: number } | null = null;
  let totalDuration = 0;
  const failedTypesNoTables: { name: string; url: string }[] = [];

  // Track per-browser statistics - dynamically allocated
  const numBrowsers = contextPool['contexts'].length;
  const perBrowserStats: { successCount: number; failCount: number }[] = Array.from({ length: numBrowsers }, () => ({
    successCount: 0,
    failCount: 0
  }));

  console.log(
    `\n🚀 Processing ${totalMetadataTypes} metadata types with shared queue (concurrency limit: ${concurrencyLimit})...\n`
  );

  /** Wrap scraping logic in an Effect */
  const scrapeTypeEffect = (type: { name: string; url: string }, index: number) =>
    Effect.tryPromise({
      try: async () => {
        const typeStartTime = Date.now();
        const result = await scrapeMetadataTypeWithContext(contextPool, type, index, totalMetadataTypes, isVisible);
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

        // Update per-browser stats
        if (result.success) {
          perBrowserStats[result.contextIndex].successCount++;
        } else {
          perBrowserStats[result.contextIndex].failCount++;
        }

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

  /** Process all types with concurrency control using Effect.all - single shared queue */
  const program = Effect.all(effects, { concurrency: concurrencyLimit }).pipe(
    Effect.map(allResults => {
      // Collect results
      for (const { type, result } of allResults) {
        if (result.success && result.results.length > 0) {
          for (const { name, data } of result.results) {
            // Only overwrite existing entries if:
            // 1. No existing entry, OR
            // 2. Existing entry has no fields but new one has fields
            // This ensures types with fields take precedence over referenced types without fields
            const existing = results[name];
            if (!existing || (existing.fields.length === 0 && data.fields.length > 0)) {
              results[name] = data;
            }
          }
          successCount++;
        } else {
          failCount++;
          // Track types that failed due to no tables
          failedTypesNoTables.push({ name: type.name, url: type.url });
        }
      }
      const averageDuration = totalMetadataTypes > 0 ? totalDuration / totalMetadataTypes : 0;
      return {
        results,
        successCount,
        failCount,
        slowestType,
        fastestType,
        averageDuration,
        perBrowserStats,
        failedTypesNoTables
      };
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
        averageDuration,
        perBrowserStats,
        failedTypesNoTables
      });
    })
  );

  // Run the Effect program
  return Effect.runPromise(program);
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
  console.log('🌐 Configuration:');
  console.log(`   • Worker pool: ${numBrowsers} browser instances`);
  console.log(`   • Capacity: ${concurrencyPerBrowser} concurrent tabs per browser`);
  console.log(`   • Total workers: ${totalConcurrency} (shared queue)`);
  console.log('   • Load balancing: Dynamic context acquisition');
  console.log('   • Fast browsers will process more tasks than slow ones\n');

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
    // Step 4: Create context pool for dynamic work distribution
    const contextPool = new ContextPool(contexts, concurrencyPerBrowser);
    console.log('📦 Work distribution: Dynamic (context pool with true load balancing)\n');
    console.log(`   Each browser can handle up to ${concurrencyPerBrowser} concurrent tasks`);
    console.log('   Workers acquire contexts dynamically as they become available\n');

    const scrapeStartTime = Date.now();
    const {
      results: mergedResults,
      successCount: totalSuccess,
      failCount: totalFail,
      slowestType: globalSlowestType,
      fastestType: globalFastestType,
      averageDuration: globalAverageDuration,
      perBrowserStats,
      failedTypesNoTables
    } = await scrapeInBatches(contextPool, typesToScrape, isVisible, totalConcurrency);

    const scrapeEndTime = Date.now();

    // Display per-browser statistics
    console.log('\n📊 Per-browser statistics (dynamic distribution):');
    perBrowserStats.forEach((stats, browserIndex) => {
      const totalForBrowser = stats.successCount + stats.failCount;
      const percentage = ((totalForBrowser / typesToScrape.length) * 100).toFixed(1);
      console.log(
        `   Browser ${browserIndex + 1}: ${totalForBrowser} types (${percentage}%) - ✅ ${stats.successCount} success, ❌ ${stats.failCount} failed`
      );
    });

    // Save results
    const outputPath =
      outputFile ?? path.join(__dirname, '../../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

    const endTime = Date.now();
    const totalElapsedTime = formatElapsedTime(startTime, endTime);
    const scrapeElapsedTime = formatElapsedTime(scrapeStartTime, scrapeEndTime);

    console.log('\n=== Summary ===');
    console.log(
      `🌐 Worker pool: ${numBrowsers} browsers × ${concurrencyPerBrowser} tabs = ${totalConcurrency} total workers`
    );
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

    // Print failed types (no tables found)
    if (failedTypesNoTables.length > 0) {
      console.log(`\n⚠️  Failed types (no tables found): ${failedTypesNoTables.length}`);
      failedTypesNoTables.forEach(({ name, url }) => {
        console.log(`   • ${name}`);
        console.log(`     ${url}`);
      });
    }

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
                                      # Work is distributed dynamically via shared queue

Work Distribution:
  True dynamic load balancing with context pool. When ANY worker finishes a task,
  it acquires the next available browser context and processes the next job from
  the shared queue. Fast browsers naturally process more tasks than slow ones.

  Example: With 20 total jobs and 2 browsers:
  - Browser 1 gets 3 slow jobs → processes only 3 tasks total
  - Browser 2 gets fast jobs → processes remaining 17 tasks

  This maximizes throughput and eliminates idle time.

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
