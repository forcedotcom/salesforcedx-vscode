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
export const REL_PREFIX = '→ ';   // parent relationship (drill up)
export const SUB_PREFIX = '← ';   // child subquery (drill down)
const MAX_REL_DEPTH = 5;

type RelDrillLevel = {
  relationshipName: string;
  referenceTo: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
};

type SubDrill = {
  relationshipName: string;
  childSObject: string;
};

export default class Fields extends LightningElement {
  @api public set fields(fields: string[]) {
    this._baseFields = fields || [];
    if (!this._isDrilledIntoRel && !this._subDrill) this._updateDisplayOptions();
  }
  public get fields(): string[] {
    return this._displayFields;
  }

  @api public selectedFields: string[] = [];
  @api public relationships: SubqueryJson[] = [];
  @api public subqueries: SubqueryJson[] = [];
  @api public hasError = false;
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    this._relOptions = this._extractRelOptions(metadata);
    this._childRelOptions = this._extractChildRelOptions(metadata);
    if (!this._isDrilledIntoRel && !this._subDrill) this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayFields: string[] = [];
  @track public _relDrillStack: RelDrillLevel[] = [];
  @track public _subDrill: SubDrill | null = null;

  private _baseFields: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;
  private _relOptions: Array<{ relationshipName: string; referenceTo: string[] }> = [];
  private _childRelOptions: Array<{ relationshipName: string; childSObject: string }> = [];

  public get i18n() {
    return messages;
  }

  public get _isDrilledIntoRel(): boolean {
    return this._relDrillStack.length > 0;
  }

  public get isDrilledIn(): boolean {
    return this._isDrilledIntoRel || this._subDrill !== null;
  }

  public get breadcrumbLabel(): string {
    if (this._isDrilledIntoRel) {
      return this._relDrillStack.map(l => `${REL_PREFIX}${l.relationshipName}`).join(' ');
    }
    if (this._subDrill) {
      return `${SUB_PREFIX}${this._subDrill.relationshipName}`;
    }
    return '';
  }

  public get backArrow(): string {
    // entered subquery by going ←, so returning is →
    return this._subDrill ? '→' : '←';
  }

  public get activeRelationshipFields(): string[] {
    if (!this._isDrilledIntoRel) return [];
    const topRelName = this._relDrillStack[0].relationshipName;
    const rel = (this.relationships || []).find(r => r.relationshipName === topRelName);
    return rel ? rel.fields : [];
  }

  public get activeSubqueryFields(): string[] {
    if (!this._subDrill) return [];
    const sq = (this.subqueries || []).find(s => s.relationshipName === this._subDrill.relationshipName);
    return sq ? sq.fields : [];
  }

  // The selected-options passed to the combobox depends on drill mode
  public get activeSelectedOptions(): string[] {
    if (this._isDrilledIntoRel) return this.activeRelationshipFields;
    if (this._subDrill) return this.activeSubqueryFields;
    return this.selectedFields;
  }

  private _updateDisplayOptions(): void {
    const relEntries = this._relOptions.map(r => `${REL_PREFIX}${r.relationshipName}`);
    const subEntries = this._childRelOptions.map(c => `${SUB_PREFIX}${c.relationshipName}`);
    this._displayFields = [CLEAR_OPTION, SELECT_ALL_OPTION, SELECT_COUNT, ...this._baseFields, ...relEntries, ...subEntries];
  }

  // Called by app with full metadata for a parent relationship sObject
  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDrillMetadata(metadata: any): void {
    if (this._relDrillStack.length === 0) return;
    this._relDrillStack = this._relDrillStack.map((level, i) =>
      i === this._relDrillStack.length - 1 ? { ...level, metadata } : level
    );
    this._buildRelDrilledOptions(metadata);
  }

