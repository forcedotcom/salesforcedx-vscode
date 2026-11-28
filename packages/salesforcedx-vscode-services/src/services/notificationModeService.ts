/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { NotificationModeService, type ProgressAndSuccessMode, type ToastAction } from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as Semaphore from 'effect/Semaphore';
import * as vscode from 'vscode';
import { getInternalMode } from './notificationModes.js';
import { makeScopedFibers } from './scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

class ToastActionError extends Schema.TaggedError<ToastActionError>()('ToastActionError', { cause: Schema.Defect() }) {}
type ShowToast = (message: string, ...items: string[]) => Thenable<string | undefined>;
const showInformationToast: ShowToast = (message, ...items) => vscode.window.showInformationMessage(message, ...items);
const showErrorToast: ShowToast = (message, ...items) => vscode.window.showErrorMessage(message, ...items);
const applyForceShow = (mode: ProgressAndSuccessMode): ProgressAndSuccessMode => {
  if (mode === 'progressToastSuccessOff') return 'progressToastSuccessToast';
  if (mode === 'progressStatusBarSuccessOff') return 'progressStatusBarSuccessStatusBar';
  return mode;
};

/** Per-extension UI ownership: no shared backend services or admission are rebuilt. */
export const makeNotificationModeServiceLayer = (
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
) =>
  Layer.effect(
    NotificationModeService,
    Effect.gen(function* () {
      const operations = yield* ServiceOperations;
      const context = yield* Effect.context<never>();
      // Background finalizers are registered only in their child scope, never above admission closure.
      const nativeScope = yield* Effect.acquireRelease(Scope.make(), scope => Scope.close(scope, Exit.void));
      const backgroundScope = yield* Effect.acquireRelease(Scope.make(), scope => Scope.close(scope, Exit.void));
      // Register last on the parent; later UI/fiber finalizers belong only to the child scopes.
      yield* Effect.addFinalizer(() => operations.close);
      const item = yield* Effect.acquireRelease(
        Effect.sync(() => vscode.window.createStatusBarItem(statusBarId, vscode.StatusBarAlignment.Left, 44)),
        value =>
          Effect.sync(() => {
            value.dispose();
          })
      ).pipe(Scope.provide(nativeScope));
      item.name = statusBarName;
      const fibers = yield* makeScopedFibers.pipe(Scope.provide(backgroundScope));
      const pending = yield* Ref.make<
        Option.Option<{ readonly message: string; readonly actions: readonly ToastAction[] }>
      >(Option.none());
      const hideTimer = yield* Ref.make<Option.Option<Fiber.Fiber<void>>>(Option.none());
      const statusChanges = yield* Semaphore.make(1);

      const awaitToastSelection = Effect.fn('NotificationModeService.awaitToastSelection')(function* (
        selection: Thenable<string | undefined>,
        actions: readonly ToastAction[]
      ) {
        const chosen = yield* Effect.promise(() => Promise.resolve(selection));
        const action = actions.find(candidate => candidate.label === chosen);
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
      const showToastWithActions = Effect.fn('NotificationModeService.showToastWithActions')(
        (show: ShowToast, message: string, actions: readonly ToastAction[]) =>
          Effect.uninterruptible(
            Effect.gen(function* () {
              const selection = yield* Effect.sync(() => show(message, ...actions.map(action => action.label)));
              // Waiting stays interruptible, and cancellation cannot split display from ownership registration.
              if (actions.length > 0)
                yield* awaitToastSelection(selection, actions).pipe(Effect.interruptible, fibers.fork);
            })
          )
      );
      const commandId = `${statusBarId}.showToast`;
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          vscode.commands.registerCommand(commandId, () =>
            Effect.runPromiseWith(context)(
              operations.run(
                Ref.get(pending).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.void,
                      onSome: value => showToastWithActions(showInformationToast, value.message, value.actions)
                    })
                  )
                )
              )
            )
          )
        ),
        command =>
          Effect.sync(() => {
            command.dispose();
          })
      ).pipe(Scope.provide(nativeScope));
      item.command = commandId;

      const showTransient = Effect.fn('NotificationModeService.showTransient')(
        (message: string, actions: readonly ToastAction[]) =>
          statusChanges.withPermit(
            Effect.uninterruptible(
              Effect.gen(function* () {
                yield* Ref.get(hideTimer).pipe(
                  Effect.flatMap(Option.match({ onNone: () => Effect.void, onSome: Fiber.interrupt }))
                );
                yield* Ref.set(pending, Option.some({ message, actions }));
                yield* Effect.sync(() => {
                  item.text = `$(check) ${message}`;
                  item.show();
                });
                const timer = yield* Effect.sleep(Duration.seconds(5)).pipe(
                  Effect.andThen(
                    statusChanges.withPermit(
                      Effect.uninterruptible(
                        Effect.sync(() => {
                          item.hide();
                        }).pipe(Effect.andThen(Ref.set(hideTimer, Option.none())))
                      )
                    )
                  ),
                  Effect.interruptible,
                  fibers.fork
                );
                yield* Ref.set(hideTimer, Option.some(timer));
              })
            )
          )
      );
      const commandLevelSection = `${extensionSection}.commandLevelNotifications`;
      return NotificationModeService.of({
        showSuccessNotification: Effect.fn('NotificationModeService.showSuccessNotification')(function* (
          command: string,
          message: string,
          forceShow = false,
          actions: readonly ToastAction[] = []
        ) {
          const configured = getInternalMode(extensionSection, commandLevelSection, command);
          const mode = forceShow ? applyForceShow(configured) : configured;
          if (mode === 'progressStatusBarSuccessStatusBar') yield* showTransient(message, actions);
          else if (mode === 'progressToastSuccessToast')
            yield* showToastWithActions(showInformationToast, message, actions);
        }, operations.run),
        showErrorWithActions: Effect.fn('NotificationModeService.showErrorWithActions')(
          (message: string, actions: readonly ToastAction[] = []) =>
            showToastWithActions(showErrorToast, message, actions),
          operations.run
        ),
        getProgressLocation: Effect.fn('NotificationModeService.getProgressLocation')(
          (command: string) =>
            Effect.sync(() => {
              const mode = getInternalMode(extensionSection, commandLevelSection, command);
              return mode === 'progressToastSuccessToast' || mode === 'progressToastSuccessOff'
                ? vscode.ProgressLocation.Notification
                : vscode.ProgressLocation.Window;
            }),
          operations.run
        )
      });
    })
  ).pipe(Layer.provide(Layer.fresh(ServiceOperationsLayer)));
