/**
 * Comprehensive Metadata API scraper that discovers all metadata types from the sidebar
 * and produces output identical to metadata_types_map.json
 *
 * Usage:
 *   npm run scrape:all-metadata
 *   npm run scrape:all-metadata -- --output custom-output.json
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

interface MetadataLink {
  name: string;
  url: string;
}

const MAIN_PAGE_URL = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm';

/**
 * Discovers all metadata type links from the sidebar/navigation
 */
async function discoverMetadataTypes(page: Page): Promise<MetadataLink[]> {
  console.log('Discovering metadata types from sidebar...');

  try {
    await page.goto(MAIN_PAGE_URL, { waitUntil: 'load', timeout: 60000 });

    // Wait for navigation/sidebar to load
    await page.waitForTimeout(5000);

    // Extract all metadata type links
    const links = await page.evaluate(() => {
      const metadataLinks: Array<{ name: string; url: string }> = [];

      // Try different selectors for the navigation/sidebar
      const possibleSelectors = [
        'nav a[href*="meta_"]',
        '.sidebar a[href*="meta_"]',
        '.navigation a[href*="meta_"]',
        'a[href*="/api_meta/"][href*="meta_"]',
        'ul.nav-list a',
        '.toc a',
        '[role="navigation"] a'
      ];

      // Also look for links in the main content area that might list all types
      const allLinks = Array.from(document.querySelectorAll('a[href]'));

      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';

        // Match links that look like metadata type documentation
        // e.g., meta_classes.htm, customobject.htm, etc.
        if (
          href.includes('meta_') ||
          (href.includes('.htm') &&
            !href.includes('meta_types') &&
            !href.includes('intro') &&
            !href.includes('index') &&
            text.length > 0 &&
            text.length < 50)
        ) {
          // Convert relative URLs to absolute
          const absoluteUrl = href.startsWith('http') ? href : new URL(href, window.location.href).href;

          // Extract the metadata type name from the link text
          const name = text.trim();

          if (name && !metadataLinks.some(ml => ml.url === absoluteUrl)) {
            metadataLinks.push({ name, url: absoluteUrl });
          }
        }
      }

      return metadataLinks;
    });

    console.log(`Found ${links.length} metadata type links`);

    // Filter out duplicates and invalid links
    const uniqueLinks = links.filter(
      (link, index, self) => index === self.findIndex(l => l.url === link.url && l.name === link.name)
    );

    return uniqueLinks;
  } catch (error) {
    console.error('Error discovering metadata types:', error);
    return [];
  }
}

/**
 * Extracts metadata information from a single documentation page
 */
async function scrapeMetadataPage(page: Page, url: string, typeName: string): Promise<MetadataType | null> {
  try {
    console.log(`  Scraping: ${typeName}`);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Handle cookie consent if present
    try {
      const acceptButton = page.locator(
        'button:has-text("Accept"), button:has-text("Accept All"), button:has-text("Agree")'
      );
      await acceptButton.click({ timeout: 3000 });
      await page.waitForTimeout(1000);
    } catch {
      // No cookie banner
    }

    // Wait for content to load
    try {
      await page.waitForSelector('table, h1, p', { timeout: 15000 });
    } catch {
      console.warn(`  ⚠️  Content not loaded for ${typeName}`);
    }

    await page.waitForTimeout(3000);

    // Extract short description
    const shortDescription = await page.evaluate(() => {
      // Try to find description in meta tag first
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content')?.trim() || '';
        if (content && content.length > 20) {
          return content;
        }
      }

      // Fall back to first paragraph
      const mainContent =
        document.querySelector('main') ||
        document.querySelector('.content') ||
        document.querySelector('article') ||
        document.body;

      const paragraphs = Array.from(mainContent.querySelectorAll('p'));
      for (const p of paragraphs) {
        const text = p.textContent?.trim() || '';
        if (
          text.length > 50 &&
          !text.toLowerCase().includes('in this section') &&
          !text.toLowerCase().includes('cookie') &&
          !text.toLowerCase().includes('required, functional, and advertising')
        ) {
          return text;
        }
      }

      return '';
    });

    // Extract fields from tables
    const fields = await page.evaluate(() => {
      const fieldsData: Array<{
        Description: string;
        'Field Name': string;
        'Field Type': string;
      }> = [];

      const mainContent =
        document.querySelector('main') ||
        document.querySelector('.content') ||
        document.querySelector('article') ||
        document.body;

      const tables = Array.from(mainContent.querySelectorAll('table'));

      for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('th')).map(
          (th: HTMLTableCellElement) => th.textContent?.trim().toLowerCase() || ''
        );

        // Check if this looks like a fields table
        const hasFieldColumn = headers.some(h => h.includes('field') || h === 'name');
        const hasTypeColumn = headers.some(h => h.includes('type') || h === 'data type');
        const hasDescColumn = headers.some(h => h.includes('description') || h.includes('detail'));

        if (hasFieldColumn && hasTypeColumn && hasDescColumn) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));

          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 3) {
              const fieldNameIdx = headers.findIndex(
                h => (h.includes('field') && h.includes('name')) || h === 'field' || h === 'name'
              );
              const typeIdx = headers.findIndex(h => h.includes('type') || h === 'data type');
              const descIdx = headers.findIndex(h => h.includes('description') || h.includes('detail'));

              const fieldName = cells[fieldNameIdx >= 0 ? fieldNameIdx : 0]?.textContent?.trim() || '';
              const fieldType = cells[typeIdx >= 0 ? typeIdx : 1]?.textContent?.trim() || '';
              const description = cells[descIdx >= 0 ? descIdx : 2]?.textContent?.trim() || '';

              if (fieldName && fieldType && description) {
                fieldsData.push({
                  Description: description,
                  'Field Name': fieldName,
                  'Field Type': fieldType
                });
              }
            }
          }

          if (fieldsData.length > 0) {
            break;
          }
        }
      }

      return fieldsData;
    });

    console.log(`  ✓ Found ${fields.length} fields`);

    return {
      fields,
      short_description: shortDescription,
      url
    };
  } catch (error) {
    console.error(`  ✗ Error scraping ${typeName}:`, error);
    return null;
  }
}

