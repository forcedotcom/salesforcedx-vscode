/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentStatus, RegistryAccess, type RetrieveResult } from '@salesforce/source-deploy-retrieve';
import {
  ChannelService,
  ComponentSetService,
  FsService,
  HashableUri,
  MetadataRegistryService,
  MetadataRetrieveService,
  NoTargetOrgConfiguredError,
  SettingsService,
  isSDRSuccess,
  isSDRFailure,
  makeFileResponseFailure,
  toRequestStatus,
  toComponentStatusChangeType
} from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
import { setImmediate } from 'node:timers/promises';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { retrieveOnLoadEffect } from '../../../src/core/retrieveOnLoad';
import { nls } from '../../../src/messages';
import { toUri } from '../../../src/services/uriUtils';

const retrieve = vi.fn<MetadataRetrieveService['Service']['retrieve']>();
const open = vi.fn<FsService['Service']['showTextDocument']>();
const lines: string[] = [];
const registry = new RegistryAccess();
beforeEach(() => {
  lines.length = 0;
  retrieve.mockReturnValue(
    Effect.succeed({
      getFileResponses: () => [
        { type: 'ApexClass', fullName: 'Foo', filePath: '/project/Foo.cls', state: ComponentStatus.Created },
        { type: 'ApexClass', fullName: 'Foo', filePath: '/project/Foo.cls-meta.xml', state: ComponentStatus.Created }
      ]
    } as unknown as RetrieveResult)
  );
  open.mockReturnValue(Effect.succeed({} as vscode.TextEditor));
});
const layer = (setting = 'ApexClass:Foo') =>
  Layer.mergeAll(
    Layer.mock(SettingsService, { getRetrieveOnLoad: () => Effect.succeed(setting) }),
    Layer.mock(MetadataRetrieveService, { retrieve }),
    Layer.mock(MetadataRegistryService, { getRegistryAccess: () => Effect.succeed(registry) }),
    Layer.mock(ComponentSetService, {
      isSDRSuccess,
      isSDRFailure,
      makeFileResponseFailure,
      toRequestStatus,
      getComponentState: value => toComponentStatusChangeType(value.state)
    }),
    Layer.mock(FsService, { HashableUri, toUri: value => Effect.succeed(toUri(value)), showTextDocument: open }),
    Layer.mock(ChannelService, {
      appendToChannel: text =>
        Effect.sync(() => {
          lines.push(text);
        })
    })
  );

it('uses canonical retrieve options and opens only the resulting content file', async () => {
  await Effect.runPromise(retrieveOnLoadEffect().pipe(Effect.provide(layer())));
  expect(retrieve).toHaveBeenCalledExactlyOnceWith([{ type: 'ApexClass', fullName: 'Foo' }], { ignoreConflicts: true });
  expect(open).toHaveBeenCalledExactlyOnceWith(URI.file('/project/Foo.cls'), { preview: false });
  expect(lines).toContain('Retrieve on load completed. 1 files retrieved successfully.');
});

it.each(['', 'invalid'])('does not start native retrieval for an empty/invalid setting: %s', async setting => {
  await Effect.runPromise(retrieveOnLoadEffect().pipe(Effect.provide(layer(setting))));
  expect(retrieve).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

it('reports a localized typed failure without waiting for its error toast to close', async () => {
  const failure = new NoTargetOrgConfiguredError({ message: 'no org' });
  retrieve.mockReturnValue(Effect.fail(failure));
  const toast = Promise.withResolvers<undefined>();
  vi.mocked(vscode.window.showErrorMessage).mockReturnValue(toast.promise);
  const running = Effect.runPromise(retrieveOnLoadEffect().pipe(Effect.provide(layer())));
  try {
    expect(await Promise.race([running.then(() => 'completed'), setImmediate().then(() => 'pending')])).toBe(
      'completed'
    );
    const message = nls.localize('retrieve_on_load_failed', String(failure));
    expect(lines).toContain(message);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledExactlyOnceWith(message);
  } finally {
    toast.resolve(undefined);
    await running;
  }
});

it.each(['defect', 'interrupt', 'mixed'] as const)(
  'preserves %s instead of reporting a recoverable retrieve failure',
  async kind => {
    const failure = new NoTargetOrgConfiguredError({ message: 'no org' });
    const defect = new Error('native defect');
    retrieve.mockReturnValue(
      Match.value(kind).pipe(
        Match.when('defect', () => Effect.die(defect)),
        Match.when('interrupt', () => Effect.interrupt),
        Match.orElse(() => Effect.failCause(Cause.combine(Cause.fail(failure), Cause.interrupt())))
      )
    );
    const result = await Effect.runPromiseExit(retrieveOnLoadEffect().pipe(Effect.provide(layer())));
    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      if (kind === 'defect')
        expect(result.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
      else expect(Cause.hasInterrupts(result.cause)).toBe(true);
      if (kind === 'mixed')
        expect(result.cause.reasons.some(reason => reason._tag === 'Fail' && reason.error === failure)).toBe(true);
    }
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  }
);