  // Called by app with field names for a child subquery sObject
  @api
  public setSubqueryDrillFields(fields: string[]): void {
    this._displayFields = fields;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _buildRelDrilledOptions(metadata: any): void {
    if (!metadata || !Array.isArray(metadata.fields)) { this._displayFields = []; return; }
    const plain: string[] = (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.type !== 'reference' || !f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    const refs: string[] = this._relDrillStack.length < MAX_REL_DEPTH
      ? (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
      : [];
    this._displayFields = [...plain, ...refs];
  }

  private _extractRelOptions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any
  ): Array<{ relationshipName: string; referenceTo: string[] }> {
    if (!metadata || !Array.isArray(metadata.fields)) return [];
    return (metadata.fields as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.type === 'reference' && f.relationshipName && Array.isArray(f.referenceTo) && f.referenceTo.length > 0) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ relationshipName: f.relationshipName, referenceTo: f.referenceTo })); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  private _extractChildRelOptions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any
  ): Array<{ relationshipName: string; childSObject: string }> {
    if (!metadata || !Array.isArray(metadata.childRelationships)) return [];
    return (metadata.childRelationships as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((cr: any) => cr.relationshipName && cr.childSObject) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((cr: any) => ({ relationshipName: cr.relationshipName, childSObject: cr.childSObject })); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    // --- Drilled into parent relationship ---
    if (this._isDrilledIntoRel) {
      if (value.startsWith(REL_PREFIX)) {
        // Drill deeper
        const relName = value.slice(REL_PREFIX.length);
        const currentMeta = this._relDrillStack[this._relDrillStack.length - 1].metadata;
        const refField = currentMeta?.fields?.find((f: any) => f.relationshipName === relName); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!refField) return;
        const referenceTo: string[] = refField.referenceTo; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        this._relDrillStack = [...this._relDrillStack, { relationshipName: relName, referenceTo, metadata: null }];
        this._displayFields = [];
        this.dispatchEvent(new CustomEvent('fields__loadrelationship', { detail: { relationshipName: relName, referenceTo } }));
      } else {
        // Plain field — qualify with stack path below top
        const topRelName = this._relDrillStack[0].relationshipName;
        const prefix = this._relDrillStack.slice(1).map(l => l.relationshipName).join('.');
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

    // --- Drilled into child subquery ---
    if (this._subDrill) {
      const { relationshipName } = this._subDrill;
      const current = (this.subqueries || []).find(s => s.relationshipName === relationshipName);
      const currentFields = current ? current.fields : [];
      if (currentFields.includes(value)) return;
      this.dispatchEvent(new CustomEvent('fields__subquerychanged', {
        detail: { relationshipName, fields: [...currentFields, value] }
      }));
      return;
    }

    // --- Top level ---
    if (value.startsWith(REL_PREFIX)) {
      const relName = value.slice(REL_PREFIX.length);
      const rel = this._relOptions.find(r => r.relationshipName === relName);
      if (!rel) return;
      this._relDrillStack = [{ relationshipName: rel.relationshipName, referenceTo: rel.referenceTo, metadata: null }];
      this._displayFields = [];
      this.dispatchEvent(new CustomEvent('fields__loadrelationship', {
        detail: { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo }
      }));
    } else if (value.startsWith(SUB_PREFIX)) {
      const relName = value.slice(SUB_PREFIX.length);
      const child = this._childRelOptions.find(c => c.relationshipName === relName);
      if (!child) return;
      this._subDrill = { relationshipName: child.relationshipName, childSObject: child.childSObject };
      this._displayFields = [];
      this.dispatchEvent(new CustomEvent('fields__loadsubquery', {
        detail: { relationshipName: child.relationshipName, childSObject: child.childSObject }
      }));
    } else if (value.toLowerCase() === SELECT_COUNT.toLowerCase()) {
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: [SELECT_COUNT] } }));
    } else if (value === SELECT_ALL_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__selectall', {}));
    } else if (value === CLEAR_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__clearall', {}));
    } else {
      const selection = this.selectedFields.filter(v => v.toLowerCase() !== SELECT_COUNT.toLowerCase());
      selection.push(value);
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: selection } }));
    }
  }

  public handleBackOneLevel(): void {
    if (this._isDrilledIntoRel) {
      if (this._relDrillStack.length <= 1) {
        this._relDrillStack = [];
        this._updateDisplayOptions();
      } else {
        const newStack = this._relDrillStack.slice(0, -1);
        this._relDrillStack = newStack;
        const parentMeta = newStack[newStack.length - 1].metadata;
        if (parentMeta) {
          this._buildRelDrilledOptions(parentMeta);
        } else {
          this._displayFields = [];
        }
      }
    } else if (this._subDrill) {
      this._subDrill = null;
      this._updateDisplayOptions();
    }
  }

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('fields__selected', {
        detail: { fields: this.selectedFields.filter(v => v !== (e.target as HTMLElement).dataset.field) }
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
    if (this._relDrillStack[0]?.relationshipName === relationshipName) {
      this._relDrillStack = [];
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('fields__relationshipremoved', { detail: { relationshipName } }));
  }

  public handleSubqueryFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const relationshipName = target.dataset.relationship;
    const field = target.dataset.field;
    if (!relationshipName || !field) return;
    const current = (this.subqueries || []).find(s => s.relationshipName === relationshipName);
    const newFields = current ? current.fields.filter(f => f !== field) : [];
    this.dispatchEvent(new CustomEvent('fields__subquerychanged', { detail: { relationshipName, fields: newFields } }));
  }

  public handleSubqueryRemoved(e: Event): void {
    e.preventDefault();
    const relationshipName = (e.target as HTMLElement).dataset.relationship;
    if (!relationshipName) return;
    if (this._subDrill?.relationshipName === relationshipName) {
      this._subDrill = null;
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('fields__subqueryremoved', { detail: { relationshipName } }));
  }
}
