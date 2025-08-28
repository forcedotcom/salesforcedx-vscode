/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
    return this.documentationMap.get(metadataType) ?? null;
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
        description: typeInfo.description ?? '',
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
          'Represents an Apex class. An Apex class is a template or blueprint from which Apex objects are created. Classes consist of other classes, user-defined methods, variables, exception types, and static initialization code.'
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
      },
      FlexiPage: {
        description:
          'Represents a Lightning page. Lightning pages are custom layouts that let you design pages for use in the Salesforce mobile app and Lightning Experience.'
      },
      RemoteSiteSetting: {
        description:
          'Represents a remote site setting. Remote site settings allow you to access external URLs from Apex code and Visualforce pages.'
      },
      Prompt: {
        description:
          'Represents a prompt template for Einstein AI. Prompts define the instructions and context for AI-powered features in Salesforce.'
      },
      CustomMetadata: {
        description:
          'Represents a custom metadata type record. Custom metadata types are customizable, deployable, packageable, and upgradeable application metadata.'
      },
      CustomLabel: {
        description:
          "Represents a custom label. Custom labels enable developers to create multilingual applications by automatically presenting information in a user's native language."
      },
      Queue: {
        description:
          'Represents a queue. Queues are used to prioritize, distribute, and assign records to teams who share workloads.'
      },
      Group: {
        description:
          'Represents a public group. Public groups are collections of individual users, other groups, individual roles or territories, or roles or territories with their subordinates.'
      },
      Role: {
        description:
          'Represents a role in the role hierarchy. Roles control the level of visibility that users have into your Salesforce data.'
      },
      Territory2: {
        description:
          'Represents a territory in Territory Management 2.0. Territories are used to structure your organization and control data access based on geographical or other criteria.'
      },
      AssignmentRule: {
        description:
          'Represents an assignment rule. Assignment rules automatically assign cases to users or queues, or leads to users or queues.'
      },
      AutoResponseRule: {
        description:
          'Represents an auto-response rule. Auto-response rules automatically send email responses to leads or cases based on the attributes of the submitted record.'
      },
      EscalationRule: {
        description:
          'Represents an escalation rule. Escalation rules automatically escalate cases to the appropriate users so that cases are resolved in a timely manner.'
      },
      SharingRule: {
        description:
          'Represents a sharing rule. Sharing rules extend sharing access to users in public groups, roles, or territories.'
      },
      Workflow: {
        description:
          'Represents a workflow rule. Workflow rules automate standard internal procedures and processes to save time across your org.'
      },
      ApexPage: {
        description:
          'Represents a Visualforce page. Visualforce pages are web pages that can be displayed in the Salesforce user interface or used to override standard pages.'
      },
      ApexComponent: {
        description:
          'Represents a Visualforce component. Visualforce components are reusable sections of code that can be used on multiple Visualforce pages.'
      },
      ReportType: {
        description:
          'Represents a custom report type. Custom report types define the set of records and fields available to a report based on the relationships between a primary object and its related objects.'
      },
      ConnectedApp: {
        description:
          'Represents a connected app. Connected apps are applications that can connect to Salesforce over Identity and Data APIs.'
      },
      AuthProvider: {
        description:
          'Represents an authentication provider. Authentication providers enable users to log in to Salesforce using their login credentials from an external service.'
      },
      NamedCredential: {
        description:
          'Represents a named credential. Named credentials specify the URL of a callout endpoint and its required authentication parameters in one definition.'
      },
      BusinessProcess: {
        description:
          'Represents a business process. Business processes are used to track the stages of a record through a process, such as the sales process for opportunities.'
      },
      RecordType: {
        description:
          'Represents a record type. Record types let you offer different business processes, picklist values, and page layouts to different users.'
      },
      GlobalValueSet: {
        description:
          'Represents a global value set. Global value sets are shared sets of picklist values that you can use in custom picklist and multi-select picklist fields.'
      },
      PathAssistant: {
        description:
          'Represents a path. Paths guide users through a business process by breaking it down into stages with key fields and guidance for success.'
      },
      CompactLayout: {
        description:
          "Represents a compact layout. Compact layouts display a record's key fields at a glance in the highlights panel in Lightning Experience and Salesforce mobile app."
      },
      ListView: {
        description:
          'Represents a list view. List views are filtered lists of records that show only the records that meet specific criteria.'
      },
      QuickAction: {
        description:
          'Represents a quick action. Quick actions let users quickly create records, update records, log calls, send emails, and more.'
      },
      FlowDefinition: {
        description:
          'Represents a flow definition. Flow definitions contain the metadata for flows, including versioning and activation status.'
      },
      MatchingRule: {
        description:
          'Represents a matching rule. Matching rules determine how duplicate records are identified when users create or edit records.'
      },
      DuplicateRule: {
        description:
          'Represents a duplicate rule. Duplicate rules define what happens when users create or edit records that have duplicates.'
      },
      ExternalDataSource: {
        description:
          "Represents an external data source. External data sources specify how to connect to data that's stored outside your Salesforce org."
      },
      AuraDefinitionBundle: {
        description:
          'Represents an Aura component bundle. Aura components are the self-contained and reusable units of an app.'
      },
      LightningMessageChannel: {
        description:
          'Represents a Lightning message channel. Lightning message channels are used for communication between Lightning web components, Aura components, and Visualforce pages.'
      },
      Bot: {
        description:
          'Represents an Einstein Bot. Einstein Bots are AI-powered chatbots that can handle routine customer service tasks.'
      },
      CustomPermission: {
        description:
          'Represents a custom permission. Custom permissions give you a way to provide access to custom processes or apps.'
      },
      Network: {
        description:
          'Represents a community or site. Communities are branded spaces for your employees, customers, and partners to connect.'
      },
      Certificate: {
        description:
          'Represents a certificate. Certificates are used to authenticate single sign-on (SSO) with an external website or to authenticate API integrations.'
      },
      Settings: {
        description:
          'Represents organization settings. Settings control various features and behaviors in your Salesforce org.'
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
      CustomObject: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/customobject.htm',
      Flow: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_visual_workflow.htm'
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
      `${baseUrl}/meta_${typeNameLower}es.htm`, // plural form with es suffix
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
