/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';
import { SELECT_COUNT } from '../services/model';

export const SELECT_ALL_OPTION = 'ALL FIELDS';
export const CLEAR_OPTION = '- Clear Selection -';

export default class Fields extends LightningElement {
  @api public set fields(fields: string[]) {
    this._displayFields = [
      CLEAR_OPTION,
      SELECT_ALL_OPTION,
      SELECT_COUNT,
      ...fields
    ];
  }
  public get fields(): string[] {
    return this._displayFields;
  }
  @api public selectedFields: string[] = [];
  @api public hasError = false;
  @api public isLoading = false;
  public selectPlaceHolderText = 'Search fields...'; // TODO: i18n
  public _displayFields: string[];

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    if (e.detail && e.detail.value) {
      let selection = [];
      // COUNT() and other fields are mutually exclusive
      if (e.detail.value.toLowerCase() === SELECT_COUNT.toLowerCase()) {
        selection.push(SELECT_COUNT);
        const fieldSelectedEvent = new CustomEvent('fields__selected', {
          detail: { fields: selection }
        });
        this.dispatchEvent(fieldSelectedEvent);
      } else if (e.detail.value === SELECT_ALL_OPTION) {
        const fieldSelectAllEvent = new CustomEvent('fields__selectall', {});
        this.dispatchEvent(fieldSelectAllEvent);
      } else if (e.detail.value === CLEAR_OPTION) {
        const fieldClearAllEvent = new CustomEvent('fields__clearall', {});
        this.dispatchEvent(fieldClearAllEvent);
      } else {
        selection = this.selectedFields.filter(
          (value) => value.toLowerCase() !== SELECT_COUNT.toLowerCase()
        );
        selection.push(e.detail.value);
        const fieldSelectedEvent = new CustomEvent('fields__selected', {
          detail: { fields: selection }
        });
        this.dispatchEvent(fieldSelectedEvent);
      }
    }
  }

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    const fieldRemovedEvent = new CustomEvent('fields__selected', {
      detail: {
        fields: this.selectedFields.filter(
          (value) => value !== e.target.dataset.field
        )
      }
    });
    this.dispatchEvent(fieldRemovedEvent);
  }
}
