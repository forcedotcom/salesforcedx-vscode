/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const NonEmptyString = Schema.NonEmptyString;
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const OptionalObservationSequence = {
  observationSequence: Schema.optional(PositiveInteger)
};
export const Within = Schema.Struct({ role: NonEmptyString, name: NonEmptyString });
export type Within = Schema.Schema.Type<typeof Within>;
const RoleTargetFields = {
  role: NonEmptyString,
  name: NonEmptyString,
  exact: Schema.optional(Schema.Boolean),
  within: Schema.optional(Within),
  ...OptionalObservationSequence
};

const ExtensionMode = Schema.Literals(['dev', 'vsix']);

export const DrivableVscodeExtension = Schema.Struct({
  directory: NonEmptyString,
  id: NonEmptyString,
  version: NonEmptyString,
  mode: ExtensionMode,
  path: NonEmptyString,
  hash: Schema.optional(NonEmptyString)
});
export type DrivableVscodeExtension = Schema.Schema.Type<typeof DrivableVscodeExtension>;

export const DrivableVscodeLaunchOptions = Schema.Struct({
  objective: Schema.optional(NonEmptyString),
  extensionMode: Schema.optional(ExtensionMode),
  repoRoot: Schema.optional(NonEmptyString),
  vscodeExecutable: Schema.optional(NonEmptyString),
  artifactRoot: Schema.optional(NonEmptyString),
  userSettings: Schema.optional(Schema.Record(Schema.String, Schema.Json)),
  orgAlias: Schema.optional(NonEmptyString)
});
export type DrivableVscodeLaunchOptions = Schema.Schema.Type<typeof DrivableVscodeLaunchOptions>;

export const DrivableVscodeObservation = Schema.Struct({
  sequence: PositiveInteger,
  capturedAt: NonEmptyString,
  title: Schema.String,
  url: Schema.String,
  ariaSnapshot: Schema.String,
  ariaSnapshotTruncated: Schema.Boolean,
  activeEditor: Schema.optional(Schema.String),
  tabs: Schema.Array(Schema.String),
  quickInput: Schema.optional(Schema.String),
  dialogs: Schema.Array(Schema.String),
  notifications: Schema.Array(Schema.String),
  statusBar: Schema.Array(Schema.String),
  screenshotPath: NonEmptyString
});
export type DrivableVscodeObservation = Schema.Schema.Type<typeof DrivableVscodeObservation>;

export const DrivableVscodeAction = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('click'),
    ...RoleTargetFields
  }),
  Schema.Struct({
    kind: Schema.Literal('fill'),
    value: Schema.String,
    ...RoleTargetFields
  }),
  Schema.Struct({ kind: Schema.Literal('type'), text: Schema.String, ...OptionalObservationSequence }),
  Schema.Struct({ kind: Schema.Literal('press'), key: NonEmptyString, ...OptionalObservationSequence }),
  Schema.Struct({ kind: Schema.Literal('command'), title: NonEmptyString, ...OptionalObservationSequence }),
  Schema.Struct({
    kind: Schema.Literal('waitForText'),
    text: NonEmptyString,
    exact: Schema.optional(Schema.Boolean),
    timeoutMs: Schema.optional(PositiveInteger.check(Schema.isLessThanOrEqualTo(30_000))),
    ...OptionalObservationSequence
  })
]);
export type DrivableVscodeAction = Schema.Schema.Type<typeof DrivableVscodeAction>;

export const DrivableVscodeFinding = Schema.Struct({
  title: NonEmptyString,
  severity: Schema.Literals(['critical', 'high', 'medium', 'low']),
  area: NonEmptyString,
  steps: Schema.NonEmptyArray(NonEmptyString),
  expected: NonEmptyString,
  actual: NonEmptyString,
  confidence: Schema.Literals(['high', 'medium', 'low']),
  evidence: NonEmptyString.pipe(Schema.Array, Schema.optional)
});
export type DrivableVscodeFinding = Schema.Schema.Type<typeof DrivableVscodeFinding>;

export const DrivableVscodeManifest = Schema.Struct({
  runId: NonEmptyString,
  objective: NonEmptyString,
  mode: ExtensionMode,
  startedAt: NonEmptyString,
  repoRoot: NonEmptyString,
  workspaceDir: NonEmptyString,
  vscodeExecutable: NonEmptyString,
  extensions: Schema.Array(DrivableVscodeExtension),
  orgAlias: Schema.optional(NonEmptyString),
  screenshotWarning: NonEmptyString
});
export type DrivableVscodeManifest = Schema.Schema.Type<typeof DrivableVscodeManifest>;

export const DrivableVscodeSummary = Schema.Struct({
  objective: NonEmptyString,
  runId: NonEmptyString,
  exploredCount: Schema.Natural,
  actionCount: Schema.Natural,
  observationCount: Schema.Natural,
  findingCount: Schema.Natural,
  status: Schema.Literals(['completed', 'completed-with-limitations', 'failed']),
  limitations: Schema.Array(NonEmptyString)
});
export type DrivableVscodeSummary = Schema.Schema.Type<typeof DrivableVscodeSummary>;

const ActionRecord = {
  sequence: PositiveInteger,
  observationSequence: Schema.Natural,
  startedAt: NonEmptyString,
  action: DrivableVscodeAction
};
export const DrivableVscodeActionRecord = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('observation'), ...DrivableVscodeObservation.fields }),
  Schema.Struct({ kind: Schema.Literal('action-started'), ...ActionRecord }),
  Schema.Struct({ kind: Schema.Literal('action-succeeded'), ...ActionRecord, completedAt: NonEmptyString }),
  Schema.Struct({
    kind: Schema.Literal('action-failed'),
    ...ActionRecord,
    completedAt: NonEmptyString,
    error: Schema.Unknown
  }),
  Schema.Struct({ kind: Schema.Literal('session-closing'), capturedAt: NonEmptyString })
]);
export type DrivableVscodeActionRecord = Schema.Schema.Type<typeof DrivableVscodeActionRecord>;

export const DrivableVscodeRendererConsoleEntry = Schema.Struct({
  capturedAt: NonEmptyString,
  type: NonEmptyString,
  text: Schema.String,
  location: Schema.Struct({ url: Schema.String, lineNumber: Schema.Number, columnNumber: Schema.Number })
});
export type DrivableVscodeRendererConsoleEntry = Schema.Schema.Type<typeof DrivableVscodeRendererConsoleEntry>;

const ControllerLifecycle = Schema.Literals(['new', 'starting', 'running', 'stopping', 'closed']);

export const DrivableVscodeStatus = Schema.Struct({
  state: ControllerLifecycle,
  objective: Schema.optional(NonEmptyString),
  runId: Schema.optional(NonEmptyString),
  artifactDir: Schema.optional(NonEmptyString),
  findingCount: Schema.Natural
});
export type DrivableVscodeStatus = Schema.Schema.Type<typeof DrivableVscodeStatus>;

export const StartInput = Schema.Struct({
  objective: NonEmptyString,
  artifactRoot: Schema.optional(NonEmptyString),
  orgAlias: Schema.optional(NonEmptyString),
  extensionMode: Schema.optional(ExtensionMode)
});
export type StartInput = Schema.Schema.Type<typeof StartInput>;

export const ActInput = Schema.Struct({
  observationSequence: PositiveInteger,
  action: DrivableVscodeAction
});
export type ActInput = Schema.Schema.Type<typeof ActInput>;
