/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as ExecutionStrategy from 'effect/ExecutionStrategy';
import * as Exit from 'effect/Exit';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import { DRIVABLE_VSCODE_EXTENSION_DIRS } from '../src/constants';
import { consumeConsoleWrites, drainConsoleWrites, type ConsoleWrite } from '../src/consoleWriteQueue';
import { releaseAll } from '../src/releaseAll';
import {
  DrivableVscodeActionRecord,
  ActInput,
  StartInput,
  DrivableVscodeFinding,
  DrivableVscodeManifest,
  DrivableVscodeRendererConsoleEntry,
  type DrivableVscodeRendererConsoleEntry as DrivableVscodeRendererConsoleEntryType
} from '../src/schemas';

describe('drivable VS Code contracts', () => {
  test('retains the canonical 15 extension inventory', () => {
    expect(DRIVABLE_VSCODE_EXTENSION_DIRS).toHaveLength(15);
    expect(new Set(DRIVABLE_VSCODE_EXTENSION_DIRS).size).toBe(15);
    expect(DRIVABLE_VSCODE_EXTENSION_DIRS).toContain('salesforcedx-vscode-apex-oas');
    expect(DRIVABLE_VSCODE_EXTENSION_DIRS).toContain('salesforcedx-vscode-apex-debugger');
  });

  test('decodes MCP inputs through canonical Effect schemas', () => {
    expect(Schema.decodeUnknownSync(StartInput)({ objective: 'Validate URL feedback' })).toEqual({
      objective: 'Validate URL feedback',
      extensionMode: 'vsix'
    });
    expect(
      Schema.decodeUnknownSync(ActInput)({
        observationSequence: 7,
        action: { kind: 'command', title: 'SFDX: Create Project' }
      })
    ).toEqual({ observationSequence: 7, action: { kind: 'command', title: 'SFDX: Create Project' } });
    expect(() =>
      Schema.decodeUnknownSync(DrivableVscodeFinding)({
        title: 'Missing steps',
        severity: 'low',
        area: 'Project creation',
        steps: [],
        expected: 'feedback',
        actual: 'none',
        confidence: 'high'
      })
    ).toThrow();
  });

  test('rejects stale action sequences at the schema boundary', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActInput)({
        observationSequence: 0,
        action: { kind: 'press', key: 'Enter' }
      })
    ).toThrow();
  });

  test('validates persisted artifact contracts', () => {
    const renderer = Schema.decodeUnknownSync(DrivableVscodeRendererConsoleEntry)({
      capturedAt: '2026-08-06T00:00:00.000Z',
      type: 'log',
      text: 'ready',
      location: { url: 'file:///extension.js', lineNumber: 1, columnNumber: 2 }
    });
    expect(Schema.encodeSync(DrivableVscodeRendererConsoleEntry)(renderer)).toEqual(renderer);
    expect(() => Schema.decodeUnknownSync(DrivableVscodeActionRecord)({ kind: 'session-closing' })).toThrow();
    expect(() => Schema.decodeUnknownSync(DrivableVscodeManifest)({ runId: 'run' })).toThrow();
  });

  test('attempts every release when releases fail', async () => {
    const attempted: string[] = [];
    const release = (name: string) => Effect.sync(() => attempted.push(name)).pipe(Effect.zipRight(Effect.fail(name)));
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(releaseAll([release('electron'), release('workspace'), release('listeners')]))
      )
    ).toBe(true);
    expect(attempted.toSorted()).toEqual(['electron', 'listeners', 'workspace']);
  });

  test('attempts every scope finalizer and reports their failures', async () => {
    const attempted: string[] = [];
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const scope = yield* Scope.make(ExecutionStrategy.sequential);
        yield* Effect.forEach(['workspace', 'electron', 'listener'], name =>
          Scope.addFinalizer(scope, Effect.sync(() => attempted.push(name)).pipe(Effect.zipRight(Effect.die(name))))
        );
        yield* Scope.close(scope, Exit.void);
      })
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(attempted).toEqual(['listener', 'electron', 'workspace']);
  });

  test('drains queued console entries in order before stopping', async () => {
    const entries: DrivableVscodeRendererConsoleEntryType[] = [];
    const entry = (text: string): DrivableVscodeRendererConsoleEntryType => ({
      capturedAt: '2026-08-06T00:00:00.000Z',
      type: 'log',
      text,
      location: { url: 'file:///extension.js', lineNumber: 1, columnNumber: 2 }
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* Queue.unbounded<ConsoleWrite>();
        const consumer = yield* Effect.fork(
          consumeConsoleWrites(queue, value => Effect.sync(() => entries.push(value)))
        );
        yield* Queue.offerAll(queue, [
          { _tag: 'Entry', entry: entry('first') },
          { _tag: 'Entry', entry: entry('second') }
        ]);
        yield* drainConsoleWrites(queue, consumer);
        expect(yield* Queue.isShutdown(queue)).toBe(true);
      })
    );
    expect(entries.map(value => value.text)).toEqual(['first', 'second']);
  });
});
