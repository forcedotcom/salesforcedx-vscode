/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import { _electron as electron, type ConsoleMessage, type ElectronApplication, type Page } from '@playwright/test';
import { redactValue } from '@salesforce/playwright-vscode-ext';
import { downloadAndUnzipVSCode, SilentReporter } from '@vscode/test-electron';
import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as ExecutionStrategy from 'effect/ExecutionStrategy';
import * as Exit from 'effect/Exit';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import { randomUUID } from 'node:crypto';
import { ArtifactService } from './artifactService';
import { consumeConsoleWrites, drainConsoleWrites, type ConsoleWrite } from './consoleWriteQueue';
import { QUICK_INPUT_WIDGET, WORKBENCH } from './constants';
import {
  causeMessage,
  VisualQaActionError,
  VisualQaArtifactError,
  VisualQaLaunchError,
  VisualQaObservationError,
  VisualQaStaleObservationError,
  VisualQaStateError,
  VisualQaTeardownError
} from './errors';
import { ExtensionService } from './extensionService';
import {
  VisualQaObservation,
  VisualQaRendererConsoleEntry,
  type VisualQaAction,
  type VisualQaExtension,
  type VisualQaFinding,
  type VisualQaLaunchOptions
} from './schemas';
import { WorkspaceService } from './workspaceService';

export type VisualQaSession = {
  runId: string;
  artifactDir: string;
  workspaceDir: string;
  extensions: readonly VisualQaExtension[];
  observe: Effect.Effect<VisualQaObservation, VisualQaArtifactError | VisualQaObservationError | VisualQaStateError>;
  act: (
    action: VisualQaAction
  ) => Effect.Effect<
    void,
    VisualQaActionError | VisualQaArtifactError | VisualQaStaleObservationError | VisualQaStateError
  >;
  addFinding: (finding: VisualQaFinding) => Effect.Effect<void, VisualQaStateError | VisualQaArtifactError>;
  close: Effect.Effect<void, VisualQaTeardownError>;
};

type SessionState = {
  observationSequence: number;
  actionSequence: number;
  lifecycle: 'open' | 'closing' | 'closed';
  screenshotSaved: boolean;
  closingRecorded: boolean;
  consoleListenerRemoved: boolean;
  consoleDrained: boolean;
  electronClosed: boolean;
  userDataRemoved: boolean;
  workspaceRemoved: boolean;
  scopeClosed: boolean;
  videoSaved: boolean;
  artifactsFlushed: boolean;
  findingCount: number;
};

const ARIA_SNAPSHOT_LIMIT = 20_000;
const CLOSE_TIMEOUT = Duration.seconds(5);
type AriaRole = Parameters<Page['getByRole']>[0];
const AriaRole = Schema.Literal(
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'insertion',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'meter',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'paragraph',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  'subscript',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem'
);
const decodeRole = Schema.decodeUnknownSync(AriaRole);
const defaultSettings = {
  'files.simpleDialog.enable': true,
  'window.menuStyle': 'custom',
  'window.dialogStyle': 'custom',
  'settingsSync.enabled': false,
  'github.gitAuthentication': false,
  'git.terminalAuthentication': false,
  'git.autofetch': false,
  'git.openRepositoryInParentFolders': 'never',
  'chat.commandCenter.enabled': false,
  'chat.setupFromDialog': false,
  'workbench.startupEditor': 'none',
  'workbench.enableExperiments': false,
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'salesforcedx-vscode-core.telemetry-tag': 'agent-visual-qa'
};
const disabledBuiltins = [
  'vscode.github',
  'vscode.github-authentication',
  'vscode.microsoft-authentication',
  'GitHub.vscode-pull-request-github',
  'GitHub.copilot',
  'GitHub.copilot-chat',
  'ms-vscode.azure-account'
].map(id => `--disable-extension=${id}`);
const launchEnvironment = (): Record<string, string> => {
  const {
    ELECTRON_RUN_AS_NODE: _electronRunAsNode,
    ELECTRON_NO_ATTACH_CONSOLE: _electronNoAttachConsole,
    ...environment
  } = process.env;
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => !entry[0].startsWith('VSCODE_') && entry[1] !== undefined
    )
  );
};

const teardownFailure = (message: string, cause: unknown) =>
  new VisualQaTeardownError({ message, cause: causeMessage(cause) });
