/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';

/** Effect-free wire shapes; independently checked against both majors' codecs. */
export type OrgSnapshot = {
  readonly aliases?: readonly string[];
  readonly orgId?: string;
  readonly instanceName?: string;
  readonly devHubOrgId?: string;
  readonly username?: string;
  readonly alias?: string;
  readonly devHubUsername?: string;
  readonly tracksSource?: boolean;
  readonly isScratch?: boolean;
  readonly isSandbox?: boolean;
  readonly userId?: string;
  readonly cliId?: string;
  readonly webUserId?: string;
  readonly orgEdition?: string;
};
export type ConfigFailure =
  | { readonly _tag: 'NoWorkspaceOpenError'; readonly message: string }
  | { readonly _tag: 'FailedToCreateConfigAggregatorError'; readonly message: string; readonly cause?: Error };
export type ConnectionFailure =
  | ConfigFailure
  | {
      readonly _tag: 'MissingSettingsError';
      readonly cause: unknown;
      readonly key: string;
      readonly section?: string;
      readonly message: string;
    }
  | {
      readonly _tag: 'FailedToCreateAuthInfoError' | 'FailedToCreateConnectionError';
      readonly message: string;
      readonly cause?: Error;
    }
  | { readonly _tag: 'NoTargetOrgConfiguredError'; readonly message: string }
  | { readonly _tag: 'AccessTokenExpiredError'; readonly message: string; readonly username?: string };

export type HostReason<E> =
  | { readonly _tag: 'Fail'; readonly error: E }
  | { readonly _tag: 'Die'; readonly defect: unknown }
  | { readonly _tag: 'Interrupt'; readonly fiberId: number | undefined };

/** Ordered reasons, not a promise to reconstruct V4's unavailable V3 Cause topology. */
export type HostExit<A, E> =
  | { readonly _tag: 'Success'; readonly value: A }
  | { readonly _tag: 'Failure'; readonly reasons: readonly HostReason<E>[] };

/** Operations enter the owned V4 runtime; only results and Cause payloads cross, never foreign runnable values. */
export type CompatibilityHost = {
  /** Check signal.aborted before starting V4; completion includes all operation finalizers. */
  readonly getConnection: (
    username: string | undefined,
    signal: AbortSignal
  ) => Promise<HostExit<Connection, ConnectionFailure>>;
  readonly getAliasesFromUsername: (username: string, signal: AbortSignal) => Promise<HostExit<string[], never>>;
  readonly getTargetOrg: (signal: AbortSignal) => Promise<HostExit<string | undefined, ConfigFailure>>;
  /** Mask snapshot/subscription and each serialized commit through callback completion; callbacks never call back into the host. */
  readonly subscribeOrgChanges: (
    onChange: (snapshot: OrgSnapshot) => Promise<void>
  ) => Promise<HostExit<() => Promise<HostExit<void, never>>, never>>;
  /** The host's shared synchronous redactor, also applied to V3 prebuilt-layer log output. */
  readonly redact: (text: string) => string;
};
