/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { VscodeMultiSelect } from '@vscode-elements/elements/dist/vscode-multi-select/index.js';
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select/index.js';
import '@vscode-elements/elements/dist/vscode-option/index.js';
import { css, html, LitElement, nothing } from 'lit';
import {
  SOQL_BUILDER_ACTION_EVENT,
  createInitialSoqlBuilderState,
  type SoqlBuilderAction,
  type SoqlBuilderState
} from '../domain.js';

export type SoqlBuilderLabels = {
  readonly fields: string;
  readonly from: string;
  readonly inputs: string;
  readonly noDefaultOrg: string;
  readonly query: string;
};

export const defaultSoqlBuilderLabels: SoqlBuilderLabels = {
  fields: 'Fields',
  from: 'From',
  inputs: 'SOQL query inputs',
  noDefaultOrg: 'SOQL Builder requires a default org. Set a default org before using the builder.',
  query: 'SOQL Query'
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

export class SoqlBuilderApp extends LitElement {
  public static properties = {
    labels: { attribute: false },
    viewState: { attribute: false }
  };

  public static styles = css`
    :host {
      display: block;
      max-width: 960px;
    }

    * {
      box-sizing: border-box;
    }

    .content {
      display: grid;
      gap: 24px;
      grid-template-columns: minmax(360px, 1fr) minmax(300px, 1fr);
    }

    .form {
      display: grid;
      gap: 16px;
    }

    .control {
      display: grid;
      gap: 6px;
      grid-template-columns: 72px minmax(0, 1fr);
    }

    label,
    .preview-title {
      font-weight: 600;
      padding-top: 4px;
    }

    vscode-single-select,
    vscode-multi-select {
      width: 100%;
    }

    .preview {
      min-width: 0;
    }

    pre {
      background: var(--vscode-textCodeBlock-background, rgba(10, 10, 10, 0.4));
      border: 1px solid var(--vscode-widget-border, transparent);
      color: var(--vscode-editor-foreground, inherit);
      font-family: var(--vscode-editor-font-family, monospace);
      margin: 6px 0 0;
      min-height: 76px;
      overflow: auto;
      padding: 12px;
      white-space: pre-wrap;
    }

    .warning {
      background: var(--vscode-inputValidation-warningBackground, #352a05);
      border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
      color: var(--vscode-inputValidation-warningForeground, inherit);
      padding: 10px;
    }

    @media (max-width: 750px) {
      .content {
        grid-template-columns: 1fr;
      }
    }
  `;

  declare public labels: SoqlBuilderLabels;
  public lifecycle: SoqlBuilderLifecycle | undefined;
  declare public viewState: SoqlBuilderState;

  constructor() {
    super();
    this.labels = defaultSoqlBuilderLabels;
    this.viewState = createInitialSoqlBuilderState();
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this.lifecycle?.connect();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    void this.lifecycle?.disconnect();
  }

  protected override render() {
    const state = this.viewState;
    return html`
      <main>
        ${state.errorMessage || state.hasNoDefaultOrg
          ? html`<p class="warning" role="alert">${state.errorMessage ?? this.labels.noDefaultOrg}</p>`
          : html`
              <div class="content">
                <section class="form" aria-label=${this.labels.inputs}>
                  <div class="control">
                    <label for="soql-object">${this.labels.from}</label>
                    <vscode-single-select
                      id="soql-object"
                      combobox
                      filter="startsWithPerTerm"
                      label=${this.labels.from}
                      ?disabled=${state.isObjectsLoading}
                      .value=${state.query.sObject}
                      @change=${this.handleObjectChange}
                    >
                      ${state.metadata.objects.map(
                        object => html`<vscode-option value=${object.name}>${object.label}</vscode-option>`
                      )}
                    </vscode-single-select>
                  </div>
                  <div class="control">
                    <label for="soql-fields">${this.labels.fields}</label>
                    <vscode-multi-select
                      id="soql-fields"
                      combobox
                      filter="startsWithPerTerm"
                      label=${this.labels.fields}
                      ?disabled=${state.isFieldsLoading || state.query.sObject.length === 0}
                      .value=${state.query.fields}
                      @change=${this.handleFieldsChange}
                    >
                      ${state.metadata.fields.map(
                        field => html`<vscode-option value=${field.name}>${field.label}</vscode-option>`
                      )}
                    </vscode-multi-select>
                  </div>
                </section>
                <section class="preview" aria-live="polite">
                  <div class="preview-title">${this.labels.query}</div>
                  <pre data-testid="query-preview">${state.query.originalSoqlStatement || nothing}</pre>
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

  private readonly handleObjectChange = (event: Event): void => {
    const select = event.currentTarget;
    if (select instanceof VscodeSingleSelect && select.value) {
      this.dispatchEvent(
        new SoqlBuilderActionEvent({
          _tag: 'ObjectSelected',
          objectName: select.value
        })
      );
    }
  };
}

declare global {
  interface HTMLElementEventMap {
    'soql-builder-action': SoqlBuilderActionEvent;
  }

  interface HTMLElementTagNameMap {
    'soql-builder-app': SoqlBuilderApp;
  }
}
