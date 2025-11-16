/**
 * Robust Metadata API scraper with improved content loading
 * Produces JSON output identical to metadata_types_map.json
 *
 * Usage:
 *   npm run scrape:robust
 *   npm run scrape:robust -- --output custom-output.json
 *   npm run scrape:robust -- --visible  (runs with visible browser for debugging)
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loadPageRobustly, extractMetadataFromPage, MetadataType } from './scrapeUtils';

interface MetadataMap {
  [key: string]: MetadataType;
}

/**
 * Scrape a single metadata type (may return multiple if page has multiple tables)
 */
async function scrapeMetadataType(
  page: Page,
  name: string,
  url: string,
  isVisible: boolean
): Promise<Array<{ name: string; data: MetadataType }>> {
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
      function findLinks(root: Document | ShadowRoot | Element) {
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
      }

      findLinks(document);
      return metadataLinks;
    });

    console.log(`   ✅ Discovered ${links.length} metadata types!\n`);

    // Print all discovered metadata types for verification
    if (links.length > 0) {
      console.log('   📋 Discovered metadata types:');
      links.forEach((link, index) => {
        console.log(`      ${index + 1}. ${link.name}`);
      });
      console.log('');
    }

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
  const testAssignmentRulesOnly = process.env.TEST_ASSIGNMENT_RULES_ONLY === 'true';
  const testLimit = parseInt(process.env.TEST_LIMIT || '3');

  let typesToScrape = metadataTypes;

  if (testAssignmentRulesOnly) {
    // Filter for just AssignmentRules
    typesToScrape = metadataTypes.filter(t => t.name === 'AssignmentRules');
    if (typesToScrape.length === 0) {
      console.log('⚠️  AssignmentRules not found, using fallback');
      typesToScrape = [
        {
          name: 'AssignmentRules',
          url: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_assignmentrules.htm'
        }
      ];
    }
  } else if (testMode) {
    typesToScrape = metadataTypes.slice(0, testLimit);
  }

  console.log(
    `📋 Will scrape ${typesToScrape.length} metadata types${testMode || testAssignmentRulesOnly ? ' (TEST MODE)' : ''}\n`
  );

  try {
    for (let i = 0; i < typesToScrape.length; i++) {
      const type = typesToScrape[i];
      console.log(`[${i + 1}/${typesToScrape.length}] ${type.name}`);

      try {
        const pageResults = await scrapeMetadataType(page, type.name, type.url, isVisible);

        if (pageResults.length > 0) {
          // Add each table result as a separate entry
          for (const { name, data } of pageResults) {
            results[name] = data;
          }
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
