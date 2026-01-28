/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';
export default class OrderBy extends LightningElement {
  @api public orderByFields: string[];
  @api public selectedOrderByFields: JsonMap[] = [];
  @api public hasError = false; // currently not used, no specific order by errors
  @api public isLoading = false;
  public selectPlaceHolderText = 'Search fields...'; // i18n

  public get defaultOptionText(): string {
    // TODO: i18n
    return this.isLoading ? 'Loading...' : 'Select fields...';
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
  public handleOrderBySelected(e: Event): void {
    e.preventDefault();
    const orderbyFieldEl = this.template.querySelector(
      'querybuilder-custom-select'
    );
    const orderEl = this.template.querySelector('[data-el-orderby-order]');
    const nullsEl = this.template.querySelector('[data-el-orderby-nulls]');
    if (
      orderbyFieldEl &&
      orderbyFieldEl.value[0] &&
      orderbyFieldEl.value.length
    ) {
      const orderBySelectedEvent = new CustomEvent('orderby__selected', {
        detail: {
          field: orderbyFieldEl.value[0],
          order: orderEl.value,
          nulls: nullsEl.value
        }
      });
      this.dispatchEvent(orderBySelectedEvent);
    }
  }

  public handleOrderByRemoved(e: Event): void {
    e.preventDefault();
    const orderByRemovedEvent = new CustomEvent('orderby__removed', {
      detail: { field: e.target.dataset.field }
    });
    this.dispatchEvent(orderByRemovedEvent);
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
}
