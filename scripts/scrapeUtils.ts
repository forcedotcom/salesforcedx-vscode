/**
 * Shared utilities for metadata scraping scripts
 */

import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface MetadataField {
  Description: string;
  'Field Name': string;
  'Field Type': string;
}

export interface MetadataType {
  fields: MetadataField[];
  short_description: string;
  url: string;
}

/**
 * Improved page loading with multiple strategies
 * Returns the frame containing the actual content (might be an iframe)
 */
export const loadPageRobustly = async (
  page: Page,
  url: string,
  indent: string = '     '
): Promise<{ success: boolean; contentFrame: any }> => {
  try {
    console.log(`${indent.slice(0, -2)}📄 Loading: ${url}`);

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
        console.log(`${indent}✓ Accepted cookies`);
        await page.waitForTimeout(1000);
      }
    } catch {
      // No cookie banner
    }

    // Strategy 3: Wait for network to settle
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Strategy 4: Wait for JavaScript to fully render
    console.log(`${indent}⏳ Waiting 10 seconds for content to fully load...`);
    await page.waitForTimeout(10000);

    // Strategy 5: Scroll to trigger any lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Strategy 6: Wait for iframe and its content to load
    console.log(`${indent}⏳ Waiting for iframe content...`);
    await page.waitForTimeout(3000);

    // Get the iframe's content
    const frames = page.frames();
    console.log(`${indent}🔍 Found ${frames.length} frames`);

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

    console.log(`${indent}✓ Using frame: ${contentFrame.url() || 'main'}`);

    // Wait for tables in the iframe
    console.log(`${indent}⏳ Waiting for tables to stabilize...`);
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

      console.log(`${indent}🔍 Table count: ${currentTableCount}`);

      if (currentTableCount === lastTableCount && currentTableCount > 0) {
        stableIterations++;
        if (stableIterations >= 2) {
          console.log(`${indent}✓ Content stabilized with ${currentTableCount} tables`);
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
      const screenshotPath = path.join(__dirname, 'debug-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`${indent}📸 Screenshot saved to: ${screenshotPath}`);

      const htmlPath = path.join(__dirname, 'debug-page.html');
      fs.writeFileSync(htmlPath, await page.content());
      console.log(`${indent}📝 HTML saved to: ${htmlPath}`);
    }

    if (tableCount === 0) {
      console.log(`${indent}❌ No tables found after all strategies`);
      return { success: false, contentFrame: null };
    }

    console.log(`${indent}✅ Ready to extract (${tableCount} tables found)`);
    return { success: true, contentFrame };
  } catch (error) {
    console.error(`${indent}Error loading page: ${error}`);
    return { success: false, contentFrame: null };
  }
};

/** Clean up description text by normalizing whitespace */
const cleanDescription = (text: string): string => {
  if (!text) return text;

  // Replace \n followed by any number of spaces or tabs with a single space
  return text
    .replace(/\n[\s\t]+/g, ' ')
    .replace(/\s+/g, ' ') // Also normalize multiple spaces to single space
    .trim();
};

/**
 * Extract metadata from a loaded page (or iframe)
 * Returns an array because some pages have multiple tables representing different types
 */
