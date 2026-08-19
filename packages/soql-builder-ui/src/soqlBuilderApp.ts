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
  createInitialSoqlBuilderState,
  defaultSoqlBuilderLabels,
  type SoqlBuilderHost,
  type SoqlBuilderLabels,
  type SoqlBuilderState
} from './contracts.js';

export class SoqlBuilderApp extends LitElement {
  public static properties = {
    labels: { attribute: false },
    viewState: { state: true }
  };

  public static styles = css`
    :host {
      display: block;
      max-width: 960px;
    }

    * {
      box-sizing: border-box;
    }

    .spike-banner {
      background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      color: var(--vscode-descriptionForeground, inherit);
      margin-bottom: 20px;
      padding: 8px 12px;
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

  public host: SoqlBuilderHost | undefined;
  declare public labels: SoqlBuilderLabels;
  declare public viewState: SoqlBuilderState;

  constructor() {
    super();
    this.labels = defaultSoqlBuilderLabels;
    this.viewState = createInitialSoqlBuilderState();
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    const initialization = this.host?.initialize(state => {
      this.viewState = {
        ...state,
        availableFields: [...state.availableFields],
        query: { ...state.query, fields: [...state.query.fields] },
        sObjects: [...state.sObjects]
      };
    });
    if (initialization) {
      void Promise.resolve(initialization).catch(error => {
        console.error('Unable to initialize the SOQL Builder.', error);
      });
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    void this.host?.dispose();
  }

  protected override render() {
    const state = this.viewState;
    return html`
      <main>
        <div class="spike-banner" role="status">${this.labels.spikeDescription}</div>
        ${state.errorMessage || state.hasNoDefaultOrg
          ? html`<p class="warning" role="alert">${state.errorMessage ?? this.labels.noDefaultOrg}</p>`
          : html`
              <div class="content">
                <section class="form" aria-label="SOQL query inputs">
                  <div class="control">
                    <label for="lit-spike-object">${this.labels.from}</label>
                    <vscode-single-select
                      id="lit-spike-object"
                      combobox
                      filter="startsWithPerTerm"
                      label=${this.labels.from}
                      ?disabled=${state.isObjectsLoading}
                      .value=${state.query.sObject}
                      @change=${this.handleObjectChange}
                    >
                      ${state.sObjects.map(sObject => html`<vscode-option value=${sObject}>${sObject}</vscode-option>`)}
                    </vscode-single-select>
                  </div>
                  <div class="control">
                    <label for="lit-spike-fields">${this.labels.fields}</label>
                    <vscode-multi-select
                      id="lit-spike-fields"
                      combobox
                      filter="startsWithPerTerm"
                      label=${this.labels.fields}
                      ?disabled=${state.isFieldsLoading || state.query.sObject.length === 0}
                      .value=${state.query.fields}
                      @change=${this.handleFieldsChange}
                    >
                      ${state.availableFields.map(
                        field => html`<vscode-option value=${field}>${field}</vscode-option>`
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
      this.host?.selectFields([...select.value]);
    }
  };

  private readonly handleObjectChange = (event: Event): void => {
    const select = event.currentTarget;
    if (select instanceof VscodeSingleSelect && select.value) {
      this.host?.selectSObject(select.value);
    }
  };
}
