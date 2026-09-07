/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators/property.js';
import { createInitialSoqlBuilderState, type SoqlBuilderState } from '../domain.js';
import { SoqlBuilderActionEvent } from './soqlBuilderActionEvent.js';
import { soqlBuilderElementStyles } from './soqlBuilderElement.styles.js';

export { SoqlBuilderActionEvent } from './soqlBuilderActionEvent.js';

export type SoqlBuilderLabels = {
  readonly clearAllFields: string;
  readonly count: string;
  readonly fields: string;
  readonly from: string;
  readonly inputs: string;
  readonly loading: string;
  readonly noDefaultOrg: string;
  readonly noResults: string;
  readonly query: string;
  readonly selectAllFields: string;
};

export type SoqlBuilderLifecycle = {
  readonly connect: () => void;
  readonly disconnect: () => Promise<void> | void;
};

export class SoqlBuilderElement extends LitElement {
  public static styles = soqlBuilderElementStyles;

  @property({ attribute: false })
  public accessor labels!: SoqlBuilderLabels;

  public lifecycle: SoqlBuilderLifecycle | undefined;

  @property({ attribute: false })
  public accessor viewState: SoqlBuilderState = createInitialSoqlBuilderState();

  public override connectedCallback(): void {
    super.connectedCallback();
    this.lifecycle?.connect();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    // disconnectedCallback must stay synchronous (Custom Elements contract); attach a catch
    // so a rejected teardown does not surface as a silent unhandled rejection.
    void Promise.resolve(this.lifecycle?.disconnect()).catch(() => {
      // disconnect rejections during teardown are non-actionable
    });
  }

  protected override render() {
    const state = this.viewState;
    const hasRecoverableFromError = state.query.parseErrors.some(error =>
      ['EMPTY', 'INCOMPLETEFROM', 'NOFROM'].includes(error.type)
    );
    const hasRecoverableFieldsError = state.query.parseErrors.some(error =>
      ['EMPTY', 'NOSELECT', 'NOSELECTIONS'].includes(error.type)
    );
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- an empty statement must still render as `nothing`, unlike a merely-unset one; `??` would not collapse ''
    const queryPreview = state.query.originalSoqlStatement ? state.query.originalSoqlStatement : nothing;
    return html`
      <main>
        ${state.errorMessage || state.hasNoDefaultOrg
          ? html`<p class="warning" role="alert">${state.errorMessage ?? this.labels.noDefaultOrg}</p>`
          : html`
              <div class="content">
                <form
                  class="form"
                  aria-label=${this.labels.inputs}
                  aria-busy=${state.isObjectsLoading || state.isFieldsLoading ? 'true' : 'false'}
                  @submit=${this.preventSubmit}
                >
                  <div class="control">
                    <soql-builder-from
                      .invalid=${hasRecoverableFromError}
                      .isLoading=${state.isObjectsLoading}
                      .labels=${{
                        from: this.labels.from,
                        loading: this.labels.loading,
                        noResults: this.labels.noResults
                      }}
                      .objects=${state.metadata.objects}
                      .selectedObjectName=${state.query.sObject}
                    ></soql-builder-from>
                  </div>
                  <div class="control">
                    <soql-builder-fields
                      .disabled=${state.query.sObject === undefined}
                      .fields=${state.metadata.fields}
                      .invalid=${hasRecoverableFieldsError}
                      .isLoading=${state.isFieldsLoading}
                      .labels=${{
                        clearAll: this.labels.clearAllFields,
                        count: this.labels.count,
                        fields: this.labels.fields,
                        loading: this.labels.loading,
                        noResults: this.labels.noResults,
                        selectAll: this.labels.selectAllFields
                      }}
                      .selectedFieldNames=${state.query.fields}
                    ></soql-builder-fields>
                  </div>
                </form>
                <section class="preview" role="status" aria-live="polite">
                  <div class="preview-title">${this.labels.query}</div>
                  <pre data-testid="query-preview">${queryPreview}</pre>
                </section>
              </div>
            `}
      </main>
    `;
  }

  private readonly preventSubmit = (event: SubmitEvent): void => event.preventDefault();
}

declare global {
  interface HTMLElementEventMap {
    'soql-builder-action': SoqlBuilderActionEvent;
  }

  interface HTMLElementTagNameMap {
    'soql-builder-app': SoqlBuilderElement;
  }
}
