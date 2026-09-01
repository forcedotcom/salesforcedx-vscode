/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { VscodeMultiSelect } from '@vscode-elements/elements/dist/vscode-multi-select/index.js';
import '@vscode-elements/elements/dist/vscode-option/index.js';
import { html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators/property.js';
import {
  SOQL_BUILDER_ACTION_EVENT,
  createInitialSoqlBuilderState,
  type SoqlBuilderAction,
  type SoqlBuilderState
} from '../domain.js';
import { soqlBuilderElementStyles } from './soqlBuilderElement.styles.js';

export type SoqlBuilderLabels = {
  readonly fields: string;
  readonly from: string;
  readonly inputs: string;
  readonly loading: string;
  readonly noDefaultOrg: string;
  readonly noResults: string;
  readonly query: string;
};

export type SoqlBuilderLifecycle = {
  readonly connect: () => void;
  readonly disconnect: () => Promise<void> | void;
};

export class SoqlBuilderActionEvent extends CustomEvent<SoqlBuilderAction> {
  constructor(action: SoqlBuilderAction) {
    super(SOQL_BUILDER_ACTION_EVENT, {
      bubbles: true,
      composed: true,
      detail: action
    });
  }
}

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
                    <label for="soql-fields">${this.labels.fields}</label>
                    <vscode-multi-select
                      id="soql-fields"
                      name="fields"
                      tabindex="0"
                      combobox
                      filter="startsWithPerTerm"
                      label=${this.labels.fields}
                      ?disabled=${state.isFieldsLoading || state.query.sObject === undefined}
                      .value=${state.query.fields}
                      @change=${this.handleFieldsChange}
                    >
                      ${state.metadata.fields.map(
                        field => html`<vscode-option value=${field.name}>${field.label}</vscode-option>`
                      )}
                    </vscode-multi-select>
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

  private readonly handleFieldsChange = (event: Event): void => {
    const select = event.currentTarget;
    if (select instanceof VscodeMultiSelect) {
      this.dispatchEvent(
        new SoqlBuilderActionEvent({
          _tag: 'FieldsSelected',
          fieldNames: [...select.value]
        })
      );
    }
  };

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
