/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
const OptionalObservationSequence = {
  observationSequence: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive()))
};

const ExtensionMode = Schema.Literal('dev', 'vsix');

export const VisualQaExtension = Schema.Struct({
  directory: NonEmptyString,
  id: NonEmptyString,
  version: NonEmptyString,
  mode: ExtensionMode,
  path: NonEmptyString,
  hash: Schema.optional(NonEmptyString)
});
export type VisualQaExtension = Schema.Schema.Type<typeof VisualQaExtension>;

export const VisualQaLaunchOptions = Schema.Struct({
  objective: Schema.optional(NonEmptyString),
  extensionMode: Schema.optional(ExtensionMode),
  repoRoot: Schema.optional(NonEmptyString),
  vscodeExecutable: Schema.optional(NonEmptyString),
  artifactRoot: Schema.optional(NonEmptyString),
  userSettings: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  orgAlias: Schema.optional(NonEmptyString)
});
export type VisualQaLaunchOptions = Schema.Schema.Type<typeof VisualQaLaunchOptions>;

export const VisualQaObservation = Schema.Struct({
  sequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
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
export type VisualQaObservation = Schema.Schema.Type<typeof VisualQaObservation>;

export const VisualQaAction = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('click'),
    role: NonEmptyString,
    name: NonEmptyString,
    exact: Schema.optional(Schema.Boolean),
    ...OptionalObservationSequence
  }),
  Schema.Struct({
    kind: Schema.Literal('fill'),
    role: NonEmptyString,
    name: NonEmptyString,
    value: Schema.String,
    exact: Schema.optional(Schema.Boolean),
    ...OptionalObservationSequence
  }),
  Schema.Struct({ kind: Schema.Literal('type'), text: Schema.String, ...OptionalObservationSequence }),
  Schema.Struct({ kind: Schema.Literal('press'), key: NonEmptyString, ...OptionalObservationSequence }),
  Schema.Struct({ kind: Schema.Literal('command'), title: NonEmptyString, ...OptionalObservationSequence }),
  Schema.Struct({
    kind: Schema.Literal('waitForText'),
    text: NonEmptyString,
    exact: Schema.optional(Schema.Boolean),
    timeoutMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(30_000))),
    ...OptionalObservationSequence
  })
);
export type VisualQaAction = Schema.Schema.Type<typeof VisualQaAction>;

export const VisualQaFinding = Schema.Struct({
  title: NonEmptyString,
  severity: Schema.Literal('critical', 'high', 'medium', 'low'),
  area: NonEmptyString,
  steps: Schema.NonEmptyArray(NonEmptyString),
  expected: NonEmptyString,
  actual: NonEmptyString,
  confidence: Schema.Literal('high', 'medium', 'low'),
  evidence: NonEmptyString.pipe(Schema.Array, Schema.optional)
});
export type VisualQaFinding = Schema.Schema.Type<typeof VisualQaFinding>;

export const VisualQaManifest = Schema.Struct({
  runId: NonEmptyString,
  objective: NonEmptyString,
  mode: ExtensionMode,
  startedAt: NonEmptyString,
  repoRoot: NonEmptyString,
  workspaceDir: NonEmptyString,
  vscodeExecutable: NonEmptyString,
  extensions: Schema.Array(VisualQaExtension),
  orgAlias: Schema.optional(NonEmptyString),
  screenshotWarning: NonEmptyString
});
export type VisualQaManifest = Schema.Schema.Type<typeof VisualQaManifest>;

export const VisualQaSummary = Schema.Struct({
  objective: NonEmptyString,
  runId: NonEmptyString,
  exploredCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  actionCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  observationCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  findingCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: Schema.Literal('completed', 'completed-with-limitations', 'failed'),
  limitations: Schema.Array(NonEmptyString)
});
export type VisualQaSummary = Schema.Schema.Type<typeof VisualQaSummary>;

const ActionRecord = {
  sequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
  observationSequence: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  startedAt: NonEmptyString,
  action: VisualQaAction
};
export const VisualQaActionRecord = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('observation'), ...VisualQaObservation.fields }),
  Schema.Struct({ kind: Schema.Literal('action-started'), ...ActionRecord }),
  Schema.Struct({ kind: Schema.Literal('action-succeeded'), ...ActionRecord, completedAt: NonEmptyString }),
  Schema.Struct({
    kind: Schema.Literal('action-failed'),
    ...ActionRecord,
    completedAt: NonEmptyString,
    error: Schema.Unknown
  }),
  Schema.Struct({ kind: Schema.Literal('session-closing'), capturedAt: NonEmptyString })
);
export type VisualQaActionRecord = Schema.Schema.Type<typeof VisualQaActionRecord>;

export const VisualQaRendererConsoleEntry = Schema.Struct({
  capturedAt: NonEmptyString,
  type: NonEmptyString,
  text: Schema.String,
  location: Schema.Struct({ url: Schema.String, lineNumber: Schema.Number, columnNumber: Schema.Number })
});
export type VisualQaRendererConsoleEntry = Schema.Schema.Type<typeof VisualQaRendererConsoleEntry>;

const ControllerLifecycle = Schema.Literal('new', 'starting', 'running', 'stopping', 'closed');

export const VisualQaStatus = Schema.Struct({
  state: ControllerLifecycle,
  objective: Schema.optional(NonEmptyString),
  runId: Schema.optional(NonEmptyString),
  artifactDir: Schema.optional(NonEmptyString),
  findingCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
});
export type VisualQaStatus = Schema.Schema.Type<typeof VisualQaStatus>;

export const StartInput = Schema.Struct({
  objective: NonEmptyString,
  artifactRoot: Schema.optional(NonEmptyString),
  vscodeExecutable: Schema.optional(NonEmptyString),
  orgAlias: Schema.optional(NonEmptyString),
  extensionMode: Schema.optionalWith(ExtensionMode, { default: () => 'vsix' as const })
});
export type StartInput = Schema.Schema.Type<typeof StartInput>;

export const ActInput = Schema.Struct({
  observationSequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
  action: VisualQaAction
});
export type ActInput = Schema.Schema.Type<typeof ActInput>;
