/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api, track } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';
import { messages } from 'querybuilder/messages';

export default class OrderBy extends LightningElement {
  @api public orderByFields: string[];
  @api public selectedOrderByFields: JsonMap[] = [];
  @api public hasError = false;
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public sobjectMetadata: any = null;

  @track public _pendingField: string | null = null;

  public get i18n() {
    return messages;
  }

  public get placeholderText(): string {
    return messages.placeholder_search_fields;
  }

  public get currentFieldSelection(): string[] {
    return this._pendingField ? [this._pendingField] : [];
  }

  public get emptySelection(): string[] {
    return [];
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const value: string = e.detail?.value;
    if (!value) return;
    this._pendingField = value;
  }

  public handleOrderByAdd(e: Event): void {
    e.preventDefault();
    const fieldValue = this._pendingField;
    const orderEl = this.template.querySelector('[data-el-orderby-order]') as HTMLSelectElement;
    const nullsEl = this.template.querySelector('[data-el-orderby-nulls]') as HTMLSelectElement;
    if (fieldValue) {
      const order = orderEl?.value;
      const nulls = nullsEl?.value;
      this._pendingField = null;
      if (orderEl) orderEl.value = '';
      if (nullsEl) nullsEl.value = '';
      this.dispatchEvent(new CustomEvent('orderby__selected', {
        detail: { field: fieldValue, order, nulls }
      }));
    }
  }

  public handleOrderByRemoved(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('orderby__removed', {
      detail: { field: (e.target as HTMLElement).dataset.field }
    }));
  }
}
