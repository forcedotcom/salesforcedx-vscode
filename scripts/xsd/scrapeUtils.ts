/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Page } from 'playwright';

type MetadataField = {
  Description: string;
  'Field Name': string;
  'Field Type': string;
};

export type MetadataType = {
  fields: MetadataField[];
  short_description: string;
  url: string;
  parent: string;
};

export type MetadataTypesMap = {
  [typeName: string]: MetadataType;
};

/** Browser launch arguments for anti-detection */
export const BROWSER_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--no-first-run',
  '--no-default-browser-check'
];

/**
 * Improved page loading with multiple strategies.
 * Returns the frame containing the actual content (might be an iframe).
 */
export const loadMetadataPage = async (
  page: Page,
  url: string,
  indent: string = '     '
): Promise<{ success: boolean; contentFrame: any }> => {
  try {
    console.log(`${indent.slice(0, -2)}📄 Loading: ${url}`);

    // Step 1: Load page with domcontentloaded
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Step 2: Wait for the main content frame to appear
    console.log(`${indent}⏳ Waiting for content frame...`);

    // Extract the expected page name from the URL (e.g., "meta_classes.htm")
    const urlParts = url.split('/');
    const expectedPage = urlParts.at(-1)!;

    // Wait for iframe elements to be present and loaded in the page
    let contentFrame: any = null;
    let iframePresent = false;

    try {
      // Wait for any iframe to be attached to the DOM
      await page.waitForSelector('iframe', { state: 'attached', timeout: 10_000 });
      iframePresent = true;

      // Wait for the expected iframe to finish loading by monitoring frame navigation
      // Note: We use the frame lifecycle events which are more reliable than fixed timeouts
      const framePromise = page
        .waitForEvent('framenavigated', {
          predicate: frame => frame.url().includes(expectedPage) || frame.url().includes('atlas.en-us.api_meta'),
          timeout: 10_000
        })
        .catch(() => null);

      await framePromise;
    } catch {
      // No iframes or navigation event timeout, will proceed with frame search
    }

    // Get all frames and find the content frame
    const frames = page.frames();
    console.log(`${indent}🔍 Found ${frames.length} frames${iframePresent ? ' (iframes detected)' : ''}`);

    // Find the frame matching our target URL
    contentFrame = frames.find(f => f.url().includes(expectedPage));

    const frameInfo = contentFrame === page.mainFrame() ? 'main frame' : contentFrame.url() || 'unnamed frame';
    console.log(`${indent}✓ Using frame: ${frameInfo}`);

    // Step 3: Wait for tables to appear in the content frame using locators
    console.log(`${indent}⏳ Waiting for tables to appear...`);

    // Create a frame locator for the content frame
    // Note: We still need to use the frame object for evaluate() later, but we can use locators for waiting
    const frameLocator = contentFrame === page.mainFrame() ? page : page.locator('iframe').first().contentFrame();

    try {
      // Wait for at least one table to be visible
      await frameLocator.locator('table').first().waitFor({ state: 'attached', timeout: 20_000 });

      // Count tables in the frame (including shadow DOM)
      const tableCount = await contentFrame.evaluate(getTableCountEvaluator());

      console.log(`${indent}✅ Ready to extract (${tableCount} tables found)`);
    } catch {
      // If waiting for tables times out, try scrolling to trigger lazy loading
      console.log(`${indent}⏳ Tables not immediately visible, trying scroll trigger...`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.evaluate(() => window.scrollTo(0, 0));

      // Wait a bit for lazy-loaded content
      try {
        await frameLocator.locator('table').first().waitFor({ state: 'attached', timeout: 5_000 });
      } catch {
        // Still no tables
      }

      const tableCount = await contentFrame.evaluate(getTableCountEvaluator());

      if (tableCount === 0) {
        console.log(`${indent}❌ No tables found after all strategies`);
        return { success: false, contentFrame: null };
      }
      console.log(`${indent}✅ Found ${tableCount} tables after scroll`);
    }

    return { success: true, contentFrame };
  } catch (error) {
    console.error(`${indent}Error loading page: ${error}`);
    return { success: false, contentFrame: null };
  }

  /** Returns a function that counts tables including those in shadow DOMs when evaluated in browser context */
  function getTableCountEvaluator() {
    return () => {
      const countTablesIncludingShadowDOM = (root: Document | ShadowRoot | Element): number => {
        let count = root.querySelectorAll('table').length;
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
          if (el.shadowRoot) {
            count += countTablesIncludingShadowDOM(el.shadowRoot);
          }
        });
        return count;
      };
      return countTablesIncludingShadowDOM(document);
    };
  }
};

