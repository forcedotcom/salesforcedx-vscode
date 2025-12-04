/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect, Pool, Duration, Metric, MetricBoundaries, Logger, LogLevel, Ref } from 'effect';
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
import { NodeSdkLayer, MetricsLayer } from './observability';

const JSON_DOC_URL = 'https://developer.salesforce.com/docs/get_document/atlas.en-us.api_meta.meta';
const BASE_DOC_URL = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/';

/** Counter metrics */
const metadataTypesDiscovered = Metric.counter('scraper.metadata_types.discovered', {
  description: 'Total number of metadata types discovered'
});

const metadataTypesAttempted = Metric.counter('scraper.metadata_types.attempted', {
  description: 'Total number of metadata types attempted to scrape'
});

const metadataTypesSuccess = Metric.counter('scraper.metadata_types.success', {
  description: 'Number of successful metadata type scrapes'
});

const metadataTypesFailed = Metric.counter('scraper.metadata_types.failed', {
  description: 'Number of failed metadata type scrapes'
});

const errorsTotal = Metric.counter('scraper.errors.total', {
  description: 'Total number of errors encountered'
});

/** Histogram metrics */
const scrapeDuration = Metric.histogram(
  'scraper.scrape.duration',
  MetricBoundaries.exponential({ start: 0.1, factor: 2, count: 8 }),
  'Duration per metadata type scrape in seconds'
);

const pageLoadDuration = Metric.histogram(
  'scraper.page.load.duration',
  MetricBoundaries.exponential({ start: 0.1, factor: 2, count: 6 }),
  'Page load time in seconds'
);

const contextAcquisitionDuration = Metric.histogram(
  'scraper.context.acquisition.duration',
  MetricBoundaries.exponential({ start: 0.001, factor: 10, count: 5 }),
  'Context acquisition time in seconds'
);

/** Gauge metrics */
const poolUtilization = Metric.gauge('scraper.pool.utilization', {
  description: 'Pool utilization percentage'
});

const browserActivePages = Metric.gauge('scraper.browser.active_pages', {
  description: 'Number of active pages per browser'
});

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
  isVisible: boolean,
  logLevel: LogLevel.LogLevel = LogLevel.Debug
): Promise<{ name: string; data: MetadataType }[]> => {
  Effect.runSync(
    Effect.logDebug(`📄 ${name}`)
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.catchAll(() => Effect.void))
  );

  const { success, contentFrame } = await loadMetadataPage(page, url);

  if (!success || !contentFrame) {
    Effect.runSync(
      Effect.logDebug('Content failed to load')
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.catchAll(() => Effect.void))
    );
    return [];
  }

  Effect.runSync(
    Effect.logDebug('Content loaded')
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.catchAll(() => Effect.void))
  );

  const results = await extractMetadataFromPage(contentFrame, url, name);

  if (results.length === 0) {
    Effect.runSync(
      Effect.logDebug('No fields found')
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.catchAll(() => Effect.void))
    );

    // In visible mode, pause to let user inspect
    if (isVisible) {
      Effect.runSync(
        Effect.logDebug('Waiting for user inspection (30s timeout)')
          .pipe(Logger.withMinimumLogLevel(logLevel))
          .pipe(Effect.catchAll(() => Effect.void))
      );
      await page.waitForTimeout(30_000);
    }

    return [];
  }

  return results;
};

