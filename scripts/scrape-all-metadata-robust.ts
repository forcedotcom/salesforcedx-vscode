/**
 * Robust Metadata API scraper with improved content loading
 * Produces JSON output identical to metadata_types_map.json
 *
 * Usage:
 *   npm run scrape:robust
 *   npm run scrape:robust -- --output custom-output.json
 *   npm run scrape:robust -- --visible  (runs with visible browser for debugging)
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

/**
 * Improved page loading with multiple strategies
 * Returns the frame containing the actual content (might be an iframe)
 */
async function loadPageRobustly(page: Page, url: string): Promise<{ success: boolean; contentFrame: any }> {
  try {
    // Strategy 1: Load page with domcontentloaded
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Strategy 2: Handle cookie consent FIRST
    try {
      await page.waitForTimeout(1000);
      const cookieButton = page.locator(
        'button:has-text("Accept All"), button:has-text("Accept"), button:has-text("Agree")'
      );
      if (await cookieButton.isVisible({ timeout: 2000 })) {
        await cookieButton.click();
        console.log(`     ✓ Accepted cookies`);
        await page.waitForTimeout(1000);
      }
    } catch {
      // No cookie banner
    }

    // Strategy 3: Wait for network to settle
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Strategy 4: Just wait a long time for the JavaScript to fully render
    console.log(`     ⏳ Waiting 10 seconds for content to fully load...`);
    await page.waitForTimeout(10000);

    // Strategy 5: Scroll to trigger any lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Strategy 6: Wait for iframe and its content to load
    console.log(`     ⏳ Waiting for iframe content...`);
    await page.waitForTimeout(3000);

    // Get the iframe's content
    const frames = page.frames();
    console.log(`     🔍 Found ${frames.length} frames`);

    // Extract the expected page name from the URL (e.g., "meta_classes.htm")
    const urlParts = url.split('/');
    const expectedPage = urlParts[urlParts.length - 1];

    // Find the frame matching our target URL
    let contentFrame = frames.find(f => f.url().includes(expectedPage));

    if (!contentFrame) {
      // Fallback: find any frame with the base path
      contentFrame = frames.find(f => f.url().includes('atlas.en-us.api_meta') && f !== page.mainFrame());
    }

    if (!contentFrame && frames.length > 1) {
      contentFrame = frames[1]; // Often the second frame is the content
    }

    if (!contentFrame) {
      contentFrame = page.mainFrame(); // Fallback to main frame
    }

    console.log(`     ✓ Using frame: ${contentFrame.url() || 'main'}`);

    // Wait for tables in the iframe
    console.log(`     ⏳ Waiting for tables to stabilize...`);
    let lastTableCount = 0;
    let stableIterations = 0;

    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000);

      const currentTableCount = await contentFrame.evaluate(() => {
        // Helper function to traverse shadow DOMs recursively
        function countTablesIncludingShadowDOM(root: Document | ShadowRoot | Element): number {
          let count = root.querySelectorAll('table').length;

          // Check all elements for shadow roots
          const elements = root.querySelectorAll('*');
          elements.forEach(el => {
            if (el.shadowRoot) {
              count += countTablesIncludingShadowDOM(el.shadowRoot);
            }
          });

          return count;
        }

        return countTablesIncludingShadowDOM(document);
      });

      console.log(`     🔍 Table count: ${currentTableCount}`);

      if (currentTableCount === lastTableCount && currentTableCount > 0) {
        stableIterations++;
        if (stableIterations >= 2) {
          console.log(`     ✓ Content stabilized with ${currentTableCount} tables`);
          break;
        }
      } else {
        stableIterations = 0;
      }

      lastTableCount = currentTableCount;
    }

    // Final check: do we have tables?
    const tableCount = await contentFrame.evaluate(() => {
      function countTablesIncludingShadowDOM(root: Document | ShadowRoot | Element): number {
        let count = root.querySelectorAll('table').length;
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
          if (el.shadowRoot) {
            count += countTablesIncludingShadowDOM(el.shadowRoot);
          }
        });
        return count;
      }
      return countTablesIncludingShadowDOM(document);
    });

    // Optional: Save debug files if DEBUG env var is set
    if (process.env.DEBUG === 'true') {
      const screenshotPath = path.join(__dirname, '../debug-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`     📸 Screenshot saved to: ${screenshotPath}`);

      const htmlPath = path.join(__dirname, '../debug-page.html');
      fs.writeFileSync(htmlPath, await page.content());
      console.log(`     📝 HTML saved to: ${htmlPath}`);
    }

    if (tableCount === 0) {
      console.log(`     ❌ No tables found after all strategies`);
      return { success: false, contentFrame: null };
    }

    console.log(`     ✅ Ready to extract (${tableCount} tables found)`);
    return { success: true, contentFrame };
  } catch (error) {
    console.error(`    Error loading page: ${error}`);
    return { success: false, contentFrame: null };
  }
}

/**
 * Extract metadata from a loaded page (or iframe)
 */
