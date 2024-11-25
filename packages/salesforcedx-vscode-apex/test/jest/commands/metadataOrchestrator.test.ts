/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { MetadataOrchestrator } from '../../../src/commands/metadataOrchestrator';
import { languageClientUtils } from '../../../src/languageUtils';
import { ApexOASResource } from '../../../src/openApiUtilities/schemas';
import { getTelemetryService } from '../../../src/telemetry/telemetry';
import { MockTelemetryService } from '../telemetry/mockTelemetryService';

jest.mock('../../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn()
}));

describe('MetadataOrchestrator', () => {
  let orchestrator: MetadataOrchestrator;
  let showErrorMessageMock: jest.SpyInstance;

  beforeEach(() => {
    orchestrator = new MetadataOrchestrator();
    showErrorMessageMock = jest.spyOn(notificationService, 'showErrorMessage').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isMethodEligible', () => {
    it('should return true for any method identifier', () => {
      const result = orchestrator.isMethodEligible('someMethod');
      expect(result).toBe(true);
    });
  });

  describe('extractMethodMetadata', () => {
    it('should return undefined if no active editor', () => {
      (vscode.window as any).activeTextEditor = undefined;
      const result = orchestrator.extractMethodMetadata();
      expect(result).toBeUndefined();
      expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
    });

    it('should return method metadata if method is found', () => {
      const editorStub = {
        document: {
          getText: () => '@AuraEnabled\npublic void someMethod(String param) { }',
          fileName: 'example.cls'
        },
        selection: {
          active: { line: 1 }
        }
      } as vscode.TextEditor;
      (vscode.window as any).activeTextEditor = editorStub;

      const result = orchestrator.extractMethodMetadata();
      expect(result).toEqual({
        name: 'someMethod',
        parameters: [
          {
            name: 'param',
            in: 'query',
            required: true,
            description: 'The param parameter of type String.',
            schema: { type: 'string' }
          }
        ],
        returnType: 'void',
        isAuraEnabled: true
      });
    });

    it('should throw an error if method is not Aura-enabled', () => {
      const editorStub = {
        document: {
          uri: { path: 'someClass.cls' } as vscode.Uri,
          getText: () => 'public void someMethod(String param) { }',
          fileName: 'someClass.cls'
        },
        selection: {
          active: { line: 0 }
        }
      } as vscode.TextEditor;

      (vscode.window as any).activeTextEditor = editorStub;

      expect(() => orchestrator.extractMethodMetadata()).toThrow();
    });
  });

  describe('extractAllMethodsMetadata', () => {
    it('should return undefined if no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;
      const result = await orchestrator.extractAllMethodsMetadata(undefined);
      expect(result).toBeUndefined();
      expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
    });

    it('should return metadata for all methods from active editor', async () => {
      const editorStub = {
        document: {
          uri: { path: 'someClass.cls' } as vscode.Uri,
          getText: () => '@AuraEnabled\npublic void methodOne() { }\n@AuraEnabled\npublic void methodTwo() { }',
          fileName: 'someClass.cls'
        },
        selection: {
          active: { line: 1 }
        }
      } as vscode.TextEditor;
      (vscode.window as any).activeTextEditor = editorStub;

      const result = await orchestrator.extractAllMethodsMetadata(undefined);
      expect(result).toEqual([
        {
          name: 'methodOne',
          parameters: [],
          returnType: 'void',
          isAuraEnabled: true,
          className: 'someClass'
        },
        {
          name: 'methodTwo',
          parameters: [],
          returnType: 'void',
          isAuraEnabled: true,
          className: 'someClass'
        }
      ]);
    });

    it('should throw an error if no eligible methods are found', async () => {
      const editorStub = {
        document: {
          uri: { path: 'someClass.cls' } as vscode.Uri,
          getText: () => 'public void methodOne() { }',
          fileName: 'someClass.cls'
        },
        selection: {
          active: { line: 1 }
        }
      } as vscode.TextEditor;
      (vscode.window as any).activeTextEditor = editorStub;

      await expect(() => orchestrator.extractAllMethodsMetadata(undefined)).rejects.toThrow();
    });
  });

  describe('parseMethodSignature', () => {
    it('should parse method signature and return metadata', () => {
      const methodSignature = 'public void someMethod(String param) { }';
      const result = orchestrator['parseMethodSignature'](methodSignature, true, 'someClass');
      expect(result).toEqual({
        name: 'someMethod',
        parameters: [
          {
            name: 'param',
            in: 'query',
            required: true,
            description: 'The param parameter of type String.',
            schema: { type: 'string' }
          }
        ],
        returnType: 'void',
        isAuraEnabled: true,
        className: 'someClass'
      });
    });

    it('should throw an error if method signature is invalid', () => {
      const methodSignature = 'invalid signature';
      expect(() => orchestrator['parseMethodSignature'](methodSignature, true)).toThrow();
    });
  });

  describe('mapApexTypeToJsonType', () => {
    it('should map Apex types to JSON types', () => {
      expect(orchestrator['mapApexTypeToJsonType']('String')).toEqual('string');
      expect(orchestrator['mapApexTypeToJsonType']('Integer')).toEqual('integer');
      expect(orchestrator['mapApexTypeToJsonType']('Boolean')).toEqual('boolean');
      expect(orchestrator['mapApexTypeToJsonType']('Double')).toEqual('number');
      expect(orchestrator['mapApexTypeToJsonType']('UnknownType')).toEqual('string');
    });
  });

  describe('validateEligibility', () => {
    let eligibilityDelegateSpy: jest.SpyInstance;

    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should call eligibilityDelegate with expected parameter when there are multiple uris (requests)', async () => {
      const responses = [{ isEligible: true, resourceUri: 'file.cls' }];
      const uris = [{ path: '/hello/world.cls' } as vscode.Uri, { path: 'hola/world.cls' } as vscode.Uri];
      const expectedRequest = {
        payload: [
          {
            resourceUri: '/hello/world.cls',
            includeAllMethods: true,
            includeAllProperties: true,
            positions: null,
            methodNames: [],
            propertyNames: []
          },
          {
            resourceUri: 'hola/world.cls',
            includeAllMethods: true,
            includeAllProperties: true,
            positions: null,
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      eligibilityDelegateSpy = jest.spyOn(orchestrator, 'eligibilityDelegate').mockResolvedValue(responses);
      await orchestrator.validateEligibility(uris, false);
      await expect(eligibilityDelegateSpy).toHaveBeenCalledWith(expectedRequest);
    });

    it('should throw an error when method is selected but the active editor is not available', async () => {
      (vscode.window as any).activeTextEditor = undefined;
      const uri = vscode.Uri.file('/hello/world.js');
      await expect(orchestrator.validateEligibility(uri, true)).rejects.toThrow();
    });

    it('should throw an error when method is selected but the active editor is not on an apex source file', async () => {
      const mockEditor = {
        document: { fileName: 'file.cls' },
        selection: { active: new vscode.Position(3, 5) } // Mocked cursor position
      };

      (vscode.window as any).activeTextEditor = mockEditor;
      const uri = vscode.Uri.file('/hello/world.js');
      await expect(orchestrator.validateEligibility(uri, true)).rejects.toThrow();
    });

    it('should call eligibilityDelegate with expected parameter when there is single request', async () => {
      const responses = [{ isEligible: true, resourceUri: 'file.cls' }];
      eligibilityDelegateSpy = jest.spyOn(orchestrator, 'eligibilityDelegate').mockResolvedValue(responses);
      const mockEditor = {
        document: { fileName: 'file.cls' }
      };
      // with no method selected
      const request = {
        resourceUri: 'file.cls',
        includeAllMethods: true,
        includeAllProperties: true,
        positions: null,
        methodNames: [],
        propertyNames: []
      };

      const payload = {
        payload: [request]
      };

      (vscode.window as any).activeTextEditor = mockEditor;
      await orchestrator.validateEligibility({ path: 'file.cls' } as vscode.Uri, false);
      await expect(eligibilityDelegateSpy).toHaveBeenCalledWith(payload);
    });
  });

  describe('eligibilityDelegate', () => {
    let mockLanguageClient;
    let getClientInstanceSpy;
    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should return undefined when language client not available', async () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes',
            includeAllMethods: true,
            includeAllProperties: true,
            positions: [],
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      getClientInstanceSpy = jest.spyOn(languageClientUtils, 'getClientInstance').mockReturnValue(undefined);
      const responses = await orchestrator.eligibilityDelegate(sampleRequest);
      expect(responses).toBe(undefined);
    });
  });

  describe('requestTarget', () => {
    it('request for a folder', () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes',
            includeAllMethods: true,
            includeAllProperties: true,
            positions: [],
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      expect(orchestrator.requestTarget(sampleRequest)).toBe(ApexOASResource.folder);
    });
  });

  it('request for a single class', () => {
    const sampleRequest = {
      payload: [
        {
          resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file.cls',
          includeAllMethods: true,
          includeAllProperties: true,
          positions: [],
          methodNames: [],
          propertyNames: []
        }
      ]
    };
    expect(orchestrator.requestTarget(sampleRequest)).toBe(ApexOASResource.class);
  });

  it('request for a single method or property', () => {
    const sampleRequest = {
      payload: [
        {
          resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file.cls',
          includeAllMethods: false,
          includeAllProperties: false,
          positions: [new vscode.Position(3, 5)],
          methodNames: [],
          propertyNames: []
        }
      ]
    };
    expect(orchestrator.requestTarget(sampleRequest)).toBe(ApexOASResource.singleMethodOrProp);
  });

  it('request for multiple classes', () => {
    const sampleRequest = {
      payload: [
        {
          resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file1.cls',
          includeAllMethods: true,
          includeAllProperties: true,
          positions: null,
          methodNames: [],
          propertyNames: []
        },
        {
          resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file2.cls',
          includeAllMethods: true,
          includeAllProperties: true,
          positions: null,
          methodNames: [],
          propertyNames: []
        }
      ]
    };
    expect(orchestrator.requestTarget(sampleRequest)).toBe(ApexOASResource.multiClass);
  });
});
function eventName(this: any, ...args: any[]): unknown {
  throw new Error('Function not implemented.');
}
