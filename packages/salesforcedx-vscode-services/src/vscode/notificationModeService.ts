/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';

class ToastActionError extends Schema.TaggedError<ToastActionError>()('ToastActionError', {
  cause: Schema.Defect
}) {}

const STATUS_BAR_VISIBLE = Duration.seconds(5);

/** An action button shown in a success toast, or when a status bar success notification is clicked. */
export type ToastAction = { label: string; run: () => void | Promise<void> };

const COMMAND_LEVEL_KEY = 'commandLevelNotifications';
const EXTENSION_LEVEL_KEY = 'extensionLevelNotifications';
const GLOBAL_SECTION = 'salesforcedx-vscode-services';
const GLOBAL_KEY = 'notifications';

/** Notification mode for commands that have both a progress phase and a success notification. */
export type ProgressAndSuccessMode =
  | 'progressToastSuccessToast'
  | 'progressToastSuccessOff'
  | 'progressStatusBarSuccessStatusBar'
  | 'progressStatusBarSuccessOff';

/** Notification mode for commands that have a progress phase but no success notification. */
export type ProgressOnlyMode = 'progressToast' | 'progressStatusBar';

/** Notification mode for commands that produce only a success notification. */
export type SuccessOnlyMode = 'successToast' | 'successStatusBar' | 'successOff';

const AnyModeSchema = Schema.Union(
  Schema.Literal(
    'progressToastSuccessToast',
    'progressToastSuccessOff',
    'progressStatusBarSuccessStatusBar',
    'progressStatusBarSuccessOff'
  ),
  Schema.Literal('progressToast', 'progressStatusBar'),
  Schema.Literal('successToast', 'successStatusBar', 'successOff')
);
type AnyMode = Schema.Schema.Type<typeof AnyModeSchema>;

const ProgressAndSuccessModeSchema = Schema.Literal(
  'progressToastSuccessToast',
  'progressToastSuccessOff',
  'progressStatusBarSuccessStatusBar',
  'progressStatusBarSuccessOff'
);

const decodeAnyMode = Schema.decodeUnknownOption(AnyModeSchema);
const decodeProgressAndSuccessMode = Schema.decodeUnknownOption(ProgressAndSuccessModeSchema);

/** Normalizes a validated user-facing mode to the shared internal representation. */
export const normalizeToInternal = (raw: AnyMode): ProgressAndSuccessMode => {
  switch (raw) {
    case 'progressToastSuccessToast':
    case 'progressToastSuccessOff':
    case 'progressStatusBarSuccessStatusBar':
    case 'progressStatusBarSuccessOff':
      return raw;
    case 'progressToast':
      return 'progressToastSuccessOff';
    case 'progressStatusBar':
      return 'progressStatusBarSuccessOff';
    case 'successToast':
      return 'progressToastSuccessToast';
    case 'successStatusBar':
      return 'progressStatusBarSuccessStatusBar';
    case 'successOff':
      return 'progressToastSuccessOff';
  }
};

export const getInternalMode = (
  extensionSection: string,
  commandLevelSection: string,
  command: string
): ProgressAndSuccessMode => {
  // Command-level: any of the three mode types; Schema rejects unknown strings before normalizing
  const raw = vscode.workspace.getConfiguration(commandLevelSection).inspect<unknown>(command);
  const cmdExplicit = raw?.workspaceFolderValue ?? raw?.workspaceValue ?? raw?.globalValue;
  const fromCmd = Option.map(decodeAnyMode(cmdExplicit), normalizeToInternal);
  if (Option.isSome(fromCmd)) return fromCmd.value;

  // Extension-level (always stores ProgressAndSuccessMode)
  const extCfg = vscode.workspace.getConfiguration(extensionSection).inspect<unknown>(EXTENSION_LEVEL_KEY);
  const extExplicit = extCfg?.workspaceFolderValue ?? extCfg?.workspaceValue ?? extCfg?.globalValue;
  const fromExt = decodeProgressAndSuccessMode(extExplicit);
  if (Option.isSome(fromExt)) return fromExt.value;

  // Global fallback (also ProgressAndSuccessMode)
  return Option.getOrElse(
    decodeProgressAndSuccessMode(vscode.workspace.getConfiguration(GLOBAL_SECTION).get<unknown>(GLOBAL_KEY)),
    () => 'progressToastSuccessToast' as const
  );
};

