import assert from 'node:assert/strict';
import { WorkspaceService, bindLegacyWorkspaceService } from '@salesforce/vscode-services-v3-compat/legacyWorkspaceService';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { setProvider, stats } from './vscode.mjs';

const bind = name => {
  const info = { uri: URI.file(`/${name}`), path: `/${name}`, fsPath: `/${name}`, cwd: '/', isEmpty: false, isVirtualFs: false };
  return bindLegacyWorkspaceService({ getWorkspaceInfo: () => Effect.succeed(info),
    getWorkspaceInfoOrThrow: () => Effect.succeed(info) });
};
const a = bind('a');
const b = bind('b');
const contextA = Context.make(WorkspaceService, a.instance);
const contextB = Context.make(WorkspaceService, b.instance);
setProvider({ prebuiltServicesDependencies: contextA }, false);
assert.equal(await Effect.runPromise(WorkspaceService.pipe(Effect.provide(WorkspaceService.Default))), a.instance);
assert.deepEqual(stats, { lookups: 1, activations: 1 });
setProvider({ prebuiltServicesDependencies: contextB }, true);
assert.equal(await Effect.runPromise(WorkspaceService.pipe(Effect.provide(WorkspaceService.Default))), b.instance);
assert.deepEqual(stats, { lookups: 2, activations: 1 });
assert.equal(await Effect.runPromise(WorkspaceService.pipe(Effect.provide(WorkspaceService.Default.pipe(
  Layer.provide(Layer.succeedContext(contextA)))))), a.instance);
assert.equal(await Effect.runPromise(WorkspaceService.pipe(Effect.provide(a.Service.Default))), a.instance);
assert.deepEqual(stats, { lookups: 2, activations: 1 }, 'provided/bound defaults must not look up a different owner');
console.log('PASS source fallback: inactive activation, active reuse, explicit caller preference and bound-owner isolation');
