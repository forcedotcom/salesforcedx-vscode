/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DebugLevelItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import {
  pickDebugLevel,
  pickLogLevel,
  pickOrgUser,
  pickTraceFlag,
  readDefaultDurationMinutes,
  refreshTraceFlagsView,
  sanitizeDeveloperName
} from '../../traceFlags/traceFlagJsonSync';
import { createTraceFlagsUri } from '../../traceFlags/traceFlagsContentProvider';

const noOrgWarning = () => Effect.promise(() => vscode.window.showWarningMessage(nls.localize('trace_flags_no_org')));

/** Resolves { api, orgId, userId? }. Shows warning and returns None when org (or userId if required) is missing. */
const requireOrgContext = Effect.fn('ApexLog.requireOrgContext')(function* (opts?: { requireUserId?: boolean }) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId, userId } = yield* SubscriptionRef.get(ref);
  if (!(orgId && (!opts?.requireUserId || userId))) {
    yield* noOrgWarning();
    return Option.none();
  }
  return Option.some({ api, orgId, userId });
});

/** Open trace flags JSON for the current target org (virtual doc, read-only). */
export const openTraceFlagsCommand = Effect.fn('ApexLog.Command.openTraceFlags')(function* () {
  const ctx = yield* requireOrgContext();
  if (Option.isNone(ctx)) return;
  const { api, orgId } = ctx.value;
  const uri = createTraceFlagsUri(orgId);
  yield* api.services.FsService.showTextDocument(uri);
});

type PickDebugLevelResult = { kind: 'picked'; id: string } | { kind: 'noLevels' } | { kind: 'cancelled' };

const pickDebugLevelId = async (debugLevels: DebugLevelItem[]): Promise<PickDebugLevelResult> => {
  if (debugLevels.length === 0) return { kind: 'noLevels' };
  const picked = await pickDebugLevel(debugLevels);
  return picked ? { kind: 'picked', id: picked.debugLevelId } : { kind: 'cancelled' };
};

/** Create/extends trace flag for current user using defaultDurationMinutes from config, refreshes virtual doc. */
export const createTraceFlagForCurrentUserCommand = Effect.fn('ApexLog.Command.createTraceFlagForCurrentUser')(
  function* () {
    const ctx = yield* requireOrgContext({ requireUserId: true });
    if (Option.isNone(ctx)) return;
    const { api, orgId, userId } = ctx.value;
    const traceFlagService = yield* api.services.TraceFlagService;
    const debugLevels = yield* traceFlagService.getDebugLevels();
    const debugLevelResult = yield* Effect.promise(() => pickDebugLevelId(debugLevels));
    if (debugLevelResult.kind === 'cancelled') return;
    const minutes = yield* readDefaultDurationMinutes();
    yield* traceFlagService.ensureTraceFlag(
      userId!,
      Duration.minutes(minutes),
      'DEVELOPER_LOG',
      debugLevelResult.kind === 'picked' ? debugLevelResult.id : undefined
    );
    yield* refreshTraceFlagsView(orgId);
  }
);

/** Delete trace flag for current user, refresh virtual doc. */
export const deleteTraceFlagForCurrentUserCommand = Effect.fn('ApexLog.Command.deleteTraceFlagForCurrentUser')(
  function* () {
    const ctx = yield* requireOrgContext({ requireUserId: true });
    if (Option.isNone(ctx)) return;
    const { api, orgId, userId } = ctx.value;
    const traceFlagService = yield* api.services.TraceFlagService;
    const existing = yield* traceFlagService.getTraceFlagForUser(userId!);
    yield* Option.match(existing, {
      onNone: () => Effect.void,
      onSome: tf => traceFlagService.deleteTraceFlag(tf.id)
    });
    yield* refreshTraceFlagsView(orgId);
  }
);

/** Create trace flag for another org user (prompted via SOSL-powered picker), refresh virtual doc. */
export const createTraceFlagForUserCommand = Effect.fn('ApexLog.Command.createTraceFlagForUser')(function* () {
  const ctx = yield* requireOrgContext({ requireUserId: true });
  if (Option.isNone(ctx)) return;
  const { api, orgId, userId: currentUserId } = ctx.value;
  const picked = yield* pickOrgUser(currentUserId!);
  yield* Effect.annotateCurrentSpan('createTraceFlagForUser', { attributes: { userId: picked?.userId ?? 'none' } });
  if (!picked) return;
  const traceFlagService = yield* api.services.TraceFlagService;
  const debugLevels = yield* traceFlagService.getDebugLevels();
  const debugLevelResult = yield* Effect.promise(() => pickDebugLevelId(debugLevels));
  if (debugLevelResult.kind === 'cancelled') return;
  const minutes = yield* readDefaultDurationMinutes();
  yield* traceFlagService.ensureTraceFlag(
    picked.userId,
    Duration.minutes(minutes),
    'USER_DEBUG',
    debugLevelResult.kind === 'picked' ? debugLevelResult.id : undefined
  );
  yield* refreshTraceFlagsView(orgId);
});

