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

type SubDrillLevel = {
  relationshipName: string;
  childSObject: string;
};

export default class Fields extends LightningElement {
  @api public set fields(fields: string[]) {
    this._baseFields = fields || [];
    if (!this._isDrilledIntoRel && !this._subDrillStack.length) this._updateDisplayOptions();
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
    if (!this._isDrilledIntoRel && !this._subDrillStack.length) this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayFields: string[] = [];
  @track public _relDrillStack: DrillLevel[] = [];
  @track public _subDrillStack: SubDrillLevel[] = [];

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
    return this._isDrilledIntoRel || this._subDrillStack.length > 0;
  }

  public get breadcrumbLabel(): string {
    if (this._isDrilledIntoRel) return buildBreadcrumb(this._relDrillStack);
    if (this._subDrillStack.length > 0) {
      return this._subDrillStack.map(l => `${SUB_PREFIX}${l.relationshipName}`).join(' ');
    }
    return '';
  }

  public get backArrow(): string {
    return this._subDrillStack.length > 0 ? '→' : '←';
  }

  public get activeRelationshipFields(): string[] {
    if (!this._isDrilledIntoRel) return [];
    const topRelName = this._relDrillStack[0].relationshipName;
    const rel = (this.relationships || []).find(r => r.relationshipName === topRelName);
    return rel ? rel.fields : [];
  }

  public get activeSubqueryFields(): string[] {
    if (!this._subDrillStack.length) return [];
    // Navigate the full drill path to find the fields at the current level
    let node: SubqueryJson | undefined = (this.subqueries || []).find(
      s => s.relationshipName === this._subDrillStack[0].relationshipName
    );
    for (let i = 1; i < this._subDrillStack.length; i++) {
      if (!node) break;
      node = (node.subqueries || []).find(
        s => s.relationshipName === this._subDrillStack[i].relationshipName
      );
    }
    return node ? node.fields : [];
  }

  // Flatten the subquery tree into a list of { groupLabel, fields, relationshipName } for pill rendering
  public get flatSubqueryPillGroups(): Array<{ groupLabel: string; fields: string[]; relationshipName: string }> {
    const result: Array<{ groupLabel: string; fields: string[]; relationshipName: string }> = [];
    const walk = (sqs: SubqueryJson[], prefix: string) => {
      for (const sq of sqs || []) {
        const label = prefix ? `${prefix} ← ${sq.relationshipName}` : sq.relationshipName;
        if (sq.fields.length > 0) {
          result.push({ groupLabel: label, fields: sq.fields, relationshipName: sq.relationshipName });
        }
        walk(sq.subqueries || [], label);
      }
    };
    walk(this.subqueries || [], '');
    return result;
  }

  public get activeSelectedOptions(): string[] {
    if (this._isDrilledIntoRel) return this.activeRelationshipFields;
    if (this._subDrillStack.length > 0) return this.activeSubqueryFields;
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
    // Discard stale responses if the user navigated back
    if (this._relDrillStack.length === 0) return;
    this._relDrillStack = applyDrillMetadata(this._relDrillStack, metadata);
    this._displayFields = buildDrilledOptions(metadata, this._relDrillStack.length);
  }

  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setSubqueryDrillMetadata(metadata: any): void {
    // If the user navigated back before this response arrived, discard it
    if (this._subDrillStack.length === 0) return;
    if (!metadata || !Array.isArray(metadata.fields)) { this._displayFields = []; return; }
    // Store the sObject name on the current top of stack so back-navigation can reload it
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sobjectName: string = metadata.name ?? '';
    if (this._subDrillStack.length > 0) {
      this._subDrillStack = this._subDrillStack.map((l, i) =>
        i === this._subDrillStack.length - 1 ? { ...l, childSObject: sobjectName } : l
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const plain: string[] = (metadata.fields as any[])
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    const subEntries: string[] = ((metadata.childRelationships as any[]) || [])
      .filter((cr: any) => cr.relationshipName && cr.childSObject) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((cr: any) => `${SUB_PREFIX}${cr.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort((a, b) => a.localeCompare(b));
    this._displayFields = [...plain, ...subEntries];
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

    if (this._subDrillStack.length > 0) {
      if (value.startsWith(SUB_PREFIX)) {
        // Drill deeper into a nested child subquery
        const childRelName = value.slice(SUB_PREFIX.length);
        const topRelName = this._subDrillStack[0].relationshipName;
        this._subDrillStack = [...this._subDrillStack, { relationshipName: childRelName, childSObject: '' }];
        this._displayFields = [];
        this.dispatchEvent(new CustomEvent('fields__loadnested', {
          detail: { parentRelationshipName: topRelName, childRelationshipName: childRelName }
        }));
        return;
      }
      // Plain field — dispatch full path so the model can navigate to the correct nested level
      const path = this._subDrillStack.map(l => l.relationshipName);
      this.dispatchEvent(new CustomEvent('fields__subquerychanged', {
        detail: { path, field: value }
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
      this._subDrillStack = [{ relationshipName: child.relationshipName, childSObject: child.childSObject }];
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
    } else if (this._subDrillStack.length > 0) {
      if (this._subDrillStack.length <= 1) {
        this._subDrillStack = [];
        this._updateDisplayOptions();
      } else {
        const newStack = this._subDrillStack.slice(0, -1);
        this._subDrillStack = newStack;
        this._displayFields = [];
        // Reload the parent level's metadata — its childSObject was stored when we received the metadata
        const parentLevel = newStack[newStack.length - 1];
        this.dispatchEvent(new CustomEvent('fields__loadsubquery', {
          detail: { relationshipName: parentLevel.relationshipName, childSObject: parentLevel.childSObject }
        }));
      }
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
    if (this._subDrillStack[0]?.relationshipName === relationshipName) {
      this._subDrillStack = [];
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('fields__subqueryremoved', { detail: { relationshipName } }));
  }
}
