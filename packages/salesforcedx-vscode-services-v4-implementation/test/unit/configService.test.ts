/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config, OrgConfigProperties, SfConfigProperties } from '@salesforce/core';
import type * as SalesforceCore from '@salesforce/core';
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { CliId, ConfigService, TargetOrgRef, type DefaultOrgInfo } from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as Tracer from 'effect/Tracer';
import * as TestClock from 'effect/testing/TestClock';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ConfigServiceLayer } from '../../src/configService.js';
import { OrgChanges, OrgChangesLayer, orgLayers } from '../../src/targetOrgRef.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';

vi.mock('@salesforce/core', async () => ({
  ...(await vi.importActual<typeof SalesforceCore>('@salesforce/core')),
  Config: { create: vi.fn(), getDefaultOptions: () => ({}) }
}));
vi.mock('@salesforce/core/configAggregator', () => ({ ConfigAggregator: { create: vi.fn() } }));

class ConfigA extends Context.Service<ConfigA, ConfigService['Service']>()('test/configA') {}
class ConfigB extends Context.Service<ConfigB, ConfigService['Service']>()('test/configB') {}
const configGraph = ConfigServiceLayer.pipe(Layer.provideMerge(Layer.mergeAll(WorkspaceServiceLayer, orgLayers)));
const graph = Layer.mergeAll(
  configGraph,
  Layer.effect(ConfigA, ConfigService).pipe(Layer.provide(configGraph)),
  Layer.effect(ConfigB, ConfigService).pipe(Layer.provide(configGraph))
);
const folders: vscode.WorkspaceFolder[] = [];
const values: Record<string, unknown> = {};
const reload = vi.fn();
const set = vi.fn();
const unset = vi.fn();
const write = vi.fn();

beforeEach(() => {
  folders.splice(0, folders.length, { uri: URI.file('/mock/project'), name: 'project', index: 0 });
  Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, get: () => folders });
  Object.keys(values).forEach(key => {
    delete values[key];
  });
  reload.mockReset();
  set.mockReset();
  unset.mockReset();
  write.mockReset().mockResolvedValue(undefined);
  const aggregator = {
    getPropertyValue: (key: string) => values[key],
    getConfig: () => values,
    reload: () => {
      reload();
      return Promise.resolve(aggregator);
    }
  } as unknown as ConfigAggregator;
  vi.mocked(ConfigAggregator.create).mockReset().mockResolvedValue(aggregator);
  vi.mocked(Config.create)
    .mockReset()
    .mockResolvedValue({ set, unset, write } as unknown as Config);
});
afterEach(() => vi.unstubAllEnvs());

it('memoizes the same ConfigService and cache across dependent layers', async () => {
  const runtime = ManagedRuntime.make(graph);
  try {
    const [a, b] = await runtime.runPromise(Effect.all([ConfigA, ConfigB]));
    expect(a).toBe(b);
    values[OrgConfigProperties.TARGET_ORG] = 'MyOrg';
    const results = await runtime.runPromise(
      Effect.all([a.getConfigAggregator(), b.getConfigAggregator()], { concurrency: 'unbounded' })
    );
    expect(results[0]).toBe(results[1]);
    expect(ConfigAggregator.create).toHaveBeenCalledExactlyOnceWith({ projectPath: URI.file('/mock/project').fsPath });
    expect(reload).toHaveBeenCalledTimes(2);
    expect(await runtime.runPromise(a.getTargetOrg())).toBe('MyOrg');
  } finally {
    await runtime.dispose();
  }
});

it('preserves an absolute virtual workspace path at the SDK config boundary', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  folders[0] = { uri: URI.parse('memfs:/virtual/project'), name: 'project', index: 0 };
  const runtime = ManagedRuntime.make(configGraph);
  try {
    await runtime.runPromise(ConfigService.use(service => service.getConfigAggregator()));
    expect(ConfigAggregator.create).toHaveBeenCalledExactlyOnceWith({ projectPath: '/virtual/project' });
  } finally {
    await runtime.dispose();
  }
});

it('retains cache capacity and invalidates on observed org changes', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const runtime = ManagedRuntime.make(configGraph);
  try {
    await runtime.runPromise(ConfigService.use(service => service.getConfigAggregator()));
    await runtime.runPromise(ConfigService.use(service => service.getConfigAggregator()));
    expect(ConfigAggregator.create).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    await runtime.runPromise(
      Effect.gen(function* () {
        const ref = yield* TargetOrgRef;
        yield* SubscriptionRef.set(ref, { username: 'new@example.com' });
        yield* Effect.yieldNow;
        yield* ConfigService.use(service => service.getConfigAggregator());
      })
    );
    expect(ConfigAggregator.create).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 5; index++) {
      folders[0] = { uri: URI.file(`/mock/project${index}`), name: 'project', index: 0 };
      await runtime.runPromise(ConfigService.use(service => service.getConfigAggregator()));
    }
    folders[0] = { uri: URI.file('/mock/project'), name: 'project', index: 0 };
    await runtime.runPromise(ConfigService.use(service => service.getConfigAggregator()));
    expect(ConfigAggregator.create).toHaveBeenCalledTimes(8);
  } finally {
    await runtime.dispose();
  }
});

