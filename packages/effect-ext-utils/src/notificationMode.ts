/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';

// ─── Shared ──────────────────────────────────────────────────────────────────

const STATUS_BAR_VISIBLE_MS = 5000;

/** An action button shown in a success toast, or when a status bar success notification is clicked. */
export type ToastAction = { label: string; run: () => void | Promise<void> };

const COMMAND_LEVEL_KEY = 'commandLevelNotifications';
const EXTENSION_LEVEL_KEY = 'extensionLevelNotifications';
const GLOBAL_SECTION = 'salesforcedx-vscode-services';
const GLOBAL_KEY = 'notifications';

// ─── User-facing setting value types ─────────────────────────────────────────

/**
 * Notification mode for commands that have both a progress phase and a success notification.
 *
 * - `progressToastSuccessToast`: Show progress and success as toast notifications.
 * - `progressToastSuccessOff`: Show progress as a cancellable toast, but suppress the success notification.
 * - `progressStatusBarSuccessStatusBar`: Show progress spinner and success message in the status bar.
 * - `progressStatusBarSuccessOff`: Show progress spinner in the status bar, but suppress the success notification.
 */
export type ProgressAndSuccessMode =
  | 'progressToastSuccessToast'
  | 'progressToastSuccessOff'
  | 'progressStatusBarSuccessStatusBar'
  | 'progressStatusBarSuccessOff';

/**
 * Notification mode for commands that have a progress phase but no success notification.
 * Two options — the success half is irrelevant.
 *
 * - `progressToast`: Show progress as a toast notification.
 * - `progressStatusBar`: Show progress spinner in the status bar.
 */
export type ProgressOnlyMode = 'progressToast' | 'progressStatusBar';

/**
 * Notification mode for commands that produce only a success notification (no progress phase).
 *
 * - `successToast`: Show the success notification as a toast.
 * - `successStatusBar`: Show the success message in the status bar.
 * - `successOff`: Suppress the success notification.
 */
export type SuccessOnlyMode = 'successToast' | 'successStatusBar' | 'successOff';

// ─── Internal normalization ───────────────────────────────────────────────────

/**
 * Normalizes any user-facing mode string to an internal `ProgressAndSuccessMode`.
 * The three mode type value sets are disjoint, so the raw string alone identifies the mode type —
 * no runtime key-type tagging needed.
 */
const normalizeToInternal = (raw: string | undefined): ProgressAndSuccessMode | undefined => {
  switch (raw) {
    // ProgressAndSuccessMode — pass through
    case 'progressToastSuccessToast':
    case 'progressToastSuccessOff':
    case 'progressStatusBarSuccessStatusBar':
    case 'progressStatusBarSuccessOff':
      return raw;
    // ProgressOnlyMode — map to equivalent with success suppressed
    case 'progressToast':
      return 'progressToastSuccessOff';
    case 'progressStatusBar':
      return 'progressStatusBarSuccessOff';
    // SuccessOnlyMode — map to equivalent with progress as toast (location irrelevant)
    case 'successToast':
      return 'progressToastSuccessToast';
    case 'successStatusBar':
      return 'progressStatusBarSuccessStatusBar';
    case 'successOff':
      return 'progressToastSuccessOff';
    default:
      return undefined;
  }
};

