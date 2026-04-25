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
import {
  REL_PREFIX,
  DrillLevel,
  buildDrilledOptions,
  applyDrillMetadata,
  buildBreadcrumb,
  buildQualifiedFieldName,
  popDrillStack,
  extractRelOptions,
  findReferenceTo
} from '../services/drillUtils';

export default class OrderBy extends LightningElement {
  @api public orderByFields: string[];
  @api public selectedOrderByFields: JsonMap[] = [];
  @api public hasError = false;
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    if (this._drillStack.length === 0) this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayFields: string[] = [];
  @track public _drillStack: DrillLevel[] = [];
  @track public _pendingField: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;

  public get i18n() {
    return messages;
  }

  public get isDrilledIn(): boolean {
    return this._drillStack.length > 0;
  }

  public get breadcrumbLabel(): string {
    return buildBreadcrumb(this._drillStack);
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

  private _updateDisplayOptions(): void {
    const relEntries = extractRelOptions(this._sobjectMetadata)
      .map(r => `${REL_PREFIX}${r.relationshipName}`)
      .sort((a, b) => a.localeCompare(b));
    this._displayFields = [...(this.orderByFields || []), ...relEntries];
  }

  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDrillMetadata(metadata: any): void {
    if (this._drillStack.length === 0) return;
    this._drillStack = applyDrillMetadata(this._drillStack, metadata);
    this._displayFields = buildDrilledOptions(metadata, this._drillStack.length);
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    if (value.startsWith(REL_PREFIX)) {
      const relName = value.slice(REL_PREFIX.length);
      const sourceMeta = this._drillStack.length > 0
        ? this._drillStack[this._drillStack.length - 1].metadata
        : this._sobjectMetadata;
      const referenceTo = findReferenceTo(sourceMeta, relName);
      if (!referenceTo) return;
      this._drillStack = [...this._drillStack, { relationshipName: relName, referenceTo, metadata: null }];
      this._displayFields = [];
      this.dispatchEvent(new CustomEvent('orderby__loadrelationship', {
        detail: { relationshipName: relName, referenceTo }
      }));
      return;
    }

    this._pendingField = buildQualifiedFieldName(this._drillStack, value);
    this._drillStack = [];
    this._updateDisplayOptions();
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

  public handleBackOneLevel(): void {
    if (this._drillStack.length <= 1) {
      this._drillStack = [];
      this._updateDisplayOptions();
    } else {
      const newStack = popDrillStack(this._drillStack);
      this._drillStack = newStack;
      const parentMeta = newStack[newStack.length - 1].metadata;
      this._displayFields = parentMeta ? buildDrilledOptions(parentMeta, newStack.length) : [];
    }
  }

  public handleOrderByRemoved(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('orderby__removed', {
      detail: { field: (e.target as HTMLElement).dataset.field }
    }));
  }
}
