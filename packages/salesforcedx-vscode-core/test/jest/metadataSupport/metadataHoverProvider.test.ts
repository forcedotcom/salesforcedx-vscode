/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  MetadataHoverProvider,
  isMetadataFile,
  extractMetadataType,
  extractFieldInfo,
  findParentMetadataType
} from '../../../src/metadataSupport/metadataHoverProvider';

// Mock MarkdownString after import
(vscode.MarkdownString as jest.Mock) = jest.fn().mockImplementation(() => ({
  appendCodeblock: jest.fn().mockReturnThis(),
  appendMarkdown: jest.fn().mockReturnThis(),
  value: ''
}));

(vscode.Hover as jest.Mock) = jest.fn().mockImplementation((contents, range) => ({
  contents,
  range
}));

// Mock document
const createMockDocument = (fileName: string, content: string) =>
  ({
    fileName,
    getText: jest.fn((range?: vscode.Range) => {
      if (!range) return content;
      const lines = content.split('\n');
      if (range.start.line === range.end.line) {
        const line = lines[range.start.line] || '';
        return line.substring(range.start.character, range.end.character);
      }
      return content; // For multi-line ranges, return full content for simplicity
    }),
    getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
      const lines = content.split('\n');
      const line = lines[position.line];
      if (!line) return undefined;

      // Look for XML element tags like <elementName> and find the element name
      const xmlElementRegex = /<(\/?)([\w:]+)(\s|>|\/)/g;
      let match;

      while ((match = xmlElementRegex.exec(line)) !== null) {
        const [fullMatch, , elementName] = match;
        const matchStart = match.index;
        const matchEnd = match.index + fullMatch.length;

        // Check if cursor is within this element
        if (position.character >= matchStart && position.character <= matchEnd) {
          // Return the range for the element name only (excluding < and >)
          const nameStart = matchStart + 1 + (match[1] ? match[1].length : 0); // Skip < and optional /
          const nameEnd = nameStart + elementName.length;
          return {
            start: { line: position.line, character: nameStart },
            end: { line: position.line, character: nameEnd }
          } as vscode.Range;
        }
      }

      // Fallback to original word finding logic
      let start = position.character;
      let end = position.character;

      // Move start backwards to find word beginning
      while (start > 0 && /[a-zA-Z_]/.test(line[start - 1])) {
        start--;
      }

      // Move end forwards to find word end
      while (end < line.length && /[a-zA-Z_]/.test(line[end])) {
        end++;
      }

      // If no word found, return undefined
      if (start === end) return undefined;

      return {
        start: { line: position.line, character: start },
        end: { line: position.line, character: end }
      } as vscode.Range;
    }),
    lineAt: jest.fn((line: number) => ({
      text: content.split('\n')[line] || '',
      lineNumber: line
    }))
  }) as any;

