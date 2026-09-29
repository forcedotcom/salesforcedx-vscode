/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import type { NonEmptyComponentSet } from '../../../src/core/componentSetService';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService } from '../../../src/core/connectionService';
import { MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { MetadataChangeNotificationService } from '../../../src/core/metadataChangeNotificationService';
import { MetadataDescribeService } from '../../../src/core/metadataDescribeService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { ProjectService } from '../../../src/core/projectService';
import { SourceTrackingService } from '../../../src/core/sourceTrackingService';
import { redactingConsoleLoggerLayer } from '../../../src/observability/redactingConsoleLogger';
import { OrgMetadataCatalogRecorder } from '../../../src/orgCatalog/orgMetadataCatalogRecorder';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

jest.mock('@salesforce/source-deploy-retrieve', () => {
  const actual = jest.requireActual<typeof import('@salesforce/source-deploy-retrieve')>(
    '@salesforce/source-deploy-retrieve'
  );
  return {
    ...actual,
    MetadataApiRetrieve: function metadataApiRetrieve(this: {
      start: () => Promise<never>;
      cancel: () => Promise<void>;
      pollStatus: () => Promise<void>;
    }) {
      this.start = () => Promise.reject(new Error('retrieve failed 00D000000000000!retrieve-secret'));
      this.cancel = () => Promise.resolve();
      this.pollStatus = () => Promise.resolve();
    }
  };
});

const TOKEN = 'retrieve-secret';

const deps = Layer.mergeAll(
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
  jest
    .spyOn(console, 'log')
    .mock.calls.map(call => String(call[0]))
    .join('\n');

describe('MetadataRetrieveService retrieve failure', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const tokenSource = new vscode.CancellationTokenSource();
    jest
      .spyOn(vscode.window, 'withProgress')
      .mockImplementation((_opts, task) => task({ report: () => undefined }, tokenSource.token));
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
