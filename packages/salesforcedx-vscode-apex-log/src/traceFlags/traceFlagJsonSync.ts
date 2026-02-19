/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DebugLevelItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { TraceFlagsContentProviderService, createTraceFlagsUri } from './traceFlagsContentProvider';

const readDefaultDurationMinutes = Effect.fn('ApexLog.readDefaultDurationMinutes')(function* () {
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex-log');
  const val = config.get<number>('traceFlagsDefaultDurationMinutes', 30);
  return val > 0 ? val : 30;
});

const refreshTraceFlagsView = Effect.fn('ApexLog.refreshTraceFlagsView')(function* (orgId: string) {
  const { refresh } = yield* TraceFlagsContentProviderService;
  yield* Effect.sync(() => refresh(orgId));
});

/** Open trace flags JSON for the current target org (virtual doc, read-only). */
export const openTraceFlagsCommand = Effect.fn('ApexLog.Command.openTraceFlags')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId } = yield* SubscriptionRef.get(ref);
  if (!orgId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const uri = createTraceFlagsUri(orgId);
  yield* api.services.FsService.showTextDocument(uri);
});

/** Create/extends trace flag for current user using defaultDurationMinutes from config, refreshes virtual doc. */
export const createTraceFlagForCurrentUserCommand = Effect.fn('ApexLog.Command.createTraceFlagForCurrentUser')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const ref = yield* api.services.TargetOrgRef();
    const { orgId, userId } = yield* SubscriptionRef.get(ref);
    if (!orgId || !userId) {
      return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
    }
    const minutes = yield* readDefaultDurationMinutes();
    const traceFlagService = yield* api.services.TraceFlagService;
    yield* traceFlagService.ensureTraceFlag(userId, Duration.minutes(minutes));
    yield* refreshTraceFlagsView(orgId);
  }
);

/** Delete trace flag for current user, refresh virtual doc. */
export const deleteTraceFlagForCurrentUserCommand = Effect.fn('ApexLog.Command.deleteTraceFlagForCurrentUser')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const ref = yield* api.services.TargetOrgRef();
    const { orgId, userId } = yield* SubscriptionRef.get(ref);
    if (!orgId || !userId) {
      return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
    }
    const traceFlagService = yield* api.services.TraceFlagService;
    const existing = yield* traceFlagService.getTraceFlagForUser(userId);
    yield* Option.match(existing, {
      onNone: () => Effect.void,
      onSome: tf => traceFlagService.deleteTraceFlag(tf.id)
    });
    yield* refreshTraceFlagsView(orgId);
  }
);

type UserRecord = { Id: string; FirstName: string; LastName: string; Username: string; UserType: string };

type UserQuickPickItem = vscode.QuickPickItem & { userId: string };

const SOSL_DEBOUNCE_MS = 300;
const SOSL_MIN_CHARS = 2;

const toUserQuickPickItems = (records: UserRecord[], excludeUserId: string): UserQuickPickItem[] =>
  records
    .filter(r => r.Id !== excludeUserId)
    .map(r => ({
      label: `${r.FirstName ?? ''} ${r.LastName ?? ''}`.trim(),
      description: `${r.Username}  (${r.UserType})`,
      userId: r.Id
    }));

/** Coerce jsforce search records (untyped) to UserRecord[]. */
const toUserRecords = (searchRecords: { [field: string]: unknown }[]): UserRecord[] =>
  searchRecords.map(r => ({
    Id: String(r.Id ?? ''),
    FirstName: String(r.FirstName ?? ''),
    LastName: String(r.LastName ?? ''),
    Username: String(r.Username ?? ''),
    UserType: String(r.UserType ?? '')
  }));

type ConnectionLike = { search: (sosl: string) => Promise<{ searchRecords: { [field: string]: unknown }[] }> };

