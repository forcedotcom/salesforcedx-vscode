/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { XMLParser } from 'fast-xml-parser';
import * as path from 'node:path';
import { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getVscodeCoreExtension } from '../../../src/coreExtensionUtils';
import { nls } from '../../../src/messages';
import { ProcessorInputOutput } from '../../../src/oas/documentProcessorPipeline/processorStep';
import {
  ExternalServiceRegistrationManager,
  FullPath,
  replaceXmlToYaml
} from '../../../src/oas/externalServiceRegistrationManager';
import * as oasUtils from '../../../src/oasUtils';
import { createProblemTabEntriesForOasDocument } from '../../../src/oasUtils';

jest.mock('../../../src/coreExtensionUtils');

class MockRegistryAccess {
  public getTypeByName() {
    // will be mocked in tests
  }
}

interface ParsedOperation {
  name: string;
  active: boolean;
}

interface ParsedOperations {
  // Operations can be structured in different ways depending on XMLBuilder output
  // Single operation: { name: string, active: boolean }
  // Multiple operations: { name: string[], active: boolean[] } or array of operation objects
  name?: string | string[];
  active?: boolean | boolean[] | string | string[] | number | number[];
  operation?: ParsedOperation | ParsedOperation[];
}

interface ParsedExternalServiceRegistration {
  operations: ParsedOperations;
  schema?: string;
}

interface ParsedXml {
  ExternalServiceRegistration: ParsedExternalServiceRegistration;
}

