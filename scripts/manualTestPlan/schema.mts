/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Schema } from 'effect';

const WatchVideo = Schema.Struct({
  kind: Schema.Literal('watch-video'),
  spec: Schema.NonEmptyString,
  workflow: Schema.NonEmptyString,
  job: Schema.NonEmptyString
});
const ManualItem = Schema.Struct({
  kind: Schema.Literal('manual'),
  step: Schema.NonEmptyString
});
const Item = Schema.Union(WatchVideo, ManualItem);
export type Item = typeof Item.Type;
const Nothing = Schema.Struct({ kind: Schema.Literal('nothing') });
const Checklist = Schema.Struct({
  kind: Schema.Literal('checklist'),
  items: Schema.NonEmptyArray(Item)
});
export const Judgment = Schema.Union(Nothing, Checklist);
export type Judgment = typeof Judgment.Type;

const TextFile = Schema.Struct({
  path: Schema.String,
  text: Schema.String
});
const WorkflowFact = Schema.Struct({
  name: Schema.String,
  jobs: Schema.Array(Schema.String)
});
const PackageFact = Schema.Struct({
  package: Schema.String,
  name: Schema.String,
  diff: Schema.String,
  playwright: Schema.Array(TextFile),
  unitTests: Schema.Array(TextFile),
  workflows: Schema.Array(WorkflowFact)
});
const DependentFact = Schema.Struct({
  package: Schema.String,
  workflow: Schema.optional(Schema.String),
  jobs: Schema.Array(Schema.String),
  specs: Schema.Array(Schema.String),
  excerpt: Schema.optional(Schema.String)
});
export type DependentFact = typeof DependentFact.Type;
const Facts = Schema.Struct({
  packages: Schema.Array(PackageFact),
  dependents: Schema.Array(DependentFact)
});
export type Facts = typeof Facts.Type;

export const PrBody = Schema.Struct({ body: Schema.NullOr(Schema.String) });
export const PackageMeta = Schema.Struct({
  name: Schema.optional(Schema.String),
  dependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  devDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  optionalDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});
export type PackageMeta = typeof PackageMeta.Type;

export class CursorRunFailed extends Schema.TaggedError<CursorRunFailed>()('CursorRunFailed', {
  status: Schema.String,
  message: Schema.String
}) {}

export class CommandFailed extends Schema.TaggedError<CommandFailed>()('CommandFailed', {
  command: Schema.String,
  code: Schema.Number,
  message: Schema.String
}) {}

export class InvalidBaseRef extends Schema.TaggedError<InvalidBaseRef>()('InvalidBaseRef', {
  ref: Schema.String,
  message: Schema.String
}) {}
