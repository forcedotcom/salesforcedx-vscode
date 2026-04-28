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
  MAX_DRILL_DEPTH,
  MAX_SUBQUERY_DEPTH,
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
    if (!this._isDrilledIntoRel && !this._subDrillStack.length) this._updateColumns();
  }
  public get fields(): string[] {
    return this._middleItems;
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
    if (!this._isDrilledIntoRel && !this._subDrillStack.length) this._updateColumns();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _leftItems: string[] = [];    // child sObjects / subquery options
  @track public _middleItems: string[] = [];  // base fields
  @track public _rightItems: string[] = [];   // parent relationship options
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

  // The fields already committed for the active rel/subquery drill (to show as selected in middle)
  public get activeSelectedOptions(): string[] {
    if (this._isDrilledIntoRel) {
      const topRelName = this._relDrillStack[0].relationshipName;
      const rel = (this.relationships || []).find(r => r.relationshipName === topRelName);
      return rel ? rel.fields : [];
    }
    if (this._subDrillStack.length > 0) {
      let node: SubqueryJson | undefined = (this.subqueries || []).find(
        s => s.relationshipName === this._subDrillStack[0].relationshipName
      );
      for (let i = 1; i < this._subDrillStack.length; i++) {
        if (!node) break;
        node = (node.subqueries || []).find(s => s.relationshipName === this._subDrillStack[i].relationshipName);
      }
      return node ? node.fields : [];
    }
    return this.selectedFields;
  }

  public get hasLeftItems(): boolean {
    return this._leftItems.length > 0;
  }

  public get hasRightItems(): boolean {
    return this._rightItems.length > 0;
  }

  // ---- Pill group getters (unchanged from before) ----

  public get flatRelationshipPillGroups(): Array<{ groupLabel: string; fields: string[]; pathKey: string }> {
    const groupMap = new Map<string, string[]>();
    for (const rel of this.relationships || []) {
      for (const field of rel.fields) {
        const parts = field.split('.');
        const leafField = parts[parts.length - 1];
        const pathKey = [rel.relationshipName, ...parts.slice(0, -1)].join('|');
        if (!groupMap.has(pathKey)) groupMap.set(pathKey, []);
        groupMap.get(pathKey)!.push(leafField);
      }
    }
    return Array.from(groupMap.entries()).map(([pathKey, fields]) => ({
      groupLabel: pathKey.split('|').join(' → '),
      fields,
      pathKey
    }));
  }

  public get flatSubqueryPillGroups(): Array<{ groupLabel: string; fields: string[]; path: string[]; pathKey: string }> {
    const result: Array<{ groupLabel: string; fields: string[]; path: string[]; pathKey: string }> = [];
    const walk = (sqs: SubqueryJson[], prefix: string, pathSoFar: string[]) => {
      for (const sq of sqs || []) {
        const label = prefix ? `${prefix} ← ${sq.relationshipName}` : sq.relationshipName;
        const path = [...pathSoFar, sq.relationshipName];
        if (sq.fields.length > 0) {
          result.push({ groupLabel: label, fields: sq.fields, path, pathKey: path.join('|') });
        }
        walk(sq.subqueries || [], label, path);
      }
    };
    walk(this.subqueries || [], '', []);
    return result;
  }

  // ---- Column population ----

  private _updateColumns(): void {
    // Left: child sObjects available to subquery into
    this._leftItems = this._subDrillStack.length < MAX_SUBQUERY_DEPTH
      ? this._childRelOptions.map(c => c.relationshipName).sort((a, b) => a.localeCompare(b))
      : [];

    // Middle: base fields + special options
    this._middleItems = [CLEAR_OPTION, SELECT_ALL_OPTION, SELECT_COUNT, ...this._baseFields];

    // Right: parent relationships available to traverse
    this._rightItems = this._relOptions.map(r => r.relationshipName).sort((a, b) => a.localeCompare(b));
  }

  // Called after drilling into a parent relationship sObject
  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDrillMetadata(metadata: any): void {
    if (this._relDrillStack.length === 0) return;
    this._relDrillStack = applyDrillMetadata(this._relDrillStack, metadata);
    const drilled = buildDrilledOptions(metadata, this._relDrillStack.length);
    // Separate plain fields from further → entries
    this._middleItems = drilled.filter(f => !f.startsWith(REL_PREFIX));
    this._rightItems = this._relDrillStack.length < MAX_DRILL_DEPTH
      ? drilled.filter(f => f.startsWith(REL_PREFIX)).map(f => f.slice(REL_PREFIX.length))
      : [];
    // No sub-drilling while in a relationship
    this._leftItems = [];
  }

  // Called after drilling into a child subquery sObject
  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setSubqueryDrillMetadata(metadata: any): void {
    if (this._subDrillStack.length === 0) return;
    if (!metadata || !Array.isArray(metadata.fields)) {
      this._leftItems = [];
      this._middleItems = [];
      this._rightItems = [];
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sobjectName: string = metadata.name ?? '';
    this._subDrillStack = this._subDrillStack.map((l, i) =>
      i === this._subDrillStack.length - 1 ? { ...l, childSObject: sobjectName } : l
    );

    // Middle: plain fields of drilled sObject
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this._middleItems = (metadata.fields as any[])
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();

    // Left: child relationships of this sObject (for further nesting)
    this._leftItems = this._subDrillStack.length < MAX_SUBQUERY_DEPTH
      ? ((metadata.childRelationships as any[]) || [])
        .filter((cr: any) => cr.relationshipName && cr.childSObject) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((cr: any) => cr.relationshipName as string) // eslint-disable-line @typescript-eslint/no-explicit-any
        .sort((a, b) => a.localeCompare(b))
      : [];

    // Right: parent relationships of this sObject
    this._rightItems = ((metadata.fields as any[]) || [])
      .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.relationshipName as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort((a, b) => a.localeCompare(b));
  }

  // ---- Column click handlers ----

  public handleLeftItemClick(e: Event): void {
    e.preventDefault();
    const name = (e.target as HTMLElement).dataset.name;
    if (!name) return;

    if (this._isDrilledIntoRel) {
      // Not applicable while drilling into a relationship
      return;
    }

    if (this._subDrillStack.length > 0) {
      // Drill deeper into a nested child subquery
      if (this._subDrillStack.length >= MAX_SUBQUERY_DEPTH) return;
      const topRelName = this._subDrillStack[0].relationshipName;
      this._subDrillStack = [...this._subDrillStack, { relationshipName: name, childSObject: '' }];
      this._leftItems = [];
      this._middleItems = [];
      this._rightItems = [];
      this.dispatchEvent(new CustomEvent('fields__loadnested', {
        detail: { parentRelationshipName: topRelName, childRelationshipName: name }
      }));
      return;
    }

    // Top level: drill into this child subquery
    const child = this._childRelOptions.find(c => c.relationshipName === name);
    if (!child) return;
    this._subDrillStack = [{ relationshipName: child.relationshipName, childSObject: child.childSObject }];
    this._leftItems = [];
    this._middleItems = [];
    this._rightItems = [];
    this.dispatchEvent(new CustomEvent('fields__loadsubquery', {
      detail: { relationshipName: child.relationshipName, childSObject: child.childSObject }
    }));
  }

  public handleMiddleItemClick(e: Event): void {
    e.preventDefault();
    const value = (e.target as HTMLElement).dataset.name;
    if (!value) return;

    if (this._isDrilledIntoRel) {
      // Select a field for the active relationship drill
      const topRelName = this._relDrillStack[0].relationshipName;
      const qualifiedField = buildQualifiedFieldName(this._relDrillStack.slice(1), value);
      const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
      const currentFields = current ? current.fields : [];
      if (currentFields.includes(qualifiedField)) return;
      this.dispatchEvent(new CustomEvent('fields__relationshipchanged', {
        detail: { relationshipName: topRelName, fields: [...currentFields, qualifiedField] }
      }));
      return;
    }

    if (this._subDrillStack.length > 0) {
      // Select a field for the active subquery drill
      const path = this._subDrillStack.map(l => l.relationshipName);
      this.dispatchEvent(new CustomEvent('fields__subquerychanged', {
        detail: { path, field: value }
      }));
      return;
    }

    // Top level field selection
    if (value.toLowerCase() === SELECT_COUNT.toLowerCase()) {
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: [SELECT_COUNT] } }));
    } else if (value === SELECT_ALL_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__selectall', {}));
    } else if (value === CLEAR_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__clearall', {}));
    } else {
      const selection = this.selectedFields.filter(v => v.toLowerCase() !== SELECT_COUNT.toLowerCase());
      if (selection.includes(value)) return;
      selection.push(value);
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: selection } }));
    }
  }

  public handleRightItemClick(e: Event): void {
    e.preventDefault();
    const name = (e.target as HTMLElement).dataset.name;
    if (!name) return;

    if (this._isDrilledIntoRel) {
      // Drill deeper into a parent relationship
      if (this._relDrillStack.length >= MAX_DRILL_DEPTH) return;
      const currentMeta = this._relDrillStack[this._relDrillStack.length - 1].metadata;
      const referenceTo = findReferenceTo(currentMeta, name);
      if (!referenceTo) return;
      this._relDrillStack = [...this._relDrillStack, { relationshipName: name, referenceTo, metadata: null }];
      this._leftItems = [];
      this._middleItems = [];
      this._rightItems = [];
      this.dispatchEvent(new CustomEvent('fields__loadrelationship', { detail: { relationshipName: name, referenceTo } }));
      return;
    }

    if (this._subDrillStack.length > 0) {
      // Drill into a parent relationship of the subquery's sObject
      // For now load it as a nested rel-within-subquery (rare but valid)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const currentMeta = this._sobjectMetadata;
      const referenceTo = findReferenceTo(currentMeta, name);
      if (!referenceTo) return;
      this._relDrillStack = [{ relationshipName: name, referenceTo, metadata: null }];
      this._leftItems = [];
      this._middleItems = [];
      this._rightItems = [];
      this.dispatchEvent(new CustomEvent('fields__loadrelationship', { detail: { relationshipName: name, referenceTo } }));
      return;
    }

    // Top level: drill into this parent relationship
    const rel = this._relOptions.find(r => r.relationshipName === name);
    if (!rel) return;
    this._relDrillStack = [{ relationshipName: rel.relationshipName, referenceTo: rel.referenceTo, metadata: null }];
    this._leftItems = [];
    this._middleItems = [];
    this._rightItems = [];
    this.dispatchEvent(new CustomEvent('fields__loadrelationship', {
      detail: { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo }
    }));
  }

  public handleBackOneLevel(): void {
    if (this._isDrilledIntoRel) {
      if (this._relDrillStack.length <= 1) {
        this._relDrillStack = [];
        this._updateColumns();
      } else {
        const newStack = popDrillStack(this._relDrillStack);
        this._relDrillStack = newStack;
        const parentMeta = newStack[newStack.length - 1].metadata;
        if (parentMeta) {
          const drilled = buildDrilledOptions(parentMeta, newStack.length);
          this._middleItems = drilled.filter(f => !f.startsWith(REL_PREFIX));
          this._rightItems = newStack.length < MAX_DRILL_DEPTH
            ? drilled.filter(f => f.startsWith(REL_PREFIX)).map(f => f.slice(REL_PREFIX.length))
            : [];
          this._leftItems = [];
        } else {
          this._leftItems = [];
          this._middleItems = [];
          this._rightItems = [];
        }
      }
    } else if (this._subDrillStack.length > 0) {
      if (this._subDrillStack.length <= 1) {
        this._subDrillStack = [];
        this._updateColumns();
      } else {
        const newStack = this._subDrillStack.slice(0, -1);
        this._subDrillStack = newStack;
        this._leftItems = [];
        this._middleItems = [];
        this._rightItems = [];
        const parentLevel = newStack[newStack.length - 1];
        this.dispatchEvent(new CustomEvent('fields__loadsubquery', {
          detail: { relationshipName: parentLevel.relationshipName, childSObject: parentLevel.childSObject }
        }));
      }
    }
  }

  // ---- Pill removal handlers (unchanged logic) ----

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('fields__selected', {
        detail: { fields: this.selectedFields.filter(v => v !== (e.target as HTMLElement).dataset.field) }
      })
    );
  }

  public handleRelationshipGroupRemoved(e: Event): void {
    e.preventDefault();
    const pathKey = (e.target as HTMLElement).dataset.path;
    if (!pathKey) return;
    const parts = pathKey.split('|');
    const topRelName = parts[0];
    const dotPrefix = parts.slice(1).join('.');
    const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
    if (!current) return;
    const newFields = current.fields.filter(f => {
      const fieldPrefix = f.includes('.') ? f.substring(0, f.lastIndexOf('.')) : '';
      return dotPrefix ? fieldPrefix !== dotPrefix && !fieldPrefix.startsWith(`${dotPrefix}.`) : fieldPrefix !== '';
    });
    if (newFields.length === 0) {
      this.dispatchEvent(new CustomEvent('fields__relationshipremoved', { detail: { relationshipName: topRelName } }));
    } else {
      this.dispatchEvent(new CustomEvent('fields__relationshipchanged', { detail: { relationshipName: topRelName, fields: newFields } }));
    }
  }

  public handleRelationshipPillFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const pathKey = target.dataset.path;
    const leafField = target.dataset.field;
    if (!pathKey || !leafField) return;
    const parts = pathKey.split('|');
    const topRelName = parts[0];
    const dotPrefix = parts.slice(1).join('.');
    const fullField = dotPrefix ? `${dotPrefix}.${leafField}` : leafField;
    const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
    const newFields = current ? current.fields.filter(f => f !== fullField) : [];
    this.dispatchEvent(new CustomEvent('fields__relationshipchanged', { detail: { relationshipName: topRelName, fields: newFields } }));
  }

  public handleSubqueryFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const pathKey = target.dataset.path;
    const field = target.dataset.field;
    if (!pathKey || !field) return;
    const path = pathKey.split('|');
    let node: SubqueryJson | undefined = (this.subqueries || []).find(s => s.relationshipName === path[0]);
    for (let i = 1; i < path.length; i++) {
      if (!node) break;
      node = (node.subqueries || []).find(s => s.relationshipName === path[i]);
    }
    const newFields = node ? node.fields.filter(f => f !== field) : [];
    this.dispatchEvent(new CustomEvent('fields__subquerychanged', { detail: { path, fields: newFields } }));
  }

  public handleSubqueryRemoved(e: Event): void {
    e.preventDefault();
    const pathKey = (e.target as HTMLElement).dataset.path;
    if (!pathKey) return;
    const path = pathKey.split('|');
    const topRelName = path[0];
    if (this._subDrillStack[0]?.relationshipName === topRelName) {
      this._subDrillStack = [];
      this._updateColumns();
    }
    this.dispatchEvent(new CustomEvent('fields__subqueryclear', { detail: { path } }));
  }
}