const applyForceShow = (mode: ProgressAndSuccessMode): ProgressAndSuccessMode => {
  if (mode === 'progressToastSuccessOff') return 'progressToastSuccessToast';
  if (mode === 'progressStatusBarSuccessOff') return 'progressStatusBarSuccessStatusBar';
  return mode;
};

/** Per-extension service for notification settings, progress placement, and success notifications. */
export class NotificationModeService extends Effect.Service<NotificationModeService>()('NotificationModeService', {
  accessors: true,
  effect: (extensionSection: string, statusBarId: string, statusBarName: string) =>
    Effect.gen(function* () {
      const item = yield* Effect.sync(() =>
        vscode.window.createStatusBarItem(statusBarId, vscode.StatusBarAlignment.Left, 44)
      );
      item.name = statusBarName;

      const pendingToastRef = yield* Ref.make<Option.Option<{ message: string; actions: ToastAction[] }>>(
        Option.none()
      );
      const hideTimerRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none());
      const runtime = yield* Effect.runtime<never>();

      const showToastWithActions = Effect.fn('NotificationModeService.showToastWithActions')(function* (
        message: string,
        actions: ToastAction[]
      ) {
        const selection = yield* Effect.promise(() =>
          vscode.window.showInformationMessage(message, ...actions.map(candidate => candidate.label))
        );
        const action = actions.find(candidate => candidate.label === selection);
        if (action)
          yield* Effect.tryPromise({
            try: async () => await action.run(),
            catch: cause => new ToastActionError({ cause })
          }).pipe(
            Effect.catchTag('ToastActionError', error =>
              Effect.promise(() => vscode.window.showErrorMessage(String(error.cause))).pipe(Effect.asVoid)
            )
          );
      });

      const commandId = `${statusBarId}.showToast`;
      const commandDisposable = yield* Effect.sync(() =>
        vscode.commands.registerCommand(commandId, async () => {
          const pending = pendingToastRef.pipe(Ref.get, Runtime.runSync(runtime));
          await Option.match(pending, {
            onNone: () => Promise.resolve(),
            onSome: ({ message, actions }) => Runtime.runPromise(runtime)(showToastWithActions(message, actions))
          });
        })
      );
      item.command = commandId;

      const showTransient = Effect.fn('NotificationModeService.showTransient')(function* (
        message: string,
        actions: ToastAction[]
      ) {
        yield* Effect.sync(() => {
          item.text = `$(check) ${message}`;
          item.show();
        });
        yield* Ref.set(pendingToastRef, Option.some({ message, actions }));
        yield* Option.match(yield* Ref.get(hideTimerRef), {
          onNone: () => Effect.void,
          onSome: Fiber.interrupt
        });
        const newFiber = yield* Effect.sleep(STATUS_BAR_VISIBLE).pipe(
          Effect.andThen(Effect.sync(() => item.hide())),
          Effect.andThen(Ref.set(hideTimerRef, Option.none())),
          Effect.interruptible,
          Effect.forkDaemon
        );
        yield* Ref.set(hideTimerRef, Option.some(newFiber));
      });

      const commandLevelSection = `${extensionSection}.${COMMAND_LEVEL_KEY}`;

      return {
        showSuccessNotification: Effect.fn('NotificationModeService.showSuccessNotification')(function* (
          command: string,
          message: string,
          forceShow = false,
          actions: ToastAction[] = []
        ) {
          const mode = getInternalMode(extensionSection, commandLevelSection, command);
          const effectiveMode = forceShow ? applyForceShow(mode) : mode;
          if (effectiveMode === 'progressStatusBarSuccessStatusBar') return yield* showTransient(message, actions);
          if (effectiveMode === 'progressToastSuccessToast') return yield* showToastWithActions(message, actions);
        }),
        getProgressLocation: Effect.fn('NotificationModeService.getProgressLocation')(function* (command: string) {
          const mode = getInternalMode(extensionSection, commandLevelSection, command);
          return mode === 'progressToastSuccessToast' || mode === 'progressToastSuccessOff'
            ? vscode.ProgressLocation.Notification
            : vscode.ProgressLocation.Window;
        }),
        runDispose: (): void => {
          hideTimerRef.pipe(
            Ref.get,
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.void,
                onSome: Fiber.interrupt
              })
            ),
            Runtime.runFork(runtime)
          );
          commandDisposable.dispose();
          item.dispose();
        }
      };
    })
}) {}
