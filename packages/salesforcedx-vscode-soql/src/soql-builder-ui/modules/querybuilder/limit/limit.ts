/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';
import { messages } from 'querybuilder/messages';

export default class Limit extends LightningElement {
  @api public hasError = false;
  @api public limit;
  @api public maxRows;

  public get i18n() {
    return messages;
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
  public handleLimitChange(e: Event): void {
    e.preventDefault();
    const limit = e.target.value;
    this.dispatchEvent(new CustomEvent('limit__changed', { detail: { limit } }));
  }

  public handleMaxRowsChange(e: Event): void {
    e.preventDefault();
    const maxRows = e.target.value;
    this.dispatchEvent(new CustomEvent('maxrows__changed', { detail: { maxRows } }));
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
}
