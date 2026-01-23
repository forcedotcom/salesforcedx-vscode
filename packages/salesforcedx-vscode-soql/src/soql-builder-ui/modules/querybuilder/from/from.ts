/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';

export default class From extends LightningElement {
  @api public sobjects: string[];
  @api public hasError = false;
  @api public isLoading = false;
  public selectPlaceHolderText = 'Search object...'; // i18n
  public _selectedObject: string[] = [];

  @api
  public get selected(): string {
    return this._selectedObject[0];
  }

  public set selected(objectName: string) {
    this._selectedObject = objectName ? [objectName] : [];
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
  public handleSobjectSelection(e: CustomEvent): void {
    e.preventDefault();
    const selectedSobject = e.detail.value;
    if (selectedSobject && selectedSobject.length) {
      const sObjectSelected = new CustomEvent('from__object_selected', {
        detail: { selectedSobject }
      });
      this.dispatchEvent(sObjectSelected);
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
}