export const extractMetadataFromPage = async (
  contentFrame: any,
  url: string,
  typeName: string
): Promise<Array<{ name: string; data: MetadataType }>> => {
  try {
    // Extract fields from ALL tables (each table is a separate metadata type)
    // We'll extract descriptions per-table instead of one for the whole page
    const allTableFields = await contentFrame.evaluate(() => {
      const tablesData: Array<{
        fields: Array<{
          Description: string;
          'Field Name': string;
          'Field Type': string;
        }>;
        tableName: string;
        tableDescription: string;
        pageTitle: string;
        pageLevelDescription: string;
      }> = [];

      // Get the page title (from h1, or from title element, or from first h2)
      let pageTitle = '';

      // Try h1 first
      const h1 = document.querySelector('h1');
      if (h1) {
        pageTitle = h1.textContent?.trim() || '';
      }

      // If no h1 or h1 looks like it has navigation cruft, try first h2
      if (!pageTitle || pageTitle.includes('|') || pageTitle.includes('Developers')) {
        const h2 = document.querySelector('h2');
        if (h2) {
          const h2Text = h2.textContent?.trim() || '';
          if (h2Text && h2Text.length < 100 && !h2Text.includes('|')) {
            pageTitle = h2Text;
          }
        }
      }

      // Last resort: title element, but clean it up
      if (!pageTitle) {
        const titleElement = document.querySelector('title');
        if (titleElement) {
          const titleText = titleElement.textContent || '';
          // Try to extract just the first part before any separator
          pageTitle = titleText.split('|')[0].split('-')[0].trim();
        }
      }

      // Extract page-level description (for the first table)
      // This is typically the first substantial paragraph after the main H1/H2 but before any tables
      let pageLevelDescription = '';

      // Helper to search including shadow DOMs
      function findInShadowDOM(selector: string): Element | null {
        // Try regular DOM first
        let found = document.querySelector(selector);
        if (found) return found;

        // Search shadow DOMs
        function searchShadow(root: Document | ShadowRoot | Element): Element | null {
          const result = root.querySelector(selector);
          if (result) return result;

          const elements = root.querySelectorAll('*');
          for (const el of Array.from(elements)) {
            if (el.shadowRoot) {
              const shadowResult = searchShadow(el.shadowRoot);
              if (shadowResult) return shadowResult;
            }
          }
          return null;
        }

        return searchShadow(document);
      }

      // Strategy 1: Look for Salesforce's standard shortdesc div (including in shadow DOM)
      const shortdescDiv = findInShadowDOM('div.shortdesc');
      if (shortdescDiv) {
        const text = shortdescDiv.textContent?.trim() || '';
        if (text.length > 20) {
          pageLevelDescription = text;
        }
      }

      // Strategy 2: Look for direct paragraph siblings after heading
      const mainHeading = document.querySelector('h1') || document.querySelector('h2');
      if (mainHeading && !pageLevelDescription) {
        let current = mainHeading.nextElementSibling;
        let attempts = 0;

        while (current && attempts < 15 && !pageLevelDescription) {
          // Stop if we hit a table
          if (current.tagName === 'TABLE') {
            break;
          }

          // Stop if we hit another major heading (H2 for a specific table)
          if (current.tagName && current.tagName.match(/^H[2-6]$/)) {
            const headingText = current.textContent?.trim().toLowerCase() || '';
            if (headingText.includes('field') || headingText.length < 100) {
              break;
            }
          }

          // Check if this element or its children have the description
          const checkElement = (el: Element) => {
            const text = el.textContent?.trim() || '';
            const textLower = text.toLowerCase();

            const isSubstantial = text.length > 50;
            const isNotNavigation =
              !textLower.includes('cookie') &&
              !textLower.includes('in this section') &&
              !textLower.includes('©') &&
              !textLower.includes('skip navigation') &&
              !textLower.includes('related topics') &&
              !textLower.includes('see also') &&
              !textLower.startsWith('note:') &&
              !textLower.startsWith('tip:') &&
              !textLower.startsWith('important:');

            return isSubstantial && isNotNavigation ? text : '';
          };

          // Try the element itself if it's P or DD
          if (current.tagName === 'P' || current.tagName === 'DD') {
            const desc = checkElement(current);
            if (desc) {
              pageLevelDescription = desc;
              break;
            }
          }

          // If it's a DIV, look for P or DD children
          if (current.tagName === 'DIV') {
            const paragraphs = current.querySelectorAll('p, dd');
            for (const p of Array.from(paragraphs)) {
              const desc = checkElement(p);
              if (desc) {
                pageLevelDescription = desc;
                break;
              }
            }
            if (pageLevelDescription) break;
          }

          current = current.nextElementSibling;
          attempts++;
        }
      }

      // Strategy 3: If still not found, do a broader search for the first P after the heading
      if (!pageLevelDescription && mainHeading) {
        const allParagraphs = Array.from(document.querySelectorAll('p, dd'));
        for (const p of allParagraphs) {
          // Only consider paragraphs that come after the heading in DOM order
          if (mainHeading.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) {
            const text = p.textContent?.trim() || '';
            const textLower = text.toLowerCase();

            const isSubstantial = text.length > 50;
            const isNotNavigation =
              !textLower.includes('cookie') &&
              !textLower.includes('in this section') &&
              !textLower.includes('©') &&
              !textLower.includes('skip navigation') &&
              !textLower.includes('related topics') &&
              !textLower.includes('see also') &&
              !textLower.startsWith('note:') &&
              !textLower.startsWith('tip:') &&
              !textLower.startsWith('important:');

            if (isSubstantial && isNotNavigation) {
              pageLevelDescription = text;
              break;
            }
          }
        }
      }

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

        // Accept tables with all 3 columns OR 2-column format (field name + description)
        const isTraditionalFormat = hasField && hasType && hasDesc;
        const isNestedFormat = headers.length === 2 && hasField && hasDesc;

        if (!isTraditionalFormat && !isNestedFormat) continue;

        // Find column indices
        const fieldIdx = headers.findIndex(
          h => (h.includes('field') && h.includes('name')) || h === 'field' || h === 'name'
        );
        const typeIdx = headers.findIndex(h => h.includes('type'));
        const descIdx = headers.findIndex(h => h.includes('description') || h.includes('detail'));

        // Try to find a table name/caption and description
        let tableName = '';
        let tableDescription = '';
        const caption = table.querySelector('caption');
        if (caption) {
          tableName = caption.textContent?.trim() || '';
        } else {
          // Look for heading before the table - try multiple element types
          let prevElement = table.previousElementSibling;
          let attempts = 0;
          let foundHeading: Element | null = null;

          while (prevElement && attempts < 10) {
            const tagName = prevElement.tagName;

            // Check for H1-H6 headings
            if (tagName && tagName.match(/^H[1-6]$/)) {
              tableName = prevElement.textContent?.trim() || '';
              foundHeading = prevElement;
              break;
            }

            // Check for DT (definition term) which Salesforce docs sometimes use
            if (tagName === 'DT') {
              tableName = prevElement.textContent?.trim() || '';
              foundHeading = prevElement;
              break;
            }

            // Check for DIV or P with bold/strong text that looks like a heading
            if (tagName === 'DIV' || tagName === 'P') {
              const strong = prevElement.querySelector('strong, b');
              if (strong) {
                const text = strong.textContent?.trim() || '';
                if (text.length > 2 && text.length < 100) {
                  tableName = text;
                  foundHeading = prevElement;
                  break;
                }
              }
            }

            prevElement = prevElement.previousElementSibling;
            attempts++;
          }

          // If no heading found as direct sibling, check parent's siblings
          // (common in Salesforce docs where table is wrapped in a div)
          if (!foundHeading && table.parentElement) {
            let parentPrev = table.parentElement.previousElementSibling;
            attempts = 0;

            while (parentPrev && attempts < 10) {
              const tagName = parentPrev.tagName;

              // Check for H1-H6 headings
              if (tagName && tagName.match(/^H[1-6]$/)) {
                tableName = parentPrev.textContent?.trim() || '';
                foundHeading = parentPrev;
                break;
              }

              // Check for DT
              if (tagName === 'DT') {
                tableName = parentPrev.textContent?.trim() || '';
                foundHeading = parentPrev;
                break;
              }

              // Check for DIV or P with bold/strong text
              if (tagName === 'DIV' || tagName === 'P') {
                const strong = parentPrev.querySelector('strong, b');
                if (strong) {
                  const text = strong.textContent?.trim() || '';
                  if (text.length > 2 && text.length < 100) {
                    tableName = text;
                    foundHeading = parentPrev;
                    break;
                  }
                }
              }

              parentPrev = parentPrev.previousElementSibling;
              attempts++;
            }
          }

          // If we found a heading, look for a description paragraph right after it
          if (foundHeading) {
            let nextElement = foundHeading.nextElementSibling;
            let searchAttempts = 0;

            while (nextElement && searchAttempts < 10) {
              // Stop if we reach the table itself
              if (nextElement === table) {
                break;
              }

              // Look for a paragraph with meaningful content
              if (nextElement.tagName === 'P') {
                const text = nextElement.textContent?.trim() || '';
                // Make sure it's a substantial description
                if (
                  text.length > 20 &&
                  !text.toLowerCase().includes('cookie') &&
                  !text.toLowerCase().includes('in this section') &&
                  !text.toLowerCase().includes('©')
                ) {
                  tableDescription = text;
                  break;
                }
              }

              // Also check for DD (definition description) after DT
              if (nextElement.tagName === 'DD') {
                const text = nextElement.textContent?.trim() || '';
                if (text.length > 20) {
                  tableDescription = text;
                  break;
                }
              }

              nextElement = nextElement.nextElementSibling;
              searchAttempts++;
            }
          }
        }

        // Extract rows for this table
        const rows = Array.from(table.querySelectorAll('tbody tr, tr:not(:first-child)'));
        const tableFields: Array<{
          Description: string;
          'Field Name': string;
          'Field Type': string;
        }> = [];

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));

          if (cells.length < 2) continue;

          let fieldName = '';
          let fieldType = '';
          let description = '';

          // Try traditional 3-column format first
          if (cells.length >= 3 && typeIdx >= 0 && descIdx >= 0) {
            fieldName = cells[fieldIdx >= 0 ? fieldIdx : 0]?.textContent?.trim() || '';
            fieldType = cells[typeIdx]?.textContent?.trim() || '';
            description = cells[descIdx]?.textContent?.trim() || '';
          } else {
            // Try nested format (2 columns: Field Name, then nested Field Type + Description)
            fieldName = cells[0]?.textContent?.trim() || '';

            if (cells.length >= 2) {
              const secondCell = cells[1];

              // Strategy 1: Look for <dt>Field Type</dt><dd>TYPE</dd> structure
              const dtElements = Array.from(secondCell.querySelectorAll('dt'));
              for (const dt of dtElements) {
                const dtText = dt.textContent?.trim().toLowerCase() || '';
                if (dtText.includes('field type') || dtText === 'type') {
                  // Get the next dd sibling
                  let nextSibling = dt.nextElementSibling;
                  while (nextSibling && nextSibling.tagName !== 'DD' && nextSibling.tagName !== 'DT') {
                    nextSibling = nextSibling.nextElementSibling;
                  }
                  if (nextSibling && nextSibling.tagName === 'DD') {
                    fieldType = nextSibling.textContent?.trim() || '';
                    break;
                  }
                }
              }

              // Strategy 2: Look for links to other metadata types
              if (!fieldType) {
                const typeLink = secondCell.querySelector('a[href*="meta_"]');
                if (typeLink) {
                  fieldType = typeLink.textContent?.trim() || '';
                }
              }

              // Strategy 3: Look for text that looks like a type (capitalized words, array notation)
              if (!fieldType) {
                const allText = secondCell.textContent || '';
                const typeMatch = allText.match(/Field Type\s*([A-Z][\w\[\]]+)/);
                if (typeMatch) {
                  fieldType = typeMatch[1];
                }
              }

              // Try to find Description
              // Strategy 1: Look for <dt>Description</dt><dd>DESC</dd> structure
              const dtElementsForDesc = Array.from(secondCell.querySelectorAll('dt'));
              for (const dt of dtElementsForDesc) {
                const dtText = dt.textContent?.trim().toLowerCase() || '';
                if (dtText.includes('description') || dtText === 'desc') {
                  // Get ALL consecutive DD siblings until the next DT
                  const descriptionParts: string[] = [];
                  let current = dt.nextElementSibling;

                  while (current) {
                    if (current.tagName === 'DT') {
                      // Stop at next DT
                      break;
                    }
                    if (current.tagName === 'DD') {
                      const ddText = current.textContent?.trim() || '';
                      if (ddText) {
                        descriptionParts.push(ddText);
                      }
                    }
                    current = current.nextElementSibling;
                  }

                  if (descriptionParts.length > 0) {
                    description = descriptionParts.join('\n\n');
                    break;
                  }
                }
              }

              // Strategy 2: Look for text after "Description" label
              if (!description) {
                const descElements = Array.from(secondCell.querySelectorAll('*'));
                let foundDescLabel = false;
                for (const elem of descElements) {
                  const text = elem.textContent?.trim() || '';
                  if (text.toLowerCase() === 'description') {
                    foundDescLabel = true;
                  } else if (foundDescLabel && text && text.length > 10) {
                    description = text;
                    break;
                  }
                }
              }

              // Strategy 3: Fallback - get all text after type
              if (!description) {
                const fullText = secondCell.textContent || '';
                const lines = fullText
                  .split('\n')
                  .map(l => l.trim())
                  .filter(l => l);
                // Description is usually the last substantial line
                for (let i = lines.length - 1; i >= 0; i--) {
                  if (
                    lines[i].length > 20 &&
                    !lines[i].toLowerCase().includes('field type') &&
                    !lines[i].toLowerCase().includes('description') &&
                    lines[i] !== fieldType
                  ) {
                    description = lines[i];
                    break;
                  }
                }
              }
            }
          }

          if (fieldName && fieldType && description && !fieldName.toLowerCase().includes('field')) {
            tableFields.push({
              Description: description,
              'Field Name': fieldName,
              'Field Type': fieldType
            });
          }
        }

        // Only add this table if it has fields
        if (tableFields.length > 0) {
          tablesData.push({
            fields: tableFields,
            tableName: tableName,
            tableDescription: tableDescription,
            pageTitle: pageTitle,
            pageLevelDescription: pageLevelDescription
          });
        }
      }

      return tablesData;
    });

    // Create a separate metadata type entry for each table
    const results: Array<{ name: string; data: MetadataType }> = [];

    if (allTableFields.length === 0) {
      return [];
    }

    // Helper to extract type name from array notation (e.g., "AssignmentRule[]" -> "AssignmentRule")
    const extractArrayTypeName = (fieldType: string): string | null => {
      // Remove zero-width characters that might be in the type name
      const cleanType = fieldType.replace(/[\u200B-\u200D\uFEFF]/g, '');
      const match = cleanType.match(/^([A-Z][a-zA-Z0-9_]+)\[\]$/);
      return match ? match[1] : null;
    };

    // Helper to extract complex type names (non-primitive types without [])
    const extractComplexTypeName = (fieldType: string): string | null => {
      // Skip enumeration types entirely - they don't represent table structures
      if (fieldType.toLowerCase().includes('enumeration')) {
        return null;
      }

      // Clean up the field type - remove enumeration info and extra spaces
      let cleanType = fieldType.split('(')[0].trim();

      // Remove any zero-width or special Unicode characters
      cleanType = cleanType.replace(/[\u200B-\u200D\uFEFF]/g, '');

      // Match types that start with capital letter and are not primitives
      const primitives = ['string', 'boolean', 'int', 'double', 'date', 'datetime', 'long'];
      if (primitives.includes(cleanType.toLowerCase())) {
        return null;
      }

      // Match capitalized type names (but not array notation)
      // Allow underscores and be more flexible with the pattern
      const match = cleanType.match(/^([A-Z][a-zA-Z0-9_]+)$/);
      return match ? match[1] : null;
    };

    // If only one table, always use the page title or typeName (the table represents the main type)
    if (allTableFields.length === 1) {
      const tableData = allTableFields[0];
      const finalName = tableData.pageTitle || typeName;

      // For the only table, always use page-level description first (just like we always use page title)
      const description = tableData.pageLevelDescription || tableData.tableDescription || '';

      // Clean up all field descriptions and types
      const cleanedFields = tableData.fields.map(field => ({
        ...field,
        Description: cleanDescription(field.Description),
        'Field Type': cleanDescription(field['Field Type'])
      }));

      results.push({
        name: finalName,
        data: {
          fields: cleanedFields,
          short_description: cleanDescription(description),
          url: url.split('#')[0] // Strip hash fragment if present
        }
      });
      console.log('Newest entry ONE TABLE:', JSON.stringify(results[results.length - 1], null, 2));
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
            finalName = tableData.pageTitle || typeName;
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

          finalName = inferredName || `${typeName} (Table ${i + 1})`;
        } else {
          finalName = `${typeName} (Table ${i + 1})`;
        }

        // For the first table, always use page-level description first (just like we always use page title)
        // For subsequent tables, only use table-specific descriptions
        const description =
          i === 0
            ? tableData.pageLevelDescription || tableData.tableDescription || ''
            : tableData.tableDescription || '';

        // Clean up all field descriptions and types
        const cleanedFields = tableData.fields.map(field => ({
          ...field,
          Description: cleanDescription(field.Description),
          'Field Type': cleanDescription(field['Field Type'])
        }));

        results.push({
          name: finalName,
          data: {
            fields: cleanedFields,
            short_description: cleanDescription(description),
            url: url.split('#')[0] // Strip hash fragment if present (all tables share the same base URL)
          }
        });
        console.log('Newest entry MULTIPLE TABLES:', JSON.stringify(results[results.length - 1], null, 2));
      }
    }

    return results;
  } catch (error) {
    console.error(`    Error extracting data: ${error}`);
    return [];
  }
};
