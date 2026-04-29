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
  // Full metadata of the current subquery sObject — used to resolve → referenceTo when inside a subquery
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _subquerySObjectMeta: any = null;
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
    const subPart = this._subDrillStack.length > 0
      ? this._subDrillStack.map(l => `${SUB_PREFIX}${l.relationshipName}`).join(' ')
      : '';
    const relPart = this._isDrilledIntoRel ? buildBreadcrumb(this._relDrillStack) : '';
    if (subPart && relPart) return `${subPart} ${relPart}`;
    return subPart || relPart;
  }

  public get backArrow(): string {
    // In State 3 (both stacks), popping rel → returns toward subquery, so back is ←
    // In State 2 (subquery only), going back goes forward in parent direction →
    // In State 1 (rel only), going back goes ←
    if (this._subDrillStack.length > 0 && !this._isDrilledIntoRel) return '→';
    return '←';
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

  // Flatten relationship fields into layered boxes matching the subquery display style.
  // e.g. Owner.Name → { groupLabel: 'Owner', field: 'Name' }
  //      Owner.Profile.Name → { groupLabel: 'Owner → Profile', field: 'Name' }
  public get flatRelationshipPillGroups(): Array<{ groupLabel: string; fields: string[]; pathKey: string }> {
    const groupMap = new Map<string, string[]>();
    for (const rel of this.relationships || []) {
      for (const field of rel.fields) {
        const parts = field.split('.');
        const leafField = parts[parts.length - 1];
        // Build label: top-level rel name + any intermediate segments joined with →
        // pathKey uniquely identifies this group for removal: topRelName + all segments
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

  // Flatten the subquery tree into a list for pill rendering.
  // Each entry carries the full path so removal handlers can navigate to the correct nested node.
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

  public get activeSelectedOptions(): string[] {
    if (this._isDrilledIntoRel) return this.activeRelationshipFields;
    if (this._subDrillStack.length > 0) return this.activeSubqueryFields;
    return this.selectedFields;
  }

  private _updateDisplayOptions(): void {
    const relEntries = this._relOptions
      .map(r => `${REL_PREFIX}${r.relationshipName}`)
      .sort((a, b) => a.localeCompare(b));
    // Hide ← entries once we've reached the maximum nesting depth
    const subEntries = this._subDrillStack.length < MAX_SUBQUERY_DEPTH
      ? this._childRelOptions
        .map(c => `${SUB_PREFIX}${c.relationshipName}`)
        .sort((a, b) => a.localeCompare(b))
      : [];
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
    this._subquerySObjectMeta = metadata;
    if (this._subDrillStack.length > 0) {
      this._subDrillStack = this._subDrillStack.map((l, i) =>
        i === this._subDrillStack.length - 1 ? { ...l, childSObject: sobjectName } : l
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const plain: string[] = (metadata.fields as any[])
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    const subEntries: string[] = this._subDrillStack.length < MAX_SUBQUERY_DEPTH
      ? ((metadata.childRelationships as any[]) || [])
        .filter((cr: any) => cr.relationshipName && cr.childSObject) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((cr: any) => `${SUB_PREFIX}${cr.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
        .sort((a, b) => a.localeCompare(b))
      : [];
    // Also offer → parent relationships within this subquery sObject
    const relEntries: string[] = (metadata.fields as any[])
      .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort((a, b) => a.localeCompare(b));
    this._displayFields = [...plain, ...relEntries, ...subEntries];
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    // State 3: inside a subquery AND following a → relationship within it
    if (this._isDrilledIntoRel && this._subDrillStack.length > 0) {
      if (value.startsWith(REL_PREFIX)) {
        // Drill deeper up the rel chain within the subquery
        const relName = value.slice(REL_PREFIX.length);
        const currentMeta = this._relDrillStack[this._relDrillStack.length - 1].metadata;
        const referenceTo = findReferenceTo(currentMeta, relName);
        if (!referenceTo) return;
        this._relDrillStack = [...this._relDrillStack, { relationshipName: relName, referenceTo, metadata: null }];
        this._displayFields = [];
        this.dispatchEvent(new CustomEvent('fields__loadrelationship', { detail: { relationshipName: relName, referenceTo } }));
      } else {
        // Plain field — qualified relative to the rel stack, stored in the subquery
        const relPrefix = buildQualifiedFieldName(this._relDrillStack, value);
        const path = this._subDrillStack.map(l => l.relationshipName);
        this.dispatchEvent(new CustomEvent('fields__subquerychanged', {
          detail: { path, field: relPrefix }
        }));
      }
      return;
    }

    // State 1: drilled into a top-level relationship (not inside a subquery)
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

    // State 2: drilled into a subquery (no rel stack yet)
    if (this._subDrillStack.length > 0) {
      if (value.startsWith(REL_PREFIX)) {
        // Enter a → relationship within this subquery sObject
        const relName = value.slice(REL_PREFIX.length);
        const referenceTo = findReferenceTo(this._subquerySObjectMeta, relName);
        if (!referenceTo) return;
        this._relDrillStack = [{ relationshipName: relName, referenceTo, metadata: null }];
        this._displayFields = [];
        this.dispatchEvent(new CustomEvent('fields__loadrelationship', { detail: { relationshipName: relName, referenceTo } }));
        return;
      }
      if (value.startsWith(SUB_PREFIX)) {
        // Drill deeper into a nested child subquery
        if (this._subDrillStack.length >= MAX_SUBQUERY_DEPTH) return;
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
        if (this._subDrillStack.length > 0) {
          // Return to State 2: restore the subquery sObject's display using cached metadata
          if (this._subquerySObjectMeta) {
            // Re-invoke the same logic as setSubqueryDrillMetadata to rebuild _displayFields
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const plain: string[] = (this._subquerySObjectMeta.fields as any[])
              .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
              .sort();
            const subEntries: string[] = this._subDrillStack.length < MAX_SUBQUERY_DEPTH
              ? ((this._subquerySObjectMeta.childRelationships as any[]) || [])
                .filter((cr: any) => cr.relationshipName && cr.childSObject) // eslint-disable-line @typescript-eslint/no-explicit-any
                .map((cr: any) => `${SUB_PREFIX}${cr.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
                .sort((a, b) => a.localeCompare(b))
              : [];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const relEntries: string[] = (this._subquerySObjectMeta.fields as any[])
              .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
              .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
              .sort((a, b) => a.localeCompare(b));
            this._displayFields = [...plain, ...relEntries, ...subEntries];
          }
        } else {
          this._updateDisplayOptions();
        }
      } else {
        const newStack = popDrillStack(this._relDrillStack);
        this._relDrillStack = newStack;
        const parentMeta = newStack[newStack.length - 1].metadata;
        this._displayFields = parentMeta ? buildDrilledOptions(parentMeta, newStack.length) : [];
      }
    } else if (this._subDrillStack.length > 0) {
      if (this._subDrillStack.length <= 1) {
        this._subDrillStack = [];
        this._relDrillStack = [];
        this._subquerySObjectMeta = null;
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

  // Remove all fields under a given path prefix from the relationship entry
  public handleRelationshipGroupRemoved(e: Event): void {
    e.preventDefault();
    const pathKey = (e.target as HTMLElement).dataset.path;
    if (!pathKey) return;
    const parts = pathKey.split('|');
    const topRelName = parts[0];
    // The dotted prefix to match (empty for top-level, e.g. "Profile" for Owner|Profile)
    const dotPrefix = parts.slice(1).join('.');
    const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
    if (!current) return;
    const newFields = current.fields.filter(f => {
      const fieldPrefix = f.includes('.') ? f.substring(0, f.lastIndexOf('.')) : '';
      return dotPrefix ? fieldPrefix !== dotPrefix && !fieldPrefix.startsWith(`${dotPrefix}.`) : fieldPrefix !== '';
    });
    if (newFields.length === current.fields.length) {
      // All fields are under this prefix — remove the whole relationship
      this.dispatchEvent(new CustomEvent('fields__relationshipremoved', { detail: { relationshipName: topRelName } }));
    } else if (newFields.length === 0) {
      this.dispatchEvent(new CustomEvent('fields__relationshipremoved', { detail: { relationshipName: topRelName } }));
    } else {
      this.dispatchEvent(new CustomEvent('fields__relationshipchanged', { detail: { relationshipName: topRelName, fields: newFields } }));
    }
  }

  // Remove a single leaf field identified by pathKey + field name
  public handleRelationshipPillFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const pathKey = target.dataset.path;
    const leafField = target.dataset.field;
    if (!pathKey || !leafField) return;
    const parts = pathKey.split('|');
    const topRelName = parts[0];
    // Reconstruct the full dotted field name stored in the model
    const dotPrefix = parts.slice(1).join('.');
    const fullField = dotPrefix ? `${dotPrefix}.${leafField}` : leafField;
    const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
    const newFields = current ? current.fields.filter(f => f !== fullField) : [];
    this.dispatchEvent(new CustomEvent('fields__relationshipchanged', { detail: { relationshipName: topRelName, fields: newFields } }));
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
    const pathKey = target.dataset.path;
    const field = target.dataset.field;
    if (!pathKey || !field) return;
    const path = pathKey.split('|');
    // Navigate to the correct node to get current fields
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
      this._updateDisplayOptions();
    }
    // Clear only this box's fields (not nested children) — mirrors relationship box behaviour
    this.dispatchEvent(new CustomEvent('fields__subqueryclear', { detail: { path } }));
  }
}
