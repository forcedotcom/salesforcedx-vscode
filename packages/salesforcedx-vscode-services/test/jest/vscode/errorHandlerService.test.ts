/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { ChannelService } from '../../../src/vscode/channelService';
import { ErrorHandlerService } from '../../../src/vscode/errorHandlerService';
import { createMockOutputChannel } from '../testUtils';

describe('ErrorHandlerService', () => {
  let mockChannel: vscode.OutputChannel;
  let mockChannelService: ChannelService;
  let errorHandler: ErrorHandlerService;
  let showErrorMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock OutputChannel
    mockChannel = createMockOutputChannel();

    // Mock ChannelService
    mockChannelService = new ChannelService({
      getChannel: Effect.sync(() => mockChannel),
      clearChannel: Effect.succeed(undefined),
      appendToChannel: (message: string) =>
        Effect.sync(() => {
          mockChannel.appendLine(message);
        })
    });

    // Mock vscode.window.showErrorMessage
    showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);

    // Create ErrorHandlerService with mocked ChannelService
    const layer = Layer.provide(ErrorHandlerService.Default, Layer.succeed(ChannelService, mockChannelService));
    errorHandler = Effect.runSync(Effect.provide(Effect.flatMap(ErrorHandlerService, Effect.succeed), layer));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCause', () => {
    describe('regular native JS errors', () => {
      it('should handle simple Error without cause or actions', async () => {
        const error = new Error('Simple error');
        const cause = Cause.fail(error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Simple error');
        expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
        expect(mockChannel.show).not.toHaveBeenCalled();
      });

      it('should handle Error with message only', async () => {
        const error = new Error('Error message');
        const cause = Cause.fail(error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Error message');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });
    });

    describe('errors with cause property', () => {
      it('should prefer inner cause message', async () => {
        const innerError = new Error('Inner error');
        const outerError = new Error('Outer error');
        (outerError as { cause: Error }).cause = innerError;
        const cause = Cause.fail(outerError);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Inner error');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });

      it('should handle deeply nested cause chain', async () => {
        const deepestError = new Error('Deepest error');
        const middleError = new Error('Middle error');
        (middleError as { cause: Error }).cause = deepestError;
        const outerError = new Error('Outer error');
        (outerError as { cause: Error }).cause = middleError;
        const cause = Cause.fail(outerError);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Deepest error');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });
    });

    describe('string errors (edge case)', () => {
      it('should handle string error', async () => {
        const cause = Cause.fail('String error');

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('String error');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });
    });

    describe('errors with actions array', () => {
      it('should handle error with actions and show View Details button', async () => {
        const error = new Error('Base error message') as Error & { actions: string[] };
        error.actions = ['Action 1', 'Action 2'];
        const cause = Cause.fail(error);

        showErrorMessageSpy.mockResolvedValue('View Suggestions');

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Base error message', 'View Suggestions');
        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Base error message\n\nAction 1\nAction 2');
        expect(mockChannel.show).toHaveBeenCalled();
      });

      it('should not show channel when View Details is not clicked', async () => {
        const error = new Error('Base error message') as Error & { actions: string[] };
        error.actions = ['Action 1'];
        const cause = Cause.fail(error);

        showErrorMessageSpy.mockResolvedValue(undefined);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Base error message', 'View Suggestions');
        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Base error message\n\nAction 1');
        expect(mockChannel.show).not.toHaveBeenCalled();
      });

      it('should filter out empty strings from actions', async () => {
        const error = new Error('Base error') as Error & { actions: string[] };
        error.actions = ['Valid', '', 'Also valid'];
        const cause = Cause.fail(error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Base error\n\nValid\nAlso valid');
      });

      it('should treat empty actions array as no actions', async () => {
        const error = new Error('Base error') as Error & { actions: string[] };
        error.actions = [];
        const cause = Cause.fail(error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Base error');
        expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
        expect(mockChannel.show).not.toHaveBeenCalled();
      });
    });

    describe('errors with both actions and cause', () => {
      it('should extract actions from both error and cause', async () => {
        const innerError = new Error('Inner error') as Error & { actions: string[] };
        innerError.actions = ['Inner action'];
        const outerError = new Error('Outer error') as Error & { actions: string[] };
        outerError.actions = ['Outer action'];
        (outerError as { cause: Error }).cause = innerError;
        const cause = Cause.fail(outerError);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Inner error', 'View Suggestions');
        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Inner error\n\nOuter action\nInner action');
      });

      it('should prefer inner cause message when both have actions', async () => {
        const innerError = new Error('Inner message') as Error & { actions: string[] };
        innerError.actions = ['Inner action'];
        const outerError = new Error('Outer message') as Error & { actions: string[] };
        outerError.actions = ['Outer action'];
        (outerError as { cause: Error }).cause = innerError;
        const cause = Cause.fail(outerError);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Inner message', 'View Suggestions');
        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Inner message\n\nOuter action\nInner action');
      });
    });

    describe('Effect TaggedError with cause', () => {
      it('should handle TaggedError with cause', async () => {
        class TestTaggedError extends Data.TaggedError('TestTaggedError')<{
          readonly cause: unknown;
        }> {}

        const innerError = new Error('Inner error from TaggedError');
        const taggedError = new TestTaggedError({ cause: innerError });
        const cause = Cause.fail(taggedError);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Inner error from TaggedError');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });

      it('should handle TaggedError with cause and actions', async () => {
        class TestTaggedError extends Data.TaggedError('TestTaggedError')<{
          readonly cause: unknown;
        }> {}

        const innerError = new Error('Inner error') as Error & { actions: string[] };
        innerError.actions = ['Action from cause'];
        const taggedError = new TestTaggedError({ cause: innerError });
        const cause = Cause.fail(taggedError);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Inner error', 'View Suggestions');
        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Inner error\n\nAction from cause');
      });
    });

    describe('nested cause chains', () => {
      it('should collect all actions from nested chain', async () => {
        const level3Error = new Error('Level 3') as Error & { actions: string[] };
        level3Error.actions = ['Action 3'];
        const level2Error = new Error('Level 2') as Error & { actions: string[] };
        level2Error.actions = ['Action 2'];
        (level2Error as { cause: Error }).cause = level3Error;
        const level1Error = new Error('Level 1') as Error & { actions: string[] };
        level1Error.actions = ['Action 1'];
        (level1Error as { cause: Error }).cause = level2Error;
        const cause = Cause.fail(level1Error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Level 3', 'View Suggestions');
        expect(mockChannel.appendLine).toHaveBeenCalledWith('Error: Level 3\n\nAction 1\nAction 2\nAction 3');
      });

      it('should get base message from deepest cause in chain', async () => {
        const deepest = new Error('Deepest');
        const middle = new Error('Middle');
        (middle as { cause: Error }).cause = deepest;
        const outer = new Error('Outer');
        (outer as { cause: Error }).cause = middle;
        const cause = Cause.fail(outer);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Deepest');
      });
    });

    describe('edge cases', () => {
      it('should handle error with only empty string actions', async () => {
        const error = new Error('Base error') as Error & { actions: string[] };
        error.actions = ['', '', ''];
        const cause = Cause.fail(error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Base error');
        expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });

      it('should handle non-Error object with actions property', async () => {
        const errorObj = {
          message: 'Not an Error',
          actions: ['Action 1']
        };
        const cause = Cause.fail(errorObj);

        await Effect.runPromise(errorHandler.handleCause(cause));

        // getActions returns [] for non-Error objects
        // getBaseMessage reads message from plain objects when present
        expect(showErrorMessageSpy).toHaveBeenCalledWith('Not an Error');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });

      it('should handle Cause.die', async () => {
        const error = new Error('Defect error');
        const cause = Cause.die(error);

        await Effect.runPromise(errorHandler.handleCause(cause));

        expect(showErrorMessageSpy).toHaveBeenCalledWith('Defect error');
        expect(mockChannel.appendLine).not.toHaveBeenCalled();
      });
    });
  });
});
