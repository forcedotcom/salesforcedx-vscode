/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Frame, Page } from 'playwright';

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
): Promise<{ success: boolean; contentFrame: Frame | null }> => {
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
    let contentFrame: Frame;
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

    // Find the frame matching our target URL, fall back to main frame if not found
    contentFrame = frames.find(f => f.url().includes(expectedPage)) ?? page.mainFrame();

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
  contentFrame: Frame,
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

      // Collect the first paragraph from shortdesc as the main description
      if (shortdescDiv) {
        // Look for both <p> tags and <div class="p"> paragraph containers
        const shortdescParagraphs = Array.from(shortdescDiv.querySelectorAll('p, div.p'));

        if (shortdescParagraphs.length > 0) {
          // Collect only the first non-callout paragraph as the primary description
          for (const p of shortdescParagraphs) {
            if (isInsideCallout(p)) continue;
            const text = getTextIncludingLinks(p);
            // Only collect non-empty paragraphs
            if (text.length > 0) {
              collectedParagraphs.push(text);
              // Check if this first paragraph contains "extends"
              if (text.toLowerCase().includes('extends')) {
                foundExtendsInShortdesc = true;
              }
              // Stop after first paragraph - we'll look for extends info separately if needed
              break;
            }
          }
        } else {
          // Fallback: if no paragraph tags, use the entire shortdesc text content
          const text = getTextIncludingLinks(shortdescDiv);
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
            return getTextIncludingLinks(el);
          };

          // Try the element itself if it's P or DD
          if (current.tagName === 'P' || current.tagName === 'DD') {
            const text = checkElement(current);
            if (text && collectedParagraphs.length < maxParagraphs) {
              collectedParagraphs.push(text);
              // Stop collecting if this paragraph contains "extends"
              if (text.toLowerCase().includes('extends')) {
                foundExtends = true;
                break;
              }
            }
          }

          // If it's a DIV, iterate through its children in order (but skip callout divs)
          // Stop if we encounter a heading inside the DIV
          if (current.tagName === 'DIV' && !isInsideCallout(current)) {
            const shouldStop = processDivForParagraphs(
              current,
              checkElement,
              text => {
                if (text && collectedParagraphs.length < maxParagraphs) {
                  collectedParagraphs.push(text);
                  // Stop collecting if this paragraph contains "extends"
                  if (text.toLowerCase().includes('extends')) {
                    foundExtends = true;
                    return true; // Stop processing
                  }
                }
                return false; // Continue processing
              },
              {
                checkDirectChildren: true,
                checkNestedDivs: true,
                fallbackToDirectText: false
              }
            );

            // If we found "extends" while processing the DIV, stop the main loop
            if (shouldStop) break;
          }

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
        let headers = Array.from(table.querySelectorAll('th')).map(cell => cell.textContent?.trim().toLowerCase());

        if (headers.length === 0) return null;

        // Check if this is a fields table
        let hasField = headers.some(isFieldNameColumn);
        const hasType = headers.some(isFieldTypeColumn);
        const hasDesc = headers.some(isDescriptionColumn);

        // Special case: Handle Salesforce documentation bug where first "Field Type" column should be "Field Name"
        // This happens when we have 3 columns with duplicate "Field Type" headers
        if (!hasField && hasType && hasDesc && headers.length === 3) {
          // Find all indices of "Field Type" columns
          const typeIndices = headers.map((h, idx) => (isFieldTypeColumn(h) ? idx : -1)).filter(idx => idx >= 0);

          // If we have exactly 2 "Field Type" columns, treat the first one as "Field Name"
          if (typeIndices.length === 2) {
            headers = headers.slice(); // Clone to avoid mutating original
            headers[typeIndices[0]] = 'field name'; // Fix the first duplicate
            hasField = true; // Update the flag
          }
        }

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
        const tableName = heading ? getTextIncludingLinks(heading) : '';
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

      /**
       * Extract text content from an element, ensuring hyperlink text is included.
       * Only collects text from inline elements (text nodes, <a>, <span>, etc.)
       * and stops at block-level elements to avoid capturing too much.
       */
      function getTextIncludingLinks(el: Element): string {
        const textParts: string[] = [];
        const blockElements = new Set(['DIV', 'TABLE', 'UL', 'OL', 'DL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P']);

        /** Recursively collect text from node, stopping at block elements */
        const collectText = (node: Node): void => {
          // For element nodes, check if it's a block element
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Stop at block-level child elements (but not if it's the root element we're processing)
            if (node !== el && blockElements.has(element.tagName)) {
              return;
            }

            // Process children of inline elements
            for (const child of Array.from(node.childNodes)) {
              collectText(child);
            }
          }
          // For text nodes, collect the text (without trimming individual parts to preserve spacing)
          else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? '';
            if (text) {
              textParts.push(text);
            }
          }
        };

        collectText(el);
        // Join all parts and normalize whitespace to remove extra spaces
        return textParts.join('').replace(/\s+/g, ' ').trim();
      }

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

      /**
       * Helper to extract paragraphs from a DIV element, skipping callouts.
       * Returns true if processing should stop (early termination), false to continue.
       */
      function processDivForParagraphs(
        divElement: Element,
        extractText: (el: Element) => string,
        onParagraphFound: (text: string) => boolean,
        options: {
          checkDirectChildren?: boolean;
          checkNestedDivs?: boolean;
          fallbackToDirectText?: boolean;
        } = {}
      ): boolean {
        const { checkDirectChildren = false, checkNestedDivs = false, fallbackToDirectText = false } = options;

        // Skip if the DIV itself is a callout
        if (isCalloutElement(divElement)) return false;

        /** Helper to process a single element and invoke callback if text is found */
        const processElement = (el: Element): boolean => {
          const text = extractText(el);
          return text ? onParagraphFound(text) : false;
        };

        /** Helper to process an array of elements */
        const processElements = (elements: Element[]): boolean => {
          for (const el of elements) {
            if (processElement(el)) return true;
          }
          return false;
        };

        if (checkDirectChildren) {
          // Process direct children in order
          for (const child of Array.from(divElement.children)) {
            // Stop if we hit a heading inside the DIV
            if (child.tagName.match(/^H[2-6]$/)) break;

            // Check paragraphs directly
            if (child.tagName === 'P' || child.tagName === 'DD') {
              if (processElement(child)) return true;
            }

            // Check nested DIVs if requested
            if (checkNestedDivs && child.tagName === 'DIV' && !isInsideCallout(child)) {
              const nestedParagraphs = Array.from(child.querySelectorAll('p, dd'));
              if (processElements(nestedParagraphs)) return true;
            }
          }
        } else {
          // Use querySelectorAll to find all paragraphs in the DIV
          const paragraphs = Array.from(divElement.querySelectorAll('p'));
          if (processElements(paragraphs)) return true;
        }

        // Fallback: Check direct text content if no valid P found
        if (fallbackToDirectText) {
          const hasComplexChildren = divElement.querySelector('table, h1, h2, h3, h4, h5, h6');
          if (!hasComplexChildren) {
            // Clone to verify text without callouts (avoids "combined text" issue)
            const clone = divElement.cloneNode(true) as Element;
            const allElements = Array.from(clone.querySelectorAll('*'));
            for (const el of allElements) {
              if (isCalloutElement(el)) {
                el.remove();
              }
            }

            const text = getTextIncludingLinks(clone);
            if (text.length > 0 && onParagraphFound(text)) return true;
          }
        }

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

      /** Helper to find description paragraph after a heading element */
      function findDescriptionAfterHeading(headingElement: Element): string {
        let description = '';
        let nextElement = headingElement.nextElementSibling;

        /** Helper to extract description from a paragraph element, returns the description or empty string */
        const tryExtractDescription = (element: Element): string => {
          if (isInsideCallout(element)) return '';
          const text = getTextIncludingLinks(element);
          return text.length > 0 ? text : '';
        };

        while (nextElement) {
          const tagName = nextElement.tagName;

          // Stop if we hit a table (when specified)
          if (tagName === 'TABLE') break;

          // Stop if we hit another heading
          if (tagName?.match(/^H[1-6]$/)) break;

          // Look for a paragraph with meaningful content
          if (tagName === 'P') {
            const extracted = tryExtractDescription(nextElement);
            if (extracted) {
              description = extracted;
              break;
            }
          }

          // Check inside DIVs for paragraphs (but skip callout divs)
          if (tagName === 'DIV' && !isInsideCallout(nextElement)) {
            // Special case: Salesforce uses <div class="p"> as paragraph containers
            // These DIVs can contain multiple elements (text, paragraphs, tables, code samples, strong tags)
            // We need to extract text but stop at tables to avoid collecting example headers
            if (nextElement.classList.contains('p')) {
              // Create a helper function that extracts text but stops after encountering a table
              const extractTextBeforeTable = (el: Element): string => {
                const textParts: string[] = [];
                const blockElements = new Set(['TABLE', 'UL', 'OL', 'DL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

                // Process children until we hit a table or data container
                for (const child of Array.from(el.childNodes)) {
                  // If we hit a table or data container (which wraps tables), stop
                  if (child.nodeType === Node.ELEMENT_NODE) {
                    const element = child as Element;
                    if (element.tagName === 'TABLE' || element.classList.contains('data')) {
                      break;
                    }

                    // Skip callout/note containers (Important boxes, etc.)
                    if (isCalloutElement(element)) {
                      continue;
                    }

                    // Skip other block elements
                    if (blockElements.has(element.tagName)) {
                      continue;
                    }

                    // For inline elements and paragraphs, collect text recursively
                    const collectText = (node: Node): void => {
                      if (node.nodeType === Node.ELEMENT_NODE) {
                        const elem = node as Element;
                        // Skip callout elements
                        if (isCalloutElement(elem)) {
                          return;
                        }
                        // Stop at block elements except P
                        if (
                          blockElements.has(elem.tagName) ||
                          elem.tagName === 'TABLE' ||
                          elem.classList.contains('data')
                        ) {
                          return;
                        }
                        for (const c of Array.from(node.childNodes)) {
                          collectText(c);
                        }
                      } else if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent ?? '';
                        if (text) textParts.push(text);
                      }
                    };

                    collectText(child);
                  } else if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent ?? '';
                    if (text) textParts.push(text);
                  }
                }

                return textParts.join('').replace(/\s+/g, ' ').trim();
              };

              const directText = extractTextBeforeTable(nextElement);
              if (directText) {
                description = directText;
                break;
              }
            }

            const foundInDiv = processDivForParagraphs(
              nextElement,
              tryExtractDescription,
              text => {
                description = text;
                return true; // Stop processing after first match
              },
              {
                checkDirectChildren: false,
                checkNestedDivs: false,
                fallbackToDirectText: true
              }
            );
            if (foundInDiv) break;
          }

          nextElement = nextElement.nextElementSibling;
        }

        return description;
      }

      /** Helper to find heading element before a given element */
      function findHeadingBefore(startElement: Element | null): Element | null {
        if (!startElement) return null;

        // First, try to find a heading among previous siblings at the current level
        let current = startElement.previousElementSibling;

        while (current) {
          if (current.tagName.match(/^H[1-6]$/)) return current;
          current = current.previousElementSibling;
        }

        // If no heading found at this level, try looking at the parent's siblings
        // This handles cases where the table is nested in a wrapper div
        if (startElement.parentElement && startElement.parentElement.tagName !== 'BODY') {
          return findHeadingBefore(startElement.parentElement);
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

    // If no tables and no headings without tables, return empty
    if (allTableFields.length === 0 && !extractionResult.headingsWithoutTables?.length) return [];

    /** Helper to create a result entry with cleaned fields and normalized description */
    const createResultEntry = (name: string, description: string, fields: MetadataField[]) => {
      const cleanedFields = fields.map((field: MetadataField) => ({
        ...field,
        Description: normalizeWhitespace(field.Description),
        'Field Type': normalizeWhitespace(field['Field Type'])
      }));

      const cleanedDescription = normalizeWhitespace(description);

      const entry = {
        name,
        data: {
          fields: cleanedFields,
          short_description: cleanedDescription,
          url: url.split('#')[0], // Strip hash fragment if present
          parent: extractParentType(cleanedDescription, cleanedFields)
        }
      };
      results.push(entry);
      console.log(`Newest entry:`, JSON.stringify(entry, null, 2));
    };

    // Process all tables
    for (let i = 0; i < allTableFields.length; i++) {
      const tableData = allTableFields[i];

      // Determine the appropriate name for this table
      const finalName = determineTableName(tableData, i, allTableFields.length, allTableFields, results, typeName);

      // For the first table: use page-level description if table name matches page title,
      // otherwise use table-specific description (e.g., ValueSet has its own description)
      // For subsequent tables: always use table-specific descriptions
      let description: string;
      if (i === 0) {
        // Check if the final name matches the page title (case-insensitive)
        const nameMatchesTitle = finalName.toLowerCase() === tableData.pageTitle.toLowerCase();
        description = nameMatchesTitle
          ? tableData.pageLevelDescription || tableData.tableDescription
          : tableData.tableDescription || tableData.pageLevelDescription;
      } else {
        description = tableData.tableDescription;
      }

      createResultEntry(finalName, description, tableData.fields);
    }

    // After extracting all tables, identify referenced types that don't have their own tables
    // BUT only if they have a heading on the page (indicating they have their own section)
    processReferencedTypes(results, pageHeadingsSet, url);

    // Process headings without tables
    if (extractionResult.headingsWithoutTables && extractionResult.headingsWithoutTables.length > 0) {
      processHeadingsWithoutTables(results, extractionResult.headingsWithoutTables, url);
    }

    // Special handling for Folder metadata type
    // Replace the generic "Folder" entry with 5 specific folder types
    applyFolderSpecialHandling(results, url);

    return results;
  } catch (error) {
    console.error(`    Error extracting data: ${error}`);
    return [];
  }
};

// ============================================================================
// Post-Processing Helper Functions
// ============================================================================

/**
 * Determine the appropriate name for a table based on its position and context.
 * For the first table, uses page title unless explicitly named.
 * For subsequent tables, uses explicit name or infers from referenced types.
 */
const determineTableName = (
  tableData: { tableName: string; pageTitle: string; fields: MetadataField[] },
  tableIndex: number,
  totalTables: number,
  allTables: Array<{ tableName: string; pageTitle: string; fields: MetadataField[] }>,
  existingResults: Array<{ name: string }>,
  fallbackTypeName: string
): string => {
  if (tableIndex === 0) {
    // Handle the first table
    if (totalTables === 1) {
      // For single table, always use page title (the table represents the main type)
      return tableData.pageTitle;
    }
    // For multiple tables, use page title if table name is 'Fields' or empty
    return !tableData.tableName || tableData.tableName.toLowerCase() === 'fields'
      ? tableData.pageTitle
      : tableData.tableName;
  }

  if (tableData.tableName) {
    // For subsequent tables, use the found table name
    return tableData.tableName;
  }

  // Try to infer name from types in previous tables (both arrays and complex types)
  const arrayTypes: string[] = [];
  const complexTypes: string[] = [];

  // Process tables in REVERSE order to prioritize more recent types
  for (let j = tableIndex - 1; j >= 0; j--) {
    const prevTable = allTables[j];
    for (const field of prevTable.fields) {
      // Skip fields with empty field names - they're just inline type references, not actual fields
      if (!field['Field Name'] || field['Field Name'].trim() === '') continue;

      const fieldType = field['Field Type'];

      // Collect array types (higher priority)
      const arrayType = extractArrayTypeName(fieldType);
      if (arrayType) arrayTypes.push(arrayType);

      // Collect complex types (lower priority)
      const complexType = extractComplexTypeName(fieldType);
      if (complexType) complexTypes.push(complexType);
    }
  }

  // Prioritize: arrays from recent tables, then complex types from recent tables
  const candidateTypes = [...arrayTypes, ...complexTypes];

  // Filter out unused candidates
  const unusedCandidates = candidateTypes.filter(candidate => !existingResults.some(r => r.name === candidate));

  if (unusedCandidates.length === 0) {
    return `${fallbackTypeName} (Table ${tableIndex + 1})`;
  }

  // Prefer candidates that start with the page title (more specific, compound types)
  const pageTitle = allTables[0]?.pageTitle || fallbackTypeName;
  const matchingPrefix = unusedCandidates.find(candidate => candidate.startsWith(pageTitle));
  if (matchingPrefix) {
    return matchingPrefix;
  }

  // Otherwise, use the first unused candidate
  return unusedCandidates[0];
};

/**
 * Process referenced types that don't have their own tables but appear in field types.
 * Only includes types that have a heading on the page, indicating they have their own section.
 */
const processReferencedTypes = (
  results: Array<{ name: string; data: MetadataType }>,
  pageHeadingsSet: Set<string>,
  url: string
): void => {
  const extractedTypeNames = new Set(results.map(r => r.name));
  const referencedTypes = new Set<string>();

  /** Check if a type name matches any heading on the page */
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
      // Skip fields with empty field names - they're just inline type references, not actual fields
      if (!field['Field Name'] || field['Field Name'].trim() === '') continue;

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
};

/**
 * Process headings without tables, updating or creating entries as needed.
 * Updates existing entries with better descriptions or creates new entries.
 */
const processHeadingsWithoutTables = (
  results: Array<{ name: string; data: MetadataType }>,
  headingsWithoutTables: Array<{ headingName: string; description: string }>,
  url: string
): void => {
  for (const heading of headingsWithoutTables) {
    // Check if we already have an entry for this heading name
    const existingEntry = results.find(r => r.name === heading.headingName);
    if (existingEntry) {
      // Update the existing entry if it only has a generic "Referenced type" description
      if (existingEntry.data.short_description.startsWith('Referenced type from')) {
        const cleanedDesc = normalizeWhitespace(heading.description);
        existingEntry.data.short_description = cleanedDesc;
        existingEntry.data.parent = extractParentType(cleanedDesc, existingEntry.data.fields);
        console.log('Updated entry HEADING WITHOUT TABLE:', JSON.stringify(existingEntry, null, 2));
      }
      continue;
    }

    // Create a new entry with no fields but with the description
    const cleanedHeadingDesc = normalizeWhitespace(heading.description);
    results.push({
      name: heading.headingName,
      data: {
        fields: [],
        short_description: cleanedHeadingDesc,
        url: url.split('#')[0],
        parent: extractParentType(cleanedHeadingDesc, [])
      }
    });
    console.log('Newest entry HEADING WITHOUT TABLE:', JSON.stringify(results.at(-1), null, 2));
  }
};

/**
 * Apply special handling for the Folder metadata type.
 * Replaces generic Folder entry with 5 specific folder types (Document, Email, EmailTemplate, Report, Dashboard).
 */
const applyFolderSpecialHandling = (results: Array<{ name: string; data: MetadataType }>, url: string): void => {
  if (!url.includes('meta_folder.htm')) return;

  const folderIndex = results.findIndex(r => r.name === 'Folder');
  if (folderIndex === -1) return;

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
};

// ============================================================================
// Text Processing Helper Functions
// ============================================================================

/** Clean up text by normalizing whitespace */
const normalizeWhitespace = (text: string): string => {
  if (!text) return text;

  // Replace \n followed by any number of spaces or tabs with a single space
  return text
    .replaceAll(/\n[\s\t]+/g, ' ')
    .replaceAll(/\s+/g, ' ') // Also normalize multiple spaces to single space
    .trim();
};

/**
 * Extract parent metadata type from description and fields.
 * Looks for "extends" patterns in descriptions and "inherited from" in field descriptions.
 * Defaults to "Metadata" if not found.
 */
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

/**
 * Extract type name from array notation (e.g., "AssignmentRule[]" -> "AssignmentRule").
 * Handles zero-width Unicode characters that may be present in scraped data.
 */
const extractArrayTypeName = (fieldType: string): string | null => {
  // Remove zero-width characters that might be in the type name
  const cleanType = fieldType.replaceAll(/[\u200B-\u200D\uFEFF]/g, '');
  const match = cleanType.match(/^([A-Z][a-zA-Z0-9_]+)\[\]$/);
  return match ? match[1] : null;
};

/**
 * Extract complex type names (non-primitive types without []).
 * Excludes primitives (string, boolean, int, etc.) and enumeration types.
 * Converts camelCase type names to PascalCase for consistency.
 */
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

  // Match PascalCase type names
  const pascalCaseMatch = cleanType.match(/^([A-Z][a-zA-Z0-9_]+)$/);
  if (pascalCaseMatch) return pascalCaseMatch[1];

  // Match camelCase type names and convert to PascalCase
  const camelCaseMatch = cleanType.match(/^([a-z][a-zA-Z0-9_]+)$/);
  if (camelCaseMatch) {
    const camelCaseName = camelCaseMatch[1];
    // Convert first character to uppercase
    return camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1);
  }

  return null;
};
