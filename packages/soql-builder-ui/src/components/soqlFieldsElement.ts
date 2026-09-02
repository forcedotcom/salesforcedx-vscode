/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderState } from '../domain.js';
import '@vscode-elements/elements/dist/vscode-button/index.js';
import { VscodeCheckbox } from '@vscode-elements/elements/dist/vscode-checkbox/index.js';
import { VscodeMultiSelect } from '@vscode-elements/elements/dist/vscode-multi-select/index.js';
import '@vscode-elements/elements/dist/vscode-option/index.js';
import { html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators/property.js';
import { query } from 'lit/decorators/query.js';
import { state } from 'lit/decorators/state.js';
import { repeat } from 'lit/directives/repeat.js';
import { SoqlBuilderActionEvent } from './soqlBuilderActionEvent.js';

const SELECT_COUNT = 'COUNT()';

type SoqlFieldsLabels = {
  readonly clearAll: string;
  readonly count: string;
  readonly fields: string;
  readonly loading: string;
  readonly noResults: string;
  readonly selectAll: string;
};

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

const matchesFieldsFilter = (field: SoqlBuilderState['metadata']['fields'][number], filterValue: string): boolean => {
  const pattern = normalize(filterValue);
  if (!pattern) return true;

  return [field.label, field.name].some(value =>
    normalize(value)
      .split(/\s+/u)
      .some(term => term.startsWith(pattern))
  );
};

export class SoqlFieldsElement extends LitElement {
  @property({ type: Boolean })
  public accessor disabled = false;

  @property({ attribute: false })
  public accessor fields: SoqlBuilderState['metadata']['fields'] = [];

  @property({ type: Boolean })
  public accessor invalid = false;

  @property({ type: Boolean })
  public accessor isLoading = false;

  @property({ attribute: false })
  public accessor labels!: SoqlFieldsLabels;

  @property({ attribute: false })
  public accessor selectedFieldNames: readonly string[] = [];

  @state()
  private accessor filterValue = '';

  @query('vscode-multi-select')
  private accessor select: VscodeMultiSelect | null = null;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    // Keep the form-associated VSCode controls in the builder form's tree. A nested shadow root would prevent
    // ElementInternals from discovering that outer form.
    return this;
  }

  protected override updated(): void {
    const select = this.select;
    if (!select) return;

    // Option slot changes can clear vscode-multi-select's pending value when metadata and restored selections arrive
    // together. Reapply the controlled value after the nested control has populated its option controller.
    void select.updateComplete.then(() => {
      select.value = this.selectedFieldNames.filter(fieldName => normalize(fieldName) !== normalize(SELECT_COUNT));
      this.syncComboboxAriaState();
    });
  }

  protected override render() {
    const controlsDisabled = this.disabled || this.isLoading;
    const ordinarySelections = this.selectedFieldNames.filter(
      fieldName => normalize(fieldName) !== normalize(SELECT_COUNT)
    );
    const countSelected = this.selectedFieldNames.some(fieldName => normalize(fieldName) === normalize(SELECT_COUNT));
    const hasNoResults =
      !controlsDisabled &&
      (this.fields.length === 0 || !this.fields.some(field => matchesFieldsFilter(field, this.filterValue)));
    const status = this.isLoading ? this.labels.loading : hasNoResults ? this.labels.noResults : nothing;

    return html`
      <label class="label" for="soql-fields">
        ${this.labels.fields}${this.invalid ? html`<span class="required" aria-hidden="true">*</span>` : nothing}
      </label>
      <div class="input fields-input">
        <vscode-multi-select
          id="soql-fields"
          name="fields"
          tabindex="0"
          combobox
          filter="startsWithPerTerm"
          label=${this.labels.fields}
          aria-busy=${this.isLoading ? 'true' : 'false'}
          aria-invalid=${this.invalid ? 'true' : 'false'}
          ?disabled=${controlsDisabled}
          .invalid=${this.invalid}
          .value=${ordinarySelections}
          @change=${this.handleFieldsChange}
          @focusin=${this.handleFilterFocus}
          @input=${this.handleFilterInput}
        >
          ${repeat(
            this.fields,
            field => field.name,
            field =>
              html`<vscode-option value=${field.name}
                >${field.name === field.label ? field.name : `${field.name} — ${field.label}`}</vscode-option
              >`
          )}
        </vscode-multi-select>
        <div class="field-actions">
          <vscode-checkbox
            name="count"
            value=${SELECT_COUNT}
            ?checked=${countSelected}
            ?disabled=${controlsDisabled}
            @change=${this.handleCountChange}
            >${this.labels.count}</vscode-checkbox
          >
          <vscode-button
            type="button"
            secondary
            ?disabled=${controlsDisabled || this.fields.length === 0}
            @click=${this.handleSelectAll}
            >${this.labels.selectAll}</vscode-button
          >
          <vscode-button
            type="button"
            secondary
            ?disabled=${controlsDisabled || this.selectedFieldNames.length === 0}
            @click=${this.handleClearAll}
            >${this.labels.clearAll}</vscode-button
          >
        </div>
        ${status === nothing ? nothing : html`<span class="status" role="status" aria-live="polite">${status}</span>`}
      </div>
    `;
  }

  private readonly handleFilterInput = (event: Event): void => {
    // The public select does not expose its filter text. Native input events cross its shadow boundary,
    // so read the originating combobox while keeping the implementation detail inside this adapter.
    const [source] = event.composedPath();
    if (source instanceof HTMLInputElement) this.filterValue = source.value;
  };

  private readonly handleFilterFocus = (): void => {
    // VSCode Elements clears its private filter when the combobox regains focus without emitting input.
    this.filterValue = '';
  };

  private syncComboboxAriaState(): void {
    const combobox = this.select?.shadowRoot?.querySelector('.combobox-input');
    if (!(combobox instanceof HTMLInputElement)) return;

    combobox.setAttribute('aria-busy', this.isLoading ? 'true' : 'false');
    combobox.setAttribute('aria-invalid', this.invalid ? 'true' : 'false');
  }

  private readonly handleFieldsChange = (event: Event): void => {
    const select = event.currentTarget;
    if (select instanceof VscodeMultiSelect) {
      this.filterValue = '';
      this.dispatchEvent(
        new SoqlBuilderActionEvent({
          _tag: 'FieldsSelected',
          fieldNames: [...select.value]
        })
      );
    }
  };

  private readonly handleCountChange = (event: Event): void => {
    const checkbox = event.currentTarget;
    if (checkbox instanceof VscodeCheckbox) {
      this.dispatchEvent(
        new SoqlBuilderActionEvent({
          _tag: 'FieldsSelected',
          fieldNames: checkbox.checked ? [SELECT_COUNT] : []
        })
      );
    }
  };

  private readonly handleSelectAll = (): void => {
    this.dispatchEvent(new SoqlBuilderActionEvent({ _tag: 'AllFieldsSelected' }));
  };

  private readonly handleClearAll = (): void => {
    this.dispatchEvent(new SoqlBuilderActionEvent({ _tag: 'AllFieldsCleared' }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'soql-builder-fields': SoqlFieldsElement;
  }
}
