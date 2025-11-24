/**
 * Robust Metadata API scraper with improved content loading
 * Produces JSON output identical to metadata_types_map.json
 *
 * Usage:
 *   npm run scrape:all:pages
 *   npm run scrape:all:pages -- --output custom-output.json
 *   npm run scrape:all:pages -- --visible  (runs with visible browser for debugging)
 *
 * Environment Variables:
 *   BATCH_SIZE=20           - Number of metadata types to scrape in parallel (default: 20)
 *   TEST_MODE=true          - Test with limited number of types
 *   TEST_LIMIT=3            - Number of types to test when TEST_MODE is enabled
 *   TEST_ASSIGNMENT_RULES_ONLY=true - Test only AssignmentRules type
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loadPageRobustly, extractMetadataFromPage, MetadataType } from './scrapeUtils';

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

  const { success, contentFrame } = await loadPageRobustly(page, url);

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

/**
 * Extract child/related metadata type links from a page content
 */
const findChildMetadataTypes = async (page: Page, parentUrl: string): Promise<Array<{ name: string; url: string }>> => {
  try {
    await page.goto(parentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const frames = page.frames();
    const urlParts = parentUrl.split('/');
    const expectedPage = urlParts.at(-1)!;
    const contentFrame = frames.find(f => f.url().includes(expectedPage)) || page.mainFrame();

    // Look for child metadata type links in the page content
    const childLinks = await contentFrame.evaluate(() => {
      const children: Array<{ name: string; url: string }> = [];

      // Search both regular DOM and Shadow DOM
      const findLinksInDOM = (root: Document | ShadowRoot | Element) => {
        const allLinks = Array.from(root.querySelectorAll('a[href]'));

        for (const link of allLinks) {
          const href = (link as HTMLAnchorElement).href || link.getAttribute('href') || '';
          const text = link.textContent?.trim() || '';

          // Look for links to other metadata types in the same documentation
          // Be less restrictive here - we'll filter more carefully later
          if (
            href.includes('/api_meta/') &&
            href.includes('.htm') &&
            text.length > 0 &&
            text.length < 200 &&
            !href.includes('#') // Skip anchor links
          ) {
            // Normalize the URL
            const normalizedUrl = href.split('#')[0];
            if (!children.some(c => c.url === normalizedUrl)) {
              children.push({ name: text, url: normalizedUrl });
            }
          }
        }

        // Search Shadow DOM
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
          if (el.shadowRoot) {
            findLinksInDOM(el.shadowRoot);
          }
        });
      };

      findLinksInDOM(document);
      return children;
    });

    return childLinks;
  } catch (error) {
    return [];
  }
};

/**
 * Discover ALL metadata types from the documentation sidebar
 */
