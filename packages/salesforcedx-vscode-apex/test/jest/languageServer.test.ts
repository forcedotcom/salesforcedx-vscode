/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import type { Executable } from 'vscode-languageclient/node';
import type { RecordedSpan } from './testUtils/recordingTracer';

// Record every span (name + attrs + ended flag) so the apex.lsp.client rotation can be asserted:
// each createLanguageServer opens exactly one client span; a restart ends the prior one and opens a
// new one; onTelemetry writes attrs onto the current live span. Prefixed `mock*` for mock hoisting.
const mockRecordedSpans: RecordedSpan[] = [];

const clientSpans = (): RecordedSpan[] => mockRecordedSpans.filter(s => s.name === 'apex.lsp.client');

vi.mock('../../src/services/runtime', async () => {
  const { createRecordingRuntimeMock } = await import('./testUtils/recordingTracer.js');
  return createRecordingRuntimeMock(() => mockRecordedSpans);
});

// Stub the java/requirements resolution so createServer doesn't touch the filesystem/JDK.
vi.mock('../../src/requirements', () => ({
  resolveRequirements: vi.fn().mockResolvedValue({ java_home: '/mock/java', java_memory: 4096 })
}));

// No services extension → no scan config.
vi.mock('../../src/languageServerScanConfig', () => ({
  buildMetadataRegistryScanConfig: vi.fn().mockResolvedValue(undefined)
}));

// Capture the onTelemetry callback so tests can drive Jorje telemetry events at will.
type TelemetryData = { properties?: Record<string, string>; measures?: Record<string, number> };
let capturedOnTelemetry: ((data: TelemetryData) => void) | undefined;
vi.mock('../../src/apexLanguageClient', () => ({ ApexLanguageClient: vi.fn() }));

import { ApexLanguageClient } from '../../src/apexLanguageClient';
import { createLanguageServer } from '../../src/languageServer';
import { resolveRequirements } from '../../src/requirements';
import { buildMetadataRegistryScanConfig } from '../../src/languageServerScanConfig';
import { getRuntime } from '../../src/services/runtime';

const runCreateLanguageServer = (context: vscode.ExtensionContext) =>
  getRuntime().runPromise(createLanguageServer(context));

describe('languageServer client span', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordedSpans.length = 0;
    capturedOnTelemetry = undefined;
    // resetMocks:true wipes module-scope implementations before each test — re-establish them here.
    (resolveRequirements as VitestMock).mockResolvedValue({ java_home: '/mock/java', java_memory: 4096 });
    (buildMetadataRegistryScanConfig as VitestMock).mockResolvedValue(undefined);
    (ApexLanguageClient as unknown as VitestMock).mockImplementation(function () {
      return {
        onTelemetry: (cb: (data: TelemetryData) => void) => {
          capturedOnTelemetry = cb;
        }
      };
    });
    // Return the caller-supplied default so array settings stay iterable and boolean settings stay boolean.
    (vscode.workspace.getConfiguration as VitestMock) = vi.fn().mockReturnValue({
      get: (_key: string, def?: unknown) => def
    });
    (vscode.extensions.getExtension as VitestMock).mockReturnValue(undefined);
  });

  const mockContext = {
    extensionPath: '/mock/extension/path',
    extension: { packageJSON: { languageServerDir: 'dist' } }
  } as unknown as vscode.ExtensionContext;

  it('opens exactly one apex.lsp.client root span per lifetime', async () => {
    await runCreateLanguageServer(mockContext);
    expect(clientSpans()).toHaveLength(1);
    expect(clientSpans()[0].ended).toBe(false);
  });

  it('onTelemetry writes allowlisted attrs onto the live client span', async () => {
    await runCreateLanguageServer(mockContext);
    capturedOnTelemetry?.({ properties: { Feature: 'ApexLanguageServer', extra: 'v' }, measures: { count: 3 } });
    await new Promise(r => setImmediate(r));
    const span = clientSpans()[0];
    expect(span.attributes.get('Feature')).toBe('ApexLanguageServer');
    expect(span.attributes.get('extra')).toBe('v');
    expect(span.attributes.get('count')).toBe(3);
  });

  it('a blocked telemetry feature is not written onto the client span', async () => {
    await runCreateLanguageServer(mockContext);
    capturedOnTelemetry?.({ properties: { Feature: 'Hover' }, measures: {} });
    await new Promise(r => setImmediate(r));
    expect(clientSpans()[0].attributes.has('Feature')).toBe(false);
  });

  it('fails createServer with a requirements-phase setup error', async () => {
    (resolveRequirements as VitestMock).mockRejectedValue({ error: 'no java found' });
    const error = await getRuntime().runPromise(createLanguageServer(mockContext).pipe(Effect.flip));
    expect(error).toMatchObject({
      _tag: 'ApexLanguageClientSetupError',
      phase: 'requirements'
    });
  });

  it('restart ends the prior client span and opens exactly one new live span', async () => {
    await runCreateLanguageServer(mockContext);
    const first = clientSpans()[0];
    await runCreateLanguageServer(mockContext);
    const spans = clientSpans();
    expect(spans).toHaveLength(2);
    expect(first.ended).toBe(true);
    expect(spans[1].ended).toBe(false);
  });

  it('ignores YOURKIT_PROFILER_AGENT when suspended debug startup is enabled', async () => {
    const originalExecArgv = process.execArgv;
    const originalSuspend = process.env.SUSPEND_LANGUAGE_SERVER_STARTUP;
    const originalYourKitAgent = process.env.YOURKIT_PROFILER_AGENT;
    process.execArgv = ['--inspect'];
    process.env.SUSPEND_LANGUAGE_SERVER_STARTUP = 'true';
    process.env.YOURKIT_PROFILER_AGENT = '/mock/yourkit/libyjpagent.dylib';
    vi.resetModules();

    try {
      const isolatedVscode = await import('vscode');
      const { ApexLanguageClient: IsolatedApexLanguageClient } = await import('../../src/apexLanguageClient.js');
      (isolatedVscode.workspace.getConfiguration as VitestMock) = vi.fn().mockReturnValue({
        get: (_key: string, def?: unknown) => def
      });
      (isolatedVscode.extensions.getExtension as VitestMock).mockReturnValue(undefined);
      (IsolatedApexLanguageClient as unknown as VitestMock).mockImplementation(function () {
        return { onTelemetry: vi.fn() };
      });
      const { createLanguageServer: createIsolatedLanguageServer } = await import('../../src/languageServer.js');
      const { getRuntime: getIsolatedRuntime } = await import('../../src/services/runtime.js');

      await getIsolatedRuntime().runPromise(createIsolatedLanguageServer(mockContext));

      const server = (IsolatedApexLanguageClient as unknown as VitestMock).mock.calls[0][2] as Executable;
      expect(server.args).toContain('-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:0,quiet=y');
      expect(server.args).not.toEqual(expect.arrayContaining([expect.stringMatching(/^-agentpath:/)]));
    } finally {
      process.execArgv = originalExecArgv;
      if (originalSuspend === undefined) delete process.env.SUSPEND_LANGUAGE_SERVER_STARTUP;
      else process.env.SUSPEND_LANGUAGE_SERVER_STARTUP = originalSuspend;
      if (originalYourKitAgent === undefined) delete process.env.YOURKIT_PROFILER_AGENT;
      else process.env.YOURKIT_PROFILER_AGENT = originalYourKitAgent;
    }
  });
});
