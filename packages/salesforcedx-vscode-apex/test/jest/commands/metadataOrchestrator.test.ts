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

  describe('extractMetadata', () => {
    let editorStub: any;
    beforeEach(() => {
      editorStub = {
        document: {
          uri: { path: 'someClass.cls' } as vscode.Uri,
          getText: () => 'public void someMethod(String param) { }',
          fileName: 'someClass.cls'
        },
        selection: {
          active: { line: 0 }
        }
      } as vscode.TextEditor;
    });
    it('should throw an error if no eligible responses are returned', async () => {
      jest.spyOn(orchestrator, 'validateEligibility').mockResolvedValue(undefined);
      await expect(orchestrator.extractMetadata(editorStub.document.uri)).rejects.toThrow(
        'Failed to validate metadata.'
      );
    });

    it('should throw an error if the first eligible response is not eligible and method is selected', async () => {
      const mockResponse: any = [
        { isApexOasEligible: false, isEligible: false, symbols: [{ docSymbol: { name: 'someMethod' } }] }
      ];
      jest.spyOn(orchestrator, 'validateEligibility').mockResolvedValue(mockResponse);
      await expect(orchestrator.extractMetadata(editorStub.document.uri, true)).rejects.toThrow(
        'Method someMethod is not eligible for Apex Action creation. It is not annotated with @AuraEnabled or has wrong access modifiers.'
      );
    });

    it('should throw an error if the first eligible response is not eligible and method is not selected', async () => {
      const mockResponse: any = [{ isApexOasEligible: false, isEligible: false, resourceUri: '/hello/world.cls' }];
      jest.spyOn(orchestrator, 'validateEligibility').mockResolvedValue(mockResponse);
      await expect(orchestrator.extractMetadata(editorStub.document.uri)).rejects.toThrow(
        'The Apex Class world is not valid for Open AI document generation.'
      );
    });

    it('should return the first eligible response if it is eligible', async () => {
      const mockResponse: any = [
        {
          isApexOasEligible: true,
          isEligible: true,
          symbols: [{ isApexOasEligible: true, docSymbol: { name: 'someMethod' } }]
        }
      ];
      jest.spyOn(orchestrator, 'validateEligibility').mockResolvedValue(mockResponse);
      const result = await orchestrator.extractMetadata(editorStub.document.uri);
      expect(result).toEqual(mockResponse[0]);
    });
  });

  describe('validateEligibility', () => {
    let eligibilityDelegateSpy: jest.SpyInstance;

    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should call eligibilityDelegate with expected parameter when there are multiple uris (requests)', async () => {
      const responses = [{ isApexOasEligible: true, isEligible: true, resourceUri: 'file.cls' }];
      const uris = [{ path: '/hello/world.cls' } as vscode.Uri, { path: 'hola/world.cls' } as vscode.Uri];
      const expectedRequest = {
        payload: [
          {
            resourceUri: uris[0].toString(),
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          },
          {
            resourceUri: uris[1].toString(),
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      eligibilityDelegateSpy = jest.spyOn(orchestrator, 'eligibilityDelegate').mockResolvedValue(responses);
      await orchestrator.validateEligibility(uris, false);
      expect(eligibilityDelegateSpy).toHaveBeenCalledWith(expectedRequest);
    });

    it('should throw an error when method is selected but the active editor is not available', async () => {
      (vscode.window as any).activeTextEditor = undefined;
      const uri = vscode.Uri.file('/hello/world.js');
      expect(async () => await orchestrator.validateEligibility(uri, true)).rejects.toThrow();
    });

    it('should throw an error when method is selected but the active editor is not on an apex source file', async () => {
      const mockEditor = {
        document: { fileName: 'file.cls' },
        selection: { active: new vscode.Position(3, 5) } // Mocked cursor position
      };

      (vscode.window as any).activeTextEditor = mockEditor;
      const uri = vscode.Uri.file('/hello/world.js');
      expect(async () => await orchestrator.validateEligibility(uri, true)).rejects.toThrow();
    });

    it('should call eligibilityDelegate with expected parameter when there is single request', async () => {
      const responses = [{ isApexOasEligible: true, isEligible: true, resourceUri: 'file.cls' }];
      const uri = { path: '/file.cls' } as vscode.Uri;
      eligibilityDelegateSpy = jest.spyOn(orchestrator, 'eligibilityDelegate').mockResolvedValue(responses);
      const mockEditor = {
        document: { fileName: 'file.cls' }
      };
      // with no method selected
      const request = {
        resourceUri: uri.toString(),
        includeAllMethods: true,
        includeAllProperties: true,
        position: null,
        methodNames: [],
        propertyNames: []
      };

      const payload = {
        payload: [request]
      };

      (vscode.window as any).activeTextEditor = mockEditor;
      await orchestrator.validateEligibility({ path: 'file.cls' } as vscode.Uri, false);
      expect(eligibilityDelegateSpy).toHaveBeenCalledWith(payload);
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
            position: null,
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
            position: null,
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      expect(orchestrator.requestTarget(sampleRequest)).toBe(ApexOASResource.folder);
    });

    it('request for a single class', () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file.cls',
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
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
            position: new vscode.Position(3, 5),
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
            position: null,
            methodNames: [],
            propertyNames: []
          },
          {
            resourceUri: 'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file2.cls',
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      expect(orchestrator.requestTarget(sampleRequest)).toBe(ApexOASResource.multiClass);
    });
  });
});