/**
 * Extract metadata from a loaded page (or iframe)
 * Returns an array because some pages have multiple tables representing different types
 */
export const extractMetadataFromPage = async (
  contentFrame: any,
  url: string,
  typeName: string
): Promise<{ name: string; data: MetadataType }[]> => {
  try {
    // Extract fields from ALL tables in a single browser execution (each table is a separate metadata type)
    const extractionResult = await contentFrame.evaluate(() => {
      // Collect all headings on the page from both regular DOM and shadow DOM to identify which types have sections
      const pageHeadings = new Set<string>();
      Array.from(document.querySelectorAll('div.section[id] h2, h1.helpHead1'))
        .concat(collectFromShadowDOM(document, 'div.section[id] h2, h1.helpHead1'))
        .forEach(heading => {
          pageHeadings.add(heading.textContent?.trim());
        });

      const tablesData: {
        fields: {
          Description: string;
          'Field Name': string;
          'Field Type': string;
        }[];
        tableName: string;
        tableDescription: string;
        pageTitle: string;
        pageLevelDescription: string;
      }[] = [];

      // Track which headings have tables associated with them
      const headingsWithTables = new Set<string>();

      // ------------------------------------------------------------
      // EXTRACT PAGE TITLE AND DESCRIPTION
      // ------------------------------------------------------------

      // Get the page title
      const pageTitle = Array.from(pageHeadings).at(0) ?? '';

      // Extract page-level description (for the first table)
      // This is typically the first substantial paragraph(s) after the main H1/H2 but before any tables
      // We collect multiple paragraphs to capture "extends" information that may be in a second paragraph
      let pageLevelDescription = '';
      const collectedParagraphs: string[] = [];

      // Step 1: Look for Salesforce's standard shortdesc div (including in shadow DOM)
      const shortdescDiv = searchInRegularAndShadowDOMs(document, 'div.shortdesc');
      let foundExtendsInShortdesc = false;

      // Collect paragraphs from shortdesc, stopping when we find "extends"
      if (shortdescDiv) {
        const shortdescParagraphs = Array.from(shortdescDiv.querySelectorAll('p'));

        if (shortdescParagraphs.length > 0) {
          // If shortdesc has <p> tags, process them individually to stop at "extends"
          for (const p of shortdescParagraphs) {
            if (isInsideCallout(p)) continue;
            const text = p.textContent?.trim() ?? '';
            // Only collect non-empty paragraphs
            if (text.length > 0) {
              collectedParagraphs.push(text);
              // Stop if this paragraph contains "extends"
              if (text.toLowerCase().includes('extends')) {
                foundExtendsInShortdesc = true;
                break;
              }
            }
          }
        } else {
          // Fallback: if no <p> tags, use the entire shortdesc text content
          const text = shortdescDiv.textContent?.trim() ?? '';
          if (text.length > 0) {
            collectedParagraphs.push(text);
            // Check if it contains "extends"
            if (text.toLowerCase().includes('extends')) {
              foundExtendsInShortdesc = true;
            }
          }
        }
      }

      // Step 2: Look for direct paragraph siblings after shortdesc
      // Collect additional paragraphs until we find one with "extends" (inheritance info)
      // Start from shortdescDiv's next sibling (but skip if we already found "extends")
      const startElement = shortdescDiv?.nextElementSibling;

      if (startElement && !foundExtendsInShortdesc) {
        let current: Element | null = startElement;
        const maxParagraphs = 3; // Safety limit: collect up to 3 paragraphs total
        let foundExtends = false; // Track if we found the "extends" paragraph

        while (current && collectedParagraphs.length < maxParagraphs && !foundExtends) {
          // Stop if we hit a table
          if (current.tagName === 'TABLE') {
            break;
          }

          // Stop if we hit another heading (H2-H6)
          // This prevents collecting paragraphs from subsequent sections like "Retrieving Documents"
          if (current.tagName.match(/^H[2-6]$/)) {
            break;
          }

          // Check if this element or its children have the description
          const checkElement = (el: Element) => {
            if (isInsideCallout(el)) return '';
            return el.textContent?.trim() ?? '';
          };

          // Try the element itself if it's P or DD
          if (current.tagName === 'P' || current.tagName === 'DD') {
            if (checkAndCollectParagraph(current, checkElement, collectedParagraphs, maxParagraphs)) {
              foundExtends = true;
              break;
            }
          }

          // If it's a DIV, iterate through its children in order (but skip callout divs)
          // Stop if we encounter a heading inside the DIV
          if (current.tagName === 'DIV' && !isInsideCallout(current)) {
            for (const child of Array.from(current.children)) {
              if (foundExtends) break; // Stop if we already found extends

              // Stop if we hit a heading inside the DIV
              if (child.tagName.match(/^H[2-6]$/)) {
                break;
              }

              // Check paragraphs directly
              if (child.tagName === 'P' || child.tagName === 'DD') {
                if (checkAndCollectParagraph(child, checkElement, collectedParagraphs, maxParagraphs)) {
                  foundExtends = true;
                  break;
                }
              }

              // Also check for nested P/DD in non-heading containers
              if (child.tagName === 'DIV' && !isInsideCallout(child) && !child.tagName.match(/^H[2-6]$/)) {
                const nestedParagraphs = child.querySelectorAll('p, dd');
                for (const p of Array.from(nestedParagraphs)) {
                  if (foundExtends) break; // Stop if we already found extends
                  if (checkAndCollectParagraph(p, checkElement, collectedParagraphs, maxParagraphs)) {
                    foundExtends = true;
                    break;
                  }
                }
              }
            }
          }

          // If we found "extends" while processing the DIV, stop the main loop
          if (foundExtends) break;

          current = current.nextElementSibling;
        }
      }

      // Join collected paragraphs with space separator
      pageLevelDescription = collectedParagraphs.join(' ');

      // ------------------------------------------------------------
      // EXTRACT METADATA TYPES WITH TABLES
      // ------------------------------------------------------------

      // Find all tables (including in shadow DOMs)
      const allTables = collectFromShadowDOM(document, 'table');

      /** Analyze a table and return its headers and column indices, or null if not a metadata field table */
      const analyzeTable = (
        table: Element
      ): { headers: string[]; fieldIdx: number; typeIdx: number; descIdx: number } | null => {
        const headers = Array.from(table.querySelectorAll('th')).map(cell => cell.textContent?.trim().toLowerCase());

        if (headers.length === 0) return null;

        // Check if this is a fields table
        const hasField = headers.some(isFieldNameColumn);
        const hasType = headers.some(isFieldTypeColumn);
        const hasDesc = headers.some(isDescriptionColumn);

        // Accept tables with all 3 columns OR 2-column format (field name + description)
        const isTraditionalFormat = hasField && hasType && hasDesc;
        const isNestedFormat = headers.length === 2 && hasField && hasDesc;

        if (!isTraditionalFormat && !isNestedFormat) return null;

        // Find column indices
        const fieldIdx = headers.findIndex(isFieldNameColumn);
        const typeIdx = headers.findIndex(isFieldTypeColumn);
        const descIdx = headers.findIndex(isDescriptionColumn);

        return { headers, fieldIdx, typeIdx, descIdx };

        /** Check if header matches field name column */
        function isFieldNameColumn(h: string): boolean {
          return h === 'field name' || h === 'field' || h === 'filed name' || h === 'name';
        }

        /** Check if header matches field type column */
        function isFieldTypeColumn(h: string): boolean {
          return h === 'field type' || h === 'type';
        }

        /** Check if header matches description column */
        function isDescriptionColumn(h: string): boolean {
          return h === 'description' || h === 'descriptions' || h === 'details';
        }
      };

      // Analyze all tables and filter out invalid ones
      const analyzedTables = allTables
        .map(table => ({ table: table as HTMLTableElement, analysis: analyzeTable(table) }))
        .filter(({ analysis }) => analysis !== null) as {
        table: HTMLTableElement;
        analysis: { headers: string[]; fieldIdx: number; typeIdx: number; descIdx: number };
      }[];

      for (const { table, analysis } of analyzedTables) {
        const { fieldIdx, typeIdx, descIdx } = analysis;

        // Try to find a table name and description
        const heading = findHeadingBefore(table.parentElement);
        const tableName = heading?.textContent?.trim() ?? '';
        const tableDescription = heading ? findDescriptionAfterHeading(heading) : '';

        // Extract rows for this table
        const allRows = Array.from(table.querySelectorAll('tbody tr'));

        const tableFields: {
          Description: string;
          'Field Name': string;
          'Field Type': string;
        }[] = [];

        for (const row of allRows) {
          const cells = Array.from(row.querySelectorAll('td'));

          const fieldName = cells[fieldIdx]?.textContent?.trim();
          let fieldType = '';
          let description = '';

          // Try traditional 3-column format first
          if (cells.length >= 3 && typeIdx >= 0 && descIdx >= 0) {
            fieldType = cells[typeIdx]?.textContent?.trim();
            description = cells[descIdx]?.textContent?.trim();
          }
          // Try nested format (2 columns: Field Name, then nested Field Type + Description)
          else {
            const secondCell = cells[1];

            // Find fieldType: Look for <dt>Field Type</dt><dd>TYPE</dd> structure
            fieldType = extractFromDtDd(secondCell, ['field type', 'type'], false);

            // Find description: Look for <dt>Description</dt><dd>DESC</dd> structure
            description = extractFromDtDd(secondCell, ['description', 'desc'], true);

            // Fallback - get all text that looks like description content
            if (!description) {
              const fullText = secondCell.textContent;
              const lines = fullText
                .split('\n')
                .map(l => l.trim())
                .filter(l => l);
              // Collect all lines that look like description content (not headers)
              const descriptionLines: string[] = [];
              for (const line of lines) {
                const lowerLine = line.toLowerCase();
                // Skip header-like lines and the field type itself
                if (
                  line.length > 0 &&
                  !lowerLine.includes('field type') &&
                  !lowerLine.includes('description') &&
                  line !== fieldType
                ) {
                  descriptionLines.push(line);
                }
              }
              // Join all description lines with a space
              description = descriptionLines.join(' ');
            }
          }

          if (fieldName || fieldType || description) {
            tableFields.push({
              Description: description,
              'Field Name': fieldName,
              'Field Type': fieldType
            });
          }
        }

        // Only add this table if it has fields
        tablesData.push({
          fields: tableFields,
          tableName,
          tableDescription,
          pageTitle,
          pageLevelDescription
        });

        // Track that this heading has a table
        if (tableName) headingsWithTables.add(tableName);
      }

      // ------------------------------------------------------------
      // EXTRACT METADATA TYPES WITHOUT TABLES
      // ------------------------------------------------------------

      // Now process headings that don't have tables but have descriptions
      const headingsWithoutTables: {
        headingName: string;
        description: string;
      }[] = [];

      // Skip headings that have tables or contain spaces (those are typically section headers, not metadata types)
      const headingsWithoutTablesFiltered = Array.from(pageHeadings).filter(
        headingText => !headingsWithTables.has(headingText) && !headingText.includes(' ')
      );

      // Process all headings that don't have tables
      for (const headingText of headingsWithoutTablesFiltered) {
        // Find the heading element in the DOM (including shadow DOMs)
        const headingElement = searchInRegularAndShadowDOMs(
          document,
          'div.section[id] h2, h1.helpHead1',
          el => el.textContent?.trim() === headingText
        );

        if (!headingElement) continue;

        // Look for a description paragraph right after the heading
        const description = findDescriptionAfterHeading(headingElement);

        if (description) {
          headingsWithoutTables.push({
            headingName: headingText,
            description
          });
        }
      }

      return {
        tablesData,
        pageHeadings: Array.from(pageHeadings),
        headingsWithoutTables
      };

      // ============================================================================
      // Helper Functions (defined at bottom for hoisting with function declarations)
      // ============================================================================

      /** Helper to check if an element is a callout/note container */
      function isCalloutElement(el: Element): boolean {
        return el.tagName?.toLowerCase().includes('callout') ?? false;
      }

      /** Helper to check if an element is inside a note/callout div */
      function isInsideCallout(el: Element): boolean {
        let current: Element | null = el;
        do {
          if (isCalloutElement(current)) return true;
          current = current.parentElement;
        } while (current);
        return false;
      }

      /** Search for elements in regular DOM and shadow DOMs with optional filter predicate */
      function searchInRegularAndShadowDOMs<T extends Element>(
        root: Document | ShadowRoot | Element,
        selector: string,
        filterPredicate?: (el: Element) => boolean
      ): T | null {
        // Try regular DOM first - filter matching elements
        const elements = Array.from(root.querySelectorAll(selector));
        const filtered = filterPredicate ? elements.filter(filterPredicate) : elements;
        if (filtered.length > 0) return filtered[0] as T;

        // Search shadow DOMs recursively
        const allElements = root.querySelectorAll('*');
        for (const el of Array.from(allElements)) {
          if (el.shadowRoot) {
            const found = searchInRegularAndShadowDOMs<T>(el.shadowRoot, selector, filterPredicate);
            if (found) return found;
          }
        }

        return null;
      }

      /** Helper to collect all elements matching selector including those in shadow DOMs */
      function collectFromShadowDOM<T extends Element>(root: Document | ShadowRoot | Element, selector: string): T[] {
        const results: T[] = Array.from(root.querySelectorAll(selector)) as T[];

        const elements = root.querySelectorAll('*');
        for (const el of Array.from(elements)) {
          if (el.shadowRoot) results.push(...collectFromShadowDOM<T>(el.shadowRoot, selector));
        }

        return results;
      }

      /** Helper to check element and add to collected paragraphs if valid, returns true if "extends" was found */
      function checkAndCollectParagraph(
        element: Element,
        checkElement: (el: Element) => string,
        collectedParagraphs: string[],
        maxParagraphs: number
      ): boolean {
        const desc = checkElement(element);
        if (desc && collectedParagraphs.length < maxParagraphs) {
          collectedParagraphs.push(desc);
          // Stop collecting if this paragraph contains "extends"
          if (desc.toLowerCase().includes('extends')) return true;
        }
        return false;
      }

      /** Helper to find description paragraph after a heading element */
      function findDescriptionAfterHeading(headingElement: Element): string {
        let description = '';
        let nextElement = headingElement.nextElementSibling;

        console.log(`Looking for description after heading: ${headingElement.textContent?.trim()}`);

        while (nextElement) {
          const tagName = nextElement.tagName;
          console.log(`  Found tag ${tagName}, class: ${nextElement.className}`);

          // Stop if we hit a table (when specified)
          if (tagName === 'TABLE') {
            console.log('    Stopped at TABLE');
            break;
          }

          // Stop if we hit another heading
          if (tagName?.match(/^H[1-6]$/)) {
            console.log('    Stopped at next heading');
            break;
          }

          // Look for a paragraph with meaningful content
          if (tagName === 'P') {
            if (!isInsideCallout(nextElement)) {
              const text = nextElement.textContent?.trim() ?? '';
              console.log(`    Checking P content: "${text.substring(0, 50)}..."`);
              // Only accept non-empty descriptions
              if (text.length > 0) {
                description = text;
                console.log('    ✅ Found valid description');
                break;
              }
            } else {
              console.log('    Skipping P inside callout');
            }
          }

          // Check inside DIVs for paragraphs (but skip callout divs)
          if (tagName === 'DIV' && !isInsideCallout(nextElement)) {
            // Skip if the DIV itself is a callout
            if (isCalloutElement(nextElement)) {
              console.log('    Skipping Callout DIV');
              nextElement = nextElement.nextElementSibling;
              continue;
            }

            // Iterate all paragraphs in the DIV
            const paragraphs = Array.from(nextElement.querySelectorAll('p'));
            let foundInDiv = false;
            for (const p of paragraphs) {
              if (!isInsideCallout(p)) {
                const text = p.textContent?.trim() ?? '';
                console.log(`    Checking P inside DIV: "${text.substring(0, 50)}..."`);
                // Only accept non-empty descriptions
                if (text.length > 0) {
                  description = text;
                  console.log('    ✅ Found valid description inside DIV');
                  foundInDiv = true;
                  break;
                }
              }
            }
            if (foundInDiv) break;

            // Fallback: Check direct text content if no valid P found
            const hasComplexChildren = nextElement.querySelector('table, h1, h2, h3, h4, h5, h6');
            if (!hasComplexChildren) {
              // Clone to verify text without callouts (avoids "combined text" issue)
              const clone = nextElement.cloneNode(true) as Element;
              const allElements = Array.from(clone.querySelectorAll('*'));
              for (const el of allElements) {
                if (isCalloutElement(el)) {
                  el.remove();
                }
              }

              const text = clone.textContent?.trim() ?? '';
              console.log(`    Checking DIV text content: "${text.substring(0, 50)}..."`);
              // Only accept non-empty descriptions
              if (text.length > 0) {
                description = text;
                console.log('    ✅ Found valid description from DIV text');
                break;
              }
            }
          }

          nextElement = nextElement.nextElementSibling;
        }

        return description;
      }

      /** Helper to find heading element before a given element */
      function findHeadingBefore(startElement: Element | null): Element | null {
        if (!startElement) return null;

        let current = startElement.previousElementSibling;

        while (current) {
          if (current.tagName.match(/^H[1-6]$/)) return current;
          current = current.previousElementSibling;
        }

        return null;
      }

      /** Helper to extract value from DT/DD structure */
      function extractFromDtDd(container: Element, labelMatches: string[], collectMultiple: boolean = false): string {
        const dtElements = Array.from(container.querySelectorAll('dt'));

        for (const dt of dtElements) {
          const dtText = dt.textContent?.trim().toLowerCase() ?? '';

          // Check if this DT matches any of the label patterns
          if (!labelMatches.some(label => dtText.includes(label.toLowerCase()))) continue;

          // Collect DD siblings until the next DT
          const parts: string[] = [];
          let current = dt.nextElementSibling;

          while (current && current.tagName !== 'DT') {
            if (current.tagName === 'DD') {
              const ddText = current.textContent?.trim();
              if (ddText) {
                parts.push(ddText);
                if (!collectMultiple) return ddText; // Early return for single value
              }
            }
            current = current.nextElementSibling;
          }

          if (parts.length > 0) return collectMultiple ? parts.join('\n\n') : parts[0];
        }

        return '';
      }
    });

    // Create a separate metadata type entry for each table
    const results: { name: string; data: MetadataType }[] = [];
    const allTableFields = extractionResult.tablesData;
    const pageHeadingsSet = new Set<string>(extractionResult.pageHeadings as string[]);

    console.log('All table fields:', JSON.stringify(allTableFields, null, 2));
    console.log('Page headings set:', JSON.stringify(Array.from(pageHeadingsSet), null, 2));
    console.log('Headings without tables:', JSON.stringify(extractionResult.headingsWithoutTables, null, 2));

    // If no tables and no headings without tables, return empty
    if (allTableFields.length === 0 && !extractionResult.headingsWithoutTables?.length) return [];

    // If only one table, always use the page title or typeName (the table represents the main type)
    if (allTableFields.length === 1) {
      const tableData = allTableFields[0];
      const finalName = tableData.pageTitle ?? typeName;

      // For the only table, always use page-level description first (just like we always use page title)
      const description = tableData.pageLevelDescription ?? tableData.tableDescription;

      // Clean up all field descriptions and types
      const cleanedFields = tableData.fields.map(field => ({
        ...field,
        Description: cleanDescription(field.Description),
        'Field Type': cleanDescription(field['Field Type'])
      }));

      const cleanedDescription = cleanDescription(description);
      results.push({
        name: finalName,
        data: {
          fields: cleanedFields,
          short_description: cleanedDescription,
          url: url.split('#')[0], // Strip hash fragment if present
          parent: extractParentType(cleanedDescription, cleanedFields)
        }
      });
      console.log('Newest entry ONE TABLE:', JSON.stringify(results.at(-1), null, 2));
    } else {
      // Multiple tables - use actual table names or infer from field types
      for (let i = 0; i < allTableFields.length; i++) {
        const tableData = allTableFields[i];

        let finalName: string;

        // For the first table, ignore generic headings and use the page title/typeName
        if (i === 0) {
          // Generic headings that should be ignored for the first table
          const genericHeadings = ['fields', 'field name', 'properties', 'attributes'];
          const isGenericHeading = tableData.tableName && genericHeadings.includes(tableData.tableName.toLowerCase());

          if (isGenericHeading || !tableData.tableName) {
            // Use page title or fall back to typeName
            finalName = tableData.pageTitle ?? typeName;
          } else {
            // Use the specific table name if it's not generic
            finalName = tableData.tableName;
          }
        } else if (tableData.tableName) {
          // For subsequent tables, use the found table name
          finalName = tableData.tableName;
        } else if (i > 0) {
          // Try to infer name from types in previous tables (both arrays and complex types)
          let inferredName: string | null = null;

          // Collect candidate type names from previous tables
          // Process tables in REVERSE order to prioritize more recent types
          const arrayTypes: string[] = [];
          const complexTypes: string[] = [];

          for (let j = i - 1; j >= 0; j--) {
            const prevTable = allTableFields[j];
            for (const field of prevTable.fields) {
              const fieldType = field['Field Type'];

              // Collect array types (higher priority)
              const arrayType = extractArrayTypeName(fieldType);
              if (arrayType) {
                arrayTypes.push(arrayType);
              }

              // Collect complex types (lower priority)
              const complexType = extractComplexTypeName(fieldType);
              if (complexType) {
                complexTypes.push(complexType);
              }
            }
          }

          // Prioritize: arrays from recent tables, then complex types from recent tables
          const candidateTypes = [...arrayTypes, ...complexTypes];

          // Find the first unused candidate type
          for (const candidate of candidateTypes) {
            const alreadyUsed = results.some(r => r.name === candidate);
            if (!alreadyUsed) {
              inferredName = candidate;
              break;
            }
          }

          finalName = inferredName ?? `${typeName} (Table ${i + 1})`;
        } else {
          finalName = `${typeName} (Table ${i + 1})`;
        }

        // For the first table, always use page-level description first (just like we always use page title)
        // For subsequent tables, only use table-specific descriptions
        const description =
          i === 0 ? (tableData.pageLevelDescription ?? tableData.tableDescription) : tableData.tableDescription;

        // Clean up all field descriptions and types
        const cleanedFields = tableData.fields.map(field => ({
          ...field,
          Description: cleanDescription(field.Description),
          'Field Type': cleanDescription(field['Field Type'])
        }));

        const cleanedDescription = cleanDescription(description);
        results.push({
          name: finalName,
          data: {
            fields: cleanedFields,
            short_description: cleanedDescription,
            url: url.split('#')[0], // Strip hash fragment if present (all tables share the same base URL)
            parent: extractParentType(cleanedDescription, cleanedFields)
          }
        });
        console.log('Newest entry MULTIPLE TABLES:', JSON.stringify(results.at(-1), null, 2));
      }
    }

    // After extracting all tables, identify referenced types that don't have their own tables
    // BUT only if they have a heading on the page (indicating they have their own section)
    const extractedTypeNames = new Set(results.map(r => r.name));
    const referencedTypes = new Set<string>();

    // Helper function to check if a type name matches any heading on the page
    const hasHeadingOnPage = (typeName: string): boolean => {
      const lowerTypeName = typeName.toLowerCase();
      for (const heading of Array.from(pageHeadingsSet)) {
        if (heading.toLowerCase() === lowerTypeName) {
          return true;
        }
      }
      return false;
    };

    // Collect all referenced types from field types
    for (const result of results) {
      for (const field of result.data.fields) {
        const fieldType = field['Field Type'];

        // Check for array types (e.g., "SharingTerritoryRule[]")
        const arrayType = extractArrayTypeName(fieldType);
        if (arrayType && !extractedTypeNames.has(arrayType) && hasHeadingOnPage(arrayType)) {
          referencedTypes.add(arrayType);
        }

        // Check for complex types (e.g., "SharedTo")
        const complexType = extractComplexTypeName(fieldType);
        if (complexType && !extractedTypeNames.has(complexType) && hasHeadingOnPage(complexType)) {
          referencedTypes.add(complexType);
        }
      }
    }

    // Add entries for referenced types with empty fields arrays
    // These are types that have a heading/section on the page but no field table
    for (const referencedType of Array.from(referencedTypes)) {
      console.log(`     ℹ️  Adding referenced type without fields: ${referencedType}`);
      const refDescription = `Referenced type from ${url}`;
      results.push({
        name: referencedType,
        data: {
          fields: [],
          short_description: refDescription,
          url: url.split('#')[0],
          parent: extractParentType(refDescription, [])
        }
      });
    }

    // Process headings without tables
    if (extractionResult.headingsWithoutTables && extractionResult.headingsWithoutTables.length > 0) {
      for (const heading of extractionResult.headingsWithoutTables) {
        // Check if we already have an entry for this heading name
        const existingEntry = results.find(r => r.name === heading.headingName);
        if (existingEntry) {
          // Update the existing entry if it only has a generic "Referenced type" description
          if (existingEntry.data.short_description.startsWith('Referenced type from')) {
            const cleanedDesc = cleanDescription(heading.description);
            existingEntry.data.short_description = cleanedDesc;
            existingEntry.data.parent = extractParentType(cleanedDesc, existingEntry.data.fields);
            console.log('Updated entry HEADING WITHOUT TABLE:', JSON.stringify(existingEntry, null, 2));
          }
          continue;
        }

        // Create a new entry with no fields but with the description
        const cleanedHeadingDesc = cleanDescription(heading.description);
        results.push({
          name: heading.headingName,
          data: {
            fields: [],
            short_description: cleanedHeadingDesc,
            url: url.split('#')[0], // Strip hash fragment if present
            parent: extractParentType(cleanedHeadingDesc, [])
          }
        });
        console.log('Newest entry HEADING WITHOUT TABLE:', JSON.stringify(results.at(-1), null, 2));
      }
    }

    // Special handling for Folder metadata type
    // Replace the generic "Folder" entry with 5 specific folder types
    if (url.includes('meta_folder.htm')) {
      const folderIndex = results.findIndex(r => r.name === 'Folder');
      if (folderIndex !== -1) {
        const folderEntry = results[folderIndex];
        const folderTypes = ['DocumentFolder', 'EmailFolder', 'EmailTemplateFolder', 'ReportFolder', 'DashboardFolder'];

        // Remove the original Folder entry
        results.splice(folderIndex, 1);

        // Add 5 specific folder type entries with the same description and fields
        for (const folderType of folderTypes) {
          results.push({
            name: folderType,
            data: {
              fields: folderEntry.data.fields,
              short_description: folderEntry.data.short_description,
              url: folderEntry.data.url,
              parent: folderEntry.data.parent
            }
          });
          console.log(`Added specific folder type: ${folderType}`);
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`    Error extracting data: ${error}`);
    return [];
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Clean up description text by normalizing whitespace */
const cleanDescription = (text: string): string => {
  if (!text) return text;

  // Replace \n followed by any number of spaces or tabs with a single space
  return text
    .replaceAll(/\n[\s\t]+/g, ' ')
    .replaceAll(/\s+/g, ' ') // Also normalize multiple spaces to single space
    .trim();
};

/** Extract parent metadata type from description and fields (defaults to "Metadata" if not found) */
const extractParentType = (description: string, fields?: MetadataField[]): string => {
  if (!description && (!fields || fields.length === 0)) return 'Metadata';

  // Look for patterns in description like:
  // - "extends SharingBaseRule"
  // - "It extends MetadataWithContent"
  // - "This type extends the MetadataWithContent metadata type"
  const extendsMatch = description.match(/\bextends\s+(?:the\s+)?([A-Z][a-zA-Z0-9_]+)(?:\s+metadata\s+type)?/);
  if (extendsMatch && extendsMatch[1]) return extendsMatch[1];

  // Check field descriptions for inheritance information
  // Look for patterns like "inherited from the MetadataWithContent component"
  if (fields && fields.length > 0) {
    for (const field of fields) {
      const inheritedMatch = field.Description?.match(
        /inherited from (?:the\s+)?([A-Z][a-zA-Z0-9_]+)(?:\s+component|\s+metadata\s+type)?/i
      );
      if (inheritedMatch && inheritedMatch[1]) return inheritedMatch[1];
    }
  }

  // Default to base Metadata type
  return 'Metadata';
};

/** Extract type name from array notation (e.g., "AssignmentRule[]" -> "AssignmentRule") */
const extractArrayTypeName = (fieldType: string): string | null => {
  // Remove zero-width characters that might be in the type name
  const cleanType = fieldType.replaceAll(/[\u200B-\u200D\uFEFF]/g, '');
  const match = cleanType.match(/^([A-Z][a-zA-Z0-9_]+)\[\]$/);
  return match ? match[1] : null;
};

/** Extract complex type names (non-primitive types without []) */
const extractComplexTypeName = (fieldType: string): string | null => {
  // Skip enumeration types entirely - they don't represent table structures
  if (fieldType.toLowerCase().includes('enumeration')) return null;

  // Clean up the field type - remove enumeration info and extra spaces
  let cleanType = fieldType.split('(')[0].trim();

  // Remove any zero-width or special Unicode characters
  cleanType = cleanType.replaceAll(/[\u200B-\u200D\uFEFF]/g, '');

  // Match types that start with capital letter and are not primitives
  const primitives = ['string', 'boolean', 'int', 'double', 'date', 'datetime', 'long'];
  if (primitives.includes(cleanType.toLowerCase())) return null;

  // Match capitalized type names (but not array notation)
  // Allow underscores and be more flexible with the pattern
  const match = cleanType.match(/^([A-Z][a-zA-Z0-9_]+)$/);
  return match ? match[1] : null;
};
