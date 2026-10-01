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