const finalizer = <E>(effect: Effect.Effect<unknown, E>) => effect.pipe(Effect.uninterruptible, Effect.orDie);
const closeSessionScope = (scope: Scope.CloseableScope, exit: Exit.Exit<unknown, unknown>) =>
  Scope.close(scope, exit).pipe(
    Effect.uninterruptible,
    Effect.sandbox,
    Effect.mapError(
      cause => new VisualQaTeardownError({ message: 'Visual QA session teardown failed', cause: Cause.pretty(cause) })
    )
  );

const closeElectron = Effect.fn('SessionService.closeElectron')(function* (app: ElectronApplication) {
  const child = app.process();
  const kill = Effect.suspend(() =>
    typeof child.pid === 'number' && child.exitCode === null
      ? Effect.try({
          try: () => process.kill(process.platform === 'win32' ? child.pid! : -child.pid!, 'SIGKILL'),
          catch: cause =>
            new VisualQaTeardownError({ message: 'Failed to kill VS Code process', cause: causeMessage(cause) })
        }).pipe(
          Effect.catchTag('VisualQaTeardownError', error =>
            error.cause?.includes('ESRCH') ? Effect.void : Effect.fail(error)
          )
        )
      : Effect.void
  );
  const close = Effect.tryPromise({
    try: () => app.close(),
    catch: cause => new VisualQaTeardownError({ message: 'VS Code close failed', cause: causeMessage(cause) })
  });
  yield* Effect.uninterruptibleMask(restore =>
    Effect.exit(restore(close).pipe(Effect.timeoutOption(CLOSE_TIMEOUT))).pipe(
      Effect.flatMap(exit =>
        Exit.match(exit, {
          onFailure: cause => Effect.exit(kill).pipe(Effect.zipRight(Effect.failCause(cause))),
          onSuccess: result => (Option.isSome(result) ? Effect.void : kill)
        })
      )
    )
  );
});

const executeAction = (page: Page, action: VisualQaAction) =>
  Effect.tryPromise({
    try: () =>
      Match.value(action).pipe(
        Match.when({ kind: 'click' }, value =>
          page.getByRole(decodeRole(value.role) satisfies AriaRole, { name: value.name, exact: value.exact }).click()
        ),
        Match.when({ kind: 'fill' }, value =>
          page
            .getByRole(decodeRole(value.role) satisfies AriaRole, { name: value.name, exact: value.exact })
            .fill(value.value)
        ),
        Match.when({ kind: 'type' }, value => page.keyboard.type(value.text)),
        Match.when({ kind: 'press' }, value => page.keyboard.press(value.key)),
        Match.when({ kind: 'command' }, async value => {
          await page.keyboard.press('F1');
          const input = page.locator(`${QUICK_INPUT_WIDGET} input`).first();
          await input.waitFor({ state: 'attached' });
          await input.fill(`>${value.title}`, { force: true });
          const escapedTitle = value.title.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
          await page.getByRole('option', { name: new RegExp(`^${escapedTitle}(?:,|$)`) }).click({ force: true });
        }),
        Match.when({ kind: 'waitForText' }, value =>
          page
            .getByText(value.text, { exact: value.exact })
            .waitFor({ state: 'visible', timeout: value.timeoutMs ?? 30_000 })
        ),
        Match.exhaustive
      ),
    catch: cause =>
      new VisualQaActionError({ message: `Failed to execute ${action.kind} action`, cause: causeMessage(cause) })
  });

