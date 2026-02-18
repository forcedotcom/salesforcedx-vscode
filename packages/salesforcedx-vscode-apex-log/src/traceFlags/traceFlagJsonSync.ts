/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { buildTraceFlagsSchemas } from '../schemas/traceFlagsSchema';

type TraceFlagsByLogType = {
  DEVELOPER_LOG?: TraceFlagItem[];
  USER_DEBUG?: TraceFlagItem[];
  CLASS_TRACING?: TraceFlagItem[];
  TRIGGERS?: TraceFlagItem[];
  OTHER?: TraceFlagItem[];
};

type TraceFlagsLogTypeKey = keyof TraceFlagsByLogType;

/** Group by logType; route 01q (triggers) to TRIGGERS. Always return all section keys with [] when empty. */
const groupByLogType = (items: TraceFlagItem[]): TraceFlagsByLogType => {
  const active = items.filter(item => item.isActive);
  const byKey: Record<TraceFlagsLogTypeKey, TraceFlagItem[]> = {
    DEVELOPER_LOG: [],
    USER_DEBUG: [],
    CLASS_TRACING: [],
    TRIGGERS: [],
    OTHER: []
  };
  active.forEach(item => {
    const key: TraceFlagsLogTypeKey = item.tracedEntityId?.startsWith('01q') ? 'TRIGGERS' : item.logType;
    byKey[key].push(item);
  });
  return byKey;
};

/** Ensure traceFlags.json exists for the current org, populate from org, return its URI */
const ensureTraceFlagsFile = Effect.fn('ApexLog.ensureTraceFlagsFile')(function* (orgId: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { encodeTraceFlagsConfigToJson } = buildTraceFlagsSchemas(api.services.TraceFlagItemStruct);
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const traceFlagService = yield* api.services.TraceFlagService;
  const fsService = yield* api.services.FsService;
  const channelService = yield* api.services.ChannelService;
  const uri = Utils.joinPath(workspaceInfo.uri, '.sf', 'orgs', orgId, 'traceFlags.json');

  const traceFlags = yield* traceFlagService
    .getTraceFlags()
    .pipe(
      Effect.catchAll(e =>
        channelService
          .appendToChannel(`Trace flags fetch failed: ${String(e)}`)
          .pipe(Effect.andThen(Effect.succeed<TraceFlagItem[]>([])))
      )
    );

  const result = encodeTraceFlagsConfigToJson({
    defaultDurationMinutes: 30,
    traceFlags: groupByLogType(traceFlags)
  });
  yield* fsService.writeFile(uri, result);
  return uri;
});

/** Open trace flags JSON for the current target org. Creates and populates the file if missing. */
export const openTraceFlagsCommand = Effect.fn('ApexLog.Command.openTraceFlags')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId } = yield* SubscriptionRef.get(ref);
  if (!orgId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const uri = yield* ensureTraceFlagsFile(orgId);
  yield* api.services.FsService.showTextDocument(uri);
});

const DEFAULT_DURATION_MINUTES = 30;

const readDefaultDurationMinutes = Effect.fn('ApexLog.readDefaultDurationMinutes')(function* (
  uri: ReturnType<typeof Utils.joinPath>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { decodeTraceFlagsConfigFromJson } = buildTraceFlagsSchemas(api.services.TraceFlagItemStruct);
  const fsService = yield* api.services.FsService;
  const read = yield* fsService.readFile(uri).pipe(Effect.option);
  if (Option.isNone(read)) return DEFAULT_DURATION_MINUTES;
  const config = decodeTraceFlagsConfigFromJson(read.value);
  const minutes = config?.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES;
  return minutes > 0 ? minutes : DEFAULT_DURATION_MINUTES;
});

/** Create/extends trace flag for current user using defaultDurationMinutes from JSON, refreshes JSON. */
export const createTraceFlagForCurrentUserCommand = Effect.fn('ApexLog.Command.createTraceFlagForCurrentUser')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const ref = yield* api.services.TargetOrgRef();
    const { orgId, userId } = yield* SubscriptionRef.get(ref);
    if (!orgId || !userId) {
      return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
    }
    const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
    const uri = Utils.joinPath(workspaceInfo.uri, '.sf', 'orgs', orgId, 'traceFlags.json');
    const minutes = yield* readDefaultDurationMinutes(uri);
    const traceFlagService = yield* api.services.TraceFlagService;
    yield* traceFlagService.ensureTraceFlag(userId, Duration.minutes(minutes));
    yield* ensureTraceFlagsFile(orgId);
  }
);