it('keeps string/boolean telemetry reads and excludes credentials from spans', async () => {
  values[OrgConfigProperties.TARGET_ORG] = 'MyOrg';
  values[OrgConfigProperties.TARGET_DEV_HUB] = 'MyHub';
  values[SfConfigProperties.DISABLE_TELEMETRY] = true;
  values['org-isv-debugger-sid'] = 'session-secret';
  values.accessToken = 'access-secret';
  const spans: Tracer.Span[] = [];
  const tracer = Tracer.make({
    span: options => {
      const span = Tracer.nativeTracer.span(options);
      spans.push(span);
      return span;
    }
  });
  const runtime = ManagedRuntime.make(configGraph);
  try {
    expect(
      await runtime.runPromise(
        ConfigService.use(service => service.isCliTelemetryDisabled()).pipe(Effect.withTracer(tracer))
      )
    ).toBe(true);
    const attributes = spans.map(span => Object.fromEntries(span.attributes));
    expect(attributes.some(value => value[OrgConfigProperties.TARGET_ORG] === 'MyOrg')).toBe(true);
    expect(JSON.stringify(attributes)).not.toMatch(/session-secret|access-secret|org-isv-debugger-sid|accessToken/);
    values[SfConfigProperties.DISABLE_TELEMETRY] = 'true';
    expect(await runtime.runPromise(ConfigService.use(service => service.isCliTelemetryDisabled()))).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it('writes before invalidating and preserves CLI/web identity when clearing org state', async () => {
  const runtime = ManagedRuntime.make(configGraph);
  const cliId = Schema.decodeUnknownSync(CliId)('00000000-0000-4000-8000-000000000001');
  try {
    await runtime.runPromise(ConfigService.use(service => service.setTargetOrg('MyAlias')));
    expect(set).toHaveBeenCalledExactlyOnceWith(OrgConfigProperties.TARGET_ORG, 'MyAlias');
    expect(write).toHaveBeenCalledTimes(1);
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[0]);
    const ref = await runtime.runPromise(TargetOrgRef);
    await runtime.runPromise(SubscriptionRef.set(ref, { cliId, webUserId: 'web-user', username: 'org-user' }));
    await runtime.runPromise(ConfigService.use(service => service.unsetTargetOrg()));
    expect(await runtime.runPromise(SubscriptionRef.get(ref))).toEqual({ cliId, webUserId: 'web-user' });
    write.mockRejectedValueOnce(new Error('disk full'));
    expect(
      await runtime.runPromise(ConfigService.use(service => service.setTargetOrg('Other')).pipe(Effect.flip))
    ).toMatchObject({
      _tag: 'ConfigWriteError',
      message: 'Failed to write config: disk full'
    });
  } finally {
    await runtime.dispose();
  }
});

it('does not hang startup when the supplied org-state subscription is already closed', async () => {
  const ref = await Effect.runPromise(SubscriptionRef.make<DefaultOrgInfo>({}));
  await Effect.runPromise(PubSub.shutdown(ref.pubsub));
  const layer = ConfigServiceLayer.pipe(
    Layer.provide(
      Layer.mergeAll(WorkspaceServiceLayer, OrgChangesLayer.pipe(Layer.provideMerge(Layer.succeed(TargetOrgRef, ref))))
    )
  );
  const exit = await Effect.runPromiseExit(
    Effect.void.pipe(Effect.provide(layer), Effect.timeout(Duration.millis(200)))
  );
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
  expect(ConfigAggregator.create).not.toHaveBeenCalled();
});

it('keeps cache entries until the existing 30-minute TTL expires', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* ConfigService;
      yield* service.getConfigAggregator();
      yield* TestClock.adjust(Duration.minutes(29));
      yield* service.getConfigAggregator();
      expect(ConfigAggregator.create).toHaveBeenCalledTimes(1);
      yield* TestClock.adjust(Duration.minutes(1));
      yield* service.getConfigAggregator();
      expect(ConfigAggregator.create).toHaveBeenCalledTimes(2);
    }).pipe(Effect.provide(configGraph), Effect.provide(TestClock.layer()))
  );
});

it('does not let a delayed unset clear a newer acknowledged selection', async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  write.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
  });
  const runtime = ManagedRuntime.make(configGraph);
  try {
    const clearing = runtime.runPromise(ConfigService.use(service => service.unsetTargetOrg()));
    await entered.promise;
    await runtime.runPromise(
      OrgChanges.use(changes =>
        changes.begin.pipe(
          Effect.flatMap(generation =>
            changes.update(generation, () => Effect.succeed({ username: 'newer-selection' }))
          )
        )
      )
    );
    release.resolve();
    await clearing;
    expect((await runtime.runPromise(OrgChanges.use(changes => changes.snapshot))).org.username).toBe(
      'newer-selection'
    );
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});