/**
 * Main scraping function
 */
async function scrapeAllMetadataTypes(outputFile?: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results: MetadataMap = {};
  let successCount = 0;
  let failCount = 0;

  try {
    // Step 1: Discover all metadata types
    const metadataLinks = await discoverMetadataTypes(page);

    if (metadataLinks.length === 0) {
      console.error('\n❌ No metadata types discovered. The page structure may have changed.');
      console.log('\nTrying alternative approach: using a predefined list...');

      // Fallback: Use a comprehensive list of known metadata types
      const knownTypes = await getKnownMetadataTypes(page);
      metadataLinks.push(...knownTypes);
    }

    console.log(`\n📋 Will scrape ${metadataLinks.length} metadata types\n`);

    // Step 2: Scrape each metadata type
    for (let i = 0; i < metadataLinks.length; i++) {
      const link = metadataLinks[i];
      console.log(`[${i + 1}/${metadataLinks.length}] ${link.name}`);

      const result = await scrapeMetadataPage(page, link.url, link.name);

      if (result && result.fields.length > 0) {
        results[link.name] = result;
        successCount++;
      } else {
        console.log(`  ⚠️  No fields found, skipping`);
        failCount++;
      }

      // Be respectful to the server
      await page.waitForTimeout(1000);
    }

    // Step 3: Save results
    const outputPath =
      outputFile || path.join(__dirname, '../packages/salesforcedx-vscode-core', 'metadata_types_map_scraped.json');

    console.log(`\n=== Summary ===`);
    console.log(`Total discovered: ${metadataLinks.length}`);
    console.log(`Successfully scraped: ${successCount}`);
    console.log(`Failed or skipped: ${failCount}`);
    console.log(`\n💾 Writing results to: ${outputPath}`);

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log('✅ Done!');
  } finally {
    await browser.close();
  }
}

/**
 * Fallback: Returns a comprehensive list of known metadata types
 */
