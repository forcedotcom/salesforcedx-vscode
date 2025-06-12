/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ApexLanguageClient } from '../../../src/apexLanguageClient';
import { buildRequestTarget, MetadataOrchestrator } from '../../../src/commands/metadataOrchestrator';
import { languageClientManager } from '../../../src/languageUtils';
import { nls } from '../../../src/messages';
import GenerationInteractionLogger from '../../../src/oas/generationInteractionLogger';
import { ApexOASResource } from '../../../src/oas/schemas';
import { getTelemetryService } from '../../../src/telemetry/telemetry';
import { MockTelemetryService } from '../telemetry/mockTelemetryService';

jest.mock('../../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn()
}));

describe('MetadataOrchestrator', () => {
  let orchestrator: MetadataOrchestrator;

  beforeEach(() => {
    orchestrator = new MetadataOrchestrator();
    jest.spyOn(notificationService, 'showErrorMessage').mockImplementation(jest.fn());
    jest.spyOn(GenerationInteractionLogger.prototype, 'addSourceUnderStudy').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractMetadata', () => {
    let editorStub: any;
    beforeEach(() => {
      editorStub = {
        document: {
          uri: { path: 'someClass.cls' } as URI,
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

    it('should throw an error if the first eligible response is not eligible and method is not selected', async () => {
      const mockResponse: any = [
        { isApexOasEligible: false, isEligible: false, resourceUri: URI.parse('/hello/world.cls') }
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

      jest.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(mockLanguageClient);

      const mockUri = URI.parse('/hello/world.cls');
      const response = await orchestrator.gatherContext(mockUri);

      expect(mockLanguageClient.gatherOpenAPIContext).toHaveBeenCalledWith(mockUri);
      expect(response).toEqual({ some: 'response' });
    });

    it('should handle language client being unavailable', async () => {
      jest.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(undefined);

      const response = await orchestrator.gatherContext(URI.file('/path/to/source'));
      expect(response).toBeUndefined();
    });

    it('should handle errors and throw a localized error', () => {
      const mockLanguageClient = {
        sendRequest: jest.fn().mockRejectedValue(new Error('Some error'))
      } as unknown as ApexLanguageClient;

      jest.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(mockLanguageClient);

      const mockUri = { path: '/hello/world.cls' } as URI;

      expect(orchestrator.gatherContext(mockUri)).rejects.toThrow(nls.localize('cannot_gather_context'));
    });
  });

  describe('validateEligibility', () => {
    let eligibilityDelegateSpy: jest.SpyInstance;

    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should call eligibilityDelegate with expected parameter when there are multiple uris (requests)', async () => {
      const responses = [{ isApexOasEligible: true, isEligible: true, resourceUri: URI.parse('file.cls') }];
      const uris = ['/hello/world.cls', 'hola/world.cls'].map(f => URI.parse(f));
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
      const uri = URI.file('/hello/world.js');
      expect(async () => await orchestrator.validateEligibility(uri, true)).rejects.toThrow();
    });

    it('should throw an error when method is selected but the active editor is not on an apex source file', async () => {
      const mockEditor = {
        document: { fileName: 'file.cls' },
        selection: { active: new vscode.Position(3, 5) } // Mocked cursor position
      };
      const mockLanguageClient = {
        gatherOpenAPIContext: jest.fn().mockResolvedValue({ some: 'response' })
      } as unknown as ApexLanguageClient;

      jest.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(mockLanguageClient);

      (vscode.window as any).activeTextEditor = mockEditor;
      const uri = URI.file('/hello/world.js');
      expect(async () => await orchestrator.validateEligibility(uri, true)).rejects.toThrow();
    });

    it('should call eligibilityDelegate with expected parameter when there is single request', async () => {
      const uri = URI.parse('/file.cls');
      const responses = [{ isApexOasEligible: true, isEligible: true, resourceUri: uri }];
      eligibilityDelegateSpy = jest.spyOn(orchestrator, 'eligibilityDelegate').mockResolvedValue(responses);
      const mockEditor = {
        document: { fileName: 'file.cls' }
      };

      (vscode.window as any).activeTextEditor = mockEditor;
      await orchestrator.validateEligibility(URI.parse('/file.cls'), false);
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
    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });
    it('should return undefined when language client not available', async () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: URI.parse('file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes'),
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      jest.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(undefined);
      const responses = await orchestrator.eligibilityDelegate(sampleRequest);
      expect(responses).toBe(undefined);
    });
  });

  describe('requestTarget', () => {
    it('request for a folder', () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: URI.parse('file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes'),
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          }
        ]
      };
      expect(buildRequestTarget(sampleRequest)).toBe(ApexOASResource.folder);
    });

    it('request for a single class', () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: URI.parse(
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
      expect(buildRequestTarget(sampleRequest)).toBe(ApexOASResource.class);
    });

    it('request for a single method or property', () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: URI.parse(
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
      expect(buildRequestTarget(sampleRequest)).toBe(ApexOASResource.singleMethodOrProp);
    });

    it('request for multiple classes', () => {
      const sampleRequest = {
        payload: [
          {
            resourceUri: URI.parse(
              'file:///Users/peter.hale/git/apex-perf-project/force-app/main/default/classes/file1.cls'
            ),
            includeAllMethods: true,
            includeAllProperties: true,
            position: null,
            methodNames: [],
            propertyNames: []
          },
          {
            resourceUri: URI.parse(
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
      expect(buildRequestTarget(sampleRequest)).toBe(ApexOASResource.multiClass);
    });
  });
});