const getInternalMode = (
  extensionSection: string,
  commandLevelSection: string,
  command: string
): ProgressAndSuccessMode => {
  // Command-level: raw value may be any of the three mode types; normalizeToInternal handles all
  const raw = vscode.workspace.getConfiguration(commandLevelSection).inspect<string>(command);
  const cmdExplicit = raw?.workspaceFolderValue ?? raw?.workspaceValue ?? raw?.globalValue;
  const fromCmd = normalizeToInternal(cmdExplicit);
  if (fromCmd) return fromCmd;

  // Extension-level (always stores ProgressAndSuccessMode)
  const extCfg = vscode.workspace
    .getConfiguration(extensionSection)
    .inspect<ProgressAndSuccessMode>(EXTENSION_LEVEL_KEY);
  const extExplicit = extCfg?.workspaceFolderValue ?? extCfg?.workspaceValue ?? extCfg?.globalValue;
  if (extExplicit) return extExplicit;

  // Global fallback (also ProgressAndSuccessMode)
  return (
    vscode.workspace.getConfiguration(GLOBAL_SECTION).get<ProgressAndSuccessMode>(GLOBAL_KEY) ??
    'progressToastSuccessToast'
  );
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Per-extension service for reading notification mode settings and showing success notifications.
 * `showSuccessNotification` and `getProgressLocation` return Effects.
 *
 * Provide via `NotificationModeServiceLayer(extensionSection, statusBarId, statusBarName)`.
 * In `activateEffect`, push `{ dispose: () => void notifSvc.runDispose() }` to `context.subscriptions`.
 */
export class NotificationModeService extends Effect.Service<NotificationModeService>()('NotificationModeService', {
  // Stub implementation — TypeScript infers the service shape from this.
  // At runtime only NotificationModeServiceLayer is used; this stub is never reached.
  sync: () => ({
    showSuccessNotification: (_command: string, _message: string, _forceShow = false, _actions: ToastAction[] = []) =>
      Effect.void,
    getProgressLocation: (_command: string) => Effect.succeed(vscode.ProgressLocation.Notification),
    /** Disposes the status bar item and command registration. Call from context.subscriptions. */
    runDispose: (): void => {}
  })
}) {}

/**
 * Factory for a Layer that provides a `NotificationModeService` for the given extension.
 *
 * Creates a status bar item and registers the click-to-toast command as owned resources.
 * In `activateEffect`, call `yield* NotificationModeService` and push
 * `{ dispose: () => void notifSvc.runDispose() }` to `context.subscriptions` so resources
 * are released on extension deactivation.
 *
 * @param extensionSection - VS Code settings section prefix (e.g. `'salesforcedx-vscode-metadata'`)
 * @param statusBarId - Unique stable ID for the StatusBarItem (e.g. `'sf-metadata-notifications'`)
 * @param statusBarName - Human-readable name for the StatusBarItem (e.g. `'Salesforce: Metadata Notifications'`)
 */
export const NotificationModeServiceLayer = (
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
): Layer.Layer<NotificationModeService> =>
  Layer.effect(
    NotificationModeService,
    Effect.gen(function* () {
      const item = yield* Effect.sync(() =>
        vscode.window.createStatusBarItem(statusBarId, vscode.StatusBarAlignment.Left, 44)
      );

      item.name = statusBarName;

      const pendingToastRef = yield* Ref.make<{ message: string; actions: ToastAction[] } | undefined>(undefined);
      const hideTimerRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none());
      const runtime = yield* Effect.runtime<never>();

      const commandId = `${statusBarId}.showToast`;
      const commandDisposable = yield* Effect.sync(() =>
        vscode.commands.registerCommand(commandId, async () => {
          const pending = Runtime.runSync(runtime)(Ref.get(pendingToastRef));
          if (!pending) return;
          const { message, actions } = pending;
          const labels = actions.map(a => a.label);
          const selection = await vscode.window.showInformationMessage(message, ...labels);
          if (selection) await actions.find(a => a.label === selection)?.run();
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
        yield* Ref.set(pendingToastRef, { message, actions });
        // Interrupt any running hide timer before starting a new one
        const existing = yield* Ref.get(hideTimerRef);
        yield* Option.match(existing, {
          onNone: () => Effect.void,
          onSome: fiber => Fiber.interrupt(fiber)
        });
        const newFiber = yield* Effect.sleep(Duration.millis(STATUS_BAR_VISIBLE_MS)).pipe(
          Effect.andThen(Effect.sync(() => item.hide())),
          Effect.andThen(Ref.set(hideTimerRef, Option.none())),
          Effect.interruptible,
          Effect.forkDaemon
        );
        yield* Ref.set(hideTimerRef, Option.some(newFiber));
      });

      const commandLevelSection = `${extensionSection}.${COMMAND_LEVEL_KEY}`;

      return new NotificationModeService({
        showSuccessNotification: (command: string, message: string, forceShow = false, actions: ToastAction[] = []) => {
          const mode = getInternalMode(extensionSection, commandLevelSection, command);
          const effectiveMode =
            forceShow && mode === 'progressToastSuccessOff'
              ? 'progressToastSuccessToast'
              : forceShow && mode === 'progressStatusBarSuccessOff'
                ? 'progressStatusBarSuccessStatusBar'
                : mode;
          if (effectiveMode === 'progressStatusBarSuccessStatusBar') {
            return showTransient(message, actions);
          } else if (effectiveMode === 'progressToastSuccessToast') {
            return Effect.gen(function* () {
              const labels = actions.map(a => a.label);
              const selection = yield* Effect.promise(() => vscode.window.showInformationMessage(message, ...labels));
              if (selection)
                yield* Effect.promise(() => actions.find(a => a.label === selection)?.run() ?? Promise.resolve());
            });
          }
          return Effect.void;
        },
        getProgressLocation: (command: string) =>
          Effect.sync(() => {
            const mode = getInternalMode(extensionSection, commandLevelSection, command);
            return mode === 'progressToastSuccessToast' || mode === 'progressToastSuccessOff'
              ? vscode.ProgressLocation.Notification
              : vscode.ProgressLocation.Window;
          }),
        runDispose: (): void => {
          // Interrupt any active hide timer (fire-and-forget — we're deactivating)
          void Runtime.runPromise(runtime)(
            Ref.get(hideTimerRef).pipe(
              Effect.flatMap(opt => (Option.isSome(opt) ? Effect.forkDaemon(Fiber.interrupt(opt.value)) : Effect.void))
            )
          );
          commandDisposable.dispose();
          item.dispose();
        }
      });
    })
  );

// ─── Shared per-package helpers ───────────────────────────────────────────────

/** Returns an Effect that resolves to the VS Code ProgressLocation for a given command key. */
export const getProgressLocation = (command: string) =>
  Effect.flatMap(NotificationModeService, svc => svc.getProgressLocation(command));

/** Returns an Effect that shows a success notification (toast or status bar) for a given command key. */
export const showSuccessNotification = (
  command: string,
  message: string,
  forceShow = false,
  actions: ToastAction[] = []
) => Effect.flatMap(NotificationModeService, svc => svc.showSuccessNotification(command, message, forceShow, actions));