async function extractMetadataFromPage(contentFrame: any, url: string, typeName: string): Promise<MetadataType | null> {
  try {
    // Extract short description
    const shortDescription = await contentFrame.evaluate(() => {
      // Try meta description first
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content')?.trim() || '';
        if (content && content.length > 20) {
          return content;
        }
      }

      // Try first meaningful paragraph
      const allParagraphs = Array.from(document.querySelectorAll('p'));
      for (const p of allParagraphs) {
        const text = p.textContent?.trim() || '';
        if (
          text.length > 50 &&
          !text.toLowerCase().includes('cookie') &&
          !text.toLowerCase().includes('in this section') &&
          !text.toLowerCase().includes('©')
        ) {
          return text;
        }
      }

      return '';
    });

    // Extract fields
    const fields = await contentFrame.evaluate(() => {
      const fieldsData: Array<{
        Description: string;
        'Field Name': string;
        'Field Type': string;
      }> = [];

      // Helper to collect all tables including those in shadow DOMs
      function getAllTablesIncludingShadowDOM(root: Document | ShadowRoot | Element): Element[] {
        const tables: Element[] = Array.from(root.querySelectorAll('table'));

        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
          if (el.shadowRoot) {
            tables.push(...getAllTablesIncludingShadowDOM(el.shadowRoot));
          }
        });

        return tables;
      }

      // Find all tables (including in shadow DOMs)
      const tables = getAllTablesIncludingShadowDOM(document);

      for (const table of tables) {
        // Get headers
        const headerCells = Array.from(table.querySelectorAll('th, thead td'));
        const headers = headerCells.map(cell => cell.textContent?.trim().toLowerCase() || '');

        if (headers.length === 0) continue;

        // Check if this is a fields table
        const hasField = headers.some(h => h.includes('field') || h === 'name');
        const hasType = headers.some(h => h.includes('type'));
        const hasDesc = headers.some(h => h.includes('description') || h.includes('detail'));

        if (!hasField || !hasType || !hasDesc) continue;

        // Find column indices
        const fieldIdx = headers.findIndex(
          h => (h.includes('field') && h.includes('name')) || h === 'field' || h === 'name'
        );
        const typeIdx = headers.findIndex(h => h.includes('type'));
        const descIdx = headers.findIndex(h => h.includes('description') || h.includes('detail'));

        // Extract rows
        const rows = Array.from(table.querySelectorAll('tbody tr, tr:not(:first-child)'));

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));

          if (cells.length < 3) continue;

          const fieldName = cells[fieldIdx >= 0 ? fieldIdx : 0]?.textContent?.trim() || '';
          const fieldType = cells[typeIdx >= 0 ? typeIdx : 1]?.textContent?.trim() || '';
          const description = cells[descIdx >= 0 ? descIdx : 2]?.textContent?.trim() || '';

          if (fieldName && fieldType && description && !fieldName.toLowerCase().includes('field')) {
            fieldsData.push({
              Description: description,
              'Field Name': fieldName,
              'Field Type': fieldType
            });
          }
        }

        if (fieldsData.length > 0) break;
      }

      return fieldsData;
    });

    return {
      fields,
      short_description: shortDescription,
      url
    };
  } catch (error) {
    console.error(`    Error extracting data: ${error}`);
    return null;
  }
}

/**
 * Scrape a single metadata type
 */
async function scrapeMetadataType(
  page: Page,
  name: string,
  url: string,
  isVisible: boolean
): Promise<MetadataType | null> {
  console.log(`  📄 ${name}`);
  console.log(`     Loading: ${url}`);

  const { success, contentFrame } = await loadPageRobustly(page, url);

  if (!success || !contentFrame) {
    console.log(`     ❌ Content failed to load`);
    return null;
  }

  console.log(`     ✓ Content loaded`);

  const result = await extractMetadataFromPage(contentFrame, url, name);

  if (!result || result.fields.length === 0) {
    console.log(`     ⚠️  No fields found`);

    // In visible mode, pause to let user inspect
    if (isVisible) {
      console.log(`     Press Ctrl+C when ready to continue...`);
      await page.waitForTimeout(30000);
    }

    return null;
  }

  console.log(`     ✅ Found ${result.fields.length} fields`);
  return result;
}

/**
 * Discover ALL metadata types from the documentation sidebar
 */
