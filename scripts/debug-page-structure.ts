/**
 * Debug script to inspect the structure of a Salesforce documentation page
 */

import { chromium } from 'playwright';

async function debugPageStructure(url: string) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(3000);

    const pageInfo = await page.evaluate(() => {
      const info: any = {
        title: document.title,
        mainSelectors: {},
        tables: [],
        paragraphs: []
      };

      // Check for common main content selectors
      const mainSelectors = ['main', '.content', '#content', 'article', '.article', '.doc-content'];
      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        info.mainSelectors[selector] = element ? 'Found' : 'Not found';
      }

      // Get info about all tables
      const tables = Array.from(document.querySelectorAll('table'));
      info.tables = tables.map((table, idx) => {
        const headers = Array.from(table.querySelectorAll('th')).map((th: any) => th.textContent?.trim() || '');
        const rowCount = table.querySelectorAll('tbody tr').length;
        const className = table.className;
        const id = table.id;

        return {
          index: idx,
          className,
          id,
          headers,
          rowCount,
          location: table.closest('main') ? 'in main' : table.closest('.content') ? 'in .content' : 'other'
        };
      });

      // Get first few paragraphs
      const allParagraphs = Array.from(document.querySelectorAll('p'));
      info.paragraphs = allParagraphs.slice(0, 10).map((p: any, idx) => {
        const text = p.textContent?.trim() || '';
        return {
          index: idx,
          length: text.length,
          preview: text.substring(0, 100),
          location: p.closest('main') ? 'in main' : p.closest('.content') ? 'in .content' : 'other'
        };
      });

      // Check for specific content
      info.h1Text = document.querySelector('h1')?.textContent?.trim();
      info.totalParagraphs = allParagraphs.length;
      info.totalTables = tables.length;

      return info;
    });

    console.log('\n=== PAGE STRUCTURE DEBUG ===\n');
    console.log('Title:', pageInfo.title);
    console.log('\nH1:', pageInfo.h1Text);
    console.log('\nMain Content Selectors:');
    for (const [selector, status] of Object.entries(pageInfo.mainSelectors)) {
      console.log(`  ${selector}: ${status}`);
    }

    console.log(`\nTotal Paragraphs: ${pageInfo.totalParagraphs}`);
    console.log('\nFirst Paragraphs:');
    pageInfo.paragraphs.forEach((p: any) => {
      console.log(`  [${p.index}] (${p.location}) Length: ${p.length}`);
      console.log(`      Preview: ${p.preview}${p.preview.length >= 100 ? '...' : ''}`);
    });

    console.log(`\nTotal Tables: ${pageInfo.totalTables}`);
    console.log('\nTables:');
    pageInfo.tables.forEach((t: any) => {
      console.log(`  [${t.index}] (${t.location})`);
      if (t.className) console.log(`      Class: ${t.className}`);
      if (t.id) console.log(`      ID: ${t.id}`);
      console.log(`      Headers: ${JSON.stringify(t.headers)}`);
      console.log(`      Rows: ${t.rowCount}`);
    });

    console.log('\n=== END DEBUG ===\n');
    console.log('Browser will remain open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

const url =
  process.argv[2] || 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm';
debugPageStructure(url).catch(console.error);