describe('MetadataHoverProvider', () => {
  let hoverProvider: MetadataHoverProvider;

  beforeEach(() => {
    hoverProvider = new MetadataHoverProvider();
    jest.clearAllMocks();
  });

  describe('isMetadataFile', () => {
    it('should identify metadata files correctly', () => {
      const metadataDoc = createMockDocument('test-meta.xml', '<ApexClass>');
      const regularDoc = createMockDocument('test.txt', 'some text');

      // Test the exported function directly
      expect(isMetadataFile(metadataDoc)).toBe(true);
      expect(isMetadataFile(regularDoc)).toBe(false);
    });

    it('should identify XML files with metadata namespace', () => {
      const xmlDoc = createMockDocument(
        'test.xml',
        '<?xml version="1.0"?><root xmlns="http://soap.sforce.com/2006/04/metadata">'
      );

      expect(isMetadataFile(xmlDoc)).toBe(true);
    });
  });

  describe('extractMetadataType', () => {
    it('should extract metadata type from XML element', () => {
      const result = extractMetadataType('<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">', 'ApexClass', 5);

      expect(result).toBe('ApexClass');
    });

    it('should handle namespaced elements', () => {
      const result = extractMetadataType('<tns:CustomObject>', 'CustomObject', 10);

      expect(result).toBe('CustomObject');
    });

    it('should return null for non-metadata elements', () => {
      const result = extractMetadataType('<div>', 'div', 2);

      expect(result).toBeNull();
    });
  });

  describe('provideHover', () => {
    it('should return null for non-metadata files', async () => {
      const document = createMockDocument('test.txt', 'some text');
      const position = { line: 0, character: 5 } as vscode.Position;

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).toBeNull();
    });

    it('should return null when no word at position', async () => {
      const document = createMockDocument('test-meta.xml', '<ApexClass>');
      const position = { line: 0, character: 100 } as vscode.Position; // Position beyond text

      // Mock getWordRangeAtPosition to return undefined
      document.getWordRangeAtPosition.mockReturnValue(undefined);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).toBeNull();
    });
  });

  describe('extractFieldInfo', () => {
    it('should extract field information for internal fields within CustomObject', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Test Object</label>
    <enableActivities>true</enableActivities>
    <deploymentStatus>Deployed</deploymentStatus>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 3, character: 10 } as vscode.Position; // Within '<enableActivities>' tag

      const result = extractFieldInfo(document, position);

      expect(result).toEqual({
        metadataType: 'CustomObject',
        fieldName: 'enableActivities',
        intermediateLayers: []
      });
    });

    it('should extract field information for common fields', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <description>Test class description</description>
    <status>Active</status>
</ApexClass>`;

      const document = createMockDocument('TestClass.cls-meta.xml', content);
      const position = { line: 3, character: 8 } as vscode.Position; // Position inside '<description>' tag

      const result = extractFieldInfo(document, position);

      expect(result).toEqual({
        metadataType: 'ApexClass',
        fieldName: 'description',
        intermediateLayers: []
      });
    });

    it('should handle namespaced field elements', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<tns:Flow xmlns:tns="http://soap.sforce.com/2006/04/metadata">
    <tns:status>Active</tns:status>
    <tns:processType>Flow</tns:processType>
</tns:Flow>`;

      const document = createMockDocument('TestFlow.flow-meta.xml', content);
      const position = { line: 2, character: 15 } as vscode.Position; // Position inside '<tns:status>' tag

      const result = extractFieldInfo(document, position);

      expect(result).toEqual({
        metadataType: 'Flow',
        fieldName: 'status',
        intermediateLayers: []
      });
    });

    it('should return null for metadata type elements (not fields)', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Test Object</label>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 1, character: 5 } as vscode.Position; // Position on 'CustomObject'

      const result = extractFieldInfo(document, position);

      expect(result).toBeNull();
    });

    it('should handle nested field structures', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<Prompt xmlns="http://soap.sforce.com/2006/04/metadata">
    <promptVersions>
        <body>Welcome to the prompt</body>
        <displayType>Modal</displayType>
        <title>Test Prompt</title>
        <versionNumber>1</versionNumber>
    </promptVersions>
</Prompt>`;

      const document = createMockDocument('TestPrompt.prompt-meta.xml', content);
      const position = { line: 4, character: 15 } as vscode.Position; // Position inside '<displayType>' tag

      const result = extractFieldInfo(document, position);

      expect(result).toEqual({
        metadataType: 'Prompt',
        fieldName: 'displayType',
        intermediateLayers: []
      });
    });
  });

  describe('findParentMetadataType', () => {
    it('should find parent metadata type from current line', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Test Object</label>
    <enableActivities>true</enableActivities>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);

      const result = findParentMetadataType(document, 3);

      expect(result).toBe('CustomObject');
    });

    it('should find parent metadata type from multiple lines above', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <description>Test description</description>

    <status>Active</status>
</ApexClass>`;

      const document = createMockDocument('TestClass.cls-meta.xml', content);

      const result = findParentMetadataType(document, 5);

      expect(result).toBe('ApexClass');
    });

    it('should handle namespaced parent elements', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<tns:Flow xmlns:tns="http://soap.sforce.com/2006/04/metadata">
    <tns:status>Active</tns:status>
</tns:Flow>`;

      const document = createMockDocument('TestFlow.flow-meta.xml', content);

      const result = findParentMetadataType(document, 2);

      expect(result).toBe('Flow');
    });

    it('should return null when no parent metadata type found', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
    <someField>value</someField>
</root>`;

      const document = createMockDocument('test.xml', content);

      const result = findParentMetadataType(document, 2);

      expect(result).toBeNull();
    });
  });

  describe('provideHover for internal fields', () => {
    beforeEach(() => {
      // Mock the documentation service to return test data
      const mockDocumentationService = {
        getFieldDocumentation: jest.fn()
      };
      (hoverProvider as any).documentationService = mockDocumentationService;

      // Mock MarkdownString constructor
      Object.defineProperty(vscode, 'MarkdownString', {
        value: jest.fn().mockImplementation(() => ({
          appendCodeblock: jest.fn().mockReturnThis(),
          appendMarkdown: jest.fn().mockReturnThis(),
          value: ''
        })),
        writable: true,
        configurable: true
      });

      // Mock Hover constructor
      Object.defineProperty(vscode, 'Hover', {
        value: jest.fn().mockImplementation((contents, range) => ({ contents, range })),
        writable: true,
        configurable: true
      });
    });

    it('should provide hover for common field "fullName"', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>TestObject__c</fullName>
    <label>Test Object</label>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<fullName>' tag

      const mockFieldDoc = {
        name: 'fullName',
        type: 'string',
        description: 'The unique name of the metadata component. This is the API name used to reference the component.',
        required: false
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'fullName'
      );
    });

    it('should provide hover for CustomObject specific field "enableActivities"', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <enableActivities>true</enableActivities>
    <label>Test Object</label>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 10 } as vscode.Position; // Position inside '<enableActivities>' tag

      const mockFieldDoc = {
        name: 'enableActivities',
        type: 'boolean',
        description: 'Indicates whether activities (tasks and events) are enabled for this object.',
        required: false
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'enableActivities'
      );
    });

    it('should provide hover for ApexClass specific field with valid values', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <status>Active</status>
</ApexClass>`;

      const document = createMockDocument('TestClass.cls-meta.xml', content);
      const position = { line: 3, character: 8 } as vscode.Position; // Position inside '<status>' tag

      const mockFieldDoc = {
        name: 'status',
        type: 'ApexCodeUnitStatus',
        description: 'The deployment status of the Apex class.',
        required: true,
        validValues: ['Active', 'Inactive']
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'ApexClass',
        'status'
      );
    });

    it('should provide hover for Flow field with valid values', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <status>Active</status>
    <processType>Flow</processType>
</Flow>`;

      const document = createMockDocument('TestFlow.flow-meta.xml', content);
      const position = { line: 3, character: 8 } as vscode.Position; // Position inside '<processType>' tag

      const mockFieldDoc = {
        name: 'processType',
        type: 'FlowProcessType',
        description: 'The type of flow process.',
        required: false,
        validValues: ['AutoLaunchedFlow', 'Flow', 'Workflow', 'CustomEvent', 'InvocableProcess']
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'Flow',
        'processType'
      );
    });

    it('should provide hover for nested Prompt field', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<Prompt xmlns="http://soap.sforce.com/2006/04/metadata">
    <promptVersions>
        <body>Welcome to the prompt</body>
        <displayType>Modal</displayType>
        <isPublished>true</isPublished>
    </promptVersions>
</Prompt>`;

      const document = createMockDocument('TestPrompt.prompt-meta.xml', content);
      const position = { line: 5, character: 12 } as vscode.Position; // Position inside '<isPublished>' tag

      const mockFieldDoc = {
        name: 'isPublished',
        type: 'boolean',
        description: 'Indicates whether this prompt version is published and active.',
        required: false
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'Prompt',
        'isPublished'
      );
    });

    it('should return null when field documentation is not available', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <unknownField>value</unknownField>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<unknownField>' tag

      (hoverProvider as any).documentationService.getFieldDocumentation.mockReturnValue(null);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'unknownField'
      );
    });

    it('should handle self-closing field elements', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <enableActivities />
    <enableReports />
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 10 } as vscode.Position; // Position inside '<enableActivities' tag

      const mockFieldDoc = {
        name: 'enableActivities',
        type: 'boolean',
        description: 'Indicates whether activities (tasks and events) are enabled for this object.',
        required: false
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'enableActivities'
      );
    });

    it('should provide hover for fields with pattern-based documentation (enable* pattern)', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <enableFeeds>true</enableFeeds>
    <enableHistory>false</enableHistory>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<enableFeeds>' tag

      const mockFieldDoc = {
        name: 'enableFeeds',
        type: 'boolean',
        description: 'Indicates whether feeds is enabled.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'enableFeeds'
      );
    });

    it('should provide hover for fields with pattern-based documentation (is* pattern)', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<PromptVersion xmlns="http://soap.sforce.com/2006/04/metadata">
    <isPublished>true</isPublished>
    <isDefault>false</isDefault>
</PromptVersion>`;

      const document = createMockDocument('TestPromptVersion.promptVersion-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<isPublished>' tag

      const mockFieldDoc = {
        name: 'isPublished',
        type: 'boolean',
        description: 'Indicates whether this component published.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'PromptVersion',
        'isPublished'
      );
    });

    it('should provide hover for fields with pattern-based documentation (*Name pattern)', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordTypeName>Standard</recordTypeName>
    <businessProcessName>Default</businessProcessName>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<recordTypeName>' tag

      const mockFieldDoc = {
        name: 'recordTypeName',
        type: 'string',
        description: 'The name of the recordtype.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'recordTypeName'
      );
    });

    it('should provide hover for fields with pattern-based documentation (*Label pattern)', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordTypeLabel>Standard Record Type</recordTypeLabel>
    <fieldLabel>My Field</fieldLabel>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<recordTypeLabel>' tag

      const mockFieldDoc = {
        name: 'recordTypeLabel',
        type: 'string',
        description: 'The display label for the recordtype.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'recordTypeLabel'
      );
    });
  });

  describe('edge cases for internal fields', () => {
    beforeEach(() => {
      // Mock the documentation service
      const mockDocumentationService = {
        getDocumentation: jest.fn(),
        getFieldDocumentation: jest.fn()
      };
      (hoverProvider as any).documentationService = mockDocumentationService;

      // Mock MarkdownString constructor
      Object.defineProperty(vscode, 'MarkdownString', {
        value: jest.fn().mockImplementation(() => ({
          appendCodeblock: jest.fn().mockReturnThis(),
          appendMarkdown: jest.fn().mockReturnThis(),
          value: ''
        })),
        writable: true,
        configurable: true
      });

      // Mock Hover constructor
      Object.defineProperty(vscode, 'Hover', {
        value: jest.fn().mockImplementation((contents, range) => ({ contents, range })),
        writable: true,
        configurable: true
      });
    });

    it('should handle fields within deeply nested structures', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <assignments>
        <assignmentItems>
            <assignToReference>variable</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>element</elementReference>
            </value>
        </assignmentItems>
    </assignments>
</Flow>`;

      const document = createMockDocument('TestFlow.flow-meta.xml', content);
      const position = { line: 8, character: 20 } as vscode.Position; // Position inside '<elementReference>' tag

      const mockFieldDoc = {
        name: 'elementReference',
        type: 'string',
        description: 'Reference to a flow element.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith('Flow', 'value');
    });

    it('should handle mixed-case field names', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <enableBulkApi>true</enableBulkApi>
    <deploymentStatus>Deployed</deploymentStatus>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 2, character: 8 } as vscode.Position; // Position inside '<enableBulkApi>' tag

      const mockFieldDoc = {
        name: 'enableBulkApi',
        type: 'boolean',
        description: 'Indicates whether this object can be accessed via the Bulk API for large data operations.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'enableBulkApi'
      );
    });

    it('should handle fields with attributes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label translate="false">Test Object</label>
    <description translate="true">Object description</description>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 3, character: 8 } as vscode.Position; // Position inside '<description' tag

      const mockFieldDoc = {
        name: 'description',
        type: 'string',
        description: 'A description of the metadata component. This field is optional and provides additional context.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'description'
      );
    });

    it('should handle empty field elements', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <description></description>
    <enableSharing></enableSharing>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);
      const position = { line: 3, character: 8 } as vscode.Position; // Position inside '<enableSharing>' tag

      const mockFieldDoc = {
        name: 'enableSharing',
        type: 'boolean',
        description: 'Indicates whether sharing is enabled for this object.'
      };

      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      const result = await hoverProvider.provideHover(document, position, {} as any);

      expect(result).not.toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'enableSharing'
      );
    });

    it('should handle multi-line XML elements where closing > is on next line', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject
    xmlns="http://soap.sforce.com/2006/04/metadata">
    <enableActivities
        type="boolean">true</enableActivities>
</CustomObject>`;

      const document = createMockDocument('TestObject__c.object-meta.xml', content);

      // Mock return values
      const mockTypeDoc = {
        name: 'CustomObject',
        description: 'Represents a custom object in Salesforce',
        fields: []
      };

      const mockFieldDoc = {
        name: 'enableActivities',
        type: 'boolean',
        description: 'Indicates whether activities are enabled for this object',
        required: false
      };

      (hoverProvider as any).documentationService.getDocumentation.mockReturnValue(mockTypeDoc);
      (hoverProvider as any).documentationService.getFieldDocumentation.mockResolvedValue(mockFieldDoc);

      // Test hovering over "CustomObject" on line 1 (multi-line opening tag)
      const position1 = { line: 1, character: 5 } as vscode.Position;
      const result1 = await hoverProvider.provideHover(document, position1, {} as any);

      expect(result1).not.toBeNull();
      expect(result1?.contents).toBeDefined();
      expect((hoverProvider as any).documentationService.getDocumentation).toHaveBeenCalledWith('CustomObject');

      // Test hovering over "enableActivities" on line 3 (multi-line field element)
      const position2 = { line: 3, character: 10 } as vscode.Position;
      const result2 = await hoverProvider.provideHover(document, position2, {} as any);

      expect(result2).not.toBeNull();
      expect((hoverProvider as any).documentationService.getFieldDocumentation).toHaveBeenCalledWith(
        'CustomObject',
        'enableActivities'
      );
    });
  });
});
