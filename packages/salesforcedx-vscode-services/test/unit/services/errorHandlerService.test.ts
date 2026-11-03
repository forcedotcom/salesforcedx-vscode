/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, ErrorHandlerService, InactiveOrgOperationError, OrgId } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import type { MockInstance } from 'vitest';
import { getErrorMessage, makeErrorHandlerServiceLayer } from '../../../src/services/errorHandlerService.js';

const messages = { orgOperationSuperseded: 'Organisation modifiée', viewSuggestions: 'Voir les suggestions' };
let showErrorMessage: MockInstance;
const makeRuntime = () => {
  const output: vscode.OutputChannel = {
    name: 'Caller channel',
    append: vi.fn(),
    appendLine: vi.fn(),
    replace: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  };
  const channel = Layer.mock(ChannelService, {
    getChannel: Effect.succeed(output),
    appendToChannel: message => Effect.sync(() => output.appendLine(message))
  });
  const runtime = ManagedRuntime.make(makeErrorHandlerServiceLayer(messages).pipe(Layer.provide(channel)));
  return {
    output,
    runtime,
    handle: (cause: Cause.Cause<unknown>) =>
      runtime.runPromise(ErrorHandlerService.use(service => service.handleCause(cause)))
  };
};

beforeEach(() => {
  showErrorMessage = vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
  vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);
});

it('retains inner native errors and action ordering, using the localized button to open the caller channel', async () => {
  const inner = Object.assign(new Error('Inner error'), { actions: ['Inner action'] });
  const outer = Object.assign(new Error('Outer error', { cause: inner }), { actions: ['Outer action', ''] });
  expect(getErrorMessage(outer)).toBe('Inner error\n\nOuter action\nInner action');
  const caller = makeRuntime();
  showErrorMessage.mockResolvedValue(messages.viewSuggestions);
  try {
    await caller.handle(Cause.fail(outer));
    expect(caller.output.appendLine).toHaveBeenCalledExactlyOnceWith(
      'Error: Inner error\n\nOuter action\nInner action'
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Inner error', messages.viewSuggestions);
    expect(caller.output.show).toHaveBeenCalledTimes(1);
  } finally {
    await caller.runtime.dispose();
  }
});

it('does not open the channel when the suggestion action is dismissed', async () => {
  const caller = makeRuntime();
  try {
    await caller.handle(Cause.fail(Object.assign(new Error('Failure'), { actions: ['Retry'] })));
    expect(caller.output.show).not.toHaveBeenCalled();
  } finally {
    await caller.runtime.dispose();
  }
});

it('keeps org-change interruption informational instead of showing an error', async () => {
  const caller = makeRuntime();
  try {
    const error = new InactiveOrgOperationError({
      message: 'Earlier org work stopped',
      expectedOrgId: Schema.decodeUnknownSync(OrgId)('00D000000000001')
    });
    await caller.handle(Cause.fail(error));
    expect(caller.output.appendLine).toHaveBeenCalledExactlyOnceWith(
      '[InactiveOrgOperationError] Earlier org work stopped'
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(messages.orgOperationSuperseded);
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  } finally {
    await caller.runtime.dispose();
  }
});

it('does not duplicate completed metadata summaries or await action-free toasts', async () => {
  const caller = makeRuntime();
  showErrorMessage.mockReturnValue(new Promise(() => {}));
  try {
    for (const _tag of ['DeployCompletedWithErrorsError', 'RetrieveCompletedWithErrorsError']) {
      await caller.handle(Cause.fail({ _tag, message: 'Operation has failures' }));
    }
    expect(caller.output.appendLine).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(2);
  } finally {
    await caller.runtime.dispose();
  }
});

it('keeps independently built extension error handlers on their own channels', async () => {
  const first = makeRuntime();
  const second = makeRuntime();
  try {
    await first.handle(Cause.fail(new Error('First extension')));
    await second.handle(Cause.fail(new Error('Second extension')));
    expect(first.output.appendLine).toHaveBeenCalledExactlyOnceWith('First extension');
    expect(second.output.appendLine).toHaveBeenCalledExactlyOnceWith('Second extension');
  } finally {
    await first.runtime.dispose();
    await second.runtime.dispose();
  }
});
