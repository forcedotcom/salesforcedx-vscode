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

const REL_PREFIX = '→ ';
const MAX_DEPTH = 5;

type DrillLevel = {
  relationshipName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
};

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
    return this._drillStack.map(l => `${REL_PREFIX}${l.relationshipName}`).join(' ');
  }

  public get placeholderText(): string {
    return messages.placeholder_search_fields;
  }

  public get currentFieldSelection(): string[] {
    return this._pendingField ? [this._pendingField] : [];
  }

  private _updateDisplayOptions(): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const relEntries: string[] = (this._sobjectMetadata?.fields || [])
      .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    this._displayFields = [...(this.orderByFields || []), ...relEntries];
  }

  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDrillMetadata(metadata: any): void {
    if (this._drillStack.length === 0) return;
    this._drillStack = this._drillStack.map((level, i) =>
      i === this._drillStack.length - 1 ? { ...level, metadata } : level
    );
    this._buildDrilledOptions(metadata);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _buildDrilledOptions(metadata: any): void {
    if (!metadata || !Array.isArray(metadata.fields)) { this._displayFields = []; return; }
    const plain: string[] = (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.type !== 'reference' || !f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    const refs: string[] = this._drillStack.length < MAX_DEPTH
      ? (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
        .sort()
      : [];
    this._displayFields = [...plain, ...refs];
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const refField = (sourceMeta?.fields || []).find((f: any) => f.relationshipName === relName); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!refField) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const referenceTo: string[] = refField.referenceTo;
      this._drillStack = [...this._drillStack, { relationshipName: relName, metadata: null }];
      this._displayFields = [];
      this.dispatchEvent(new CustomEvent('orderby__loadrelationship', {
        detail: { relationshipName: relName, referenceTo }
      }));
      return;
    }

    // Plain field — store and wait for Add button
    const prefix = this._drillStack.map(l => l.relationshipName).join('.');
    this._pendingField = prefix ? `${prefix}.${value}` : value;
    this._drillStack = [];
    this._updateDisplayOptions();
  }

  public handleOrderByAdd(e: Event): void {
    e.preventDefault();
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
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
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
  }

  public handleBackOneLevel(): void {
    if (this._drillStack.length <= 1) {
      this._drillStack = [];
      this._updateDisplayOptions();
    } else {
      const newStack = this._drillStack.slice(0, -1);
      this._drillStack = newStack;
      const parentMeta = newStack[newStack.length - 1].metadata;
      if (parentMeta) {
        this._buildDrilledOptions(parentMeta);
      } else {
        this._displayFields = [];
      }
    }
  }

  public handleOrderByRemoved(e: Event): void {
    e.preventDefault();
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    const orderByRemovedEvent = new CustomEvent('orderby__removed', {
      detail: { field: (e.target as HTMLElement).dataset.field }
    });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    this.dispatchEvent(orderByRemovedEvent);
  }
}