// Helper function to extract operations array from parsed XML
// Handles different XML structures: flattened single operation, array of operations, or wrapped operations
const getOperationsArray = (parsed: ParsedXml): ParsedOperation[] => {
  const ops = parsed.ExternalServiceRegistration.operations;

  // If operations are wrapped in 'operation' property
  if (ops.operation) {
    const operation = ops.operation;
    return Array.isArray(operation) ? operation : [operation];
  }

  // If operations are flattened (single operation case)
  // Note: XMLParser may convert boolean false to string "false" or 0, so we need to handle that
  if (ops.name !== undefined) {
    const names = Array.isArray(ops.name) ? ops.name : [ops.name];
    // Handle active as boolean, string, or number (XMLParser may convert false to "false" or 0)
    const activeValue = ops.active;
    let actives: boolean[];
    if (activeValue === undefined) {
      actives = [];
    } else if (Array.isArray(activeValue)) {
      actives = activeValue.map(a => {
        if (typeof a === 'boolean') return a;
        if (typeof a === 'string') {
          return a.toLowerCase() === 'true';
        }
        return Boolean(a);
      });
    } else {
      let activeBool: boolean;
      if (typeof activeValue === 'boolean') {
        activeBool = activeValue;
      } else if (typeof activeValue === 'string') {
        activeBool = activeValue.toLowerCase() === 'true';
      } else {
        activeBool = Boolean(activeValue);
      }
      actives = [activeBool];
    }

    return names.map((name, index) => ({
      name,
      active: actives[index] ?? false
    }));
  }

  return [];
};
describe('ExternalServiceRegistrationManager', () => {
  let esrHandler: ExternalServiceRegistrationManager;
  let oasSpec: OpenAPIV3.Document;
  let processedOasResult: ProcessorInputOutput;
  let fullPath: FullPath;
  const fakeWorkspace = path.join('test', 'workspace');
  const mockOperations = {
    operationId: 'getPets',
    summary: 'Get all pets',
    description: 'Returns all pets from the system that the user has access to',
    responses: {
      200: {
        description: 'A list of pets.',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  };

  beforeEach(() => {
    fullPath = ['/path/to/original', '/path/to/new'];
    jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(fakeWorkspace);
    oasSpec = {
      openapi: '3.0.0',
      info: {
        description: 'oas description',
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/pets': {
          get: mockOperations
        }
      }
    } as OpenAPIV3.Document;
    processedOasResult = {
      openAPIDoc: oasSpec,
      errors: [],
      context: undefined
    } as ProcessorInputOutput;

    esrHandler = new ExternalServiceRegistrationManager();

    // Mock vscode.workspace.fs methods
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File } as vscode.FileStat);
    jest.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
    jest.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();

    // Mock getVscodeCoreExtension to return the expected extension shape
    (getVscodeCoreExtension as jest.Mock).mockResolvedValue({
      isActive: true,
      exports: {
        services: {
          RegistryAccess: MockRegistryAccess
        }
      }
    });
  });
  describe('initialize', () => {
    it('should initialize with right values', () => {
      esrHandler['initialize'](true, processedOasResult, fullPath);

      expect(esrHandler['isESRDecomposed']).toBe(true);
      expect(esrHandler['oasSpec']).toBe(processedOasResult.openAPIDoc);
      expect(esrHandler['overwrite']).toBe(false);
      expect(esrHandler['originalPath']).toBe(fullPath[0]);
      expect(esrHandler['newPath']).toBe(fullPath[1]);
    });

    it('should initialize with orgApiVersion', () => {
      esrHandler['initialize'](true, processedOasResult, fullPath, 65.0);
      expect(esrHandler['orgApiVersion']).toBe(65.0);
    });

    it('should initialize with overwrite set to true when paths are the same', () => {
      esrHandler['initialize'](false, processedOasResult, ['/path/to/file.xml', '/path/to/file.xml']);
      expect(esrHandler['overwrite']).toBe(true);
    });
    it('should initialize with overwrite set to false when paths differ only by extension', () => {
      esrHandler['initialize'](false, processedOasResult, ['/path/to/file.xml', '/path/to/file.pdf']);
      expect(esrHandler['overwrite']).toBe(false);
    });

    it('should initialize with overwrite set to false when paths are different', () => {
      esrHandler['initialize'](false, processedOasResult, ['/path/to/original.xml', '/path/to/new.xml']);
      expect(esrHandler['overwrite']).toBe(false);
    });
  });

  describe('generateEsrMD', () => {
    it('should call the necessary methods to generate ESR metadata', async () => {
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('TestCredential');
      jest.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      jest.spyOn(esrHandler, 'initialize' as any);
      jest.spyOn(esrHandler, 'writeAndOpenEsrFile').mockResolvedValue();
      jest.spyOn(esrHandler, 'displayFileDifferences').mockResolvedValue();
      jest.spyOn(oasUtils, 'createProblemTabEntriesForOasDocument').mockImplementation();

      await esrHandler.generateEsrMD(true, processedOasResult, fullPath);

      expect(esrHandler['initialize']).toHaveBeenCalledWith(true, processedOasResult, fullPath, undefined);
      expect(esrHandler.writeAndOpenEsrFile).toHaveBeenCalled();
      expect(esrHandler.displayFileDifferences).toHaveBeenCalled();
      expect(createProblemTabEntriesForOasDocument).toHaveBeenCalledWith(fullPath[1], processedOasResult, true);
    });

    it('should call initialize with orgApiVersion when provided', async () => {
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('TestCredential');
      jest.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      jest.spyOn(esrHandler, 'initialize' as any);
      jest.spyOn(esrHandler, 'writeAndOpenEsrFile').mockResolvedValue();
      jest.spyOn(esrHandler, 'displayFileDifferences').mockResolvedValue();
      jest.spyOn(oasUtils, 'createProblemTabEntriesForOasDocument').mockImplementation();

      await esrHandler.generateEsrMD(true, processedOasResult, fullPath, 65.0);

      expect(esrHandler['initialize']).toHaveBeenCalledWith(true, processedOasResult, fullPath, 65.0);
      expect(esrHandler.writeAndOpenEsrFile).toHaveBeenCalled();
      expect(esrHandler.displayFileDifferences).toHaveBeenCalled();
      expect(createProblemTabEntriesForOasDocument).toHaveBeenCalledWith(fullPath[1], processedOasResult, true);
    });
  });

  describe('displayFileDifferences', () => {
    const xmlOriginal = '/path/to/original.externalServiceRegistration-meta.xml';
    const xmlNew = '/path/to/new.externalServiceRegistration-meta.xml';
    it('displayFileDifferences composed', async () => {
      esrHandler['initialize'](false, processedOasResult, [xmlOriginal, xmlNew]);

      await esrHandler.displayFileDifferences();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.diff',
        URI.file(xmlOriginal),
        URI.file(xmlNew),
        'Manual Diff of ESR XML Files'
      );
    });

    it('displayFileDifferences decomposed', async () => {
      const yamlOriginal = '/path/to/original.yaml';
      const yamlNew = '/path/to/new.yaml';
      esrHandler['initialize'](true, processedOasResult, [xmlOriginal, xmlNew]);

      await esrHandler.displayFileDifferences();

      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        1,
        'vscode.diff',
        URI.file(xmlOriginal),
        URI.file(xmlNew),
        'Manual Diff of ESR XML Files'
      );

      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        2,
        'vscode.diff',
        URI.file(yamlOriginal),
        URI.file(yamlNew),
        'Manual Diff of ESR YAML Files'
      );
    });
  });

  it('should handle existing ESR file', async () => {
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('merge');
    const result = await esrHandler['handleExistingESR']();

    expect(result).toBe('merge');
  });

  describe('getFolderForArtifact', () => {
    it('should return the selected folder path', async () => {
      const mockDirectoryName = 'externalServiceRegistrations';
      const mockFolderPath = '/path/to/folder';
      const mockDefaultESRFolder = path.join(
        workspaceUtils.getRootWorkspacePath(),
        'force-app',
        'main',
        'default',
        mockDirectoryName
      );

      jest
        .spyOn(MockRegistryAccess.prototype, 'getTypeByName')
        .mockImplementation(() => ({ directoryName: mockDirectoryName }));
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(mockFolderPath);

      const result = await esrHandler.getFolderForArtifact();

      expect(result).toBe(path.resolve(mockFolderPath));
      expect(vscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: nls.localize('select_folder_for_oas'),
        value: mockDefaultESRFolder
      });
    });

    it('should return undefined if no folder is selected', async () => {
      jest
        .spyOn(MockRegistryAccess.prototype, 'getTypeByName')
        .mockImplementation(() => ({ directoryName: 'externalServiceRegistrations' }));
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);
      const result = await esrHandler.getFolderForArtifact();
      expect(result).toBeUndefined();
    });

    it('should throw if registry access fails', async () => {
      jest.spyOn(MockRegistryAccess.prototype, 'getTypeByName').mockImplementation(() => {
        throw new Error('fail');
      });
      await expect(esrHandler.getFolderForArtifact()).rejects.toThrow(
        'Failed to retrieve ESR directory name from the registry.'
      );
    });
  });

  it('createESRObject', () => {
    const description = 'Test Description';
    const className = 'TestClass';
    const safeOasSpec = 'safeOasSpec';
    const operations: any = [{ active: true, name: 'getPets' }];

    const result = esrHandler.createESRObject(description, className, safeOasSpec, operations);

    expect(result).toHaveProperty('ExternalServiceRegistration');
    expect(result.ExternalServiceRegistration).toHaveProperty('description', description);
    expect(result.ExternalServiceRegistration).toHaveProperty('label', className);
    expect(result.ExternalServiceRegistration).toHaveProperty('schema', safeOasSpec);
    expect(result.ExternalServiceRegistration).toHaveProperty('operations', operations);
  });

  it('extractInfoProperties', async () => {
    await esrHandler['initialize'](true, processedOasResult, fullPath);
    const result = esrHandler.extractInfoProperties();

    expect(result).toEqual({
      description: 'oas description'
    });
  });

  describe('getOperationsFromYaml', () => {
    it('should set active to true for orgs < 66.0', async () => {
      await esrHandler['initialize'](true, processedOasResult, fullPath, 65.0);
      const result = esrHandler.getOperationsFromYaml();

      expect(result).toEqual([{ active: true, name: 'getPets' }]);
    });

    it('should set active to true when orgApiVersion is undefined', async () => {
      await esrHandler['initialize'](true, processedOasResult, fullPath);
      const result = esrHandler.getOperationsFromYaml();

      expect(result).toEqual([{ active: true, name: 'getPets' }]);
    });

    it('should set active to false for orgs >= 66.0', async () => {
      await esrHandler['initialize'](true, processedOasResult, fullPath, 66.0);
      const result = esrHandler.getOperationsFromYaml();

      expect(result).toEqual([{ active: false, name: 'getPets' }]);
    });

    it('should set active to false for orgs > 66.0', async () => {
      await esrHandler['initialize'](true, processedOasResult, fullPath, 67.0);
      const result = esrHandler.getOperationsFromYaml();

      expect(result).toEqual([{ active: false, name: 'getPets' }]);
    });
  });

  describe('buildESRXml', () => {
    it('should generate XML with active=true for orgs < 66.0', async () => {
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        65.0
      );
      const result = await esrHandler.buildESRXml(undefined);

      expect(result).toContain('<ExternalServiceRegistration');
      expect(result).toContain('<operations>');
      expect(result).toContain('<description>oas description</description>');

      // Parse XML to verify operations structure
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      expect(parsed.ExternalServiceRegistration).toBeDefined();
      expect(parsed.ExternalServiceRegistration.operations).toBeDefined();
      const operations = getOperationsArray(parsed);
      expect(operations.length).toBeGreaterThan(0);
      expect(operations[0].name).toBe('getPets');
      expect(operations[0].active).toBe(true);
    });

    it('should generate XML with active=true when orgApiVersion is undefined', async () => {
      await esrHandler['initialize'](false, processedOasResult, [
        '/path/to/test.externalServiceRegistration-meta.xml',
        '/path/to/test.externalServiceRegistration-meta.xml'
      ]);
      const result = await esrHandler.buildESRXml(undefined);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      const operations = getOperationsArray(parsed);
      expect(operations[0].active).toBe(true);
    });

    it('should generate XML with active=false for orgs >= 66.0', async () => {
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        66.0
      );
      const result = await esrHandler.buildESRXml(undefined);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      const operations = getOperationsArray(parsed);
      expect(operations[0].name).toBe('getPets');
      expect(operations[0].active).toBe(false);
    });

    it('should generate XML with active=false for orgs > 66.0', async () => {
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        67.0
      );
      const result = await esrHandler.buildESRXml(undefined);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      const operations = getOperationsArray(parsed);
      expect(operations[0].active).toBe(false);
    });

    it('should update existing XML with correct active values based on org boundaries', async () => {
      const existingXml = `<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>Existing description</description>
  <label>TestClass</label>
  <schema>existing schema</schema>
  <operations>
    <operation>
      <name>oldOperation</name>
      <active>true</active>
    </operation>
  </operations>
</ExternalServiceRegistration>`;

      // Test with org < 66.0 - should set active=true
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        65.0
      );
      const result = await esrHandler.buildESRXml(existingXml);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      const operations = getOperationsArray(parsed);
      expect(operations[0].name).toBe('getPets');
      expect(operations[0].active).toBe(true);
    });

    it('should update existing XML with active=false for orgs >= 66.0', async () => {
      const existingXml = `<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>Existing description</description>
  <label>TestClass</label>
  <schema>existing schema</schema>
  <operations>
    <operation>
      <name>oldOperation</name>
      <active>true</active>
    </operation>
  </operations>
</ExternalServiceRegistration>`;

      // Test with org >= 66.0 - should set active=false
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        66.0
      );
      const result = await esrHandler.buildESRXml(existingXml);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      const operations = getOperationsArray(parsed);
      expect(operations[0].name).toBe('getPets');
      expect(operations[0].active).toBe(false);
    });

    it('should verify XML structure includes operations with correct active attributes', async () => {
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        65.0
      );
      const result = await esrHandler.buildESRXml(undefined);

      // Verify XML contains operation elements with active attribute
      expect(result).toContain('<operations>');
      expect(result).toContain('<name>getPets</name>');
      expect(result).toContain('<active>true</active>');

      // Parse and verify structure
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      expect(parsed.ExternalServiceRegistration.operations).toBeDefined();
      const operations = getOperationsArray(parsed);
      expect(operations.length).toBeGreaterThan(0);
      expect(operations[0].name).toBe('getPets');
      expect(operations[0].active).toBe(true);
    });

    it('should verify XML structure includes operations with active=false for orgs >= 66.0', async () => {
      await esrHandler['initialize'](
        false,
        processedOasResult,
        ['/path/to/test.externalServiceRegistration-meta.xml', '/path/to/test.externalServiceRegistration-meta.xml'],
        66.0
      );
      const result = await esrHandler.buildESRXml(undefined);

      // Verify XML contains operation elements with active=false
      expect(result).toContain('<operations>');
      expect(result).toContain('<name>getPets</name>');
      expect(result).toContain('<active>false</active>');

      // Parse and verify structure
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result) as ParsedXml;
      const operations = getOperationsArray(parsed);
      expect(operations[0].active).toBe(false);
    });
  });

  describe('buildESRYaml', () => {
    it('should write YAML file with correct content', async () => {
      const esrXmlPath = '/path/to/esr.externalServiceRegistration-meta.xml';
      const safeOasSpec = 'safeOasSpec';

      await esrHandler.buildESRYaml(esrXmlPath, safeOasSpec);

      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(URI.file('/path/to/esr.yaml'), expect.any(Uint8Array));
    });
  });

  describe('YAML content in XML schema based on org boundaries', () => {
    const betaInfo = 'OpenAPI documents generated from Apex classes using Apex REST annotations are in beta.';

    it('should include x-betaInfo in YAML embedded in XML schema for orgs < 66.0 (composed mode)', async () => {
      const oasSpecWithBetaInfo: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          description: 'oas description',
          title: 'Test API',
          version: '1.0.0',
          'x-betaInfo': betaInfo
        },
        paths: {
          '/pets': {
            get: mockOperations
          }
        }
      } as OpenAPIV3.Document;

      const processedOasResultWithBeta: ProcessorInputOutput = {
        openAPIDoc: oasSpecWithBetaInfo,
        errors: [],
        context: undefined
      } as ProcessorInputOutput;

      // Composed mode (isESRDecomposed = false) - YAML is embedded in XML schema
      await esrHandler['initialize'](false, processedOasResultWithBeta, fullPath, 65.0);
      const xmlResult = await esrHandler.buildESRXml(undefined);

      // Parse XML to extract schema content
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlResult) as ParsedXml;
      const schemaContent = parsed.ExternalServiceRegistration.schema as string;

      // Verify YAML in schema contains x-betaInfo
      expect(schemaContent).toContain('x-betaInfo');
      // Beta info may be wrapped across lines in YAML, so check for key parts that appear on one line
      expect(schemaContent).toContain('OpenAPI documents generated from Apex classes');
      expect(schemaContent).toContain('annotations are in beta');
      expect(schemaContent).toContain('info:');
    });

    it('should exclude x-betaInfo from YAML embedded in XML schema for orgs >= 66.0 (composed mode)', async () => {
      const oasSpecWithoutBeta: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          description: 'oas description',
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/pets': {
            get: mockOperations
          }
        }
      } as OpenAPIV3.Document;

      const processedOasResultWithoutBeta: ProcessorInputOutput = {
        openAPIDoc: oasSpecWithoutBeta,
        errors: [],
        context: undefined
      } as ProcessorInputOutput;

      // Composed mode (isESRDecomposed = false) - YAML is embedded in XML schema
      await esrHandler['initialize'](false, processedOasResultWithoutBeta, fullPath, 66.0);
      const xmlResult = await esrHandler.buildESRXml(undefined);

      // Parse XML to extract schema content
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlResult) as ParsedXml;
      const schemaContent = parsed.ExternalServiceRegistration.schema as string;

      // Verify YAML in schema does not contain x-betaInfo
      expect(schemaContent).toContain('info:');
      expect(schemaContent).not.toContain('x-betaInfo');
      expect(schemaContent).not.toContain(betaInfo);
    });

    it('should include x-betaInfo in separate YAML file for orgs < 66.0 (decomposed mode)', async () => {
      const oasSpecWithBetaInfo: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          description: 'oas description',
          title: 'Test API',
          version: '1.0.0',
          'x-betaInfo': betaInfo
        },
        paths: {
          '/pets': {
            get: mockOperations
          }
        }
      } as OpenAPIV3.Document;

      const processedOasResultWithBeta: ProcessorInputOutput = {
        openAPIDoc: oasSpecWithBetaInfo,
        errors: [],
        context: undefined
      } as ProcessorInputOutput;

      // Decomposed mode (isESRDecomposed = true) - separate YAML file is created
      // Use a path with the proper XML extension so replaceXmlToYaml works correctly
      const decomposedFullPath: FullPath = [
        '/path/to/original.externalServiceRegistration-meta.xml',
        '/path/to/new.externalServiceRegistration-meta.xml'
      ];
      await esrHandler['initialize'](true, processedOasResultWithBeta, decomposedFullPath, 65.0);
      await esrHandler.buildESRXml(undefined);

      // Find the YAML file that was written
      const writeFileCalls = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls as [URI, Uint8Array][];
      const yamlCall = writeFileCalls.find(call => {
        const uri = call[0];
        const filePath = uri.fsPath ?? uri.toString();
        return filePath.includes('.yaml') && !filePath.includes('.xml');
      });
      expect(yamlCall).toBeDefined();

      // Get the YAML content that was written
      const yamlContent = new TextDecoder().decode(yamlCall![1]);
      expect(yamlContent).toContain('x-betaInfo');
      // Beta info may be wrapped across lines in YAML, so check for key parts that appear on one line
      expect(yamlContent).toContain('OpenAPI documents generated from Apex classes');
      expect(yamlContent).toContain('annotations are in beta');
      expect(yamlContent).toContain('info:');
    });

    it('should exclude x-betaInfo from separate YAML file for orgs >= 66.0 (decomposed mode)', async () => {
      const oasSpecWithoutBeta: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          description: 'oas description',
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/pets': {
            get: mockOperations
          }
        }
      } as OpenAPIV3.Document;

      const processedOasResultWithoutBeta: ProcessorInputOutput = {
        openAPIDoc: oasSpecWithoutBeta,
        errors: [],
        context: undefined
      } as ProcessorInputOutput;

      // Decomposed mode (isESRDecomposed = true) - separate YAML file is created
      // Use a path with the proper XML extension so replaceXmlToYaml works correctly
      const decomposedFullPath: FullPath = [
        '/path/to/original.externalServiceRegistration-meta.xml',
        '/path/to/new.externalServiceRegistration-meta.xml'
      ];
      await esrHandler['initialize'](true, processedOasResultWithoutBeta, decomposedFullPath, 66.0);
      await esrHandler.buildESRXml(undefined);

      // Find the YAML file that was written
      const writeFileCalls = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls as [URI, Uint8Array][];
      const yamlCall = writeFileCalls.find(call => {
        const uri = call[0];
        const filePath = uri.fsPath ?? uri.toString();
        return filePath.includes('.yaml') && !filePath.includes('.xml');
      });
      expect(yamlCall).toBeDefined();

      // Get the YAML content that was written
      const yamlContent = new TextDecoder().decode(yamlCall![1]);
      expect(yamlContent).toContain('info:');
      expect(yamlContent).not.toContain('x-betaInfo');
      expect(yamlContent).not.toContain('OpenAPI documents generated from Apex classes');
      expect(yamlContent).not.toContain('Apex REST annotations are in beta');
    });

    it('should exclude x-betaInfo when orgApiVersion is undefined', async () => {
      const oasSpecWithoutBeta: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          description: 'oas description',
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/pets': {
            get: mockOperations
          }
        }
      } as OpenAPIV3.Document;

      const processedOasResultWithoutBeta: ProcessorInputOutput = {
        openAPIDoc: oasSpecWithoutBeta,
        errors: [],
        context: undefined
      } as ProcessorInputOutput;

      // Composed mode with undefined orgApiVersion
      await esrHandler['initialize'](false, processedOasResultWithoutBeta, fullPath);
      const xmlResult = await esrHandler.buildESRXml(undefined);

      // Parse XML to extract schema content
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlResult) as ParsedXml;
      const schemaContent = parsed.ExternalServiceRegistration.schema as string;

      // Verify YAML in schema does not contain x-betaInfo
      expect(schemaContent).not.toContain('x-betaInfo');
      expect(schemaContent).not.toContain(betaInfo);
    });
  });

  it('replaceXmlToYaml', () => {
    const filePath = '/path/to/esr.externalServiceRegistration-meta.xml';
    const result = replaceXmlToYaml(filePath);

    expect(result).toBe('/path/to/esr.yaml');
  });
});
