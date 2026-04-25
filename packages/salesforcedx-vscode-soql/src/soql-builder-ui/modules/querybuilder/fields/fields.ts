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
import {
  REL_PREFIX,
  SUB_PREFIX,
  DrillLevel,
  RelOption,
  ChildRelOption,
  buildDrilledOptions,
  applyDrillMetadata,
  buildBreadcrumb,
  buildQualifiedFieldName,
  popDrillStack,
  extractRelOptions,
  extractChildRelOptions,
  findReferenceTo
} from '../services/drillUtils';

export const SELECT_ALL_OPTION = 'ALL FIELDS';
export const CLEAR_OPTION = '- Clear Selection -';
export { REL_PREFIX, SUB_PREFIX };

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
    this._relOptions = extractRelOptions(metadata);
    this._childRelOptions = extractChildRelOptions(metadata);
    if (!this._isDrilledIntoRel && !this._subDrill) this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayFields: string[] = [];
  @track public _relDrillStack: DrillLevel[] = [];
  @track public _subDrill: SubDrill | null = null;

  private _baseFields: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;
  private _relOptions: RelOption[] = [];
  private _childRelOptions: ChildRelOption[] = [];

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
    if (this._isDrilledIntoRel) return buildBreadcrumb(this._relDrillStack);
    if (this._subDrill) return `${SUB_PREFIX}${this._subDrill.relationshipName}`;
    return '';
  }

  public get backArrow(): string {
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

  public get activeSelectedOptions(): string[] {
    if (this._isDrilledIntoRel) return this.activeRelationshipFields;
    if (this._subDrill) return this.activeSubqueryFields;
    return this.selectedFields;
  }

  private _updateDisplayOptions(): void {
    const relEntries = this._relOptions
      .map(r => `${REL_PREFIX}${r.relationshipName}`)
      .sort((a, b) => a.localeCompare(b));
    const subEntries = this._childRelOptions
      .map(c => `${SUB_PREFIX}${c.relationshipName}`)
      .sort((a, b) => a.localeCompare(b));
    this._displayFields = [CLEAR_OPTION, SELECT_ALL_OPTION, SELECT_COUNT, ...this._baseFields, ...relEntries, ...subEntries];
  }

  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDrillMetadata(metadata: any): void {
    if (this._relDrillStack.length === 0) return;
    this._relDrillStack = applyDrillMetadata(this._relDrillStack, metadata);
    this._displayFields = buildDrilledOptions(metadata, this._relDrillStack.length);
  }

  @api
  public setSubqueryDrillFields(fields: string[]): void {
    this._displayFields = fields;
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    if (this._isDrilledIntoRel) {
      if (value.startsWith(REL_PREFIX)) {
        const relName = value.slice(REL_PREFIX.length);
        const currentMeta = this._relDrillStack[this._relDrillStack.length - 1].metadata;
        const referenceTo = findReferenceTo(currentMeta, relName);
        if (!referenceTo) return;
        this._relDrillStack = [...this._relDrillStack, { relationshipName: relName, referenceTo, metadata: null }];
        this._displayFields = [];
        this.dispatchEvent(new CustomEvent('fields__loadrelationship', { detail: { relationshipName: relName, referenceTo } }));
      } else {
        const topRelName = this._relDrillStack[0].relationshipName;
        const qualifiedField = buildQualifiedFieldName(this._relDrillStack.slice(1), value);
        const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
        const currentFields = current ? current.fields : [];
        if (currentFields.includes(qualifiedField)) return;
        this.dispatchEvent(new CustomEvent('fields__relationshipchanged', {
          detail: { relationshipName: topRelName, fields: [...currentFields, qualifiedField] }
        }));
      }
      return;
    }

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
        const newStack = popDrillStack(this._relDrillStack);
        this._relDrillStack = newStack;
        const parentMeta = newStack[newStack.length - 1].metadata;
        this._displayFields = parentMeta ? buildDrilledOptions(parentMeta, newStack.length) : [];
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