/** Run SOSL search and update picker items. Ignore failures so user can keep typing. */
const searchUsersEffect = (
  term: string,
  picker: vscode.QuickPick<UserQuickPickItem>,
  conn: ConnectionLike,
  currentUserId: string
) =>
  Effect.gen(function* () {
    yield* Effect.sync(() => {
      picker.busy = true;
    });
    const escaped = term.replaceAll(/['"\\]/g, '');
    const sosl = `FIND {${escaped}} IN NAME FIELDS RETURNING User(Id, FirstName, LastName, Username, UserType WHERE IsActive = true ORDER BY LastName, FirstName) LIMIT 50`;
    const { searchRecords } = yield* Effect.tryPromise({
      try: () => conn.search(sosl),
      catch: () => new Error('search failed')
    });
    yield* Effect.sync(() => {
      picker.items = toUserQuickPickItems(toUserRecords(searchRecords), currentUserId);
      picker.busy = false;
    });
  }).pipe(
    // Ignore search failures so user can keep typing and retry
    Effect.catchAll(() =>
      Effect.sync(() => {
        picker.busy = false;
      })
    )
  );

/** Show a QuickPick that searches org users via SOSL as the user types (debounced). */
const pickOrgUser = Effect.fn('ApexLog.pickOrgUser')(function* (conn: ConnectionLike, currentUserId: string) {
  const runtime = yield* Effect.runtime();
  const run = Runtime.runFork(runtime);

  const queue = yield* Queue.unbounded<string>();
  const deferred = yield* Deferred.make<UserQuickPickItem | undefined>();
  const acceptedRef = yield* Ref.make(false);

  const picker = vscode.window.createQuickPick<UserQuickPickItem>();
  picker.placeholder = nls.localize('trace_flag_pick_user');
  picker.matchOnDescription = true;
  picker.items = [];

  const accept = (item: UserQuickPickItem | undefined) =>
    Runtime.runCallback(runtime)(
      Ref.modify(acceptedRef, (a: boolean) => [a, true]),
      {
        onExit: (exit: Exit.Exit<boolean, never>) => {
          if (Exit.isSuccess(exit) && !exit.value) {
            run(
              Effect.gen(function* () {
                yield* Queue.shutdown(queue);
                yield* Deferred.succeed(deferred, item);
              })
            );
          }
          picker.dispose();
        }
      }
    )();

  picker.onDidChangeValue(value => {
    value.length < SOSL_MIN_CHARS ? (picker.items = []) : run(Queue.offer(queue, value));
  });
  picker.onDidChangeSelection(items => accept(items[0]));
  picker.onDidAccept(() => accept(picker.activeItems[0]));
  picker.onDidHide(() => accept(undefined));

  yield* Effect.fork(
    Stream.fromQueue(queue).pipe(
      Stream.debounce(Duration.millis(SOSL_DEBOUNCE_MS)),
      Stream.filter(s => s.length >= SOSL_MIN_CHARS),
      Stream.runForEach(term => searchUsersEffect(term, picker, conn, currentUserId))
    )
  );
  picker.show();

  return yield* Deferred.await(deferred);
});

type DebugLevelQuickPickItem = vscode.QuickPickItem & { debugLevelId: string };

/** Show a QuickPick of org DebugLevels. */
const pickDebugLevel = async (items: DebugLevelItem[]): Promise<DebugLevelQuickPickItem | undefined> =>
  vscode.window.showQuickPick<DebugLevelQuickPickItem>(
    items.map(dl => ({
      label: dl.masterLabel,
      description: `Apex=${dl.apexCode} Vf=${dl.visualforce} DB=${dl.database}`,
      detail: dl.developerName,
      debugLevelId: dl.id
    })),
    { placeHolder: nls.localize('trace_flag_pick_debug_level'), matchOnDescription: true, matchOnDetail: true }
  );

/** Create trace flag for another org user (prompted via SOSL-powered picker), refresh virtual doc. */
export const createTraceFlagForUserCommand = Effect.fn('ApexLog.Command.createTraceFlagForUser')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId, userId: currentUserId } = yield* SubscriptionRef.get(ref);
  if (!orgId || !currentUserId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const connectionService = yield* api.services.ConnectionService;
  const conn = yield* connectionService.getConnection();
  const picked = yield* pickOrgUser(conn, currentUserId);
  yield* Effect.annotateCurrentSpan('createTraceFlagForUser', { attributes: { userId: picked?.userId ?? 'none' } });
  if (!picked) return;
  const traceFlagService = yield* api.services.TraceFlagService;
  const debugLevels = yield* traceFlagService.getDebugLevels();
  const pickedLevel = yield* Effect.promise(() => pickDebugLevel(debugLevels));
  if (!pickedLevel) return;
  const minutes = yield* readDefaultDurationMinutes();
  yield* traceFlagService.ensureTraceFlag(
    picked.userId,
    Duration.minutes(minutes),
    'USER_DEBUG',
    pickedLevel.debugLevelId
  );
  yield* refreshTraceFlagsView(orgId);
});

