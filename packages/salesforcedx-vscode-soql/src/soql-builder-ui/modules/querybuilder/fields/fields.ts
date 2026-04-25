/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api, track } from 'lwc';
import { SubqueryJson, SELECT_COUNT } from '../services/model';
import { messages } from 'querybuilder/messages';

export const SELECT_ALL_OPTION = 'ALL FIELDS';
export const CLEAR_OPTION = '- Clear Selection -';
export const RELATIONSHIP_PREFIX = '→ ';
const MAX_DEPTH = 5;

type DrillLevel = {
  relationshipName: string;
  referenceTo: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
};

export default class Fields extends LightningElement {
  @api public set fields(fields: string[]) {
    this._baseFields = fields || [];
    if (!this.isDrilledIn) this._updateDisplayOptions();
  }
  public get fields(): string[] {
    return this._displayFields;
  }

  @api public selectedFields: string[] = [];
  @api public relationships: SubqueryJson[] = [];
  @api public hasError = false;
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    this._relationshipOptions = this._extractRelationshipOptions(metadata);
    if (!this.isDrilledIn) this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayFields: string[] = [];
  @track public _drillStack: DrillLevel[] = [];

  private _baseFields: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;
  private _relationshipOptions: Array<{ relationshipName: string; referenceTo: string[] }> = [];

  public get i18n() {
    return messages;
  }

  public get isDrilledIn(): boolean {
    return this._drillStack.length > 0;
  }

  public get placeholderText(): string {
    return this.isDrilledIn ? messages.placeholder_search_fields : messages.placeholder_search_fields;
  }

  public get breadcrumbLabel(): string {
    return this._drillStack.map(l => `${RELATIONSHIP_PREFIX}${l.relationshipName}`).join(' ');
  }

  public get activeRelationshipFields(): string[] {
    if (!this.isDrilledIn) return [];
    const topRelName = this._drillStack[0].relationshipName;
    const rel = (this.relationships || []).find(r => r.relationshipName === topRelName);
    return rel ? rel.fields : [];
  }

  private _updateDisplayOptions(): void {
    const relOptions = this._relationshipOptions.map(r => `${RELATIONSHIP_PREFIX}${r.relationshipName}`);
    this._displayFields = [CLEAR_OPTION, SELECT_ALL_OPTION, SELECT_COUNT, ...this._baseFields, ...relOptions];
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const plain: string[] = (metadata.fields as any[])
      .filter((f: any) => f.type !== 'reference' || !f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    const refs: string[] = this._drillStack.length < MAX_DEPTH
      ? (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((f: any) => `${RELATIONSHIP_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
      : [];
    this._displayFields = [...plain, ...refs];
  }

  private _extractRelationshipOptions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any
  ): Array<{ relationshipName: string; referenceTo: string[] }> {
    if (!metadata || !Array.isArray(metadata.fields)) return [];
    return (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.type === 'reference' && f.relationshipName && Array.isArray(f.referenceTo) && f.referenceTo.length > 0) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ relationshipName: f.relationshipName, referenceTo: f.referenceTo })); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    // --- Drilled-in mode ---
    if (this.isDrilledIn) {
      if (value.startsWith(RELATIONSHIP_PREFIX)) {
        // Drill deeper
        const relName = value.slice(RELATIONSHIP_PREFIX.length);
        const currentMeta = this._drillStack[this._drillStack.length - 1].metadata;
        const refField = currentMeta?.fields?.find((f: any) => f.relationshipName === relName); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!refField) return;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const referenceTo: string[] = refField.referenceTo;
        this._drillStack = [...this._drillStack, { relationshipName: relName, referenceTo, metadata: null }];
        this._displayFields = [];
        this.dispatchEvent(new CustomEvent('fields__loadrelationship', {
          detail: { relationshipName: relName, referenceTo }
        }));
      } else {
        // Plain field — store qualified under top-level relationship
        const topRelName = this._drillStack[0].relationshipName;
        const prefix = this._drillStack.slice(1).map(l => l.relationshipName).join('.');
        const qualifiedField = prefix ? `${prefix}.${value}` : value;
        const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
        const currentFields = current ? current.fields : [];
        if (currentFields.includes(qualifiedField)) return;
        this.dispatchEvent(new CustomEvent('fields__relationshipchanged', {
          detail: { relationshipName: topRelName, fields: [...currentFields, qualifiedField] }
        }));
      }
      return;
    }

    // --- Top-level mode ---
    if (value.startsWith(RELATIONSHIP_PREFIX)) {
      const relName = value.slice(RELATIONSHIP_PREFIX.length);
      const rel = this._relationshipOptions.find(r => r.relationshipName === relName);
      if (!rel) return;
      this._drillStack = [{ relationshipName: rel.relationshipName, referenceTo: rel.referenceTo, metadata: null }];
      this._displayFields = [];
      this.dispatchEvent(new CustomEvent('fields__loadrelationship', {
        detail: { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo }
      }));
    } else if (value.toLowerCase() === SELECT_COUNT.toLowerCase()) {
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: [SELECT_COUNT] } }));
    } else if (value === SELECT_ALL_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__selectall', {}));
    } else if (value === CLEAR_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__clearall', {}));
    } else {
      const selection = this.selectedFields.filter(
        v => v.toLowerCase() !== SELECT_COUNT.toLowerCase()
      );
      selection.push(value);
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: selection } }));
    }
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

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('fields__selected', {
        detail: {
          fields: this.selectedFields.filter(
            v => v !== (e.target as HTMLElement).dataset.field
          )
        }
      })
    );
  }

  public handleRelationshipFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const relationshipName = target.dataset.relationship;
    const field = target.dataset.field;
    if (!relationshipName || !field) return;
    const current = (this.relationships || []).find(r => r.relationshipName === relationshipName);
    const newFields = current ? current.fields.filter(f => f !== field) : [];
    this.dispatchEvent(new CustomEvent('fields__relationshipchanged', { detail: { relationshipName, fields: newFields } }));
  }

  public handleRelationshipRemoved(e: Event): void {
    e.preventDefault();
    const relationshipName = (e.target as HTMLElement).dataset.relationship;
    if (!relationshipName) return;
    if (this._drillStack[0]?.relationshipName === relationshipName) {
      this._drillStack = [];
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('fields__relationshipremoved', { detail: { relationshipName } }));
  }
}
