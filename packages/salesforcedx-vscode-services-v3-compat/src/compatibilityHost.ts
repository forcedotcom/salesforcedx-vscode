/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { DefaultOrgInfoSchema } from './defaultOrgInfo.js';
import type { ConfigFailureSchema, ConnectionFailureSchema } from './serviceErrors.js';
import type { Connection } from '@salesforce/core';

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
  ) => Promise<HostExit<Connection, typeof ConnectionFailureSchema.Encoded>>;
  readonly getAliasesFromUsername: (username: string, signal: AbortSignal) => Promise<HostExit<string[], never>>;
  readonly getTargetOrg: (
    signal: AbortSignal
  ) => Promise<HostExit<string | undefined, typeof ConfigFailureSchema.Encoded>>;
  /** Mask snapshot/subscription and each serialized commit through callback completion; callbacks never call back into the host. */
  readonly subscribeOrgChanges: (
    onChange: (snapshot: typeof DefaultOrgInfoSchema.Encoded) => Promise<void>
  ) => Promise<HostExit<() => Promise<HostExit<void, never>>, never>>;
  /** The host's shared synchronous redactor, also applied to V3 prebuilt-layer log output. */
  readonly redact: (text: string) => string;
};
