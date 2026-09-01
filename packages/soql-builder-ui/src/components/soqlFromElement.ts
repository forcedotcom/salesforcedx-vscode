/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select/index.js';
import '@vscode-elements/elements/dist/vscode-option/index.js';
import { html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators/property.js';
import { state } from 'lit/decorators/state.js';
import { repeat } from 'lit/directives/repeat.js';
import { SOQL_BUILDER_ACTION_EVENT, type SoqlBuilderAction, type SoqlBuilderState } from '../domain.js';

export type SoqlFromLabels = {
  readonly from: string;
  readonly loading: string;
  readonly noResults: string;
};

const dispatchAction = (target: EventTarget, action: SoqlBuilderAction): void => {
  target.dispatchEvent(
    new CustomEvent(SOQL_BUILDER_ACTION_EVENT, {
      bubbles: true,
      composed: true,
      detail: action
    })
  );
};

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

const matchesFromFilter = (objectLabel: string, filterValue: string): boolean => {
  const pattern = normalize(filterValue);
  if (!pattern) return true;

  return normalize(objectLabel)
    .split(/\s+/u)
    .some(term => term.startsWith(pattern));
};

export class SoqlFromElement extends LitElement {
  @state()
  private accessor filterValue = '';

  @property({ type: Boolean })
  public accessor invalid = false;

  @property({ type: Boolean })
  public accessor isLoading = false;

  @property({ attribute: false })
  public accessor labels!: SoqlFromLabels;

  @property({ attribute: false })
  public accessor objects: SoqlBuilderState['metadata']['objects'] = [];

  @property({ attribute: false })
  public accessor selectedObjectName: string | undefined;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    // Keep the form-associated VSCode select in the builder form's tree. A nested shadow root would prevent
    // ElementInternals from discovering that outer form.
    return this;
  }

  protected override firstUpdated(): void {
    const select = this.querySelector('vscode-single-select');
    if (!select) return;

    // Lit's lifecycle is synchronous, but the nested custom element creates its combobox in its own update.
    void select.updateComplete.then(() => this.syncComboboxAriaState());
  }

  protected override updated(): void {
    this.syncComboboxAriaState();
  }

  protected override render() {
    const hasNoResults =
      !this.isLoading &&
      (this.objects.length === 0 || !this.objects.some(object => matchesFromFilter(object.label, this.filterValue)));
    const status = this.isLoading ? this.labels.loading : hasNoResults ? this.labels.noResults : nothing;

    return html`
      <label class="label" for="soql-object">
        ${this.labels.from}${this.invalid ? html`<span class="required" aria-hidden="true">*</span>` : nothing}
      </label>
      <div class="input">
        <vscode-single-select
          id="soql-object"
          name="sObject"
          tabindex="0"
          combobox
          filter="startsWithPerTerm"
          label=${this.labels.from}
          aria-busy=${this.isLoading ? 'true' : 'false'}
          aria-invalid=${this.invalid ? 'true' : 'false'}
          ?disabled=${this.isLoading}
          .invalid=${this.invalid}
          .value=${this.selectedObjectName ?? ''}
          @change=${this.handleObjectChange}
          @focusin=${this.handleFilterFocus}
          @input=${this.handleFilterInput}
        >
          ${repeat(
            this.objects,
            object => object.name,
            object => html`<vscode-option value=${object.name}>${object.label}</vscode-option>`
          )}
        </vscode-single-select>
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
    // The accessible combobox is the input inside vscode-single-select, not the custom-element host.
    const combobox = this.querySelector('vscode-single-select')?.shadowRoot?.querySelector('.combobox-input');
    if (!(combobox instanceof HTMLInputElement)) return;

    combobox.setAttribute('aria-busy', this.isLoading ? 'true' : 'false');
    combobox.setAttribute('aria-invalid', this.invalid ? 'true' : 'false');
  }

  private readonly handleObjectChange = (event: Event): void => {
    const select = event.currentTarget;
    if (select instanceof VscodeSingleSelect && select.value) {
      this.filterValue = '';
      dispatchAction(this, {
        _tag: 'ObjectSelected',
        objectName: select.value
      });
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'soql-builder-from': SoqlFromElement;
  }
}