async function getKnownMetadataTypes(page: Page): Promise<MetadataLink[]> {
  // This list can be expanded as needed
  const baseUrl = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/';

  const knownTypes: MetadataLink[] = [
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
    { name: 'Bot', url: `${baseUrl}meta_bot.htm` },
    { name: 'BrandingSet', url: `${baseUrl}meta_brandingset.htm` },
    { name: 'CallCenter', url: `${baseUrl}meta_callcenter.htm` },
    { name: 'Certificate', url: `${baseUrl}meta_certificate.htm` },
    { name: 'CleanDataService', url: `${baseUrl}meta_cleandataservice.htm` },
    { name: 'Community', url: `${baseUrl}meta_community.htm` },
    { name: 'ConnectedApp', url: `${baseUrl}meta_connectedapp.htm` },
    { name: 'ContentAsset', url: `${baseUrl}meta_contentasset.htm` },
    { name: 'CustomApplication', url: `${baseUrl}meta_customapplication.htm` },
    { name: 'CustomField', url: `${baseUrl}customfield.htm` },
    { name: 'CustomLabel', url: `${baseUrl}meta_customlabels.htm` },
    { name: 'CustomMetadata', url: `${baseUrl}meta_custommetadata.htm` },
    { name: 'CustomObject', url: `${baseUrl}customobject.htm` },
    { name: 'CustomObjectTranslation', url: `${baseUrl}meta_customobjecttranslation.htm` },
    { name: 'CustomPageWebLink', url: `${baseUrl}meta_custompageweblink.htm` },
    { name: 'CustomPermission', url: `${baseUrl}meta_custompermission.htm` },
    { name: 'CustomSite', url: `${baseUrl}meta_customsite.htm` },
    { name: 'CustomTab', url: `${baseUrl}meta_customtab.htm` },
    { name: 'Dashboard', url: `${baseUrl}meta_dashboard.htm` },
    { name: 'DataCategoryGroup', url: `${baseUrl}meta_datacategorygroup.htm` },
    { name: 'DelegateGroup', url: `${baseUrl}meta_delegategroup.htm` },
    { name: 'Document', url: `${baseUrl}meta_document.htm` },
    { name: 'DuplicateRule', url: `${baseUrl}meta_duplicaterule.htm` },
    { name: 'EmailTemplate', url: `${baseUrl}meta_email.htm` },
    { name: 'EmbeddedServiceBranding', url: `${baseUrl}meta_embeddedservicebranding.htm` },
    { name: 'EscalationRules', url: `${baseUrl}meta_escalationrules.htm` },
    { name: 'ExternalDataSource', url: `${baseUrl}meta_externaldatasource.htm` },
    { name: 'FlexiPage', url: `${baseUrl}meta_flexipage.htm` },
    { name: 'Flow', url: `${baseUrl}meta_visual_workflow.htm` },
    { name: 'FlowDefinition', url: `${baseUrl}meta_flowdefinition.htm` },
    { name: 'GlobalValueSet', url: `${baseUrl}meta_globalvalueset.htm` },
    { name: 'Group', url: `${baseUrl}meta_group.htm` },
    { name: 'HomePageLayout', url: `${baseUrl}meta_homepagelayout.htm` },
    { name: 'Layout', url: `${baseUrl}meta_layout.htm` },
    { name: 'LightningBolt', url: `${baseUrl}meta_lightningbolt.htm` },
    { name: 'LightningComponentBundle', url: `${baseUrl}meta_lightningcomponentbundle.htm` },
    { name: 'LightningMessageChannel', url: `${baseUrl}meta_lightningmessagechannel.htm` },
    { name: 'ListView', url: `${baseUrl}meta_listview.htm` },
    { name: 'MatchingRules', url: `${baseUrl}meta_matchingrules.htm` },
    { name: 'NamedCredential', url: `${baseUrl}meta_namedcredential.htm` },
    { name: 'Network', url: `${baseUrl}meta_network.htm` },
    { name: 'PermissionSet', url: `${baseUrl}meta_permissionset.htm` },
    { name: 'PermissionSetGroup', url: `${baseUrl}meta_permissionsetgroup.htm` },
    { name: 'PlatformCachePartition', url: `${baseUrl}meta_platformcachepartition.htm` },
    { name: 'Profile', url: `${baseUrl}meta_profile.htm` },
    { name: 'Queue', url: `${baseUrl}meta_queue.htm` },
    { name: 'QuickAction', url: `${baseUrl}meta_quickaction.htm` },
    { name: 'RemoteSiteSetting', url: `${baseUrl}meta_remotesitesetting.htm` },
    { name: 'Report', url: `${baseUrl}meta_report.htm` },
    { name: 'ReportType', url: `${baseUrl}meta_reporttype.htm` },
    { name: 'Role', url: `${baseUrl}meta_role.htm` },
    { name: 'SamlSsoConfig', url: `${baseUrl}meta_samlssoconfig.htm` },
    { name: 'Scontrol', url: `${baseUrl}meta_scontrol.htm` },
    { name: 'Settings', url: `${baseUrl}meta_settings.htm` },
    { name: 'SharingRules', url: `${baseUrl}meta_sharingrules.htm` },
    { name: 'SiteDotCom', url: `${baseUrl}meta_sitedotcom.htm` },
    { name: 'StandardValueSet', url: `${baseUrl}meta_standardvalueset.htm` },
    { name: 'StaticResource', url: `${baseUrl}meta_staticresources.htm` },
    { name: 'Territory', url: `${baseUrl}meta_territory.htm` },
    { name: 'Territory2', url: `${baseUrl}meta_territory2.htm` },
    { name: 'Territory2Model', url: `${baseUrl}meta_territory2model.htm` },
    { name: 'Territory2Rule', url: `${baseUrl}meta_territory2rule.htm` },
    { name: 'Territory2Type', url: `${baseUrl}meta_territory2type.htm` },
    { name: 'TopicsForObjects', url: `${baseUrl}meta_topicsforobjects.htm` },
    { name: 'TransactionSecurityPolicy', url: `${baseUrl}meta_transactionsecuritypolicy.htm` },
    { name: 'Translations', url: `${baseUrl}meta_translations.htm` },
    { name: 'ValidationRule', url: `${baseUrl}meta_validationrule.htm` },
    { name: 'WaveApplication', url: `${baseUrl}meta_waveapplication.htm` },
    { name: 'Workflow', url: `${baseUrl}meta_workflow.htm` }
  ];

  return knownTypes;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Salesforce Metadata API Complete Scraper

Discovers all metadata types from the documentation and scrapes each one
to produce output identical to metadata_types_map.json

Usage:
  npm run scrape:all-metadata
  npm run scrape:all-metadata -- --output custom-output.json

Options:
  --output <file>  Custom output file path
  --help           Show this help message
    `);
    return;
  }

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  console.log('🚀 Starting comprehensive metadata scraper...\n');
  await scrapeAllMetadataTypes(outputFile);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