const discoverMetadataTypes = async (page: Page): Promise<Array<{ name: string; url: string }>> => {
  const MAIN_PAGE_URL = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm';

  console.log('\n🔍 Discovering all metadata types from documentation...');
  console.log(`   Loading: ${MAIN_PAGE_URL}`);

  try {
    await page.goto(MAIN_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000); // Wait for Shadow DOM to render

    // Handle cookie consent
    try {
      const cookieButton = page.locator('button:has-text("Accept All"), button:has-text("Accept")');
      if (await cookieButton.isVisible({ timeout: 2000 })) {
        await cookieButton.click();
        await page.waitForTimeout(1000);
      }
    } catch {}

    await page.waitForTimeout(5000);

    // Get all frames to search for content
    const frames = page.frames();
    console.log(`   Found ${frames.length} frames`);

    // Try to find the content frame
    const urlParts = MAIN_PAGE_URL.split('/');
    const expectedPage = urlParts.at(-1)!;
    let contentFrame = frames.find(f => f.url().includes(expectedPage)) || page.mainFrame();

    console.log(`   Using frame: ${contentFrame.url()}`);

    // Expand all collapsed sections in the sidebar to reveal nested items
    console.log('   Expanding collapsed sidebar sections...');

    // Multiple passes to handle nested collapsible items
    for (let pass = 1; pass <= 3; pass++) {
      const expandedCount = await contentFrame.evaluate(() => {
        let count = 0;

        // Helper to expand all collapsible elements in the DOM and Shadow DOM
        const expandAll = (root: Document | ShadowRoot | Element): number => {
          let localCount = 0;

          // Find all elements with various collapse indicators
          const selectors = [
            '[aria-expanded="false"]',
            'button[aria-expanded="false"]',
            '.collapsed',
            'summary',
            '.slds-is-collapsed',
            '.slds-tree__item[aria-expanded="false"]',
            '[role="button"][aria-expanded="false"]',
            'details:not([open])'
          ];

          for (const selector of selectors) {
            const elements = root.querySelectorAll(selector);
            elements.forEach(el => {
              if (el instanceof HTMLElement) {
                // Check if it's actually collapsed before clicking
                const isCollapsed =
                  el.getAttribute('aria-expanded') === 'false' ||
                  el.classList.contains('collapsed') ||
                  el.classList.contains('slds-is-collapsed') ||
                  (el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open) ||
                  (el.tagName === 'SUMMARY' &&
                    el.parentElement?.tagName === 'DETAILS' &&
                    !(el.parentElement as HTMLDetailsElement).open);

                if (isCollapsed) {
                  // Try clicking to expand
                  try {
                    el.click();
                    localCount++;
                  } catch (e) {
                    // Ignore click errors
                  }

                  // Also try setting aria-expanded if it exists
                  if (el.hasAttribute('aria-expanded')) {
                    el.setAttribute('aria-expanded', 'true');
                  }

                  // For details/summary elements
                  if (el.tagName === 'SUMMARY' || el.tagName === 'DETAILS') {
                    const details = el.tagName === 'DETAILS' ? el : el.parentElement;
                    if (details && details.tagName === 'DETAILS') {
                      (details as HTMLDetailsElement).open = true;
                    }
                  }
                }
              }
            });
          }

          // Recursively search shadow DOMs
          const allElements = root.querySelectorAll('*');
          allElements.forEach(el => {
            if (el.shadowRoot) {
              localCount += expandAll(el.shadowRoot);
            }
          });

          return localCount;
        };

        count = expandAll(document);
        return count;
      });

      console.log(`   Pass ${pass}: Expanded ${expandedCount} elements`);

      // Wait for DOM updates after each pass
      await page.waitForTimeout(1500);

      // If nothing was expanded, no need for more passes
      if (expandedCount === 0 && pass > 1) {
        break;
      }
    }

    console.log('   ✓ Expansion complete');

    // Extract all metadata type links including from Shadow DOM
    const links = await contentFrame.evaluate(() => {
      const metadataLinks: Array<{ name: string; url: string }> = [];

      // Sections to exclude from the sidebar (we only want individual "Metadata Types" pages)
      const excludedSections = [
        'file-based calls',
        'crud-based calls',
        'utility calls',
        'result objects',
        'headers',
        'metadata components and types',
        'metadata coverage report',
        'unsupported metadata types',
        'special behavior in metadata api deployments'
      ];

      // Helper to traverse Shadow DOMs and find metadata type links
      const findLinks = (root: Document | ShadowRoot | Element) => {
        // Look for navigation lists that contain the links
        const navLists = Array.from(root.querySelectorAll('ul, ol, nav'));

        for (const list of navLists) {
          // Check if this list or its parent section has an excluded header
          let parent: Element | null = list;
          let isExcludedSection = false;

          // Walk up the DOM to find section headers
          while (parent && parent !== root) {
            const prevSiblings: Element[] = [];
            let sibling = parent.previousElementSibling;

            // Collect previous siblings (potential headers)
            for (let i = 0; i < 5 && sibling; i++) {
              prevSiblings.push(sibling);
              sibling = sibling.previousElementSibling;
            }

            // Check if any preceding header matches excluded sections
            for (const header of prevSiblings) {
              const headerText = header.textContent?.toLowerCase().trim() || '';
              if (excludedSections.some(excluded => headerText.includes(excluded))) {
                isExcludedSection = true;
                break;
              }
            }

            if (isExcludedSection) break;
            parent = parent.parentElement;
          }

          // Skip this list if it's in an excluded section
          if (isExcludedSection) continue;

          // Extract links from this list
          const allLinks = Array.from(list.querySelectorAll('a[href]'));

          for (const link of allLinks) {
            const href = (link as HTMLAnchorElement).href || link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';

            // Match metadata type documentation links
            // Exclude intro, index, overview, and other non-type pages
            const isMetadataTypePage =
              href.includes('/api_meta/') &&
              (href.includes('meta_') || href.match(/\/[a-z]+\.htm/)) &&
              !href.includes('meta_types') &&
              !href.includes('_intro') &&
              !href.includes('_overview') &&
              !href.includes('index.htm') &&
              !href.includes('meta_calls') &&
              !href.includes('meta_deploy') &&
              !href.includes('meta_retrieve') &&
              !href.includes('meta_delete') &&
              !href.includes('meta_describe') &&
              !href.includes('meta_list') &&
              !href.includes('meta_read') &&
              !href.includes('meta_update') &&
              !href.includes('meta_cancel') &&
              !href.includes('meta_check') &&
              !href.includes('result_objects') &&
              !href.includes('sforce_api') &&
              text.length > 0 &&
              text.length < 100 &&
              !text.toLowerCase().includes('intro') &&
              !text.toLowerCase().includes('overview');

            // Also exclude if the link text itself is an excluded section name
            const textLower = text.toLowerCase();
            const isExcludedText = excludedSections.some(
              excluded => textLower === excluded || textLower.includes('call')
            );

            if (isMetadataTypePage && !isExcludedText) {
              const name = text.trim();
              if (name && !metadataLinks.some(ml => ml.url === href)) {
                metadataLinks.push({ name, url: href });
              }
            }
          }
        }

        // Recursively search shadow DOMs
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
          if (el.shadowRoot) {
            findLinks(el.shadowRoot);
          }
        });
      };

      findLinks(document);
      return metadataLinks;
    });

    const metadataLinks = links;

    console.log(`   ✅ Discovered ${metadataLinks.length} metadata types!\n`);

    // Print ALL discovered metadata types from sidebar
    if (metadataLinks.length > 0) {
      console.log('   📋 All metadata types discovered from sidebar:');
      metadataLinks.forEach((link, index) => {
        console.log(`      ${String(index + 1).padStart(4)}. ${link.name}`);
      });
      console.log('');
    }

    // Step 2: Look for nested/child metadata types by visiting parent pages
    console.log('\n🔎 Searching for nested metadata types...');
    const allMetadataTypes = new Map<string, { name: string; url: string }>();

    // Add all discovered types
    for (const link of metadataLinks) {
      allMetadataTypes.set(link.url, link);
    }

    // Check ALL metadata types for potential nested children
    const parentsToCheck = metadataLinks;

    console.log(`   Checking all ${parentsToCheck.length} metadata type pages for nested types...`);
    console.log(`   (This will take a few minutes due to rate limiting)\n`);

    let totalNested = 0;
    for (let i = 0; i < parentsToCheck.length; i++) {
      const parent = parentsToCheck[i];

      // Show progress every 10 items
      if (i % 10 === 0) {
        console.log(`   Progress: ${i}/${parentsToCheck.length} pages checked...`);
      }

      const children = await findChildMetadataTypes(page, parent.url);
      let addedCount = 0;

      for (const child of children) {
        if (!allMetadataTypes.has(child.url) && child.name !== parent.name) {
          // Filter out non-metadata-type pages
          const isVersionRelease =
            child.name.match(/\d{2}\.\d/) || child.name.match(/(Spring|Summer|Winter|Fall)\s+'\d{2}/);
          const isIntroPage = child.url.includes('_intro') || child.name.toLowerCase().includes('intro');
          const isOverviewPage = child.url.includes('_overview') || child.name.toLowerCase().includes('overview');
          const isCallsPage = child.url.includes('_calls') || child.name.toLowerCase().includes('call');
          const isIndexPage = child.url.includes('index.htm');
          const isCoverageReport = child.url.includes('coverage_report') || child.url.includes('unsupported_types');
          const isSpecialBehavior = child.url.includes('special_behavior');

          // Verify it looks like a valid metadata type page
          const hasValidPattern = child.url.match(/meta_[a-z]+\.htm/) || child.url.match(/[a-z]+\.htm$/);

          if (
            hasValidPattern &&
            !isVersionRelease &&
            !isIntroPage &&
            !isOverviewPage &&
            !isCallsPage &&
            !isIndexPage &&
            !isCoverageReport &&
            !isSpecialBehavior
          ) {
            allMetadataTypes.set(child.url, child);
            addedCount++;
            totalNested++;
            console.log(`      + Found nested type: ${child.name} (under ${parent.name})`);
          }
        }
      }

      // Respectful delay between requests
      await page.waitForTimeout(500);
    }

    console.log(`   ✓ Completed checking all pages. Found ${totalNested} total nested types.\n`);

    // Step 3: Check the Metadata Coverage Report for any types we might have missed
    console.log('\n🔎 Checking Metadata Coverage Report for complete list...');
    try {
      const coverageUrl =
        'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_coverage_report.htm';
      await page.goto(coverageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(5000);

      const frames = page.frames();
      const contentFrame = frames.find(f => f.url().includes('meta_coverage_report.htm')) || page.mainFrame();

      const coverageTypes = await contentFrame.evaluate(() => {
        const types: Array<{ name: string; url: string }> = [];

        // Look for metadata type names in tables and convert them to URLs
        const allTextNodes: string[] = [];
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
          const cells = table.querySelectorAll('td, th');
          cells.forEach(cell => {
            const text = cell.textContent?.trim();
            if (text?.length > 0 && text?.length < 100) {
              allTextNodes.push(text);
            }
          });
        });

        // Common patterns for metadata type names and their URL forms
        const baseUrl = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/';
        allTextNodes.forEach(text => {
          // Convert CamelCase type name to lowercase URL format
          const urlName = text.replace(/([A-Z])/g, (match, offset) =>
            offset > 0 ? match.toLowerCase() : match.toLowerCase()
          );
          const possibleUrl = `${baseUrl}meta_${urlName}.htm`;

          if (text.match(/^[A-Z][a-zA-Z0-9]*$/)) {
            // Looks like a metadata type name
            types.push({ name: text, url: possibleUrl });
          }
        });

        return types;
      });

      let addedFromCoverage = 0;
      for (const type of coverageTypes) {
        if (!allMetadataTypes.has(type.url)) {
          allMetadataTypes.set(type.url, type);
          addedFromCoverage++;
        }
      }

      console.log(`   + Added ${addedFromCoverage} types from coverage report`);
    } catch (error) {
      console.log(`   ⚠️  Could not check coverage report: ${error}`);
    }

    const finalList = Array.from(allMetadataTypes.values());
    console.log(`   ✅ Total after all discovery: ${finalList.length} metadata types\n`);

    // Print complete list of all discovered metadata types
    console.log('\n📋 COMPLETE LIST OF ALL DISCOVERED METADATA TYPES:');
    console.log('═'.repeat(80));
    finalList.forEach((type, index) => {
      console.log(`${String(index + 1).padStart(4)}. ${type.name}`);
    });
    console.log('═'.repeat(80));
    console.log(`Total: ${finalList.length} metadata types\n`);

    return finalList.length > 0 ? finalList : [];
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
  console.log(`🚀 Starting robust metadata scraper${isVisible ? ' (VISIBLE MODE)' : ''}...\n`);

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

  const batchSize = parseInt(process.env.BATCH_SIZE || '20');
  const typesToScrape = metadataTypes;

  console.log(`📋 Will scrape ${typesToScrape.length} metadata types in parallel batches of ${batchSize}\n`);

  try {
    // Scrape in parallel batches
    const { results, successCount, failCount } = await scrapeInBatches(context, typesToScrape, isVisible, batchSize);

    // Save results
    const outputPath =
      outputFile || path.join(__dirname, '../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

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
Robust Salesforce Metadata Scraper

Usage:
  npm run scrape:robust                          # Headless mode
  npm run scrape:robust -- --visible             # Visible browser (for debugging)
  npm run scrape:robust -- --output file.json   # Custom output

Options:
  --visible        Run with visible browser (useful for debugging)
  --output <file>  Custom output file path
  --help           Show this help

Environment Variables:
  BATCH_SIZE=20                       # Number of types to scrape in parallel (default: 20)
  TEST_MODE=true                      # Test with limited number of types
  TEST_LIMIT=3                        # Number of types when TEST_MODE enabled
  TEST_ASSIGNMENT_RULES_ONLY=true     # Test only AssignmentRules

Examples:
  BATCH_SIZE=50 npm run scrape:robust                    # Use 50 parallel workers
  TEST_MODE=true TEST_LIMIT=5 npm run scrape:robust      # Test with 5 types
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
