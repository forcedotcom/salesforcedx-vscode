/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';
export default class Header extends LightningElement {
  @api public isRunning = false;

  public handleRunQuery(e: Event): void {
    e.preventDefault();
    const runEvent = new CustomEvent('header__run_query');
    this.dispatchEvent(runEvent);
  }
}
