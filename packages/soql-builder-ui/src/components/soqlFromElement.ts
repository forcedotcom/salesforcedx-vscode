/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select/index.js';
import '@vscode-elements/elements/dist/vscode-option/index.js';
import { html, LitElement, nothing } from 'lit';
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
  public static properties = {
    filterValue: { state: true },
    invalid: { type: Boolean },
    isLoading: { type: Boolean },
    labels: { attribute: false },
    objects: { attribute: false },
    selectedObjectName: { attribute: false }
  };

  declare private filterValue: string;
  declare public invalid: boolean;
  declare public isLoading: boolean;
  declare public labels: SoqlFromLabels;
  declare public objects: SoqlBuilderState['metadata']['objects'];
  declare public selectedObjectName: string | undefined;

  constructor() {
    super();
    this.filterValue = '';
    this.invalid = false;
    this.isLoading = false;
    this.objects = [];
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    // Keep the form-associated VSCode select in the builder form's tree. A nested shadow root would prevent
    // ElementInternals from discovering that outer form.
    return this;
  }

  protected override firstUpdated(): void {
    const select = this.querySelector('vscode-single-select');
    if (!select) return;

    // VSCode Elements does not expose the combobox filter value or a no-results label. Keep this implementation
    // detail contained in the From adapter so the accepted, localized empty state can be announced.
    void select.updateComplete.then(() => {
      select.shadowRoot
        ?.querySelector<HTMLInputElement>('.combobox-input')
        ?.addEventListener('input', this.handleFilterInput);
    });
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
    const source = event.currentTarget;
    if (source instanceof HTMLInputElement) this.filterValue = source.value;
  };

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
