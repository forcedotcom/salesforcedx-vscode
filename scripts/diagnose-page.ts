/**
 * Diagnostic script to see what's actually on the Salesforce docs pages
 */

import { chromium } from 'playwright';
import * as fs from 'fs';

async function diagnosePage(url: string) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log(`Loading: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for various possible states
    await Promise.race([page.waitForLoadState('networkidle'), page.waitForTimeout(10000)]).catch(() => {});

    // Wait longer
    console.log('Waiting for content...');
    await page.waitForTimeout(10000);

    // Take screenshot
    await page.screenshot({ path: 'diagnosis-screenshot.png', fullPage: true });
    console.log('Screenshot saved to diagnosis-screenshot.png');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('diagnosis-page.html', html);
    console.log(`HTML saved to diagnosis-page.html (${html.length} bytes)`);

    // Analyze content
    const analysis = await page.evaluate(() => {
      return {
        title: document.title,
        hasMain: !!document.querySelector('main'),
        tableCount: document.querySelectorAll('table').length,
        paragraphCount: document.querySelectorAll('p').length,
        h1Text: document.querySelector('h1')?.textContent?.trim(),
        h2Texts: Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()),
        firstTableHeaders: Array.from(document.querySelector('table')?.querySelectorAll('th') || []).map(th =>
          th.textContent?.trim()
        ),
        bodyClasses: document.body.className,
        mainContent: document.querySelector('main')?.textContent?.substring(0, 500)
      };
    });

    console.log('\n=== Page Analysis ===');
    console.log(JSON.stringify(analysis, null, 2));

    console.log('\nBrowser will stay open for 2 minutes for inspection...');
    await page.waitForTimeout(120000);
  } finally {
    await browser.close();
  }
}

const url =
  process.argv[2] || 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm';
diagnosePage(url).catch(console.error);
