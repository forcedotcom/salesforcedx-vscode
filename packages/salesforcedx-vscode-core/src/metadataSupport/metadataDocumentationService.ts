/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type MetadataFieldInfo = {
  name: string;
  type: string;
  description: string;
  required?: boolean;
};

export type MetadataFieldDocumentation = MetadataFieldInfo & { validValues?: string[] };

export type MetadataTypeDocumentation = {
  name: string;
  description: string;
  fields?: MetadataFieldInfo[];
  developerGuideUrls?: string[];
};

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
    // First, try to get field documentation from XSD-extracted metadata
    const typeDoc = this.documentationMap.get(metadataType);
    if (typeDoc?.fields) {
      const field = typeDoc.fields.find(f => f.name === fieldName);
      if (field) {
        return Promise.resolve(field as MetadataFieldDocumentation);
      }
    }

    // Fall back to hardcoded field definitions
    const fieldDoc = this.getFieldDefinitions(metadataType, fieldName);
    if (fieldDoc) {
      return Promise.resolve(fieldDoc);
    }

    // If no definition found, try to extract from XSD patterns
    return Promise.resolve(this.extractFieldFromXSDPatterns(metadataType, fieldName));
  }

  /**
   * Load metadata documentation from the Salesforce metadata XSD file
   * This reads descriptions directly from the official XSD schema
   */
  private async loadMetadataDocumentation(): Promise<void> {
    try {
      // Path resolution: from out/src/metadataSupport/ to resources/
      const xsdPath = path.join(__dirname, '..', '..', '..', 'resources', 'salesforce_metadata_api_clean.xsd');

      if (!fs.existsSync(xsdPath)) {
        console.warn('XSD file not found, falling back to hardcoded documentation');
        this.loadFallbackDocumentation();
        return;
      }

      const xsdContent = fs.readFileSync(xsdPath, 'utf-8');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: false,
        parseTagValue: false,
        trimValues: true
      });

      const parsedXsd = parser.parse(xsdContent);
      const schema = parsedXsd['xsd:schema'];

      if (!schema?.['xsd:complexType']) {
        console.warn('Invalid XSD structure, falling back to hardcoded documentation');
        this.loadFallbackDocumentation();
        return;
      }

      const complexTypes = Array.isArray(schema['xsd:complexType'])
        ? schema['xsd:complexType']
        : [schema['xsd:complexType']];

      for (const complexType of complexTypes) {
        if (!complexType['@_name']) continue;

        const typeName = complexType['@_name'];
        const annotation = complexType['xsd:annotation'];

        let description = '';
        let developerGuideUrl = '';

        if (annotation) {
          const documentation = annotation['xsd:documentation'];
          const appinfo = annotation['xsd:appinfo'];

          if (documentation) {
            description = typeof documentation === 'string' ? documentation : documentation['#text'] || '';
          }

          if (appinfo) {
            const appinfoText = typeof appinfo === 'string' ? appinfo : appinfo['#text'] || '';
            const urlMatch = appinfoText.match(/Documentation:\s*(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              developerGuideUrl = urlMatch[1];
            }
          }
        }

        // Extract field information from the complex type
        const fields = this.extractFieldsFromComplexType(complexType);

        this.documentationMap.set(typeName, {
          name: typeName,
          description: description.trim(),
          fields,
          developerGuideUrls: developerGuideUrl ? [developerGuideUrl] : this.getDeveloperGuideUrls(typeName)
        });
      }
    } catch (error) {
      console.error('Error loading XSD documentation:', error);
      this.loadFallbackDocumentation();
    }
  }

  /**
   * Extract field information from XSD complex type definition
   */
  private extractFieldsFromComplexType(complexType: any): MetadataFieldInfo[] {
    const fields: MetadataFieldInfo[] = [];

    try {
      // Navigate through the XSD structure to find elements
      const extension = complexType['xsd:complexContent']?.['xsd:extension'];
      const sequence = extension?.['xsd:sequence'] || complexType['xsd:sequence'];

      if (!sequence?.['xsd:element']) {
        return fields;
      }

      const elements = Array.isArray(sequence['xsd:element']) ? sequence['xsd:element'] : [sequence['xsd:element']];

      for (const element of elements) {
        if (!element['@_name']) continue;

        const fieldName = element['@_name'];
        const fieldType = element['@_type'] || 'string';
        const minOccurs = element['@_minOccurs'];
        const required = minOccurs !== '0';

        let description = '';
        const annotation = element['xsd:annotation'];
        if (annotation?.['xsd:documentation']) {
          const doc = annotation['xsd:documentation'];
          description = typeof doc === 'string' ? doc : doc['#text'] || '';
        }

        fields.push({
          name: fieldName,
          type: fieldType.replace('xsd:', '').replace('tns:', ''),
          description: description.trim(),
          required
        });
      }
    } catch (error) {
      console.warn('Error extracting fields from complex type:', error);
    }

    return fields;
  }

  /**
   * Load fallback documentation when XSD parsing fails
   * Uses hardcoded metadata types from the Salesforce Metadata API Developer Guide
   * Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm
   */
  private loadFallbackDocumentation(): void {
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
   * Get fallback metadata types when XSD parsing fails
   * Returns empty object to encourage fixing XSD parsing issues rather than relying on hardcoded descriptions
   */
  private getOfficialMetadataTypes(): Record<string, Partial<MetadataTypeDocumentation>> {
    // Return empty object - all documentation should come from XSD file
    // If this fallback is used, it indicates an issue with XSD parsing that should be investigated
    return {};
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
      `${baseUrl}/meta_${metadataType.replace(/([A-Z])/g, '_$1').toLowerCase()}.htm` // snake_case
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
