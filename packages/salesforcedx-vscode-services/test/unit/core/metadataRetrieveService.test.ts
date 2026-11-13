/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as sourceDeployRetrieve from '@salesforce/source-deploy-retrieve';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import type { NonEmptyComponentSet } from '../../../src/core/componentSetService';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService } from '../../../src/core/connectionService';
import { MetadataRetrieveError, MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { MetadataChangeNotificationService } from '../../../src/core/metadataChangeNotificationService';
import { MetadataDescribeService } from '../../../src/core/metadataDescribeService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { ProjectService } from '../../../src/core/projectService';
import { SourceTrackingService } from '../../../src/core/sourceTrackingService';
import { redactingConsoleLoggerLayer } from '../../../src/observability/redactingConsoleLogger';
import { OrgMetadataCatalogRecorder } from '../../../src/orgCatalog/orgMetadataCatalogRecorder';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';
import { PromptService } from '../../../src/vscode/prompts/promptService';

const { construct, start, cancel, pollStatus } = vi.hoisted(() => ({
  construct: vi.fn<() => void>(),
  start: vi.fn<() => Promise<void>>(),
  cancel: vi.fn<() => Promise<void>>(),
  pollStatus: vi.fn<() => Promise<never>>()
}));

vi.mock('@salesforce/source-deploy-retrieve', async () => {
  const actual = await vi.importActual<typeof sourceDeployRetrieve>('@salesforce/source-deploy-retrieve');
  return {
    ...actual,
    MetadataApiRetrieve: function metadataApiRetrieve(this: {
      start: () => Promise<void>;
      cancel: () => Promise<void>;
      pollStatus: () => Promise<void>;
    }) {
      construct();
      this.start = start;
      this.cancel = cancel;
      this.pollStatus = pollStatus;
    }
  };
});

const TOKEN = 'retrieve-secret';

const deps = Layer.mergeAll(
  PromptService.Default,
  Layer.succeed(WorkspaceService, {
    getWorkspaceInfoOrThrow: () => Effect.void
  } as never),
  Layer.succeed(ConnectionService, {
    getConnection: () => Effect.succeed({ getAuthInfoFields: () => ({}) })
  } as never),
  Layer.succeed(SourceTrackingService, {} as never),
  Layer.succeed(MetadataRegistryService, {
    getRegistryAccess: () => Effect.succeed({})
  } as never),
  Layer.succeed(ProjectService, {
    getSfProject: () =>
      Effect.succeed({
        getPath: () => '/tmp/project',
        retrieveSfProjectJson: () => Promise.resolve({ get: () => undefined })
      })
  } as never),
  Layer.succeed(ConfigService, {
    getConfigAggregator: () => Effect.succeed({ getPropertyValue: () => undefined })
  } as never),
  Layer.succeed(MetadataChangeNotificationService, {} as never),
  Layer.succeed(MetadataDescribeService, {} as never),
  Layer.succeed(OrgMetadataCatalogRecorder, {} as never),
  Layer.succeed(FsService, {} as never)
);

const loggedOutput = (): string =>
  vi
    .spyOn(console, 'log')
    .mock.calls.map(call => String(call[0]))
    .join('\n');

describe('MetadataRetrieveService retrieve failure', () => {
  let tokenSource: vscode.CancellationTokenSource;

  beforeEach(() => {
    start.mockRejectedValue(new Error('retrieve failed 00D000000000000!retrieve-secret'));
    cancel.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    tokenSource = new vscode.CancellationTokenSource();
    vi.spyOn(vscode.window, 'withProgress').mockImplementation((_opts, task) =>
      task({ report: () => undefined }, tokenSource.token)
    );
  });

  afterEach(() => {
    tokenSource.dispose();
    vi.restoreAllMocks();
  });

  it('maps a synchronous retrieve constructor failure to MetadataRetrieveError', async () => {
    const cause = new Error('invalid retrieve options');
    construct.mockImplementation(() => {
      throw cause;
    });
    const exit = await MetadataRetrieveService.retrieveComponentSetToDirectory(
      { size: 1 } as NonEmptyComponentSet,
      URI.parse('file:///tmp/out')
    ).pipe(
      Effect.provide(MetadataRetrieveService.DefaultWithoutDependencies.pipe(Layer.provide(deps))),
      Effect.runPromiseExit
    );

    expect(exit).toEqual(Exit.fail(new MetadataRetrieveError({ cause })));
    expect(start).not.toHaveBeenCalled();
  });

  it('cancels the server retrieve and surfaces UserCancellationError', async () => {
    const { promise: polling, resolve: startedPolling } = Promise.withResolvers<void>();
    start.mockResolvedValue(undefined);
    pollStatus.mockImplementation(() => {
      startedPolling();
      return new Promise<never>(() => undefined);
    });
    const done = Effect.runPromiseExit(
      MetadataRetrieveService.retrieveComponentSetToDirectory(
        { size: 1 } as NonEmptyComponentSet,
        URI.parse('file:///tmp/out')
      ).pipe(Effect.provide(MetadataRetrieveService.DefaultWithoutDependencies.pipe(Layer.provide(deps))))
    );
    await polling;
    tokenSource.cancel();
    const exit = await done;
    expect(cancel).toHaveBeenCalledOnce();
    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain('UserCancellationError');
  });

  it('logs the cause through the redacting logger', async () => {
    const exit = await Effect.runPromiseExit(
      MetadataRetrieveService.retrieveComponentSetToDirectory(
        { size: 1 } as NonEmptyComponentSet,
        URI.parse('file:///tmp/out')
      ).pipe(
        Effect.provide(MetadataRetrieveService.DefaultWithoutDependencies.pipe(Layer.provide(deps))),
        Effect.provide(redactingConsoleLoggerLayer)
      )
    );

    const pretty = Exit.match(exit, {
      onFailure: cause => Cause.pretty(cause),
      onSuccess: () => undefined
    });
    expect(pretty).toContain(TOKEN);
    const output = loggedOutput();
    expect(output).toContain('<REDACTED ACCESS TOKEN>');
    expect(output).not.toContain(TOKEN);
  });
});
