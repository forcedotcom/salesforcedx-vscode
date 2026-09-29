/**
 * Single-page metadata scraper for debugging
 *
 * Usage:
 *   pnpm scrape:single:page <URL>
 *   pnpm scrape:single:page <URL> --visible
 *   pnpm scrape:single:page https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loadMetadataPage, extractMetadataFromPage, BROWSER_LAUNCH_ARGS, createBrowserContext } from './scrapeUtils';

/** Main function */
const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Single-Page Metadata Scraper

Usage:
  pnpm scrape:single:page <URL>                   # Scrape a single page
  pnpm scrape:single:page <URL> --visible         # With visible browser
  pnpm scrape:single:page <URL> --output out.json # Custom output file

Example:
  pnpm scrape:single:page https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm

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

  const browser: Browser = await chromium.launch({
    headless: !isVisible,
    args: BROWSER_LAUNCH_ARGS
  });

  const context: BrowserContext = await createBrowserContext(browser);
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
