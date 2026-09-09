/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { VscodeCheckbox } from '@vscode-elements/elements/dist/vscode-checkbox/index.js';
import { VscodeTextfield } from '@vscode-elements/elements/dist/vscode-textfield/index.js';
import * as Match from 'effect/Match';
import * as Predicate from 'effect/Predicate';
import { html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators/property.js';
import { query } from 'lit/decorators/query.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { soqlLimitFromInput, type SoqlLimit } from '../domain.js';
import { SoqlBuilderActionEvent } from './soqlBuilderActionEvent.js';

const LIMIT_ERROR_ID = 'soql-limit-error';

export type SoqlLimitLabels = {
  readonly allRows: string;
  readonly invalid: string;
  readonly limit: string;
  readonly placeholder: string;
};

const limitPresentation = Match.type<SoqlLimit>().pipe(
  Match.tagsExhaustive({
    Empty: () => ({ input: '', invalid: false }),
    Invalid: ({ input }) => ({ input, invalid: true }),
    Valid: ({ value }) => ({ input: String(value), invalid: false })
  })
);

export class SoqlLimitElement extends LitElement {
  @property({ type: Boolean })
  public accessor allRows = false;

  @property({ attribute: false })
  public accessor labels!: SoqlLimitLabels;

  @property({ attribute: false })
  public accessor limit: SoqlLimit = { _tag: 'Empty' };

  @property({ attribute: false })
  public accessor recoverableErrorMessage: string | undefined;

  @query('vscode-textfield')
  private accessor textfield: VscodeTextfield | null = null;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    // Keep both form-associated VSCode controls in the builder form's tree. A nested shadow root would prevent
    // ElementInternals from discovering that outer form.
    return this;
  }

  protected override updated(): void {
    const textfield = this.textfield;
    if (!textfield) return;

    void textfield.updateComplete.then(() => this.syncTextfieldAriaState());
  }

  protected override render() {
    const presentation = limitPresentation(this.limit);
    const errorMessage = presentation.invalid ? this.labels.invalid : this.recoverableErrorMessage;
    const invalid = Predicate.isNotUndefined(errorMessage);

    return html`
      <label class="label" for="soql-limit">
        ${this.labels.limit}${invalid ? html`<span class="required" aria-hidden="true">*</span>` : nothing}
      </label>
      <div class="input limit-input">
        <vscode-textfield
          id="soql-limit"
          name="limit"
          type="number"
          min="0"
          step="1"
          .max=${Number.MAX_SAFE_INTEGER}
          .label=${this.labels.limit}
          .placeholder=${this.labels.placeholder}
          .invalid=${invalid}
          .value=${presentation.input}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(invalid ? LIMIT_ERROR_ID : undefined)}
          @change=${this.handleLimitChange}
          @input=${this.handleLimitChange}
        ></vscode-textfield>
        ${invalid ? html`<span id=${LIMIT_ERROR_ID} class="validation-error">${errorMessage}</span>` : nothing}
      </div>
      <div class="input all-rows-input">
        <vscode-checkbox name="allRows" .checked=${this.allRows} @change=${this.handleAllRowsChange}
          >${this.labels.allRows}</vscode-checkbox
        >
      </div>
    `;
  }

  private syncTextfieldAriaState(): void {
    const input = this.textfield?.wrappedElement;
    if (!input) return;

    const presentation = limitPresentation(this.limit);
    const errorMessage = presentation.invalid ? this.labels.invalid : this.recoverableErrorMessage;
    const invalid = Predicate.isNotUndefined(errorMessage);
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    if (invalid) {
      // An ID reference cannot cross from the control's shadow root to this adapter's light DOM. Mirror the
      // localized message onto the actual accessible input so assistive technology receives the description.
      input.setAttribute('aria-description', errorMessage);
    } else {
      input.removeAttribute('aria-description');
    }
  }

  private readonly handleLimitChange = (event: Event): void => {
    const textfield = event.currentTarget;
    if (textfield instanceof VscodeTextfield) {
      this.dispatchEvent(
        new SoqlBuilderActionEvent({
          _tag: 'LimitChanged',
          limit: soqlLimitFromInput(textfield.value)
        })
      );
    }
  };

  private readonly handleAllRowsChange = (event: Event): void => {
    const checkbox = event.currentTarget;
    if (checkbox instanceof VscodeCheckbox) {
      this.dispatchEvent(
        new SoqlBuilderActionEvent({
          _tag: 'AllRowsChanged',
          allRows: checkbox.checked
        })
      );
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'soql-builder-limit': SoqlLimitElement;
  }
}