/** Discovers metadata types from the Salesforce Metadata API JSON documentation endpoint */
const discoverMetadataTypes = (
  page: Page,
  logLevel: LogLevel.LogLevel = LogLevel.Debug
): Effect.Effect<{ name: string; url: string }[], Error> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Discovering metadata types from JSON documentation: ${JSON_DOC_URL}`);

    // Fetch the JSON document directly (no browser needed for this part!)
    const response = yield* Effect.promise(() => page.context().request.get(JSON_DOC_URL));
    if (!response.ok()) {
      yield* Effect.logError(`Failed to fetch JSON document: ${response.status()} ${response.statusText()}`);
      return yield* Effect.fail(
        new Error(`Failed to fetch JSON document: ${response.status()} ${response.statusText()}`)
      );
    }

    const docData = yield* Effect.promise(() => response.json());
    yield* Effect.logDebug('JSON document loaded successfully');

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

    yield* Effect.logInfo(`Metadata types discovered: ${metadataTypes.length}`);

    // Print all discovered metadata types
    if (metadataTypes.length > 0) {
      yield* Effect.logDebug(`All discovered metadata types: ${metadataTypes.map(t => t.name).join(', ')}`);
    }

    // Record metric
    yield* Metric.incrementBy(metadataTypes.length)(metadataTypesDiscovered);

    return metadataTypes.length > 0 ? metadataTypes : [];
  })
    .pipe(Logger.withMinimumLogLevel(logLevel))
    .pipe(Effect.withSpan('discoverMetadataTypes', { kind: 'internal' }))
    .pipe(
      Effect.catchAll(error => {
        return Effect.gen(function* () {
          yield* Effect.logError(`Discovery failed: ${String(error)}`);
          yield* Metric.increment(errorsTotal);
          yield* Effect.logInfo('Using fallback list');
          return [];
        }).pipe(Logger.withMinimumLogLevel(logLevel));
      })
    );

/** Wrapper for browser context with index for statistics tracking */
type ContextWithIndex = {
  context: any;
  index: number;
};

/**
 * Scrapes a single metadata type with dynamic context acquisition using Effect Pool
 * Acquires an available context from the pool when the task starts
 */
const scrapeMetadataTypeWithContext = (
  contextPool: Pool.Pool<ContextWithIndex, Error>,
  type: { name: string; url: string },
  index: number,
  total: number,
  isVisible: boolean,
  logLevel: LogLevel.LogLevel = LogLevel.Debug
): Effect.Effect<{ success: boolean; results: { name: string; data: MetadataType }[]; contextIndex: number }, Error> =>
  Effect.scoped(
    Effect.gen(function* () {
      // Track context acquisition time
      const contextAcquisitionStart = Date.now();
      // Acquire context from pool (automatically released when Effect completes)
      // Note: Anti-detection script is already added to the context when it was created
      const { context, index: contextIndex } = yield* Pool.get(contextPool);
      const contextAcquisitionEnd = Date.now();
      const contextAcquisitionTime = (contextAcquisitionEnd - contextAcquisitionStart) / 1000;
      yield* Metric.update(contextAcquisitionTime)(contextAcquisitionDuration);

      const page = yield* Effect.promise<Page>(() => context.newPage() as Promise<Page>);

      // Track scrape duration
      const scrapeStart = Date.now();
      try {
        yield* Effect.logDebug(`[${index + 1}/${total}] ${type.name} → Browser ${contextIndex + 1}`);

        const pageResults = yield* Effect.promise<{ name: string; data: MetadataType }[]>(() =>
          scrapeMetadataType(page, type.name, type.url, isVisible, logLevel)
        );

        const scrapeEnd = Date.now();
        const scrapeDurationSeconds = (scrapeEnd - scrapeStart) / 1000;

        if (pageResults.length > 0) {
          yield* Effect.logDebug(`${type.name} completed successfully`);
          yield* Metric.increment(metadataTypesSuccess);
          yield* Metric.update(scrapeDurationSeconds)(scrapeDuration);
          return { success: true, results: pageResults, contextIndex };
        } else {
          yield* Effect.logDebug(`${type.name} returned no results`);
          yield* Metric.increment(metadataTypesFailed);
          yield* Metric.update(scrapeDurationSeconds)(scrapeDuration);
          return { success: false, results: [], contextIndex };
        }
      } catch (error: any) {
        const scrapeEnd = Date.now();
        const scrapeDurationSeconds = (scrapeEnd - scrapeStart) / 1000;
        yield* Effect.logError(`Scraping failed for ${type.name}: ${error.message} (Browser ${contextIndex + 1})`);
        yield* Metric.increment(errorsTotal);
        yield* Metric.increment(metadataTypesFailed);
        yield* Metric.update(scrapeDurationSeconds)(scrapeDuration);
        return { success: false, results: [], contextIndex };
      } finally {
        yield* Effect.promise<void>(() => page.close());
      }
    })
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(
        Effect.withSpan('scrapeMetadataTypeWithContext', {
          kind: 'internal',
          attributes: {
            metadata_type: type.name,
            url: type.url
          }
        })
      )
  );

/**
 * Process metadata types using Effect queue system with dynamic work distribution
 * All browsers share a single queue - work is distributed as capacity becomes available
 * Uses Effect Pool for true dynamic load balancing
 */
const scrapeInBatches = (
  contextPool: Pool.Pool<ContextWithIndex, Error>,
  typesToScrape: { name: string; url: string }[],
  isVisible: boolean,
  concurrencyLimit: number,
  numBrowsers: number,
  logLevel: LogLevel.LogLevel = LogLevel.Debug
): Effect.Effect<
  {
    results: MetadataTypesMap;
    successCount: number;
    failCount: number;
    slowestType: { name: string; duration: number } | null;
    fastestType: { name: string; duration: number } | null;
    averageDuration: number;
    perBrowserStats: { successCount: number; failCount: number }[];
  },
  Error
> => {
  const totalMetadataTypes = typesToScrape.length;

  // Track per-browser statistics
  const perBrowserStats: { successCount: number; failCount: number }[] = Array.from({ length: numBrowsers }, () => ({
    successCount: 0,
    failCount: 0
  }));

  return Effect.gen(function* () {
    yield* Effect.logInfo(`Processing ${totalMetadataTypes} metadata types (concurrency: ${concurrencyLimit})`);

    // Track attempted count
    yield* Metric.incrementBy(totalMetadataTypes)(metadataTypesAttempted);

    // Create a Ref to track completed count for real-time progress logging
    const completedRef = yield* Ref.make(0);

    /** Wrap scraping logic in an Effect with timing and stats tracking */
    const scrapeTypeEffect = (type: { name: string; url: string }, index: number) =>
      Effect.gen(function* () {
        const typeStartTime = Date.now();
        const result = yield* scrapeMetadataTypeWithContext(
          contextPool,
          type,
          index,
          totalMetadataTypes,
          isVisible,
          logLevel
        );
        const typeEndTime = Date.now();
        const duration = typeEndTime - typeStartTime;

        // Log progress in real-time as each task completes
        const completed = yield* Ref.updateAndGet(completedRef, n => n + 1);
        const progress = ((completed / totalMetadataTypes) * 100).toFixed(1);
        yield* Effect.logInfo(
          `Progress: [${completed}/${totalMetadataTypes}] (${progress}%) - ${type.name} - ${result.success ? 'success' : 'failed'}`
        );

        // Update pool utilization metric
        const utilization = (completed / totalMetadataTypes) * 100;
        yield* Metric.update(utilization)(poolUtilization);

        return { type, result, duration };
      });

    /** Create all effects with concurrency control */
    const effects = typesToScrape.map((type, index) => scrapeTypeEffect(type, index));

    /** Process all types with concurrency control using Effect.all - single shared queue */
    const allResults = yield* Effect.all(effects, { concurrency: concurrencyLimit }).pipe(
      Effect.mapError((error): Error => (error instanceof Error ? error : new Error(String(error))))
    );

    const results: MetadataTypesMap = {};
    let successCount = 0;
    let failCount = 0;
    let slowestType: { name: string; duration: number } | null = null;
    let fastestType: { name: string; duration: number } | null = null;
    let totalDuration = 0;
    let completed = 0;

    // Collect results and track statistics
    for (const { type, result, duration } of allResults) {
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

      // Collect results
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
    return { results, successCount, failCount, slowestType, fastestType, averageDuration, perBrowserStats };
  })
    .pipe(Logger.withMinimumLogLevel(logLevel))
    .pipe(
      // Catch any errors and return partial results
      Effect.catchAll(error => {
        return Effect.gen(function* () {
          yield* Effect.logError(`Scraping in batches failed: ${String(error)}`);
          yield* Metric.increment(errorsTotal);
          // Return partial results even on error
          const results: MetadataTypesMap = {};
          let successCount = 0;
          let failCount = 0;
          let slowestType: { name: string; duration: number } | null = null;
          let fastestType: { name: string; duration: number } | null = null;
          let totalDuration = 0;
          const averageDuration = totalMetadataTypes > 0 ? totalDuration / totalMetadataTypes : 0;
          return {
            results,
            successCount,
            failCount: failCount + (totalMetadataTypes - successCount - failCount),
            slowestType,
            fastestType,
            averageDuration,
            perBrowserStats
          };
        }).pipe(Logger.withMinimumLogLevel(logLevel));
      })
    );
};

/** Create a browser context with standard configuration and anti-detection */
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

  // Add comprehensive anti-detection script to context (applies to all pages)
  await context.addInitScript(() => {
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

  return context;
};

/**
 * Main scraping function with multi-browser support
 */
/**
 * Parse log level from string
 */
const parseLogLevel = (level: string | undefined): LogLevel.LogLevel => {
  if (!level) return LogLevel.Info; // Default to Info

  const upperLevel = level.toUpperCase();
  switch (upperLevel) {
    case 'ALL':
      return LogLevel.All;
    case 'TRACE':
      return LogLevel.Trace;
    case 'DEBUG':
      return LogLevel.Debug;
    case 'INFO':
      return LogLevel.Info;
    case 'WARNING':
    case 'WARN':
      return LogLevel.Warning;
    case 'ERROR':
      return LogLevel.Error;
    case 'FATAL':
      return LogLevel.Fatal;
    case 'NONE':
      return LogLevel.None;
    default:
      console.warn(`Unknown log level "${level}", defaulting to Info`);
      return LogLevel.Info;
  }
};

/**
 * Create Logger layer with minimum log level
 * Note: Logger.withMinimumLogLevel is a pipeable operator that filters logs in an Effect
 */
const createLoggerLayer = (logLevel: LogLevel.LogLevel) => Logger.withMinimumLogLevel(logLevel);

const scrapeAll = async (
  outputFile?: string,
  isVisible: boolean = false,
  logLevel: LogLevel.LogLevel = LogLevel.Debug
): Promise<void> => {
  // Logger.withMinimumLogLevel is a pipeable operator that filters logs
  // Apply it to entire Effect programs, not individual log calls
  const startTime = Date.now();
  const numBrowsers = parseInt(process.env.NUM_BROWSERS ?? '5', 10);
  const concurrencyPerBrowser = parseInt(process.env.BATCH_SIZE ?? '20', 10);
  const totalConcurrency = numBrowsers * concurrencyPerBrowser;

  // Log configuration info
  await Effect.runPromise(
    Effect.logInfo(
      `Starting Salesforce Metadata API scraper (visible: ${isVisible}, browsers: ${numBrowsers}, concurrency: ${concurrencyPerBrowser}, total: ${totalConcurrency})`
    )
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );

  // Step 1: Launch a single browser for discovery
  await Effect.runPromise(
    Effect.logInfo('Launching discovery browser')
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );
  const discoveryBrowser = await chromium.launch({
    headless: !isVisible,
    args: BROWSER_LAUNCH_ARGS
  });

  const discoveryContext = await createBrowserContext(discoveryBrowser);
  const discoveryPage = await discoveryContext.newPage();

  // Note: Anti-detection script is already added to the context when it was created

  // Step 1: Discover all metadata types from documentation
  const metadataTypes = await Effect.runPromise(
    discoverMetadataTypes(discoveryPage, logLevel).pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );
  await discoveryPage.close();
  await discoveryBrowser.close();
  await Effect.runPromise(
    Effect.logInfo('Discovery browser closed')
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );

  const typesToScrape = metadataTypes;

  if (typesToScrape.length === 0) {
    await Effect.runPromise(
      Effect.logInfo('No metadata types to scrape, exiting')
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );
    return;
  }

  await Effect.runPromise(
    Effect.logInfo(`Metadata types to scrape: ${typesToScrape.length}`)
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );

  // Step 2: Launch multiple browsers in parallel for scraping
  await Effect.runPromise(
    Effect.logInfo(`Launching ${numBrowsers} scraping browsers`)
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );
  const launchStartTime = Date.now();

  const browsers = await Promise.all(
    Array.from({ length: numBrowsers }, async (_, i) => {
      const browser = await chromium.launch({
        headless: !isVisible,
        args: BROWSER_LAUNCH_ARGS
      });
      await Effect.runPromise(
        Effect.logDebug(`Browser ${i + 1}/${numBrowsers} launched`)
          .pipe(Logger.withMinimumLogLevel(logLevel))
          .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
      );
      return browser;
    })
  );

  const launchEndTime = Date.now();
  const launchTime = formatElapsedTime(launchStartTime, launchEndTime);
  await Effect.runPromise(
    Effect.logInfo(`All ${numBrowsers} browsers launched in ${launchTime}`)
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );

  // Step 3: Create contexts for each browser
  await Effect.runPromise(
    Effect.logInfo(`Creating ${numBrowsers} browser contexts`)
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );
  const contexts = await Promise.all(
    browsers.map(async (browser, i) => {
      const context = await createBrowserContext(browser);
      await Effect.runPromise(
        Effect.logDebug(`Context ${i + 1}/${numBrowsers} created`)
          .pipe(Logger.withMinimumLogLevel(logLevel))
          .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
      );
      return context;
    })
  );
  await Effect.runPromise(
    Effect.logInfo(`All ${numBrowsers} contexts created`)
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
  );

  try {
    // Step 4: Create Effect Pool for dynamic work distribution
    await Effect.runPromise(
      Effect.logInfo(
        `Work distribution: Dynamic Effect Pool (${concurrencyPerBrowser} per browser, ${totalConcurrency} total)`
      )
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );

    // Create pool of contexts - each context becomes a pool item
    const contextsWithIndex: ContextWithIndex[] = contexts.map((context, index) => ({ context, index }));

    const scrapeProgram = Effect.scoped(
      Effect.gen(function* () {
        // Create a pool where each context is a separate pool item
        // The pool will manage concurrency per context (20 pages per context)
        const contextPool = yield* Pool.makeWithTTL({
          acquire: (() => {
            let nextIndex = 0;
            return Effect.sync(() => {
              // Round-robin through contexts for initial pool population
              const contextWithIndex = contextsWithIndex[nextIndex];
              nextIndex = (nextIndex + 1) % numBrowsers;
              return contextWithIndex;
            });
          })(),
          min: numBrowsers,
          max: numBrowsers,
          timeToLive: Duration.infinity,
          concurrency: concurrencyPerBrowser
        });

        const scrapeStartTime = Date.now();
        const results = yield* scrapeInBatches(
          contextPool,
          typesToScrape,
          isVisible,
          totalConcurrency,
          numBrowsers,
          logLevel
        );
        const scrapeEndTime = Date.now();

        return { results, scrapeStartTime, scrapeEndTime };
      })
    )
      .pipe(Logger.withMinimumLogLevel(logLevel))
      .pipe(
        Effect.withSpan('scrapeAll', {
          kind: 'internal',
          attributes: {
            num_browsers: String(numBrowsers),
            concurrency_per_browser: String(concurrencyPerBrowser),
            total_concurrency: String(totalConcurrency),
            total_types: String(typesToScrape.length),
            is_visible: String(isVisible)
          }
        })
      )
      .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer));

    const scrapeResult = await Effect.runPromise(scrapeProgram);
    const {
      results: {
        results: mergedResults,
        successCount: totalSuccess,
        failCount: totalFail,
        slowestType: globalSlowestType,
        fastestType: globalFastestType,
        averageDuration: globalAverageDuration,
        perBrowserStats
      },
      scrapeStartTime,
      scrapeEndTime
    } = scrapeResult;

    // Display per-browser statistics
    await Effect.runPromise(
      Effect.gen(function* () {
        const statsSummary = perBrowserStats
          .map((stats, idx) => `Browser ${idx + 1}: ${stats.successCount} success, ${stats.failCount} failed`)
          .join('; ');
        yield* Effect.logInfo(`Per-browser statistics: ${statsSummary}`);
      })
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );

    // Save results
    const outputPath =
      outputFile ?? path.join(__dirname, '../../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

    const endTime = Date.now();
    const totalElapsedTime = formatElapsedTime(startTime, endTime);
    const scrapeElapsedTime = formatElapsedTime(scrapeStartTime, scrapeEndTime);

    await Effect.runPromise(
      Effect.logInfo(
        `Scraping summary: ${metadataTypes.length} discovered, ${typesToScrape.length} attempted, ${totalSuccess} success, ${totalFail} failed, ${scrapeElapsedTime} scraping time, ${totalElapsedTime} total time`
      )
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );

    fs.writeFileSync(outputPath, JSON.stringify(mergedResults, null, 2));
    await Effect.runPromise(
      Effect.logInfo(`Scraping completed, output: ${outputPath}`)
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );
  } finally {
    // Clean up all browsers
    await Effect.runPromise(
      Effect.logInfo(`Closing all ${numBrowsers} browsers`)
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );
    await Promise.all(
      browsers.map(async (browser, i) => {
        await browser.close();
        await Effect.runPromise(
          Effect.logDebug(`Browser ${i + 1}/${numBrowsers} closed`)
            .pipe(Logger.withMinimumLogLevel(logLevel))
            .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
        );
      })
    );
    await Effect.runPromise(
      Effect.logInfo('All browsers closed')
        .pipe(Logger.withMinimumLogLevel(logLevel))
        .pipe(Effect.provide(MetricsLayer), Effect.provide(NodeSdkLayer))
    );
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
  npm run scrape:all:pages -- --log-level INFO      # Show only INFO and above (hide DEBUG)

Options:
  --visible        Run with visible browser (useful for debugging)
  --output <file>  Custom output file path
  --log-level <level>  Minimum log level: ALL, TRACE, DEBUG, INFO, WARNING, ERROR, FATAL, NONE (default: DEBUG)
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

  const logLevelIndex = args.indexOf('--log-level');
  const logLevelArg = logLevelIndex >= 0 ? args[logLevelIndex + 1] : undefined;
  const logLevel = parseLogLevel(logLevelArg || process.env.LOG_LEVEL);

  await scrapeAll(outputFile, isVisible, logLevel);
};

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
