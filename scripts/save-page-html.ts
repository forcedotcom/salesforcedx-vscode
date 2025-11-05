import { chromium } from 'playwright';
import * as fs from 'fs';

async function savePageHTML(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Handle cookie consent
    try {
      const acceptButton = page.locator(
        'button:has-text("Accept"), button:has-text("Accept All"), button:has-text("Agree")'
      );
      await acceptButton.click({ timeout: 3000 });
      console.log('Accepted cookies');
      await page.waitForTimeout(1000);
    } catch {
      console.log('No cookie banner found');
    }

    // Wait for tables to load
    try {
      await page.waitForSelector('table', { timeout: 15000 });
      console.log('Table found');
    } catch {
      console.log('No table found');
    }

    await page.waitForTimeout(3000);

    const html = await page.content();
    const outputPath = '/Users/daphne.yang/Development/salesforcedx-vscode-4/page-dump.html';
    fs.writeFileSync(outputPath, html);
    console.log(`HTML saved to: ${outputPath}`);
    console.log(`HTML length: ${html.length} characters`);

    // Also take a screenshot
    await page.screenshot({
      path: '/Users/daphne.yang/Development/salesforcedx-vscode-4/page-screenshot.png',
      fullPage: true
    });
    console.log('Screenshot saved');
  } finally {
    await browser.close();
  }
}

savePageHTML('https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm').catch(
  console.error
);
