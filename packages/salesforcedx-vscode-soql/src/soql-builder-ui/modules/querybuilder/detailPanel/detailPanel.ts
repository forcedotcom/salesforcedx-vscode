/*
 *  Copyright (c) 2026, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';
import { messages } from 'querybuilder/messages';
import { JsonMap } from '@salesforce/ts-types';

export default class DetailPanel extends LightningElement {
  @api public contextLabel = '';
  @api public contextPath: string[] = [];
  @api public availableFields: string[] = [];
  @api public selectedFields: string[] = [];
  @api public whereExpr: JsonMap;
  @api public whereFields: string[] = [];
  @api public orderByFields: string[] = [];
  @api public selectedOrderByFields: JsonMap[] = [];
  @api public limit = '';
  @api public hasFieldsError = false;
  @api public hasOrderByError = false;
  @api public hasLimitError = false;
  @api public isLoading = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public sobjectMetadata: any;

  public get i18n() {
    return messages;
  }

  public get panelTitle(): string {
    return this.contextLabel || 'Query Clauses';
  }

  public get fieldPills(): string[] {
    return this.selectedFields || [];
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const value: string = e.detail?.value;
    if (!value) return;
    const current = [...(this.selectedFields || [])];
    if (!current.includes(value)) {
      current.push(value);
    }
    this.dispatchEvent(new CustomEvent('detail__fieldschanged', {
      detail: { fields: current }
    }));
  }

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    const field = (e.currentTarget as HTMLElement).dataset.field;
    const current = (this.selectedFields || []).filter(f => f !== field);
    this.dispatchEvent(new CustomEvent('detail__fieldschanged', {
      detail: { fields: current }
    }));
  }
}
