/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';
import { messages } from 'querybuilder/messages';

export default class Header extends LightningElement {
  @api public hasNoDefaultOrg = false;
  @api public isRunning = false;
  @api public isQueryPlanRunning = false;
  @api public isQueryValid = false;

  public get i18n() {
    return messages;
  }

  public get isQueryInvalid(): boolean {
    return !this.isQueryValid;
  }

  public handleRunQuery(e: Event): void {
    e.preventDefault();
    const runEvent = new CustomEvent('header__run_query');
    this.dispatchEvent(runEvent);
  }

  public handleGetQueryPlan(e: Event): void {
    e.preventDefault();
    const planEvent = new CustomEvent('header__get_query_plan');
    this.dispatchEvent(planEvent);
  }
}