export class SessionService extends Effect.Service<SessionService>()('VisualQa/SessionService', {
  accessors: true,
  dependencies: [ArtifactService.Default, ExtensionService.Default, WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const artifactService = yield* ArtifactService;
    const extensionService = yield* ExtensionService;
    const workspaceService = yield* WorkspaceService;
    const launch = Effect.fn('SessionService.launch')(function* (options: VisualQaLaunchOptions = {}) {
      const repoRoot = options.repoRoot ?? process.cwd();
      const extensionMode = options.extensionMode ?? 'vsix';
      const runId = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
      const artifactRoot = options.artifactRoot ?? path.join(repoRoot, '.e2e-artifacts', 'visual-qa');
      const artifacts = yield* artifactService.create(artifactRoot, runId);
      const sessionScope = yield* Scope.make(ExecutionStrategy.sequential);
      const scoped = Scope.extend(sessionScope);
      const state = yield* Ref.make<SessionState>({
        observationSequence: 0,
        actionSequence: 0,
        lifecycle: 'open',
        screenshotSaved: false,
        closingRecorded: false,
        consoleListenerRemoved: false,
        consoleDrained: false,
        electronClosed: false,
        userDataRemoved: false,
        workspaceRemoved: false,
        scopeClosed: false,
        videoSaved: false,
        artifactsFlushed: false,
        findingCount: 0
      });
      const closeSemaphore = yield* Effect.makeSemaphore(1);
      const runPhase = <K extends keyof Omit<SessionState, 'observationSequence' | 'actionSequence' | 'lifecycle'>>(
        phase: K,
        operation: Effect.Effect<void, VisualQaTeardownError>
      ) =>
        Ref.get(state).pipe(
          Effect.flatMap(value =>
            value[phase]
              ? Effect.void
              : operation.pipe(Effect.zipRight(Ref.update(state, next => ({ ...next, [phase]: true }))))
          )
        );
      const removeDirectory = (directory: string, label: string) =>
        fs
          .remove(directory, { recursive: true })
          .pipe(
            Effect.mapError(
              cause => new VisualQaTeardownError({ message: `Failed to remove ${label}`, cause: causeMessage(cause) })
            )
          );
      const acquireSession = Effect.fn('SessionService.acquireSession')(function* () {
        const workspaceDir = yield* scoped(
          Effect.acquireRelease(workspaceService.create(options.orgAlias), directory =>
            finalizer(runPhase('workspaceRemoved', removeDirectory(directory, 'disposable workspace')))
          )
        );
        const userDataDir = yield* scoped(
          Effect.acquireRelease(
            fs.makeTempDirectory({ prefix: 'salesforce-agent-qa-user-data-' }).pipe(
              Effect.mapError(
                cause =>
                  new VisualQaLaunchError({
                    message: 'Failed to create VS Code user data directory',
                    cause: causeMessage(cause)
                  })
              )
            ),
            directory => finalizer(runPhase('userDataRemoved', removeDirectory(directory, 'VS Code user data')))
          )
        );
        const videosDir = path.join(artifacts.artifactDir, 'videos');
        yield* Effect.all(
          [
            fs.makeDirectory(path.join(userDataDir, 'User'), { recursive: true }),
            fs.makeDirectory(videosDir),
            ...(extensionMode === 'dev' ? [fs.makeDirectory(path.join(userDataDir, 'extensions'))] : [])
          ],
          { concurrency: 'unbounded' }
        ).pipe(
          Effect.mapError(
            cause =>
              new VisualQaLaunchError({
                message: 'Failed to prepare VS Code launch directories',
                cause: causeMessage(cause)
              })
          )
        );
        yield* fs
          .writeFileString(
            path.join(userDataDir, 'User', 'settings.json'),
            `${JSON.stringify({ ...defaultSettings, ...options.userSettings }, undefined, 2)}\n`
          )
          .pipe(
            Effect.mapError(
              cause =>
                new VisualQaLaunchError({ message: 'Failed to write VS Code settings', cause: causeMessage(cause) })
            )
          );
        const vscodeExecutable =
          options.vscodeExecutable ??
          (yield* Effect.tryPromise({
            try: () =>
              downloadAndUnzipVSCode({
                version: process.env.PLAYWRIGHT_VSCODE_VERSION,
                cachePath: path.join(repoRoot, '.vscode-test'),
                reporter: new SilentReporter()
              }),
            catch: cause =>
              new VisualQaLaunchError({ message: 'Failed to acquire VS Code', cause: causeMessage(cause) })
          }));
        const resolved =
          extensionMode === 'dev'
            ? {
                extensions: yield* extensionService.resolveDev(repoRoot),
                extensionsDir: path.join(userDataDir, 'extensions')
              }
            : yield* extensionService.resolveVsix(repoRoot, vscodeExecutable);
        const launchArgs = [
          `--user-data-dir=${userDataDir}`,
          `--extensions-dir=${resolved.extensionsDir}`,
          ...(extensionMode === 'dev'
            ? [
                ...resolved.extensions.map(extension => `--extensionDevelopmentPath=${extension.path}`),
                '--disable-extensions'
              ]
            : []),
          ...disabledBuiltins,
          '--disable-updates',
          '--skip-welcome',
          '--skip-release-notes',
          '--disable-gpu-sandbox',
          '--disable-workspace-trust',
          '--no-sandbox',
          workspaceDir
        ];
        const app = yield* scoped(
          Effect.acquireRelease(
            Effect.tryPromise({
              try: () =>
                electron.launch({
                  executablePath: vscodeExecutable,
                  args: launchArgs,
                  env: launchEnvironment(),
                  timeout: 60_000,
                  recordVideo: { dir: videosDir, size: { width: 1920, height: 1080 } }
                }),
              catch: cause =>
                new VisualQaLaunchError({ message: 'Failed to launch VS Code', cause: causeMessage(cause) })
            }),
            acquiredApp => finalizer(runPhase('electronClosed', closeElectron(acquiredApp)))
          )
        );
        const page = yield* Effect.tryPromise({
          try: async () => {
            const firstWindow = await app.firstWindow();
            await firstWindow.waitForLoadState('domcontentloaded');
            await firstWindow.setViewportSize({ width: 1920, height: 1080 });
            await firstWindow.waitForSelector(WORKBENCH, { timeout: 60_000 });
            return firstWindow;
          },
          catch: cause =>
            new VisualQaLaunchError({ message: 'VS Code workbench failed to become ready', cause: causeMessage(cause) })
        });
        const consoleWrites = yield* Queue.unbounded<ConsoleWrite>();
        const consumeConsole = consumeConsoleWrites(consoleWrites, artifacts.appendRendererConsole);
        const consoleConsumer = yield* scoped(
          Effect.acquireRelease(Effect.forkDaemon(consumeConsole), consumer =>
            finalizer(
              runPhase(
                'consoleDrained',
                drainConsoleWrites(consoleWrites, consumer).pipe(
                  Effect.mapError(
                    cause =>
                      new VisualQaTeardownError({
                        message: 'Failed to drain renderer console',
                        cause: causeMessage(cause)
                      })
                  )
                )
              )
            )
          )
        );
        const recordConsole = (message: ConsoleMessage) => {
          const entry = Schema.decodeUnknownSync(VisualQaRendererConsoleEntry)(
            redactValue({
              capturedAt: new Date().toISOString(),
              type: message.type(),
              text: message.text(),
              location: message.location()
            })
          );
          Queue.unsafeOffer(consoleWrites, { _tag: 'Entry', entry });
        };
        const consoleListenerAttached = yield* Ref.make(false);
        const removeConsoleListener = Ref.modify(
          consoleListenerAttached,
          attached => [attached ? Effect.sync(() => page.off('console', recordConsole)) : Effect.void, false] as const
        ).pipe(Effect.flatten);
        yield* scoped(
          Effect.acquireRelease(
            Effect.sync(() => page.on('console', recordConsole)).pipe(
              Effect.zipRight(Ref.set(consoleListenerAttached, true))
            ),
            () => finalizer(runPhase('consoleListenerRemoved', removeConsoleListener))
          )
        );
        yield* artifacts.writeManifest({
          runId,
          objective: options.objective ?? 'Unspecified visual QA objective',
          mode: extensionMode,
          startedAt: new Date().toISOString(),
          repoRoot,
          workspaceDir,
          vscodeExecutable,
          extensions: resolved.extensions,
          orgAlias: options.orgAlias,
          screenshotWarning:
            'Screenshots and video are not pixel-redacted and may contain secrets displayed by VS Code.'
        });

        const requireOpen = Ref.get(state).pipe(
          Effect.filterOrFail(
            current => current.lifecycle === 'open',
            current =>
              new VisualQaStateError({ message: `Visual QA session is ${current.lifecycle}`, state: current.lifecycle })
          )
        );
        const observeSession = Effect.fn('SessionService.observe')(function* () {
          const current = yield* requireOpen;
          const sequence = current.observationSequence + 1;
          yield* Ref.set(state, { ...current, observationSequence: sequence });
          const screenshotPath = path.join(artifacts.screenshotsDir, `${String(sequence).padStart(4, '0')}.png`);
          const observation = yield* Effect.tryPromise({
            try: async () => {
              const ariaSnapshot = await page.locator('body').ariaSnapshot();
              await page.screenshot({ path: screenshotPath });
              const texts = async (selector: string) =>
                (await page.locator(selector).allTextContents()).map(text => text.trim()).filter(Boolean);
              const attribute = async (selector: string, name: string) => {
                const locator = page.locator(selector).first();
                return (await locator.count()) > 0 ? ((await locator.getAttribute(name)) ?? undefined) : undefined;
              };
              const redacted = redactValue({
                sequence,
                capturedAt: new Date().toISOString(),
                title: await page.title(),
                url: page.url(),
                ariaSnapshot: ariaSnapshot.slice(0, ARIA_SNAPSHOT_LIMIT),
                ariaSnapshotTruncated: ariaSnapshot.length > ARIA_SNAPSHOT_LIMIT,
                activeEditor: await attribute(`${WORKBENCH} .editor-instance.active .monaco-editor`, 'data-uri'),
                tabs: await texts(`${WORKBENCH} .tabs-container .tab`),
                quickInput: await attribute(`${QUICK_INPUT_WIDGET} input`, 'value'),
                dialogs: await texts('.monaco-dialog-box'),
                notifications: await texts(`${WORKBENCH} .notification-list-item`),
                statusBar: await texts(`${WORKBENCH} .statusbar-item`),
                screenshotPath
              });
              return redacted;
            },
            catch: cause =>
              new VisualQaObservationError({
                message: 'Failed to capture VS Code observation',
                cause: causeMessage(cause)
              })
          }).pipe(
            Effect.flatMap(Schema.decodeUnknown(VisualQaObservation)),
            Effect.mapError(cause =>
              cause instanceof VisualQaObservationError
                ? cause
                : new VisualQaObservationError({
                    message: 'Captured an invalid VS Code observation',
                    cause: causeMessage(cause)
                  })
            )
          );
          yield* artifacts.appendAction({ kind: 'observation', ...observation });
          return observation;
        });
        const observe = Effect.suspend(observeSession);
        const act = Effect.fn('SessionService.act')(function* (action: VisualQaAction) {
          const current = yield* requireOpen;
          if (action.observationSequence !== undefined && action.observationSequence !== current.observationSequence) {
            return yield* new VisualQaStaleObservationError({
              message: `Stale observation ${action.observationSequence}; latest observation is ${current.observationSequence}`,
              requestedSequence: action.observationSequence,
              latestSequence: current.observationSequence
            });
          }
          const actionSequence = current.actionSequence + 1;
          yield* Ref.set(state, { ...current, actionSequence });
          const record = {
            sequence: actionSequence,
            observationSequence: current.observationSequence,
            startedAt: new Date().toISOString(),
            action
          };
          yield* artifacts.appendAction({ kind: 'action-started', ...record });
          yield* executeAction(page, action).pipe(
            Effect.tap(() =>
              artifacts.appendAction({ kind: 'action-succeeded', ...record, completedAt: new Date().toISOString() })
            ),
            Effect.tapError(error =>
              artifacts.appendAction({ kind: 'action-failed', ...record, completedAt: new Date().toISOString(), error })
            )
          );
        });
        const addFinding = Effect.fn('SessionService.addFinding')(function* (finding: VisualQaFinding) {
          yield* requireOpen;
          yield* artifacts.appendFinding(finding);
          yield* Ref.update(state, current => ({ ...current, findingCount: current.findingCount + 1 }));
        });
        const closeSession = Effect.fn('SessionService.close')(function* () {
          const current = yield* Ref.get(state);
          if (current.lifecycle === 'closed') return;
          yield* Ref.update(state, value => ({ ...value, lifecycle: 'closing' as const }));
          const screenshot = runPhase(
            'screenshotSaved',
            Effect.tryPromise({
              try: () => page.screenshot({ path: path.join(artifacts.screenshotsDir, 'final.png') }),
              catch: cause =>
                new VisualQaTeardownError({ message: 'Failed to save final screenshot', cause: causeMessage(cause) })
            }).pipe(Effect.asVoid)
          );
          const closingRecord = runPhase(
            'closingRecorded',
            artifacts
              .appendAction({ kind: 'session-closing', capturedAt: new Date().toISOString() })
              .pipe(
                Effect.mapError(
                  cause =>
                    new VisualQaTeardownError({ message: 'Failed to record session close', cause: causeMessage(cause) })
                )
              )
          );
          const video = page.video();
          const videoSave = runPhase(
            'videoSaved',
            video
              ? Effect.tryPromise({
                  try: () => video.path(),
                  catch: cause =>
                    new VisualQaTeardownError({ message: 'Failed to locate session video', cause: causeMessage(cause) })
                }).pipe(
                  Effect.flatMap(videoPath => fs.rename(videoPath, path.join(artifacts.artifactDir, 'session.webm'))),
                  Effect.mapError(cause =>
                    cause instanceof VisualQaTeardownError
                      ? cause
                      : new VisualQaTeardownError({
                          message: 'Failed to save session video',
                          cause: causeMessage(cause)
                        })
                  )
                )
              : Effect.void
          );
          const evidenceExit = yield* Effect.exit(
            Effect.all([screenshot, closingRecord], { mode: 'validate', discard: true })
          );
          const releaseResources = Effect.all(
            [
              runPhase('consoleListenerRemoved', removeConsoleListener),
              runPhase(
                'consoleDrained',
                drainConsoleWrites(consoleWrites, consoleConsumer).pipe(
                  Effect.mapError(
                    cause =>
                      new VisualQaTeardownError({
                        message: 'Failed to drain renderer console',
                        cause: causeMessage(cause)
                      })
                  )
                )
              ),
              runPhase('electronClosed', closeElectron(app)),
              runPhase('userDataRemoved', removeDirectory(userDataDir, 'VS Code user data')),
              runPhase('workspaceRemoved', removeDirectory(workspaceDir, 'disposable workspace'))
            ],
            { concurrency: 1, mode: 'validate', discard: true }
          );
          const releaseExit = yield* Effect.exit(releaseResources);
          const scopeClose = yield* Effect.exit(runPhase('scopeClosed', closeSessionScope(sessionScope, evidenceExit)));
          const beforeFinish = yield* Ref.get(state);
          const phaseFailures = [
            Exit.match(evidenceExit, { onFailure: Cause.pretty, onSuccess: () => undefined }),
            Exit.match(releaseExit, { onFailure: Cause.pretty, onSuccess: () => undefined }),
            Exit.match(scopeClose, { onFailure: Cause.pretty, onSuccess: () => undefined })
          ].filter((failure): failure is string => failure !== undefined);
          const limitations = [
            'Native OS dialogs and external windows are outside Playwright Electron page coverage.',
            ...phaseFailures
          ];
          const finalArtifacts = artifacts
            .finish({
              objective: options.objective ?? 'Unspecified visual QA objective',
              runId,
              exploredCount: beforeFinish.actionSequence + beforeFinish.observationSequence,
              actionCount: beforeFinish.actionSequence,
              observationCount: beforeFinish.observationSequence,
              findingCount: beforeFinish.findingCount,
              status: phaseFailures.length === 0 ? 'completed-with-limitations' : 'failed',
              limitations
            })
            .pipe(
              Effect.zipRight(
                runPhase(
                  'artifactsFlushed',
                  artifacts.flush.pipe(
                    Effect.mapError(
                      cause =>
                        new VisualQaTeardownError({
                          message: 'Failed to flush session artifacts',
                          cause: causeMessage(cause)
                        })
                    )
                  )
                )
              ),
              Effect.mapError(
                cause =>
                  new VisualQaTeardownError({
                    message: 'Failed to finish session artifacts',
                    cause: causeMessage(cause)
                  })
              )
            );
          const finishArtifactsExit = yield* Effect.exit(
            Effect.all([videoSave, finalArtifacts], { mode: 'validate', discard: true })
          );
          const failures = [
            Exit.match(evidenceExit, { onFailure: Cause.pretty, onSuccess: () => undefined }),
            Exit.match(releaseExit, { onFailure: Cause.pretty, onSuccess: () => undefined }),
            Exit.match(scopeClose, { onFailure: Cause.pretty, onSuccess: () => undefined }),
            Exit.match(finishArtifactsExit, { onFailure: Cause.pretty, onSuccess: () => undefined })
          ].filter((failure): failure is string => failure !== undefined);
          if (failures.length > 0) {
            return yield* teardownFailure('Visual QA session teardown failed', failures.join('\n'));
          }
          yield* Ref.update(state, value => ({ ...value, lifecycle: 'closed' as const }));
        });
        const close = closeSemaphore.withPermits(1)(
          Effect.suspend(() =>
            closeSession().pipe(
              Effect.mapError(error =>
                error instanceof VisualQaTeardownError
                  ? error
                  : new VisualQaTeardownError({
                      message: 'Visual QA session teardown failed',
                      cause: causeMessage(error)
                    })
              )
            )
          )
        );
        return {
          runId,
          artifactDir: artifacts.artifactDir,
          workspaceDir,
          extensions: resolved.extensions,
          observe,
          act,
          addFinding,
          close
        } satisfies VisualQaSession;
      });
      return yield* acquireSession().pipe(
        Effect.onError(cause => closeSessionScope(sessionScope, Exit.failCause(cause)).pipe(Effect.orDie))
      );
    });
    return { launch };
  })
}) {}
