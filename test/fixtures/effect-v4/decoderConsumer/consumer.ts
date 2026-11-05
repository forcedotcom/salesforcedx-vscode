/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';

export class DecoderSettings extends Context.Service<DecoderSettings, { readonly prefix: string }>()('fixture/DecoderSettings') {}
export const ForeignIdSchema = Schema.String.pipe(Schema.check(Schema.isPattern(/^005/)), Schema.brand('CallerId'));
const RecordSchema = Schema.Struct({ Id: ForeignIdSchema, Username: Schema.String });
const PageSchema = Schema.Struct({
  totalSize: Schema.Number,
  done: Schema.optional(Schema.Boolean),
  nextRecordsUrl: Schema.optional(Schema.String),
  records: Schema.optional(Schema.Array(RecordSchema))
});
export const decodeJSON = Effect.fn('caller.decodeJSON')(function* (input: unknown) {
  const record = yield* Schema.decodeUnknownEffect(RecordSchema)(input);
  const settings = yield* DecoderSettings;
  const span = yield* Effect.currentSpan;
  return { ...record, label: `${settings.prefix}${record.Username}`, parentSpan: Option.map(span.parent, parent => parent._tag === 'Span' ? parent.name : undefined) };
});
export const decodePage = Effect.fn('caller.decodePage')(function* (input: unknown) {
  const page = yield* Schema.decodeUnknownEffect(PageSchema)(input);
  const settings = yield* DecoderSettings;
  const span = yield* Effect.currentSpan;
  return { ...page, records: page.records?.map(record => ({
    ...record, label: `${settings.prefix}${record.Username}`, parentSpan: Option.map(span.parent, parent => parent._tag === 'Span' ? parent.name : undefined)
  })) };
});
class CallerRejected extends Schema.TaggedError<CallerRejected>()('UnknownError', { cause: Schema.Unknown, message: Schema.String }) {}
export const rejection = new CallerRejected({ cause: { errorCode: 'MALFORMED_QUERY', message: 'Caller rejected page' }, message: 'Caller rejected page' });
export const rejectPage = () => Effect.fail(rejection);
export const defect = new Error('Independent caller decoder defect');
export const dieJSON = () => Effect.die(defect);
export const suspendedDecoder = (started: () => void, finalized: () => void) => (_input: unknown) =>
  Effect.sync(started).pipe(Effect.andThen(Effect.never), Effect.ensuring(Effect.sync(finalized)));

export const progressValue = Effect.gen(function* () {
  const settings = yield* DecoderSettings;
  const scope = yield* Scope.Scope;
  const span = yield* Effect.currentSpan.pipe(Effect.orDie);
  return { prefix: settings.prefix, scope, span: span.name };
});
