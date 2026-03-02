/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import type { DebugLevelItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { TraceFlagsContentProviderService } from './traceFlagsContentProvider';

export const readDefaultDurationMinutes = Effect.fn('ApexLog.readDefaultDurationMinutes')(function* () {
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex-log');
  const val = config.get<number>('traceFlagsDefaultDurationMinutes', 30);
  return val > 0 ? val : 30;
});

export const refreshTraceFlagsView = Effect.fn('ApexLog.refreshTraceFlagsView')(function* (orgId: string) {
  const { refresh } = yield* TraceFlagsContentProviderService;
  yield* Effect.sync(() => refresh(orgId));
});

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
export const pickOrgUser = Effect.fn('ApexLog.pickOrgUser')(function* (conn: ConnectionLike, currentUserId: string) {
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
export const pickDebugLevel = async (items: DebugLevelItem[]): Promise<DebugLevelQuickPickItem | undefined> =>
  vscode.window.showQuickPick<DebugLevelQuickPickItem>(
    items.map(dl => ({
      label: dl.masterLabel,
      description: `Apex=${dl.apexCode} Vf=${dl.visualforce} DB=${dl.database}`,
      detail: dl.developerName,
      debugLevelId: dl.id
    })),
    { placeHolder: nls.localize('trace_flag_pick_debug_level'), matchOnDescription: true, matchOnDetail: true }
  );

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

const LOG_LEVELS: LogCategoryLevel[] = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];

export const sanitizeDeveloperName = (s: string): string =>
  s.replaceAll(/\W+/g, '_').replaceAll(/^_|_$/g, '').toUpperCase() || 'DebugLevel';

export const pickLogLevel = async (
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
