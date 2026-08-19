/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingModelJson } from '../modules/querybuilder/services/model';
import { VscodeMultiSelect } from '@vscode-elements/elements/dist/vscode-multi-select/index.js';
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select/index.js';
import '@vscode-elements/elements/dist/vscode-button/index.js';
import '@vscode-elements/elements/dist/vscode-option/index.js';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Stream from 'effect/Stream';
import { css, html, LitElement, nothing } from 'lit';
import { messages } from '../modules/querybuilder/messages/i18n';
import { MessageService } from '../modules/querybuilder/services/message/iMessageService';
import { VscodeMessageServiceLive } from '../modules/querybuilder/services/message/vscodeMessageService';
import { ToolingModelService, toolingModelTemplate } from '../modules/querybuilder/services/toolingModelService';
import { ToolingSDK } from '../modules/querybuilder/services/toolingSDK';

export class SoqlBuilderLitSpike extends LitElement {
  public static properties = {
    fields: { state: true },
    hasNoDefaultOrg: { state: true },
    isFieldsLoading: { state: true },
    isObjectsLoading: { state: true },
    query: { state: true },
    sObjects: { state: true }
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

  public appLayer: Layer.Layer<MessageService> = VscodeMessageServiceLive;
  declare public fields: string[];
  declare public hasNoDefaultOrg: boolean;
  declare public isFieldsLoading: boolean;
  declare public isObjectsLoading: boolean;
  declare public query: ToolingModelJson;
  declare public sObjects: string[];

  private modelService: ToolingModelService | undefined;
  private requestedSObject: string | undefined;
  private runtime: ManagedRuntime.ManagedRuntime<MessageService | ToolingSDK | ToolingModelService, never> | undefined;
  private toolingSDK: ToolingSDK | undefined;

  constructor() {
    super();
    this.fields = [];
    this.hasNoDefaultOrg = false;
    this.isFieldsLoading = false;
    this.isObjectsLoading = false;
    this.query = toolingModelTemplate;
    this.sObjects = [];
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    void this.initialize().catch(error => {
      console.error('Unable to initialize the SOQL Builder Lit spike.', error);
    });
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    void this.runtime?.dispose();
  }

  protected override render() {
    return html`
      <main>
        <div class="spike-banner" role="status">
          Lit framework spike using VSCode Elements. This vertical slice intentionally covers From, Fields, and query preview only.
        </div>
        ${this.hasNoDefaultOrg
          ? html`<p class="warning" role="alert">${messages.label_no_default_org}</p>`
          : html`
              <div class="content">
                <section class="form" aria-label="SOQL query inputs">
                  <div class="control">
                    <label for="lit-spike-object">${messages.label_from}</label>
                    <vscode-single-select
                      id="lit-spike-object"
                      combobox
                      filter="startsWithPerTerm"
                      label=${messages.label_from}
                      ?disabled=${this.isObjectsLoading}
                      .value=${this.query.sObject}
                      @change=${this.handleObjectChange}
                    >
                      ${this.sObjects.map(
                        sObject => html`<vscode-option value=${sObject}>${sObject}</vscode-option>`
                      )}
                    </vscode-single-select>
                  </div>
                  <div class="control">
                    <label for="lit-spike-fields">${messages.label_fields}</label>
                    <vscode-multi-select
                      id="lit-spike-fields"
                      combobox
                      filter="startsWithPerTerm"
                      label=${messages.label_fields}
                      ?disabled=${this.isFieldsLoading || this.query.sObject.length === 0}
                      .value=${this.query.fields}
                      @change=${this.handleFieldsChange}
                    >
                      ${this.fields.map(field => html`<vscode-option value=${field}>${field}</vscode-option>`)}
                    </vscode-multi-select>
                  </div>
                </section>
                <section class="preview" aria-live="polite">
                  <div class="preview-title">${messages.label_soql_query}</div>
                  <pre data-testid="query-preview">${this.query.originalSoqlStatement || nothing}</pre>
                </section>
              </div>
            `}
      </main>
    `;
  }

  private readonly handleFieldsChange = (event: Event): void => {
    const select = event.currentTarget;
    if (!(select instanceof VscodeMultiSelect)) {
      return;
    }
    this.modelService?.setFields([...select.value]);
  };

  private readonly handleObjectChange = (event: Event): void => {
    const select = event.currentTarget;
    if (!(select instanceof VscodeSingleSelect)) {
      return;
    }
    const selectedObject = select.value;
    if (!selectedObject) {
      return;
    }

    this.fields = [];
    this.isFieldsLoading = true;
    this.requestedSObject = selectedObject;
    this.toolingSDK?.loadSObjectMetadata(selectedObject);
    this.modelService?.setSObject(selectedObject);
  };

  private async initialize(): Promise<void> {
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        this.appLayer,
        Layer.provide(ToolingSDK.Default, this.appLayer),
        Layer.provide(ToolingModelService.Default, this.appLayer)
      )
    );
    this.runtime = runtime;

    await runtime.runPromise(
      Effect.gen(this, function* () {
        this.toolingSDK = yield* ToolingSDK;
        this.modelService = yield* ToolingModelService;

        yield* Effect.forkDaemon(
          Stream.runForEach(this.modelService.UIModel, query =>
            Effect.sync(() => this.applyQuery(query))
          )
        );
        yield* Effect.forkDaemon(
          Stream.runForEach(this.toolingSDK.sobjects.changes, sObjects =>
            Effect.sync(() => {
              this.isObjectsLoading = false;
              this.sObjects = sObjects;
            })
          )
        );
        yield* Effect.forkDaemon(
          Stream.runForEach(this.toolingSDK.sobjectMetadata.changes, metadata =>
            Effect.sync(() => {
              this.isFieldsLoading = false;
              this.fields = metadata.fields.map(field => field.name).toSorted();
            })
          )
        );
        yield* Effect.forkDaemon(
          Stream.runForEach(this.toolingSDK.noDefaultOrg.changes, hasNoDefaultOrg =>
            Effect.sync(() => {
              this.hasNoDefaultOrg = hasNoDefaultOrg;
            })
          )
        );

        this.isObjectsLoading = true;
        this.toolingSDK.loadSObjectDefinitions();
        this.modelService.restoreViewState();
      })
    );
  }

  private applyQuery(query: ToolingModelJson): void {
    this.query = query;
    if (
      query.sObject.length > 0 &&
      query.sObject !== this.requestedSObject &&
      (this.fields.length === 0 || this.requestedSObject !== query.sObject)
    ) {
      this.fields = [];
      this.isFieldsLoading = true;
      this.requestedSObject = query.sObject;
      this.toolingSDK?.loadSObjectMetadata(query.sObject);
    }
  }
}

customElements.define('soql-builder-lit-spike', SoqlBuilderLitSpike);
