/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgTelemetryPolicyService } from './orgTelemetryPolicy';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import { GovernedEgressSink, makeGovernedEgressDispatcher } from './governedEgressDispatcher';
import { getSpanCreationOrgId } from './spanTransformProcessor';
import { isSpanValidForProductionTelemetry } from './spanUtils';

/**
 * Wraps a real SpanExporter with a per-export gate. The `isEnabled` predicate is re-checked
 * on every export batch so toggling `telemetry.enabled` mid-session takes effect without
 * a reload. The delegate exporter is constructed lazily on the first enabled export and
 * cached, so a disabled session never runs the delegate ctor (avoids Azure
 * Statsbeat / network setup that some exporter ctors trigger).
 */
export class GatedSpanExporter implements SpanExporter {
  private delegate: SpanExporter | undefined;
  private readonly submissions = new Set<Promise<unknown>>();
  private readonly dispatcher;

  constructor(
    private readonly make: () => SpanExporter,
    private readonly isEnabled: () => boolean,
    policy?: Pick<OrgTelemetryPolicyService, 'getClassification' | 'changes'>
  ) {
    this.dispatcher = policy
      ? Effect.runSync(
          makeGovernedEgressDispatcher(
            policy,
            Effect.sync(
              (): GovernedEgressSink<ReadableSpan> => ({
                send: item =>
                  this.isEnabled()
                    ? Effect.async<void, unknown>(resume => {
                        const delegate = (this.delegate ??= this.make());
                        const completed = { value: false };
                        delegate.export([item.payload], result => {
                          if (completed.value) return;
                          completed.value = true;
                          resume(
                            result.code === ExportResultCode.SUCCESS
                              ? Effect.void
                              : Effect.fail(result.error ?? 'Span export failed')
                          );
                        });
                      })
                    : Effect.void,
                forceFlush: Effect.promise(() => this.delegate?.forceFlush?.() ?? Promise.resolve()),
                close: Effect.promise(() => this.delegate?.shutdown() ?? Promise.resolve())
              })
            )
          )
        )
      : undefined;
  }

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (!this.isEnabled()) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }
    if (!this.dispatcher) {
      (this.delegate ??= this.make()).export(spans, resultCallback);
      return;
    }

    const submission = Effect.runPromise(
      Effect.forEach(
        spans.filter(isSpanValidForProductionTelemetry),
        span => this.dispatcher!.submit({ orgId: getSpanCreationOrgId(span), payload: span }),
        { discard: true }
      )
    );
    this.submissions.add(submission);
    void submission.finally(() => this.submissions.delete(submission));
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  public async forceFlush(): Promise<void> {
    await Promise.all(this.submissions);
    await (this.dispatcher
      ? Effect.runPromise(this.dispatcher.forceFlush)
      : (this.delegate?.forceFlush?.() ?? Promise.resolve()));
  }

  public async shutdown(): Promise<void> {
    await Promise.all(this.submissions);
    await (this.dispatcher ? Effect.runPromise(this.dispatcher.close) : this.delegate?.shutdown());
  }
}
