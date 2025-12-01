/**
 * Single-page metadata scraper for debugging
 *
 * Usage:
 *   npm run scrape:single:page -- <URL>
 *   npm run scrape:single:page -- <URL> --visible
 *   npm run scrape:single:page -- https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loadMetadataPage, extractMetadataFromPage } from './scrapeUtils';

/** Main function */
const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Single-Page Metadata Scraper

Usage:
  npm run scrape:single:page -- <URL>                   # Scrape a single page
  npm run scrape:single:page -- <URL> --visible         # With visible browser
  npm run scrape:single:page -- <URL> --output out.json # Custom output file

Example:
  npm run scrape:single:page -- https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm

Options:
  --visible        Run with visible browser (useful for debugging)
  --output <file>  Custom output file path (defaults to debug-output.json)
  --help           Show this help
    `);
    return;
  }

  const url = args.find(arg => arg.startsWith('http'));
  if (!url) {
    console.error('❌ Error: No URL provided');
    process.exit(1);
  }

  const isVisible = args.includes('--visible');
  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : path.join(__dirname, 'debug-output.json');

  console.log(`🚀 Single-Page Metadata Scraper${isVisible ? ' (VISIBLE MODE)' : ''}`);
  console.log(`🔗 URL: ${url}\n`);

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

  try {
    const { success, contentFrame } = await loadMetadataPage(page, url, '   ');

    if (!success || !contentFrame) {
      console.log(`\n❌ Failed to load page content`);
      if (isVisible) {
        console.log(`\nBrowser will stay open for 30 seconds for inspection...`);
        await page.waitForTimeout(30000);
      }
      await browser.close();
      process.exit(1);
    }

    // Extract type name from URL
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const typeName = fileName.replace('.htm', '').replace('meta_', '');

    const results = await extractMetadataFromPage(contentFrame, url, typeName);

    if (results.length === 0) {
      console.log(`\n❌ No metadata extracted`);
      if (isVisible) {
        console.log(`\nBrowser will stay open for 30 seconds for inspection...`);
        await page.waitForTimeout(30000);
      }
    } else {
      // Save results
      const output = Object.fromEntries(results.map(({ name, data }) => [name, data]));

      fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
      console.log(`\n💾 Output saved to: ${outputFile}`);
      console.log(`✅ Done!`);

      if (isVisible) {
        console.log(`\nBrowser will stay open for 10 seconds...`);
        await page.waitForTimeout(10000);
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (isVisible) {
      console.log(`\nBrowser will stay open for 30 seconds for inspection...`);
      await page.waitForTimeout(30000);
    }
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
