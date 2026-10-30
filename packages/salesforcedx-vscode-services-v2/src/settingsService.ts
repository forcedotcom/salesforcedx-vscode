/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SettingsError } from './errors.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Rec from 'effect/Record';
import type * as Redacted from 'effect/Redacted';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import type * as vscode from 'vscode';

const rawSession = Schema.Struct({
  username: Schema.optional(Schema.Unknown),
  orgId: Schema.optional(Schema.Unknown),
  userId: Schema.optional(Schema.Unknown),
  instanceName: Schema.optional(Schema.Unknown),
  orgEdition: Schema.optional(Schema.Unknown),
  namespacePrefix: Schema.optional(Schema.Unknown),
  isDevHub: Schema.optional(Schema.Unknown),
  isScratch: Schema.optional(Schema.Unknown),
  isSandbox: Schema.optional(Schema.Unknown)
});
const sessionString = Schema.decodeUnknownOption(Schema.String);
const sessionIdentity = Schema.decodeUnknownOption(Schema.Trim.check(Schema.isNonEmpty()));
const sessionBoolean = Schema.decodeUnknownOption(Schema.Boolean);

/** Tolerant settings decoder; malformed fields are omitted/defaulted, not coerced. */
export const WebSessionContextSchema = rawSession.pipe(
  Schema.decodeTo(
    Schema.Struct({
      username: Schema.optional(Schema.String),
      orgId: Schema.optional(Schema.String),
      userId: Schema.optional(Schema.String),
      instanceName: Schema.optional(Schema.String),
      orgEdition: Schema.optional(Schema.String),
      namespacePrefix: Schema.optional(Schema.String),
      isDevHub: Schema.Boolean,
      isScratch: Schema.Boolean,
      isSandbox: Schema.Boolean
    }),
    {
      decode: SchemaGetter.transform(session => ({
        ...Rec.filter(
          {
            username: Option.getOrUndefined(sessionIdentity(session.username)),
            orgId: Option.getOrUndefined(sessionIdentity(session.orgId)),
            userId: Option.getOrUndefined(sessionIdentity(session.userId)),
            instanceName: Option.getOrUndefined(sessionString(session.instanceName)),
            orgEdition: Option.getOrUndefined(sessionString(session.orgEdition)),
            namespacePrefix: Option.getOrUndefined(sessionString(session.namespacePrefix))
          },
          isNotUndefined
        ),
        isDevHub: Option.getOrElse(sessionBoolean(session.isDevHub), () => false),
        isScratch: Option.getOrElse(sessionBoolean(session.isScratch), () => false),
        isSandbox: Option.getOrElse(sessionBoolean(session.isSandbox), () => false)
      })),
      encode: SchemaGetter.transform(session => session)
    }
  )
);
export type WebSessionContext = typeof WebSessionContextSchema.Type;

export class SettingsService extends Context.Service<
  SettingsService,
  {
    readonly getValue: <T>(section: string, key: string) => Effect.Effect<T | undefined, SettingsError>;
    readonly getValueOrElse: <T>(section: string, key: string, defaultValue: T) => Effect.Effect<T, SettingsError>;
    readonly setValue: <T>(
      section: string,
      key: string,
      value: T,
      target?: vscode.ConfigurationTarget
    ) => Effect.Effect<void, SettingsError>;
    readonly getInstanceUrl: () => Effect.Effect<string, SettingsError>;
    readonly getAccessToken: () => Effect.Effect<Redacted.Redacted<string>, SettingsError>;
    readonly getApiVersion: () => Effect.Effect<string, SettingsError>;
    readonly getSessionContext: () => Effect.Effect<WebSessionContext, SettingsError>;
    readonly setInstanceUrl: (url: string) => Effect.Effect<void, SettingsError>;
    readonly setAccessToken: (token: string) => Effect.Effect<void, SettingsError>;
    readonly setApiVersion: (version: string) => Effect.Effect<void, SettingsError>;
    readonly getRetrieveOnLoad: () => Effect.Effect<string, SettingsError>;
    readonly getInternalDev: () => Effect.Effect<boolean, SettingsError>;
  }
>()('@salesforce/vscode-services-v2/SettingsService') {}
