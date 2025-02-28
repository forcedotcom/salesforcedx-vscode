/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../../../src/apexLanguageClient';
import { MetadataOrchestrator } from '../../../src/commands/metadataOrchestrator';
import { languageClientUtils } from '../../../src/languageUtils';
import { nls } from '../../../src/messages';
import GenerationInteractionLogger from '../../../src/oas/generationInteractionLogger';
import { ApexOASResource } from '../../../src/oas/schemas';
import { getTelemetryService } from '../../../src/telemetry/telemetry';
import { MockTelemetryService } from '../telemetry/mockTelemetryService';

jest.mock('../../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn()
}));

const mockUriParse = (uriString: string): vscode.Uri => {
  const mockUri = {
    path: uriString,
    scheme: 'file',
    authority: '',
    query: '',
    fragment: '',
    fsPath: uriString,
    with: jest.fn(),
    toString: jest.fn().mockReturnValue(uriString),
    toJSON: jest.fn().mockReturnValue(uriString)
  } as unknown as vscode.Uri;
  jest.spyOn(vscode.Uri, 'parse').mockReturnValue(mockUri);
  return mockUri;
};

describe('MetadataOrchestrator', () => {
  let orchestrator: MetadataOrchestrator;
  let showErrorMessageMock: jest.SpyInstance;
  let addSourceUnderStudySpy: jest.SpyInstance;

  beforeEach(() => {
    orchestrator = new MetadataOrchestrator();
    showErrorMessageMock = jest.spyOn(notificationService, 'showErrorMessage').mockImplementation(jest.fn());
    addSourceUnderStudySpy = jest
      .spyOn(GenerationInteractionLogger.prototype, 'addSourceUnderStudy')
      .mockImplementation(jest.fn());
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
      await expect(orchestrator.validateMetadata(editorStub.document.uri)).rejects.toThrow(
        'Failed to validate eligibility.'
      );
    });

    it('should throw an error if the first eligible response is not eligible and method is selected', async () => {
      const mockResponse: any = [
        { isApexOasEligible: false, isEligible: false, symbols: [{ docSymbol: { name: 'someMethod' } }] }
      ];
      jest.spyOn(orchestrator, 'validateEligibility').mockResolvedValue(mockResponse);
      await expect(orchestrator.validateMetadata(editorStub.document.uri, true)).rejects.toThrow(
        'Method someMethod is not eligible for OpenAPI Document creation. It is not annotated with an http annotator or has wrong access modifiers.'
      );
    });

    it('should throw an error if the first eligible response is not eligible and method is not selected', async () => {
      const mockResponse: any = [
        { isApexOasEligible: false, isEligible: false, resourceUri: mockUriParse('/hello/world.cls') }
      ];
      jest.spyOn(orchestrator, 'validateEligibility').mockResolvedValue(mockResponse);
      await expect(orchestrator.validateMetadata(editorStub.document.uri)).rejects.toThrow(
        'The Apex Class world is not valid for OpenAPI document generation.'
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
      const result = await orchestrator.validateMetadata(editorStub.document.uri);
      expect(result).toEqual(mockResponse[0]);
    });
  });

  describe('gatherContext', () => {
    let getClientInstanceSpy;
    let mockTelemetryService: any;

    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should send a request and return the response when successful', async () => {
      const mockLanguageClient = {
        gatherOpenAPIContext: jest.fn().mockResolvedValue({ some: 'response' })
      } as unknown as ApexLanguageClient;

      getClientInstanceSpy = jest.spyOn(languageClientUtils, 'getClientInstance').mockReturnValue(mockLanguageClient);

      const mockUri = mockUriParse('/hello/world.cls');
      const response = await orchestrator.gatherContext(mockUri);

      expect(mockLanguageClient.gatherOpenAPIContext).toHaveBeenCalledWith(mockUri);
      expect(response).toEqual({ some: 'response' });
    });

    it('should handle language client being unavailable', async () => {
      jest.spyOn(languageClientUtils, 'getClientInstance').mockReturnValue(undefined);

      const response = await orchestrator.gatherContext(vscode.Uri.file('/path/to/source'));
      expect(response).toBeUndefined();
    });

    it('should handle errors and throw a localized error', async () => {
      const mockLanguageClient = {
        sendRequest: jest.fn().mockRejectedValue(new Error('Some error'))
      } as unknown as ApexLanguageClient;

      jest.spyOn(languageClientUtils, 'getClientInstance').mockReturnValue(mockLanguageClient);

      const mockUri = { path: '/hello/world.cls' } as vscode.Uri;

      expect(orchestrator.gatherContext(mockUri)).rejects.toThrow(nls.localize('cannot_gather_context'));
    });
  });

  describe('validateEligibility', () => {
    let eligibilityDelegateSpy: jest.SpyInstance;

    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should call eligibilityDelegate with expected parameter when there are multiple uris (requests)', async () => {
      const responses = [{ isApexOasEligible: true, isEligible: true, resourceUri: mockUriParse('file.cls') }];
      const uris = [{ path: '/hello/world.cls' } as vscode.Uri, { path: 'hola/world.cls' } as vscode.Uri];
      const expectedRequest = {
        payload: [
          {
            resourceUri: uris[0],
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          },
          {
            resourceUri: uris[1],
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
      const uri = mockUriParse('/file.cls');
      const responses = [{ isApexOasEligible: true, isEligible: true, resourceUri: uri }];
      eligibilityDelegateSpy = jest.spyOn(orchestrator, 'eligibilityDelegate').mockResolvedValue(responses);
      const mockEditor = {
        document: { fileName: 'file.cls' }
      };
      // with no method selected
      const request = {
        resourceUri: uri,
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
      await orchestrator.validateEligibility(mockUriParse('/file.cls'), false);
      expect(eligibilityDelegateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: [
            expect.objectContaining({
              resourceUri: expect.anything(),
              includeAllMethods: true,
              includeAllProperties: true,
              position: null,
              methodNames: [],
              propertyNames: []
            })
          ]
        })
      );
    });
  });

  describe('eligibilityDelegate', () => {
    let getClientInstanceSpy;
    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should return undefined when language client not available', async () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: mockUriParse('file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes'),
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
            resourceUri: mockUriParse('file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes'),
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
            resourceUri: mockUriParse(
              'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file.cls'
            ),
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
            resourceUri: mockUriParse(
              'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file.cls'
            ),
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
            resourceUri: mockUriParse(
              'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file1.cls'
            ),
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          },
          {
            resourceUri: mockUriParse(
              'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file2.cls'
            ),
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