async function discoverMetadataTypes(page: Page): Promise<Array<{ name: string; url: string }>> {
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
    const expectedPage = urlParts[urlParts.length - 1];
    let contentFrame = frames.find(f => f.url().includes(expectedPage)) || page.mainFrame();

    console.log(`   Using frame: ${contentFrame.url()}`);

    // Extract all metadata type links including from Shadow DOM
    const links = await contentFrame.evaluate(() => {
      const metadataLinks: Array<{ name: string; url: string }> = [];

      // Helper to traverse Shadow DOMs
      function findLinks(root: Document | ShadowRoot | Element) {
        const allLinks = Array.from(root.querySelectorAll('a[href]'));

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
            !href.includes('result_objects') &&
            !href.includes('sforce_api') &&
            text.length > 0 &&
            text.length < 100 &&
            !text.toLowerCase().includes('intro') &&
            !text.toLowerCase().includes('overview') &&
            !text.toLowerCase().includes('calls') &&
            !text.toLowerCase().includes('objects');

          if (isMetadataTypePage) {
            const name = text.trim();
            if (name && !metadataLinks.some(ml => ml.url === href)) {
              metadataLinks.push({ name, url: href });
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
      }

      findLinks(document);
      return metadataLinks;
    });

    console.log(`   ✅ Discovered ${links.length} metadata types!\n`);

    return links.length > 0 ? links : getFallbackMetadataTypes();
  } catch (error) {
    console.error(`   ❌ Discovery failed:`, error);
    console.log(`   📋 Using fallback list...\n`);
    return getFallbackMetadataTypes();
  }
}

/**
 * Fallback list of known metadata types (subset for testing)
 */
function getFallbackMetadataTypes(): Array<{ name: string; url: string }> {
  const baseUrl = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/';

  return [
    { name: 'AIApplication', url: `${baseUrl}meta_aiapplication.htm` },
    { name: 'ApexClass', url: `${baseUrl}meta_classes.htm` },
    { name: 'ApexComponent', url: `${baseUrl}meta_apexcomponent.htm` },
    { name: 'ApexPage', url: `${baseUrl}meta_apexpage.htm` },
    { name: 'ApexTrigger', url: `${baseUrl}meta_apextrigger.htm` },
    { name: 'ApprovalProcess', url: `${baseUrl}meta_approvalprocess.htm` },
    { name: 'AssignmentRules', url: `${baseUrl}meta_assignmentrules.htm` },
    { name: 'AuraDefinitionBundle', url: `${baseUrl}meta_auradefinitionbundle.htm` },
    { name: 'AuthProvider', url: `${baseUrl}meta_authprovider.htm` },
    { name: 'AutoResponseRules', url: `${baseUrl}meta_autoresponserules.htm` },
    { name: 'CustomApplication', url: `${baseUrl}meta_customapplication.htm` },
    { name: 'CustomField', url: `${baseUrl}customfield.htm` },
    { name: 'CustomLabel', url: `${baseUrl}meta_customlabels.htm` },
    { name: 'CustomMetadata', url: `${baseUrl}meta_custommetadata.htm` },
    { name: 'CustomObject', url: `${baseUrl}customobject.htm` },
    { name: 'CustomTab', url: `${baseUrl}meta_customtab.htm` },
    { name: 'Dashboard', url: `${baseUrl}meta_dashboard.htm` },
    { name: 'EmailTemplate', url: `${baseUrl}meta_email.htm` },
    { name: 'Flow', url: `${baseUrl}meta_visual_workflow.htm` },
    { name: 'FlowDefinition', url: `${baseUrl}meta_flowdefinition.htm` },
    { name: 'Layout', url: `${baseUrl}meta_layout.htm` },
    { name: 'LightningComponentBundle', url: `${baseUrl}meta_lightningcomponentbundle.htm` },
    { name: 'PermissionSet', url: `${baseUrl}meta_permissionset.htm` },
    { name: 'Profile', url: `${baseUrl}meta_profile.htm` },
    { name: 'QuickAction', url: `${baseUrl}meta_quickaction.htm` },
    { name: 'Report', url: `${baseUrl}meta_report.htm` },
    { name: 'StaticResource', url: `${baseUrl}meta_staticresources.htm` },
    { name: 'ValidationRule', url: `${baseUrl}meta_validationrule.htm` },
    { name: 'Workflow', url: `${baseUrl}meta_workflow.htm` }
  ];
}

/**
 * Main scraping function
 */
async function scrapeAll(outputFile?: string, isVisible: boolean = false): Promise<void> {
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

  // Comprehensive anti-detection
  await page.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Mock chrome object
    (window as any).chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
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

  const results: MetadataMap = {};
  let successCount = 0;
  let failCount = 0;

  // Step 1: Discover all metadata types from documentation
  const metadataTypes = await discoverMetadataTypes(page);

  // Allow testing with a subset
  const testMode = process.env.TEST_MODE === 'true';
  const testLimit = parseInt(process.env.TEST_LIMIT || '3');
  const typesToScrape = testMode ? metadataTypes.slice(0, testLimit) : metadataTypes;

  console.log(`📋 Will scrape ${typesToScrape.length} metadata types${testMode ? ' (TEST MODE)' : ''}\n`);

  try {
    for (let i = 0; i < typesToScrape.length; i++) {
      const type = typesToScrape[i];
      console.log(`[${i + 1}/${typesToScrape.length}] ${type.name}`);

      try {
        const result = await scrapeMetadataType(page, type.name, type.url, isVisible);

        if (result) {
          results[type.name] = result;
          successCount++;
        } else {
          failCount++;
        }

        // Be respectful
        await page.waitForTimeout(2000);
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`);
        failCount++;
        // Try to recover by creating a new page if browser is still alive
        try {
          if (!page.isClosed()) {
            await page.waitForTimeout(1000);
          }
        } catch {
          // Page is closed, continue with next type
        }
      }
    }

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
}

/**
 * Main entry point
 */
async function main() {
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
    `);
    return;
  }

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const isVisible = args.includes('--visible');

  await scrapeAll(outputFile, isVisible);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
