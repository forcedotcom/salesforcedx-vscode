/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Schema } from 'effect';

const WatchVideo = Schema.TaggedStruct('WatchVideo', {
  spec: Schema.NonEmptyString,
  workflow: Schema.NonEmptyString,
  job: Schema.NonEmptyString
});
const ManualItem = Schema.TaggedStruct('ManualItem', { step: Schema.NonEmptyString });
const Item = Schema.Union([WatchVideo, ManualItem]);
export type Item = typeof Item.Type;
const Nothing = Schema.TaggedStruct('Nothing', {});
const Checklist = Schema.TaggedStruct('Checklist', { items: Schema.NonEmptyArray(Item) });
export const Judgment = Schema.Union([Nothing, Checklist]);
export type Judgment = typeof Judgment.Type;

export class CommandFailed extends Schema.TaggedError<CommandFailed>()('CommandFailed', {
  command: Schema.String,
  code: Schema.Number,
  message: Schema.String
}) {}

export class InvalidBaseRef extends Schema.TaggedError<InvalidBaseRef>()('InvalidBaseRef', {
  ref: Schema.String,
  message: Schema.String
}) {}