type LogCategoryLevel = 'NONE' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'FINE' | 'FINER' | 'FINEST';

type DebugLevelCategory = {
  key: keyof Pick<
    Record<string, LogCategoryLevel>,
    | 'apexCode'
    | 'apexProfiling'
    | 'callout'
    | 'database'
    | 'nba'
    | 'system'
    | 'validation'
    | 'visualforce'
    | 'wave'
    | 'workflow'
  >;
  label: string;
  default: LogCategoryLevel;
};

const DEBUG_LEVEL_CATEGORIES: DebugLevelCategory[] = [
  { key: 'apexCode', label: 'Apex code', default: 'DEBUG' },
  { key: 'apexProfiling', label: 'Apex profiling', default: 'NONE' },
  { key: 'callout', label: 'Callout', default: 'NONE' },
  { key: 'database', label: 'Database', default: 'INFO' },
  { key: 'nba', label: 'NBA', default: 'NONE' },
  { key: 'system', label: 'System', default: 'DEBUG' },
  { key: 'validation', label: 'Validation', default: 'NONE' },
  { key: 'visualforce', label: 'Visualforce', default: 'INFO' },
  { key: 'wave', label: 'Wave', default: 'NONE' },
  { key: 'workflow', label: 'Workflow', default: 'NONE' }
];

const LOG_LEVELS: LogCategoryLevel[] = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];

const sanitizeDeveloperName = (s: string): string =>
  s.replaceAll(/\W+/g, '_').replaceAll(/^_|_$/g, '').toUpperCase() || 'DebugLevel';

const pickLogLevel = async (
  category: DebugLevelCategory,
  defaultValue: LogCategoryLevel
): Promise<LogCategoryLevel | undefined> => {
  const items = LOG_LEVELS.map(l => ({ label: l, level: l }));
  const defaultItem = items.find(i => i.level === defaultValue);
  return new Promise<LogCategoryLevel | undefined>(resolve => {
    const picker = vscode.window.createQuickPick<{ label: string; level: LogCategoryLevel }>();
    picker.items = items;
    picker.activeItems = defaultItem ? [defaultItem] : [];
    picker.placeholder = nls.localize('trace_flag_create_log_level_pick', category.label);
    picker.title = category.label;
    picker.onDidAccept(() => {
      const selected = picker.activeItems[0];
      resolve(selected?.level);
      picker.dispose();
    });
    picker.onDidHide(() => {
      picker.dispose();
      resolve(undefined);
    });
    picker.show();
  });
};

