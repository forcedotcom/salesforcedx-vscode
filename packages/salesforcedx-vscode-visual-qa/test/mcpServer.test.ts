/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as Effect from 'effect/Effect';
import * as Deferred from 'effect/Deferred';
import * as Runtime from 'effect/Runtime';
import { ControllerService } from '../src/controllerService';
import { createVisualQaMcpServer, shutdownVisualQaMcpServer } from '../src/mcpServer';

jest.mock('@salesforce/playwright-vscode-ext', () => ({ redactValue: (value: unknown) => value }));

const text = (result: CallToolResult): string => {
  const content = result.content[0];
  expect(content.type).toBe('text');
  return content.type === 'text' ? content.text : '';
};
const callTool = async (client: Client, name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
  const result = await client.callTool({ name, arguments: args }, CallToolResultSchema);
  return CallToolResultSchema.parse(result);
};

describe('visual QA MCP server', () => {
  const start = jest.fn(() =>
    Effect.succeed({ runId: 'run-1', artifactDir: '/artifacts/run-1', workspaceDir: '/workspace' })
  );
  const observeForMcp = Effect.succeed({
    observation: { sequence: 1, title: 'Visual QA' },
    screenshot: Uint8Array.from([1, 2, 3])
  });
  const act = jest.fn(() => Effect.void);
  const addFinding = jest.fn(() => Effect.void);
  const status = Effect.succeed({
    state: 'running' as const,
    runId: 'run-1',
    artifactDir: '/artifacts/run-1',
    findingCount: 0
  });
  const finish = Effect.void;
  // Only the handlers exercised by this transport contract need concrete service outputs.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial test service for an internal SDK boundary
  const service = {
    start,
    observe: Effect.die('unused'),
    observeForMcp,
    act,
    addFinding,
    status,
    finish
  } as unknown as InstanceType<typeof ControllerService>;
  const runtime = Runtime.defaultRuntime.pipe(Runtime.provideService(ControllerService, service));
  const server = createVisualQaMcpServer(runtime);
  const client = new Client({ name: 'visual-qa-contract-test', version: '1.0.0' });

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  beforeEach(() => {
    start.mockImplementation(() =>
      Effect.succeed({ runId: 'run-1', artifactDir: '/artifacts/run-1', workspaceDir: '/workspace' })
    );
    act.mockImplementation(() => Effect.void);
    addFinding.mockImplementation(() => Effect.void);
  });

  afterAll(async () => Promise.all([client.close(), server.close()]));

  test('initializes with tool capability and publishes six Effect-generated input schemas', async () => {
    expect(client.getServerCapabilities()).toEqual(expect.objectContaining({ tools: {} }));
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(['start', 'observe', 'act', 'add_finding', 'status', 'finish']);
    expect(tools.every(tool => tool.inputSchema.type === 'object')).toBe(true);
    expect(tools.find(tool => tool.name === 'start')?.inputSchema.required).toEqual(['objective']);
    expect(tools.find(tool => tool.name === 'start')?.inputSchema.properties?.objective).toEqual(
      expect.objectContaining({ type: 'string', minLength: 1 })
    );
    expect(tools.find(tool => tool.name === 'act')?.inputSchema.required).toEqual(['observationSequence', 'action']);
  });

  test('calls tools through the Effect runtime and preserves text and image results', async () => {
    const started = await callTool(client, 'start', { objective: 'Check command feedback' });
    expect(JSON.parse(text(started))).toEqual({
      runId: 'run-1',
      artifactDir: '/artifacts/run-1',
      workspaceDir: '/workspace'
    });
    expect(start).toHaveBeenCalledWith('Check command feedback', {
      objective: 'Check command feedback',
      extensionMode: 'vsix'
    });

    const observed = await callTool(client, 'observe', {});
    expect(JSON.parse(text(observed))).toEqual({ sequence: 1, title: 'Visual QA' });
    expect(observed.content[1]).toEqual({ type: 'image', data: 'AQID', mimeType: 'image/png' });
  });

  test('returns a tool error when Effect Schema rejects call arguments', async () => {
    const result = await callTool(client, 'act', { observationSequence: 0, action: { kind: 'press', key: 'Enter' } });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('observationSequence');
    expect(act).not.toHaveBeenCalled();
  });

  test('shutdown interrupts active handlers before finishing and closing', async () => {
    const active = await Effect.runPromise(Deferred.make<void>());
    const interrupted = await Effect.runPromise(Deferred.make<void>());
    const finishOrder: string[] = [];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial test service for an internal SDK boundary
    const blockingService = {
      start,
      observe: Effect.die('unused'),
      observeForMcp: Deferred.succeed(active, undefined).pipe(
        Effect.zipRight(Effect.never),
        Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined))
      ),
      act,
      addFinding,
      status,
      finish
    } as unknown as InstanceType<typeof ControllerService>;
    const blockingRuntime = Runtime.defaultRuntime.pipe(Runtime.provideService(ControllerService, blockingService));
    const blockingServer = createVisualQaMcpServer(
      blockingRuntime,
      Deferred.await(interrupted).pipe(Effect.zipRight(Effect.sync(() => finishOrder.push('finish'))))
    );
    const blockingClient = new Client({ name: 'visual-qa-shutdown-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([blockingServer.connect(serverTransport), blockingClient.connect(clientTransport)]);
    const request = blockingClient.callTool({ name: 'observe', arguments: {} }, CallToolResultSchema);
    await active.pipe(Deferred.await, Effect.runPromise);

    await Effect.runPromise(shutdownVisualQaMcpServer(blockingServer));

    await expect(request).rejects.toThrow();
    expect(finishOrder).toEqual(['finish']);
    await blockingClient.close();
  });
});
