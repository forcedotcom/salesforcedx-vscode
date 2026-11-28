/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  ApexLogService,
  AliasService,
  ConfigService,
  ConnectionService,
  FsService,
  getDefaultOrgRef
} from './legacy/services.cjs';
import type * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';

type ApexLogListEffect = ReturnType<typeof ApexLogService.listLogs>;
type ApexLogBodyEffect = ReturnType<typeof ApexLogService.getLogBody>;
type FsWriteEffect = ReturnType<typeof FsService.safeWriteFile>;

/** External V3 subset; retain the frozen identifiers while restricting the public properties. */
export type SalesforceVSCodeServicesApi = {
  readonly services: {
    readonly ConnectionService: Pick<typeof ConnectionService, 'getConnection'>;
    readonly AliasService: Pick<typeof AliasService, 'getAliasesFromUsername'>;
    readonly ConfigService: Pick<typeof ConfigService, 'getTargetOrg'>;
    /** The V4 host owns the query, so V3 callers need not provide a V3 QueryService. */
    readonly ApexLogService: {
      readonly listLogs: (
        ...args: Parameters<typeof ApexLogService.listLogs>
      ) => Effect.Effect<
        Effect.Effect.Success<ApexLogListEffect>,
        Effect.Effect.Error<ApexLogListEffect>,
        ApexLogService
      >;
      readonly getLogBody: (
        ...args: Parameters<typeof ApexLogService.getLogBody>
      ) => Effect.Effect<
        Effect.Effect.Success<ApexLogBodyEffect>,
        Effect.Effect.Error<ApexLogBodyEffect>,
        ApexLogService
      >;
    };
    /** Keep the file write used by Debug Log Analyzer in the root V3 compatibility surface. */
    readonly FsService: {
      readonly safeWriteFile: (
        ...args: Parameters<typeof FsService.safeWriteFile>
      ) => Effect.Effect<Effect.Effect.Success<FsWriteEffect>, Effect.Effect.Error<FsWriteEffect>, FsService>;
    };
    readonly TargetOrgRef: typeof getDefaultOrgRef;
    readonly prebuiltServicesDependencies: Context.Context<
      ConnectionService | AliasService | ConfigService | ApexLogService | FsService
    >;
    readonly prebuiltServicesLayer: Layer.Layer<
      ConnectionService | AliasService | ConfigService | ApexLogService | FsService
    >;
  };
};
