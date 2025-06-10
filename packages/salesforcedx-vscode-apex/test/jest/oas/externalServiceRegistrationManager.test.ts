/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../../src/messages';
import { ProcessorInputOutput } from '../../../src/oas/documentProcessorPipeline/processorStep';
import {
  ExternalServiceRegistrationManager,
  FullPath,
  replaceXmlToYaml
} from '../../../src/oas/externalServiceRegistrationManager';
import * as oasUtils from '../../../src/oasUtils';
import { createProblemTabEntriesForOasDocument } from '../../../src/oasUtils';

jest.mock('node:fs');

class MockRegistryAccess {
  getTypeByName() {
    // will be mocked in tests
  }
}

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
      errors: []
    } as ProcessorInputOutput;

    esrHandler = new ExternalServiceRegistrationManager();

    // Mock the salesforceCoreExtension property on the esrHandler instance
    (esrHandler as any).salesforceCoreExtension = {
      exports: {
        services: {
          RegistryAccess: MockRegistryAccess
        }
      }
    };
  });
  describe('initialize', () => {
    it('should initialize with right values', async () => {
      await esrHandler['initialize'](true, processedOasResult, fullPath);

      expect(esrHandler['isESRDecomposed']).toBe(true);
      expect(esrHandler['oasSpec']).toBe(processedOasResult.openAPIDoc);
      expect(esrHandler['overwrite']).toBe(false);
      expect(esrHandler['originalPath']).toBe(fullPath[0]);
      expect(esrHandler['newPath']).toBe(fullPath[1]);
    });

    it('should initialize with overwrite set to true when paths are the same', async () => {
      await esrHandler['initialize'](false, processedOasResult, ['/path/to/file.xml', '/path/to/file.xml']);
      expect(esrHandler['overwrite']).toBe(true);
    });
    it('should initialize with overwrite set to false when paths differ only by extension', async () => {
      await esrHandler['initialize'](false, processedOasResult, ['/path/to/file.xml', '/path/to/file.pdf']);
      expect(esrHandler['overwrite']).toBe(false);
    });

    it('should initialize with overwrite set to false when paths are different', async () => {
      await esrHandler['initialize'](false, processedOasResult, ['/path/to/original.xml', '/path/to/new.xml']);
      expect(esrHandler['overwrite']).toBe(false);
    });
  });

  describe('generateEsrMD', () => {
    it('should call the necessary methods to generate ESR metadata', async () => {
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('TestCredential');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      jest.spyOn(esrHandler, 'initialize' as any);
      jest.spyOn(esrHandler, 'writeAndOpenEsrFile').mockResolvedValue();
      jest.spyOn(esrHandler, 'displayFileDifferences').mockResolvedValue();
      jest.spyOn(oasUtils, 'createProblemTabEntriesForOasDocument').mockImplementation();

      await esrHandler.generateEsrMD(true, processedOasResult, fullPath);

      expect(esrHandler['initialize']).toHaveBeenCalledWith(true, processedOasResult, fullPath);
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
    const result = await esrHandler.handleExistingESR();

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

  it('getOperationsFromYaml', async () => {
    await esrHandler['initialize'](true, processedOasResult, fullPath);
    const result = esrHandler.getOperationsFromYaml();

    expect(result).toEqual([{ active: true, name: 'getPets' }]);
  });

  it('buildESRXml', async () => {
    jest.spyOn(esrHandler, 'extractInfoProperties').mockReturnValue({
      description: 'oas description'
    });
    jest.spyOn(esrHandler, 'getOperationsFromYaml').mockReturnValue([{ active: true, name: 'getPets' }]);
    await esrHandler['initialize'](true, processedOasResult, fullPath);
    const existingContent = '<xml></xml>';

    const result = await esrHandler.buildESRXml(existingContent);

    expect(result).toContain('<ExternalServiceRegistration');
    expect(result).toContain('<operations>');
    expect(result).toContain('<description>oas description</description>');
  });

  it('buildESRYaml', () => {
    const esrXmlPath = '/path/to/esr.externalServiceRegistration-meta.xml';
    const safeOasSpec = 'safeOasSpec';

    esrHandler.buildESRYaml(esrXmlPath, safeOasSpec);

    expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/esr.yaml', safeOasSpec, 'utf8');
  });

  it('replaceXmlToYaml', () => {
    const filePath = '/path/to/esr.externalServiceRegistration-meta.xml';
    const result = replaceXmlToYaml(filePath);

    expect(result).toBe('/path/to/esr.yaml');
  });
});