/** Create a new DebugLevel in the org via Tooling API, refresh virtual doc. */
export const createLogLevelCommand = Effect.fn('ApexLog.Command.createLogLevel')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId } = yield* SubscriptionRef.get(ref);
  if (!orgId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const conn = yield* api.services.ConnectionService.getConnection();

  const masterLabel = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('trace_flag_create_log_level_master_label'),
      title: nls.localize('trace_flag_create_log_level_title')
    })
  );
  if (!masterLabel?.trim()) return;

  const defaultDevName = sanitizeDeveloperName(masterLabel.trim());
  const developerName = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('trace_flag_create_log_level_developer_name'),
      value: defaultDevName,
      title: nls.localize('trace_flag_create_log_level_title')
    })
  );
  if (!developerName?.trim()) return;

  const useDefaultsPick = yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        { label: nls.localize('trace_flag_create_log_level_use_defaults_yes'), value: true },
        { label: nls.localize('trace_flag_create_log_level_use_defaults_no'), value: false }
      ],
      {
        placeHolder: nls.localize('trace_flag_create_log_level_use_defaults'),
        title: nls.localize('trace_flag_create_log_level_title')
      }
    )
  );
  if (useDefaultsPick === undefined) return;
  const useDefaults = useDefaultsPick.value;

  const levelsOrUndef: Record<string, LogCategoryLevel> | undefined = useDefaults
    ? Object.fromEntries(DEBUG_LEVEL_CATEGORIES.map(c => [c.key, c.default]))
    : yield* Effect.gen(function* () {
        const picked = yield* Effect.all(
          DEBUG_LEVEL_CATEGORIES.map(cat =>
            Effect.promise(() => pickLogLevel(cat, cat.default)).pipe(
              Effect.flatMap(p => (p === undefined ? Effect.fail(undefined) : Effect.succeed(p)))
            )
          ),
          { concurrency: 1 }
        );
        return Object.fromEntries(DEBUG_LEVEL_CATEGORIES.map((c, i) => [c.key, picked[i]!]));
      }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  if (!levelsOrUndef) return;
  const levels = levelsOrUndef;

  const payload = {
    MasterLabel: masterLabel.trim(),
    DeveloperName: developerName.trim(),
    ApexCode: levels.apexCode ?? 'NONE',
    ApexProfiling: levels.apexProfiling ?? 'NONE',
    Callout: levels.callout ?? 'NONE',
    Database: levels.database ?? 'NONE',
    Nba: levels.nba ?? 'NONE',
    System: levels.system ?? 'NONE',
    Validation: levels.validation ?? 'NONE',
    Visualforce: levels.visualforce ?? 'NONE',
    Wave: levels.wave ?? 'NONE',
    Workflow: levels.workflow ?? 'NONE'
  };

  const result = yield* Effect.tryPromise({
    try: () => conn.tooling.create('DebugLevel', payload),
    catch: e => new Error(`Failed to create debug level: ${String(e)}`)
  });
  if (!result.success) {
    yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('trace_flag_create_log_level_failed')));
    return;
  }
  yield* refreshTraceFlagsView(orgId);
});

/** Delete trace flag by Id, refresh virtual doc. */
export const deleteTraceFlagForIdCommand = Effect.fn('ApexLog.Command.deleteTraceFlagForId')(function* (
  traceFlagId: string
) {
  if (!traceFlagId) return;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId } = yield* SubscriptionRef.get(ref);
  if (!orgId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const traceFlagService = yield* api.services.TraceFlagService;
  yield* traceFlagService.deleteTraceFlag(traceFlagId);
  yield* refreshTraceFlagsView(orgId);
});

/** Delete debug level by Id via Tooling API, refresh virtual doc. */
export const deleteDebugLevelForIdCommand = Effect.fn('ApexLog.Command.deleteDebugLevelForId')(function* (
  debugLevelId: string
) {
  if (!debugLevelId) return;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId } = yield* SubscriptionRef.get(ref);
  if (!orgId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const conn = yield* api.services.ConnectionService.getConnection();
  yield* Effect.tryPromise({
    try: () => conn.tooling.delete('DebugLevel', debugLevelId),
    catch: e => new Error(`Failed to delete debug level: ${String(e)}`)
  });
  yield* refreshTraceFlagsView(orgId);
});
