/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve-bundle';
import * as fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { ProcessorInputOutput } from '../../../src/oas/documentProcessorPipeline/processorStep';
import { ExternalServiceRegistrationManager } from '../../../src/oas/ExternalServiceRegistrationManager';
import * as oasUtils from '../../../src/oasUtils';
import { createProblemTabEntriesForOasDocument } from '../../../src/oasUtils';

jest.mock('fs');
describe('ExternalServiceRegistrationManager', () => {
  let esrHandler: ExternalServiceRegistrationManager;
  let oasSpec: OpenAPIV3.Document;
  let processedOasResult: ProcessorInputOutput;
  let workspacePathStub: jest.SpyInstance;
  let fullPath: [string, string, boolean];
  let workspaceContextGetInstanceSpy: any;
  let registryAccess: RegistryAccess;
  let getTypeByNameMock: jest.SpyInstance;
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
  const mockWorkspaceContext = {
    onOrgChange: jest.fn(),
    getConnection: async () => {
      return {
        retrieveMaxApiVersion: () => '50.0',
        query: () => {
          return {
            records: [{ MasterLabel: 'TestCredential' }]
          };
        }
      };
    }
  } as any;

  beforeEach(() => {
    workspaceContextGetInstanceSpy = jest
      .spyOn(WorkspaceContextUtil, 'getInstance')
      .mockReturnValue(mockWorkspaceContext as any);
    fullPath = ['/path/to/original', '/path/to/new', false];
    workspacePathStub = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(fakeWorkspace);
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
    registryAccess = new RegistryAccess();
    getTypeByNameMock = jest.spyOn(registryAccess, 'getTypeByName');
    processedOasResult = {
      openAPIDoc: oasSpec,
      errors: []
    } as ProcessorInputOutput;

    esrHandler = new ExternalServiceRegistrationManager();
  });
  describe('initialize', () => {
    it('should initialize with right values', () => {
      esrHandler['initialize'](true, processedOasResult, fullPath);

      expect(esrHandler['isESRDecomposed']).toBe(true);
      expect(esrHandler['processedOasResult']).toBe(processedOasResult);
      expect(esrHandler['oasSpec']).toBe(processedOasResult.openAPIDoc);
      expect(esrHandler['overwrite']).toBe(false);
      expect(esrHandler['originalPath']).toBe(fullPath[0]);
      expect(esrHandler['newPath']).toBe(fullPath[1]);
    });

    it('should initialize with overwrite set to true when paths are the same', async () => {
      await esrHandler['initialize'](false, processedOasResult, ['/path/to/file.xml', '/path/to/file.xml', true]);
      expect(esrHandler['overwrite']).toBe(true);
    });

    it('should initialize with overwrite set to false when paths are different', async () => {
      await esrHandler['initialize'](false, processedOasResult, ['/path/to/original.xml', '/path/to/new.xml', false]);
      expect(esrHandler['overwrite']).toBe(false);
    });
  });

  describe('generateEsrMD', () => {
    it('should throw an error if org version is not retrieved', async () => {
      workspaceContextGetInstanceSpy.mockReturnValue({
        getConnection: async () => {
          return {
            retrieveMaxApiVersion: () => undefined
          };
        }
      });

      await expect(esrHandler.generateEsrMD(true, processedOasResult, fullPath)).rejects.toThrow(
        nls.localize('error_retrieving_org_version')
      );
    });

    it('should call the necessary methods to generate ESR metadata', async () => {
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('TestCredential');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      jest.spyOn(esrHandler, 'initialize' as any);
      jest.spyOn(esrHandler, 'writeAndOpenEsrFile').mockResolvedValue();
      jest.spyOn(esrHandler, 'displayFileDifferences').mockResolvedValue();
      jest.spyOn(oasUtils, 'createProblemTabEntriesForOasDocument').mockImplementation();

      await esrHandler.generateEsrMD(true, processedOasResult, fullPath);

      expect(esrHandler['initialize']).toHaveBeenCalledWith(false, processedOasResult, fullPath);
      expect(esrHandler.writeAndOpenEsrFile).toHaveBeenCalled();
      expect(esrHandler.displayFileDifferences).toHaveBeenCalled();
      expect(createProblemTabEntriesForOasDocument).toHaveBeenCalledWith(fullPath[1], processedOasResult, false);
    });
  });

  describe('promptNamedCredentialSelection', () => {
    it('should prompt the user to select a named credential', async () => {
      const namedCredentials = {
        records: [{ MasterLabel: 'TestCredential1' }, { MasterLabel: 'TestCredential2' }]
      };
      const quickPickSpy = (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('TestCredential1');

      const result = await esrHandler.promptNamedCredentialSelection(namedCredentials);

      expect(quickPickSpy).toHaveBeenCalledWith(['TestCredential1', 'TestCredential2', nls.localize('enter_new_nc')], {
        placeHolder: nls.localize('select_named_credential')
      });
      expect(result).toBe('TestCredential1');
    });

    it('should return undefined if no named credentials are provided', async () => {
      const result = await esrHandler.promptNamedCredentialSelection(undefined);

      expect(result).toBeUndefined();
    });
  });

  it('displayFileDifferences', async () => {
    esrHandler['initialize'](true, processedOasResult, fullPath);

    await esrHandler.displayFileDifferences();

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      vscode.Uri.file('/path/to/original.xml'),
      vscode.Uri.file('/path/to/new.xml'),
      'Manual Diff of ESR XML Files'
    );
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

      getTypeByNameMock.mockReturnValue({ directoryName: mockDirectoryName } as any);
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(mockFolderPath);

      const result = await esrHandler.getFolderForArtifact();

      expect(result).toBe(path.resolve(mockFolderPath));
      expect(vscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: nls.localize('select_folder_for_oas'),
        value: mockDefaultESRFolder
      });
    });

    it('should return undefined if no folder is selected', async () => {
      const mockDirectoryName = 'externalServiceRegistrations';
      const mockDefaultESRFolder = path.join(
        workspaceUtils.getRootWorkspacePath(),
        'force-app',
        'main',
        'default',
        mockDirectoryName
      );

      getTypeByNameMock.mockReturnValue({ directoryName: mockDirectoryName } as any);
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

      const result = await esrHandler.getFolderForArtifact();

      expect(result).toBeUndefined();
      expect(vscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: nls.localize('select_folder_for_oas'),
        value: mockDefaultESRFolder
      });
    });
  });

  it('createESRObject', () => {
    const description = 'Test Description';
    const className = 'TestClass';
    const safeOasSpec = 'safeOasSpec';
    const operations: any = [{ active: true, name: 'getPets' }];
    const orgVersion = '50.0';
    const namedCredential = 'TestCredential';

    const result = esrHandler.createESRObject(
      description,
      className,
      safeOasSpec,
      operations,
      orgVersion,
      namedCredential
    );

    expect(result).toHaveProperty('ExternalServiceRegistration');
    expect(result.ExternalServiceRegistration).toHaveProperty('description', description);
    expect(result.ExternalServiceRegistration).toHaveProperty('label', className);
    expect(result.ExternalServiceRegistration).toHaveProperty('schema', safeOasSpec);
    expect(result.ExternalServiceRegistration).toHaveProperty('operations', operations);
    expect(result.ExternalServiceRegistration).toHaveProperty('namedCredentialReference', namedCredential);
  });

  it('extractInfoProperties', () => {
    esrHandler['initialize'](true, processedOasResult, fullPath);
    const result = esrHandler.extractInfoProperties();

    expect(result).toEqual({
      description: 'oas description',
      version: '1.0.0'
    });
  });

  it('getOperationsFromYaml', () => {
    esrHandler['initialize'](true, processedOasResult, fullPath);
    const result = esrHandler.getOperationsFromYaml();

    expect(result).toEqual([{ active: true, name: 'getPets' }]);
  });

  it('buildESRXml', async () => {
    jest.spyOn(esrHandler, 'extractInfoProperties').mockReturnValue({
      description: 'oas description',
      version: '1.0.0'
    });
    jest.spyOn(esrHandler, 'getOperationsFromYaml').mockReturnValue([{ active: true, name: 'getPets' }]);
    const existingContent = '<xml></xml>';
    const namedCredential = 'TestCredential';
    const orgVersion = '50.0';

    const result = await esrHandler.buildESRXml(existingContent, namedCredential, orgVersion);

    expect(result).toContain('<ExternalServiceRegistration');
    expect(result).toContain('<operations>');
    expect(result).toContain('<description>oas description</description>');
  });

  it('buildESRYaml', () => {
    jest.spyOn(esrHandler, 'replaceXmlToYaml').mockReturnValue('/path/to/esr.yaml');
    const esrXmlPath = '/path/to/esr.xml';
    const safeOasSpec = 'safeOasSpec';

    esrHandler.buildESRYaml(esrXmlPath, safeOasSpec);

    expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/esr.yaml', safeOasSpec, 'utf8');
  });

  it('replaceXmlToYaml', () => {
    const filePath = '/path/to/esr.externalServiceRegistration-meta.xml';
    const result = esrHandler.replaceXmlToYaml(filePath);

    expect(result).toBe('/path/to/esr.yaml');
  });
});
