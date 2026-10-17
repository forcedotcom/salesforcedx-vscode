/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';

// src/apexExtension throws at module load when the Apex extension host is absent;
// the emitters under test do not touch it.
vi.mock('../../src/apexExtension', () => ({
  salesforceApexExtension: { isActive: true, activate: vi.fn() },
  retrieveLineBreakpointInfo: () => Effect.void
}));

import { annotateCheckpointUpload } from '../../src/breakpoints/checkpointService';
import { emitErrorMetric, emitGeneralMetric, emitLaunchMetric } from '../../src/index';
import { nls } from '../../src/messages';
import { runWithRecordingTracer, type RecordedSpan } from './testUtils/recordingTracer';

describe('telemetry spans', () => {
  let recordedSpans: RecordedSpan[];
  beforeEach(() => {
    recordedSpans = [];
  });

  const spanNamed = (name: string) => recordedSpans.find(span => span.name === name);

  it('emits apexReplayDebugger.launch with logSize and errorSubject', async () => {
    await runWithRecordingTracer(
      emitLaunchMetric({ logSize: 1024, error: { subject: 'subject-a', callstack: 'stack' } }),
      recordedSpans
    );

    const span = spanNamed('apexReplayDebugger.launch');
    expect(span?.attributes.get('logSize')).toBe('1024');
    expect(span?.attributes.get('errorSubject')).toBe('subject-a');
    expect(span?.ended).toBe(true);
  });

  it('emits apexReplayDebugger.error with subject and callstack', async () => {
    await runWithRecordingTracer(emitErrorMetric({ subject: 'subject-b', callstack: 'stack-b' }), recordedSpans);

    const span = spanNamed('apexReplayDebugger.error');
    expect(span?.attributes.get('subject')).toBe('subject-b');
    expect(span?.attributes.get('callstack')).toBe('stack-b');
    expect(span?.ended).toBe(true);
  });

  it('emits apexReplayDebugger.general with subject, type and qty', async () => {
    await runWithRecordingTracer(emitGeneralMetric({ subject: 'subject-c', type: 'type-c', qty: 3 }), recordedSpans);

    const span = spanNamed('apexReplayDebugger.general');
    expect(span?.attributes.get('subject')).toBe('subject-c');
    expect(span?.attributes.get('type')).toBe('type-c');
    expect(span?.attributes.get('qty')).toBe('3');
    expect(span?.ended).toBe(true);
  });

  it('emits qty as undefined string when the general metric has no qty', async () => {
    await runWithRecordingTracer(emitGeneralMetric({ subject: 'subject-d', type: 'type-d' }), recordedSpans);

    expect(spanNamed('apexReplayDebugger.general')?.attributes.get('qty')).toBe('undefined');
  });

  it('annotates the enclosing command span on checkpoint success instead of a new span', async () => {
    await runWithRecordingTracer(
      Effect.gen(function* () {
        yield* annotateCheckpointUpload(true);
      }).pipe(Effect.withSpan('outer', { root: true })),
      recordedSpans
    );

    expect(spanNamed('outer')?.attributes.get('errorMessage')).toBe('');
    expect(spanNamed('apexReplayDebugger.checkpoint')).toBeUndefined();
  });

  it('annotates the enclosing command span with the wrap-up message on checkpoint failure', async () => {
    await runWithRecordingTracer(
      Effect.gen(function* () {
        yield* annotateCheckpointUpload(false);
      }).pipe(Effect.withSpan('outer', { root: true })),
      recordedSpans
    );

    expect(spanNamed('outer')?.attributes.get('errorMessage')).toBe(
      nls.localize('checkpoint_upload_error_wrap_up_message', nls.localize('sf_update_checkpoints_in_org'))
    );
    expect(spanNamed('apexReplayDebugger.checkpoint')).toBeUndefined();
  });
});