const DEBUG_LEVEL_CATEGORIES = [
  { key: 'apexCode' as const, label: 'Apex code', default: 'DEBUG' as const },
  { key: 'apexProfiling' as const, label: 'Apex profiling', default: 'NONE' as const },
  { key: 'callout' as const, label: 'Callout', default: 'NONE' as const },
  { key: 'database' as const, label: 'Database', default: 'INFO' as const },
  { key: 'nba' as const, label: 'NBA', default: 'NONE' as const },
  { key: 'system' as const, label: 'System', default: 'DEBUG' as const },
  { key: 'validation' as const, label: 'Validation', default: 'NONE' as const },
  { key: 'visualforce' as const, label: 'Visualforce', default: 'INFO' as const },
  { key: 'wave' as const, label: 'Wave', default: 'NONE' as const },
  { key: 'workflow' as const, label: 'Workflow', default: 'NONE' as const }
];

/** Create a new DebugLevel in the org via Tooling API, refresh virtual doc. */
export const createLogLevelCommand = Effect.fn('ApexLog.Command.createLogLevel')(function* () {
  const ctx = yield* requireOrgContext();
  if (Option.isNone(ctx)) return;
  const { api, orgId } = ctx.value;

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

  const levelsOrUndef = useDefaults
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

  const traceFlagService = yield* api.services.TraceFlagService;
  yield* traceFlagService.createDebugLevel(payload).pipe(
    Effect.flatMap(() => refreshTraceFlagsView(orgId)),
    Effect.catchTag('DebugLevelCreateError', () =>
      Effect.sync(() => {
        void vscode.window.showErrorMessage(nls.localize('trace_flag_create_log_level_failed'));
      })
    )
  );
});

/** Delete trace flag by Id, refresh virtual doc. When no Id is provided (e.g. command palette), prompts via QuickPick. */
export const deleteTraceFlagForIdCommand = Effect.fn('ApexLog.Command.deleteTraceFlagForId')(function* (
  traceFlagId?: string
) {
  const ctx = yield* requireOrgContext();
  if (Option.isNone(ctx)) return;
  const { api, orgId } = ctx.value;
  const traceFlagService = yield* api.services.TraceFlagService;
  const resolvedId =
    traceFlagId ??
    (yield* Effect.gen(function* () {
      const flags = yield* traceFlagService.getTraceFlags();
      const picked = yield* Effect.promise(() => pickTraceFlag(flags));
      return picked?.traceFlagId;
    }));
  if (!resolvedId) return;
  yield* traceFlagService.deleteTraceFlag(resolvedId);
  yield* refreshTraceFlagsView(orgId);
});

/** Change trace flag debug level via QuickPick, refresh virtual doc. */
export const changeDebugLevelCommand = Effect.fn('ApexLog.Command.changeDebugLevel')(function* (traceFlagId: string) {
  if (!traceFlagId) return;
  const ctx = yield* requireOrgContext();
  if (Option.isNone(ctx)) return;
  const { api, orgId } = ctx.value;
  const traceFlagService = yield* api.services.TraceFlagService;
  const debugLevels = yield* traceFlagService.getDebugLevels();
  const pickedLevel = yield* Effect.promise(() => pickDebugLevel(debugLevels));
  if (!pickedLevel) return;
  yield* traceFlagService.changeTraceFlagDebugLevel(traceFlagId, pickedLevel.debugLevelId);
  yield* refreshTraceFlagsView(orgId);
});

/** Delete debug level by Id via Tooling API, refresh virtual doc. */
export const deleteDebugLevelForIdCommand = Effect.fn('ApexLog.Command.deleteDebugLevelForId')(function* (
  debugLevelId: string
) {
  if (!debugLevelId) return;
  const ctx = yield* requireOrgContext();
  if (Option.isNone(ctx)) return;
  const { api, orgId } = ctx.value;
  const traceFlagService = yield* api.services.TraceFlagService;
  yield* traceFlagService.deleteDebugLevel(debugLevelId);
  yield* refreshTraceFlagsView(orgId);
});
