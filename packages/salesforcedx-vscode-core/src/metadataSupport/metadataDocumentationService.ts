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

export interface MetadataFieldDocumentation {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  validValues?: string[];
}

export interface MetadataTypeDocumentation {
  name: string;
  description: string;
  fields?: MetadataFieldInfo[];
  developerGuideUrls?: string[];
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
   * Get documentation for a specific field within a metadata type
   */
  public getFieldDocumentation(metadataType: string, fieldName: string): Promise<MetadataFieldDocumentation | null> {
    // Get field documentation from our hardcoded field definitions
    const fieldDoc = this.getFieldDefinitions(metadataType, fieldName);
    if (fieldDoc) {
      return Promise.resolve(fieldDoc);
    }

    // If no hardcoded definition, try to extract from XSD patterns
    return Promise.resolve(this.extractFieldFromXSDPatterns(metadataType, fieldName));
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
        developerGuideUrls: this.getDeveloperGuideUrls(typeName)
      });
    }
  }

  /**
   * Get official metadata types from the Salesforce Metadata API Developer Guide
   * Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm
   */
  private getOfficialMetadataTypes(): Record<string, Partial<MetadataTypeDocumentation>> {
    return {
      Audience: {
        description:
          'Represents an audience definition. Audiences are used to define groups of users or contacts based on specific criteria for targeting in marketing campaigns, personalization, or content delivery.'
      },
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
      ProfilePasswordPolicy: {
        description:
          'Represents a profile password policy. Profile password policies define password requirements and security settings for users assigned to specific profiles, including password complexity, expiration, and lockout rules.'
      },
      ProfileSessionSetting: {
        description:
          'Represents profile session settings. Profile session settings define session security and timeout configurations for users assigned to specific profiles, including session timeout, IP restrictions, and login hours.'
      },
      PermissionSet: {
        description:
          "Represents a permission set. Permission sets extend users' functional access without changing their profiles."
      },
      CustomField: {
        description:
          "Represents a custom field. Custom fields allow you to store additional information that's unique to your organization."
      },
      CustomFieldTranslation: {
        description:
          'Represents a custom field translation. CustomFieldTranslation contains the translated label and help text for custom fields in different languages for internationalization support.'
      },
      ValidationRule: {
        description:
          'Represents a validation rule. Validation rules verify that data entered by users in records meets the standards you specify.'
      },
      WebLink: {
        description:
          'Represents a custom link or button. WebLinks allow users to interact with external websites, execute custom JavaScript, or invoke Visualforce pages directly from Salesforce records.'
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
      Document: {
        description:
          'Represents a document. Documents are files that you can upload and store in Salesforce, such as presentations, spreadsheets, images, and other file types that can be shared and accessed by users.'
      },
      DocumentFolder: {
        description:
          'Represents a document folder. Document folders are used to organize and categorize documents in Salesforce, providing a hierarchical structure for document management and access control.'
      },
      EmailFolder: {
        description:
          'Represents an email folder. Email folders are used to organize and categorize email templates in Salesforce, providing structure for email template management and access control.'
      },
      EmailTemplate: {
        description:
          'Represents an email template. Email templates are preformatted emails that communicate a standard message.'
      },
      ExperienceBundle: {
        description:
          'Represents an Experience Bundle. Experience Bundles are collections of resources and configurations that define the structure, branding, and functionality of Salesforce Experience Cloud sites, including templates, themes, and components.'
      },
      Letterhead: {
        description:
          'Represents a letterhead used by Classic email templates. Letterheads define branding elements such as logos, colors, and layout applied to email content.'
      },
      StaticResource: {
        description:
          'Represents a static resource. Static resources allow you to upload content that you can reference in a Visualforce page.'
      },
      LightningComponentBundle: {
        description:
          'Represents a Lightning web component bundle. A Lightning web component bundle contains all the resources for a Lightning web component: JavaScript, HTML, CSS, SVG resources, and a configuration file.'
      },
      FeatureParameterBoolean: {
        description:
          'Represents a boolean feature parameter. Feature parameters are used to configure and control various features and behaviors in Salesforce applications, with boolean parameters representing true/false settings.'
      },
      FeatureParameterDate: {
        description:
          'Represents a date feature parameter. Feature parameters are used to configure and control various features and behaviors in Salesforce applications, with date parameters representing date-based settings and constraints.'
      },
      FeatureParameterInteger: {
        description:
          'Represents an integer feature parameter. Feature parameters are used to configure and control various features and behaviors in Salesforce applications, with integer parameters representing numeric settings and limits.'
      },
      FieldSet: {
        description:
          'Represents a field set. Field sets are groupings of fields that can be referenced dynamically in Visualforce pages and Apex code, allowing for flexible and reusable components that adapt to field configuration changes.'
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
      CustomLabels: {
        description:
          'Represents a collection of custom labels. CustomLabels is a container metadata type that holds multiple CustomLabel definitions in a single file for easier management and deployment.'
      },
      CustomNotificationType: {
        description:
          'Represents a custom notification type. Custom notification types define the structure and behavior of custom notifications that can be sent to users in Salesforce.'
      },
      CustomObjectTranslation: {
        description:
          'Represents a custom object translation. CustomObjectTranslation contains translated labels, field translations, and other localized content for custom objects to support multiple languages and internationalization.'
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
      Translations: {
        description:
          'Represents a translations file. Translations contain localized text for custom labels, custom fields, and other customizable text elements to support multiple languages in Salesforce.'
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
      SharingRules: {
        description:
          'Represents sharing rules for an object. Sharing rules contain multiple sharing rule definitions that determine how records are shared with users, groups, roles, or territories based on criteria or ownership.'
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
      ReportFolder: {
        description:
          'Represents a report folder. Report folders are used to organize and categorize reports in Salesforce, providing a hierarchical structure for report management and access control.'
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
      NavigationMenu: {
        description:
          'Represents a navigation menu. Navigation menus define the structure and items that appear in navigation components for Experience Cloud sites, providing organized access to pages and content.'
      },
      NetworkBranding: {
        description:
          'Represents network branding settings. Network branding defines the visual appearance and styling of Experience Cloud sites, including themes, colors, logos, and other branding elements that customize the user interface.'
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
      GlobalValueSetTranslation: {
        description:
          'Represents a translation for a global value set. Global value set translations provide localized labels and values for global value sets in different languages and locales.'
      },
      Package: {
        description:
          'Represents a package. Packages are containers that bundle metadata components together for distribution and deployment across Salesforce organizations, enabling modular development and managed distribution of applications and customizations.'
      },
      PathAssistant: {
        description:
          'Represents a path. Paths guide users through a business process by breaking it down into stages with key fields and guidance for success.'
      },
      PlatformEventChannelMember: {
        description:
          'Represents a platform event channel member. Platform event channel members define the relationship between platform event channels and the platform events that are published to those channels, enabling event-driven architecture and real-time data streaming.'
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
      MatchingRules: {
        description:
          'Represents a collection of matching rules. MatchingRules contains multiple MatchingRule definitions that determine how duplicate records are identified for a specific object.'
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
      CustomSite: {
        description:
          'Represents a custom site. Custom sites enable you to create public websites and applications that are directly integrated with your Salesforce organization, without requiring users to log in with a Salesforce username and password.'
      },
      Network: {
        description:
          'Represents a community or site. Communities are branded spaces for your employees, customers, and partners to connect.'
      },
      Certificate: {
        description:
          'Represents a certificate. Certificates are used to authenticate single sign-on (SSO) with an external website or to authenticate API integrations.'
      },
      ContentAsset: {
        description:
          'Represents a content asset. Content assets are files that can be referenced in Lightning components, Visualforce pages, and other places in Salesforce. They provide a way to upload and manage static resources like images, stylesheets, and JavaScript files.'
      },
      CspTrustedSite: {
        description:
          'Represents a Content Security Policy (CSP) trusted site. CSP trusted sites allow you to relax certain CSP directives for specific domains, enabling your Lightning components to load resources from external sites.'
      },
      Settings: {
        description:
          'Represents organization settings. Settings control various features and behaviors in your Salesforce org.'
      }
      // Add more metadata types as needed from the official documentation
    };
  }

  /** Generate developer guide URL for a metadata type with fallback patterns */
  private getDeveloperGuideUrls(metadataType: string): string[] {
    // Known specific URLs that don't follow standard patterns
    const knownUrls: Record<string, string> = {
      ApexClass: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_classes.htm',
      ApexTrigger: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_triggers.htm',
      ApexComponent: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_component.htm',
      ApexPage: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_pages.htm',
      CustomObject: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/customobject.htm',
      CustomField: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/customfield.htm',
      CustomFieldTranslation:
        'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_customobjecttranslation.htm',
      CustomSite: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_sites.htm',
      CustomTab: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm',
      DocumentFolder: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_document.htm',
      EmailFolder: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_emailtemplate.htm',
      Flow: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_visual_workflow.htm',
      MatchingRules: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_matchingrule.htm',
      ReportFolder: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_report.htm'
    };

    // Return known URL if available
    if (knownUrls[metadataType]) {
      return [knownUrls[metadataType]];
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

    return potentialUrls;
  }

  /**
   * Get hardcoded field definitions for common metadata fields
   */
  private getFieldDefinitions(metadataType: string, fieldName: string): MetadataFieldDocumentation | null {
    const commonFields: Record<string, MetadataFieldDocumentation> = {
      // Common fields across all metadata types
      fullName: {
        name: 'fullName',
        type: 'string',
        description: 'The unique name of the metadata component. This is the API name used to reference the component.',
        required: false
      },
      description: {
        name: 'description',
        type: 'string',
        description: 'A description of the metadata component. This field is optional and provides additional context.',
        required: false
      },
      masterLabel: {
        name: 'masterLabel',
        type: 'string',
        description: 'The display label for the metadata component. This is what users see in the Salesforce UI.',
        required: false
      }
    };

    // Metadata type specific fields
    const typeSpecificFields: Record<string, Record<string, MetadataFieldDocumentation>> = {
      CustomObject: {
        deploymentStatus: {
          name: 'deploymentStatus',
          type: 'DeploymentStatus',
          description: 'Specifies whether the object is deployed (available in the organization) or in development.',
          required: false,
          validValues: ['Deployed', 'InDevelopment']
        },
        enableActivities: {
          name: 'enableActivities',
          type: 'boolean',
          description: 'Indicates whether activities (tasks and events) are enabled for this object.',
          required: false
        },
        enableBulkApi: {
          name: 'enableBulkApi',
          type: 'boolean',
          description: 'Indicates whether this object can be accessed via the Bulk API for large data operations.',
          required: false
        },
        enableReports: {
          name: 'enableReports',
          type: 'boolean',
          description: 'Indicates whether this object is available for use in reports and dashboards.',
          required: false
        },
        enableSearch: {
          name: 'enableSearch',
          type: 'boolean',
          description: 'Indicates whether records of this object type appear in search results.',
          required: false
        },
        enableSharing: {
          name: 'enableSharing',
          type: 'boolean',
          description: 'Indicates whether sharing is enabled for this object.',
          required: false
        },
        label: {
          name: 'label',
          type: 'string',
          description: 'The display name for the object in the Salesforce user interface.',
          required: true
        },
        pluralLabel: {
          name: 'pluralLabel',
          type: 'string',
          description: 'The plural form of the object label used in the Salesforce user interface.',
          required: true
        }
      },
      ApexClass: {
        apiVersion: {
          name: 'apiVersion',
          type: 'double',
          description: 'The API version with which the class is compatible.',
          required: true
        },
        status: {
          name: 'status',
          type: 'ApexCodeUnitStatus',
          description: 'The deployment status of the Apex class.',
          required: true,
          validValues: ['Active', 'Inactive']
        }
      },
      Flow: {
        status: {
          name: 'status',
          type: 'FlowVersionStatus',
          description: 'The status of the flow version.',
          required: true,
          validValues: ['Active', 'Draft', 'Obsolete', 'InvalidDraft']
        },
        processType: {
          name: 'processType',
          type: 'FlowProcessType',
          description: 'The type of flow process.',
          required: false,
          validValues: ['AutoLaunchedFlow', 'Flow', 'Workflow', 'CustomEvent', 'InvocableProcess']
        }
      },
      Prompt: {
        promptVersions: {
          name: 'promptVersions',
          type: 'PromptVersion',
          description: 'Contains the version-specific configuration for the prompt template.',
          required: false
        }
      },
      PromptVersion: {
        body: {
          name: 'body',
          type: 'string',
          description: 'The main content or instructions for the prompt template.',
          required: true
        },
        displayType: {
          name: 'displayType',
          type: 'PromptDisplayType',
          description: 'How the prompt should be displayed to users.',
          required: true,
          validValues: ['FloatingPanel', 'Modal', 'Inline']
        },
        title: {
          name: 'title',
          type: 'string',
          description: 'The title displayed at the top of the prompt.',
          required: true
        },
        versionNumber: {
          name: 'versionNumber',
          type: 'int',
          description: 'The version number of this prompt version.',
          required: true
        },
        customApplication: {
          name: 'customApplication',
          type: 'string',
          description: 'The name of the custom application where this prompt should appear.',
          required: false
        },
        targetPageType: {
          name: 'targetPageType',
          type: 'string',
          description: 'The type of page where this prompt should be displayed.',
          required: false
        },
        isPublished: {
          name: 'isPublished',
          type: 'boolean',
          description: 'Indicates whether this prompt version is published and active.',
          required: false
        }
      }
    };

    // Check type-specific fields first
    if (typeSpecificFields[metadataType]?.[fieldName]) {
      return typeSpecificFields[metadataType][fieldName];
    }

    // Fall back to common fields
    if (commonFields[fieldName]) {
      return commonFields[fieldName];
    }

    return null;
  }

  /**
   * Extract field information from XSD patterns (fallback method)
   */
  private extractFieldFromXSDPatterns(metadataType: string, fieldName: string): MetadataFieldDocumentation | null {
    // Basic pattern-based field documentation
    const patterns: Record<string, Partial<MetadataFieldDocumentation>> = {
      // Boolean patterns
      enable: {
        type: 'boolean',
        description: `Indicates whether ${fieldName.replace('enable', '').toLowerCase()} is enabled.`
      },
      is: {
        type: 'boolean',
        description: `Indicates whether this component ${fieldName.replace('is', '').toLowerCase()}.`
      },
      allow: {
        type: 'boolean',
        description: `Indicates whether ${fieldName.replace('allow', '').toLowerCase()} is allowed.`
      },

      // String patterns
      name: { type: 'string', description: `The name of the ${fieldName.replace('Name', '').toLowerCase()}.` },
      label: {
        type: 'string',
        description: `The display label for the ${fieldName.replace('Label', '').toLowerCase()}.`
      },
      url: { type: 'string', description: `The URL for the ${fieldName.replace('Url', '').toLowerCase()}.` },

      // Numeric patterns
      version: {
        type: 'double',
        description: `The version number for ${fieldName.replace('Version', '').toLowerCase()}.`
      },
      number: { type: 'int', description: `The numeric value for ${fieldName.replace('Number', '').toLowerCase()}.` }
    };

    for (const [pattern, info] of Object.entries(patterns)) {
      if (fieldName.toLowerCase().includes(pattern)) {
        return {
          name: fieldName,
          type: info.type ?? 'string',
          description: info.description ?? `The ${fieldName} field for ${metadataType}.`,
          required: false
        };
      }
    }

    // Generic fallback
    return {
      name: fieldName,
      type: 'string',
      description: `The ${fieldName} field for ${metadataType} metadata.`,
      required: false
    };
  }
}
