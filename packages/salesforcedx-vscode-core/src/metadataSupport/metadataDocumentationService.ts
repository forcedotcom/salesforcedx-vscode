/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export interface MetadataFieldInfo {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

export interface MetadataTypeDocumentation {
  name: string;
  description: string;
  fields?: MetadataFieldInfo[];
  developerGuideUrl?: string;
}

/**
 * Service for loading and providing metadata type documentation
 */
export class MetadataDocumentationService {
  private documentationMap: Map<string, MetadataTypeDocumentation> = new Map();
  private initialized = false;

  constructor(extensionContext: vscode.ExtensionContext) {
    // Extension context not needed since we're using static documentation
  }

  /**
   * Initialize the service by loading metadata documentation from XSD
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadMetadataDocumentation();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize metadata documentation service:', error);
    }
  }

  /**
   * Get documentation for a specific metadata type
   */
  public getDocumentation(metadataType: string): MetadataTypeDocumentation | null {
    return this.documentationMap.get(metadataType) || null;
  }

  /**
   * Get all available metadata types
   */
  public getAllMetadataTypes(): string[] {
    return Array.from(this.documentationMap.keys()).sort();
  }

  /**
   * Load metadata documentation from the official Salesforce Developer Guide
   * This references the authoritative documentation at:
   * https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm
   */
  private async loadMetadataDocumentation(): Promise<void> {
    // Load comprehensive metadata type documentation from the official Salesforce Developer Guide
    // This is the authoritative source of truth for all metadata types
    const metadataTypes = this.getOfficialMetadataTypes();

    for (const [typeName, typeInfo] of Object.entries(metadataTypes)) {
      this.documentationMap.set(typeName, {
        name: typeName,
        description: typeInfo.description || '',
        fields: typeInfo.fields,
        developerGuideUrl: await this.getDeveloperGuideUrl(typeName)
      });
    }
  }

  /**
   * Get official metadata types from the Salesforce Metadata API Developer Guide
   * Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm
   */
  private getOfficialMetadataTypes(): Record<string, Partial<MetadataTypeDocumentation>> {
    return {
      ApexClass: {
        description:
          'Represents an Apex class. Classes consist of other classes, user-defined methods, variables, exception types, and static initialization code.'
      },
      ApexTrigger: {
        description:
          'Represents an Apex trigger. A trigger is Apex code that executes before or after specific database operations on a Salesforce object.'
      },
      CustomObject: {
        description:
          'Represents a custom object. Custom objects are database tables that allow you to store information unique to your organization.'
      },
      Flow: {
        description:
          'Represents a Flow. Flows are applications that automate business processes by collecting data and performing actions in your Salesforce org or external systems.'
      },
      Layout: {
        description:
          'Represents a page layout. Page layouts control the layout and organization of buttons, fields, Visualforce, custom links, and related lists on object record pages.'
      },
      Profile: {
        description:
          'Represents a profile. Profiles define how users access objects and data, and what they can do within the application.'
      },
      PermissionSet: {
        description:
          "Represents a permission set. Permission sets extend users' functional access without changing their profiles."
      },
      CustomField: {
        description:
          "Represents a custom field. Custom fields allow you to store additional information that's unique to your organization."
      },
      ValidationRule: {
        description:
          'Represents a validation rule. Validation rules verify that data entered by users in records meets the standards you specify.'
      },
      WorkflowRule: {
        description:
          'Represents a workflow rule. Workflow rules automate standard internal procedures and processes to save time across your org.'
      },
      CustomTab: {
        description:
          'Represents a custom tab. Custom tabs let you display custom object data or other web content in Salesforce.'
      },
      CustomApplication: {
        description:
          'Represents a custom application. Custom applications are collections of tabs that work as a unit to provide application functionality.'
      },
      Report: {
        description:
          'Represents a report. Reports are formatted displays of Salesforce data that you can filter, group, and display in a graphical chart.'
      },
      Dashboard: {
        description:
          'Represents a dashboard. Dashboards are visual displays of key metrics and trends for records in your org.'
      },
      EmailTemplate: {
        description:
          'Represents an email template. Email templates are preformatted emails that communicate a standard message.'
      },
      StaticResource: {
        description:
          'Represents a static resource. Static resources allow you to upload content that you can reference in a Visualforce page.'
      },
      LightningComponentBundle: {
        description:
          'Represents a Lightning web component bundle. A Lightning web component bundle contains all the resources for a Lightning web component: JavaScript, HTML, CSS, SVG resources, and a configuration file.'
      }
      // Add more metadata types as needed from the official documentation
    };
  }

  /** Generate developer guide URL for a metadata type with fallback patterns */
  private async getDeveloperGuideUrl(metadataType: string): Promise<string> {
    // Known specific URLs that don't follow standard patterns
    const knownUrls: Record<string, string> = {
      ApexClass: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm',
      ApexTrigger: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_triggers.htm',
      CustomObject: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_customobject.htm',
      Flow: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_visual_workflow.htm',
      Layout: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_layout.htm',
      Profile: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_profile.htm',
      PermissionSet: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_permissionset.htm',
      CustomField: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_customfield.htm',
      ValidationRule:
        'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_validationrule.htm',
      WorkflowRule: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_workflowrule.htm',
      CustomTab: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_customtab.htm',
      CustomApplication:
        'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_customapplication.htm',
      Report: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_report.htm',
      Dashboard: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_dashboard.htm',
      EmailTemplate: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_emailtemplate.htm',
      StaticResource:
        'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_staticresource.htm',
      LightningComponentBundle:
        'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_lightningcomponentbundle.htm'
    };

    // Return known URL if available
    if (knownUrls[metadataType]) {
      return knownUrls[metadataType];
    }

    // Try multiple URL patterns for unknown metadata types
    const baseUrl = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta';
    const typeNameLower = metadataType.toLowerCase();

    // Generate potential URLs to try (in order of preference)
    const potentialUrls = [
      `${baseUrl}/meta_${typeNameLower}.htm`,
      `${baseUrl}/meta_${typeNameLower}s.htm`, // plural form
      `${baseUrl}/meta_${typeNameLower.replace(/([A-Z])/g, '_$1').toLowerCase()}.htm`, // snake_case
      `${baseUrl}/meta_${typeNameLower.replace(/([A-Z])/g, '$1').toLowerCase()}.htm` // remove camelCase
    ];

    // Test each URL to see if it redirects to the intro page
    for (const url of potentialUrls) {
      const isValid = await this.isValidDocumentationUrl(url);
      if (isValid) {
        return url;
      }
    }

    // If no valid URL found, fall back to the metadata types list
    return 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm';
  }

  /** Check if a URL is valid documentation (doesn't redirect to intro page) */
  private async isValidDocumentationUrl(url: string): Promise<boolean> {
    try {
      // Use fetch with HEAD request to check redirect without downloading content
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow' // Follow redirects to see final destination
      });

      // Check if the final URL is the intro page (indicates invalid metadata type)
      const finalUrl = response.url;

      // Return false if it redirects to intro page or if response is not ok
      return response.ok && !finalUrl.includes('meta_intro.htm');
    } catch (error) {
      // If fetch fails (network error, etc.), assume URL is invalid
      console.warn(`Failed to validate URL ${url}:`, error);
      return false;
    }
  }
}
