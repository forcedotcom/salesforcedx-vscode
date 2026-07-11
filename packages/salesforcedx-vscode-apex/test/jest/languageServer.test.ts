/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import type { RecordedSpan } from './testUtils/recordingTracer';

// Record every span (name + attrs + ended flag) so the apex.lsp.client rotation can be asserted:
// each createLanguageServer opens exactly one client span; a restart ends the prior one and opens a
// new one; onTelemetry writes attrs onto the current live span. Prefixed `mock*` for jest hoisting.
const mockRecordedSpans: RecordedSpan[] = [];

const clientSpans = (): RecordedSpan[] => mockRecordedSpans.filter(s => s.name === 'apex.lsp.client');

jest.mock('../../src/services/runtime', () =>
  require('./testUtils/recordingTracer').createRecordingRuntimeMock(() => mockRecordedSpans)
);

// Stub the java/requirements resolution so createServer doesn't touch the filesystem/JDK.
jest.mock('../../src/requirements', () => ({
  resolveRequirements: jest.fn().mockResolvedValue({ java_home: '/mock/java', java_memory: 4096 })
}));

// No services extension → no scan config.
jest.mock('../../src/languageServerScanConfig', () => ({
  buildMetadataRegistryScanConfig: jest.fn().mockResolvedValue(undefined)
}));

// Capture the onTelemetry callback so tests can drive Jorje telemetry events at will.
type TelemetryData = { properties?: Record<string, string>; measures?: Record<string, number> };
let capturedOnTelemetry: ((data: TelemetryData) => void) | undefined;
jest.mock('../../src/apexLanguageClient', () => ({ ApexLanguageClient: jest.fn() }));

import { ApexLanguageClient } from '../../src/apexLanguageClient';
import { createLanguageServer } from '../../src/languageServer';
import { resolveRequirements } from '../../src/requirements';
import { buildMetadataRegistryScanConfig } from '../../src/languageServerScanConfig';

describe('languageServer client span', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordedSpans.length = 0;
    capturedOnTelemetry = undefined;
    // resetMocks:true wipes module-scope implementations before each test — re-establish them here.
    (resolveRequirements as jest.Mock).mockResolvedValue({ java_home: '/mock/java', java_memory: 4096 });
    (buildMetadataRegistryScanConfig as jest.Mock).mockResolvedValue(undefined);
    (ApexLanguageClient as unknown as jest.Mock).mockImplementation(() => ({
      onTelemetry: (cb: (data: TelemetryData) => void) => {
        capturedOnTelemetry = cb;
      }
    }));
    // Return the caller-supplied default so array settings stay iterable and boolean settings stay boolean.
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      get: (_key: string, def?: unknown) => def
    });
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);
  });

  const mockContext = {
    extensionPath: '/mock/extension/path',
    extension: { packageJSON: { languageServerDir: 'dist' } }
  } as unknown as vscode.ExtensionContext;

  it('opens exactly one apex.lsp.client root span per lifetime', async () => {
    await createLanguageServer(mockContext);
    expect(clientSpans()).toHaveLength(1);
    expect(clientSpans()[0].ended).toBe(false);
  });

  it('onTelemetry writes allowlisted attrs onto the live client span', async () => {
    await createLanguageServer(mockContext);
    capturedOnTelemetry?.({ properties: { Feature: 'ApexLanguageServer', extra: 'v' }, measures: { count: 3 } });
    await new Promise(r => setImmediate(r));
    const span = clientSpans()[0];
    expect(span.attributes.get('Feature')).toBe('ApexLanguageServer');
    expect(span.attributes.get('extra')).toBe('v');
    expect(span.attributes.get('count')).toBe(3);
  });

  it('a blocked telemetry feature is not written onto the client span', async () => {
    await createLanguageServer(mockContext);
    capturedOnTelemetry?.({ properties: { Feature: 'Hover' }, measures: {} });
    await new Promise(r => setImmediate(r));
    expect(clientSpans()[0].attributes.has('Feature')).toBe(false);
  });

  it('records an errored apexLSPError span when createServer fails', async () => {
    (resolveRequirements as jest.Mock).mockRejectedValue({ error: 'no java found' });
    await expect(createLanguageServer(mockContext)).rejects.toBeDefined();
    await new Promise(r => setImmediate(r));
    const errSpan = mockRecordedSpans.find(s => s.name === 'apexLSPError');
    expect(errSpan?.attributes.get('error')).toBe('no java found');
    // fireErrorSpan fails inside the span so it ends with ERROR status (severity 17 in AppInsights).
    expect(errSpan?.ended).toBe(true);
  });

  it('restart ends the prior client span and opens exactly one new live span', async () => {
    await createLanguageServer(mockContext);
    const first = clientSpans()[0];
    await createLanguageServer(mockContext);
    const spans = clientSpans();
    expect(spans).toHaveLength(2);
    expect(first.ended).toBe(true);
    expect(spans[1].ended).toBe(false);
  });
});