/** Delete trace flag for current user, refresh JSON. */
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
    yield* ensureTraceFlagsFile(orgId);
  }
);

type UserRecord = { Id: string; FirstName: string; LastName: string; Username: string };

type UserQuickPickItem = vscode.QuickPickItem & { userId: string };

const SOSL_DEBOUNCE_MS = 300;
const SOSL_MIN_CHARS = 2;

const toUserQuickPickItems = (records: UserRecord[], excludeUserId: string): UserQuickPickItem[] =>
  records
    .filter(r => r.Id !== excludeUserId)
    .map(r => ({
      label: `${r.FirstName ?? ''} ${r.LastName ?? ''}`.trim(),
      description: r.Username,
      userId: r.Id
    }));

/** Coerce jsforce search records (untyped) to UserRecord[]. */
const toUserRecords = (searchRecords: { [field: string]: unknown }[]): UserRecord[] =>
  searchRecords.map(r => ({
    Id: String(r.Id ?? ''),
    FirstName: String(r.FirstName ?? ''),
    LastName: String(r.LastName ?? ''),
    Username: String(r.Username ?? '')
  }));

/** Show a QuickPick that searches org users via SOSL as the user types (debounced). */
const pickOrgUser = (
  conn: { search: (sosl: string) => Promise<{ searchRecords: { [field: string]: unknown }[] }> },
  currentUserId: string
): Promise<UserQuickPickItem | undefined> =>
  new Promise(resolve => {
    const picker = vscode.window.createQuickPick<UserQuickPickItem>();
    picker.placeholder = nls.localize('trace_flag_pick_user');
    picker.matchOnDescription = true;
    picker.items = [];
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const searchUsers = async (term: string) => {
      if (disposed) return;
      picker.busy = true;
      try {
        const escaped = term.replaceAll(/['"\\]/g, '');
        const sosl = `FIND {${escaped}} IN NAME FIELDS RETURNING User(Id, FirstName, LastName, Username WHERE IsActive = true ORDER BY LastName, FirstName) LIMIT 50`;
        const { searchRecords } = await conn.search(sosl);
        if (!disposed) {
          picker.items = toUserQuickPickItems(toUserRecords(searchRecords), currentUserId);
        }
      } catch {
        // silently ignore search failures; user can keep typing
      } finally {
        if (!disposed) picker.busy = false;
      }
    };

    picker.onDidChangeValue(value => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (value.length < SOSL_MIN_CHARS) {
        picker.items = [];
        return;
      }
      debounceTimer = setTimeout(() => void searchUsers(value), SOSL_DEBOUNCE_MS);
    });
    const accept = (item: UserQuickPickItem | undefined) => {
      if (disposed) return;
      disposed = true;
      picker.dispose();
      resolve(item);
    };
    picker.onDidChangeSelection(items => {
      accept(items[0]);
    });
    picker.onDidAccept(() => {
      accept(picker.activeItems[0]);
    });
    picker.onDidHide(() => {
      accept(undefined);
    });
    picker.show();
  });

/** Create trace flag for another org user (prompted via SOSL-powered picker), refresh JSON. */
export const createTraceFlagForUserCommand = Effect.fn('ApexLog.Command.createTraceFlagForUser')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId, userId: currentUserId } = yield* SubscriptionRef.get(ref);
  if (!orgId || !currentUserId) {
    return yield* Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));
  }
  const connectionService = yield* api.services.ConnectionService;
  const conn = yield* connectionService.getConnection();
  const picked = yield* Effect.promise(() => pickOrgUser(conn, currentUserId));
  yield* Effect.annotateCurrentSpan('createTraceFlagForUser', { attributes: { userId: picked?.userId ?? 'none' } });
  if (!picked) return;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const uri = Utils.joinPath(workspaceInfo.uri, '.sf', 'orgs', orgId, 'traceFlags.json');
  const minutes = yield* readDefaultDurationMinutes(uri);
  const traceFlagService = yield* api.services.TraceFlagService;
  yield* traceFlagService.ensureTraceFlag(picked.userId, Duration.minutes(minutes), 'USER_DEBUG');
  yield* ensureTraceFlagsFile(orgId);
});

/** Delete trace flag by Id, refresh JSON. */
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
  yield* ensureTraceFlagsFile(orgId);
});
