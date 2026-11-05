/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EditorService, NoActiveEditorError } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { EditorServiceLayer } from '../../../src/services/editorService.js';

const originalEditor = Object.getOwnPropertyDescriptor(vscode.window, 'activeTextEditor');
const listeners = new Set<(editor: vscode.TextEditor | undefined) => void>();
const disposed = vi.fn();
const showEditor = (isEmpty: boolean) => {
  const editor = {
    document: {
      uri: URI.file('/project/classes/Example.cls'),
      getText: vi.fn((selection?: vscode.Range) => (selection ? 'selected text' : 'full document'))
    },
    selection: { isEmpty, start: { line: 7, character: 12 } }
  };
  Object.defineProperty(vscode.window, 'activeTextEditor', { configurable: true, value: editor });
  return editor;
};

beforeEach(() => {
  listeners.clear();
  disposed.mockClear();
  Object.defineProperty(vscode.window, 'activeTextEditor', { configurable: true, value: undefined });
  vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockImplementation(listener => {
    listeners.add(listener);
    return {
      dispose: () => {
        listeners.delete(listener);
        disposed();
      }
    };
  });
});
afterEach(() => {
  if (originalEditor) Object.defineProperty(vscode.window, 'activeTextEditor', originalEditor);
  else Reflect.deleteProperty(vscode.window, 'activeTextEditor');
});

it('retains the cursor position for an empty selection', async () => {
  const editor = showEditor(true);
  const runtime = ManagedRuntime.make(EditorServiceLayer);
  try {
    expect(await runtime.runPromise(EditorService.use(service => service.getActiveEditorContext(true)))).toEqual({
      text: 'full document',
      documentUri: editor.document.uri,
      selectionStart: { line: 7, character: 12 },
      selectionRange: undefined
    });
  } finally {
    await runtime.dispose();
  }
});

it('uses selected text only when requested and retains document identity', async () => {
  const editor = showEditor(false);
  const runtime = ManagedRuntime.make(EditorServiceLayer);
  try {
    const service = await runtime.runPromise(EditorService);
    expect(await runtime.runPromise(service.getActiveEditorUri())).toBe(editor.document.uri);
    expect(await runtime.runPromise(service.getActiveEditorText(true))).toBe('selected text');
    expect(await runtime.runPromise(service.getActiveEditorText(false))).toBe('full document');
    expect(await runtime.runPromise(service.getActiveEditorContext(true))).toEqual({
      text: 'selected text',
      documentUri: editor.document.uri,
      selectionStart: { line: 7, character: 12 },
      selectionRange: { startLine: 7, startCharacter: 12 }
    });
    expect(await runtime.runPromise(service.getActiveEditorContext(false))).toEqual({
      text: 'full document',
      documentUri: editor.document.uri,
      selectionStart: undefined,
      selectionRange: undefined
    });
  } finally {
    await runtime.dispose();
  }
});

it('keeps all missing-editor operations typed', async () => {
  const runtime = ManagedRuntime.make(EditorServiceLayer);
  try {
    const service = await runtime.runPromise(EditorService);
    const errors = await runtime.runPromise(
      Effect.all([
        service.getActiveEditorUri().pipe(Effect.flip),
        service.getActiveEditorText(true).pipe(Effect.flip),
        service.getActiveEditorContext(true).pipe(Effect.flip)
      ])
    );
    errors.forEach(error => expect(error).toBeInstanceOf(NoActiveEditorError));
  } finally {
    await runtime.dispose();
  }
});

it('shares one listener, preserves event order and closes its publisher on repeated disposal', async () => {
  const runtime = ManagedRuntime.make(Layer.mergeAll(EditorServiceLayer, EditorServiceLayer));
  const service = await runtime.runPromise(EditorService);
  const registered = [...listeners];
  try {
    expect(listeners.size).toBe(1);
    const events = await runtime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(service.pubsub);
        const editor = showEditor(true);
        listeners.forEach(listener => listener(vscode.window.activeTextEditor));
        Object.defineProperty(vscode.window, 'activeTextEditor', { configurable: true, value: undefined });
        listeners.forEach(listener => listener(undefined));
        const first = yield* PubSub.take(subscription);
        const second = yield* PubSub.take(subscription);
        return { first, second, editor };
      }).pipe(Effect.scoped)
    );
    expect(events.first?.document.uri).toBe(events.editor.document.uri);
    expect(events.second).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
  await runtime.dispose();
  expect(listeners.size).toBe(0);
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(await Effect.runPromise(PubSub.isShutdown(service.pubsub))).toBe(true);
  registered.forEach(listener => expect(() => listener(undefined)).not.toThrow());
});

it('interrupts a waiting consumer when the owning editor publisher closes', async () => {
  const runtime = ManagedRuntime.make(EditorServiceLayer);
  const service = await runtime.runPromise(EditorService);
  const ready = await Effect.runPromise(Deferred.make<void>());
  const waiting = Effect.runPromiseExit(
    Effect.gen(function* () {
      const subscription = yield* PubSub.subscribe(service.pubsub);
      yield* Deferred.succeed(ready, undefined);
      return yield* PubSub.take(subscription);
    }).pipe(Effect.scoped)
  );
  try {
    await Effect.runPromise(Deferred.await(ready));
    await runtime.dispose();
    const exit = await waiting;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(Cause.hasInterrupts(exit.cause)).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it('does not replay an event to a subscriber created after the VS Code callback returned', async () => {
  const runtime = ManagedRuntime.make(EditorServiceLayer);
  const service = await runtime.runPromise(EditorService);
  const scope = Effect.runSync(Scope.make());
  try {
    showEditor(true);
    listeners.forEach(listener => listener(vscode.window.activeTextEditor));
    const subscription = Effect.runSync(PubSub.subscribe(service.pubsub).pipe(Scope.provide(scope)));
    const second = showEditor(false);
    listeners.forEach(listener => listener(vscode.window.activeTextEditor));
    const received = await Effect.runPromise(PubSub.take(subscription));
    expect(received?.document.uri).toBe(second.document.uri);
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    await runtime.dispose();
  }
});

it('retains listener disposal defects while still shutting down its publisher', async () => {
  const defect = new Error('Editor listener disposal failed');
  vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockReturnValue({
    dispose: () => {
      throw defect;
    }
  });
  const runtime = ManagedRuntime.make(EditorServiceLayer);
  const service = await runtime.runPromise(EditorService);
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) expect(exit.cause.reasons).toContainEqual(expect.objectContaining({ _tag: 'Die', defect }));
  expect(await Effect.runPromise(PubSub.isShutdown(service.pubsub))).toBe(true);
});
