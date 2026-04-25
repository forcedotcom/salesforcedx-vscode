/*
 *  Copyright (c) 2026, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api, track } from 'lwc';
import { SubqueryJson } from '../services/model';
import { messages } from 'querybuilder/messages';

export const RELATIONSHIP_PREFIX = '→ ';
const MAX_DEPTH = 5; // SOQL relationship traversal limit

export type RelationshipOption = {
  relationshipName: string;
  referenceTo: string[];
};

type DrillLevel = {
  relationshipName: string;
  referenceTo: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
};

export default class Relationships extends LightningElement {
  @api public relationships: SubqueryJson[] = [];
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    this._relationshipOptions = this._extractRelationshipOptions(metadata);
    if (this._drillStack.length === 0) {
      this._updateDisplayOptions();
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayOptions: string[] = [];
  @track public _drillStack: DrillLevel[] = [];
  @track private _relationshipOptions: RelationshipOption[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;

  public get i18n() {
    return messages;
  }

  public get isDrilledIn(): boolean {
    return this._drillStack.length > 0;
  }

  public get placeholderText(): string {
    return this.isDrilledIn ? messages.placeholder_search_fields : messages.placeholder_search_object;
  }

  public get breadcrumbLabel(): string {
    return this._drillStack.map(l => `${RELATIONSHIP_PREFIX}${l.relationshipName}`).join(' ');
  }

  // Fields already selected for the top-level relationship we're drilling into
  public get activeRelationshipFields(): string[] {
    if (!this.isDrilledIn) return [];
    const topRelName = this._drillStack[0].relationshipName;
    const rel = (this.relationships || []).find(r => r.relationshipName === topRelName);
    return rel ? rel.fields : [];
  }

  private _updateDisplayOptions(): void {
    if (this.isDrilledIn) return;
    this._displayOptions = this._relationshipOptions.map(r => `${RELATIONSHIP_PREFIX}${r.relationshipName}`);
  }

  // Called by app with full metadata for the newly loaded sObject
  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDrillMetadata(metadata: any): void {
    if (this._drillStack.length === 0) return;
    // Attach metadata to the top of the stack
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._drillStack = this._drillStack.map((level, i) =>
      i === this._drillStack.length - 1 ? { ...level, metadata } : level
    );
    this._buildDrilledOptions(metadata);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _buildDrilledOptions(metadata: any): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!metadata || !Array.isArray(metadata.fields)) {
      this._displayOptions = [];
      return;
    }
    // Plain fields
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const plainFields: string[] = (metadata.fields as any[])
      .filter((f: any) => f.type !== 'reference' || !f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort();
    // Reference fields as → entries (only if not at max depth)
    const refEntries: string[] = this._drillStack.length < MAX_DEPTH
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ? (metadata.fields as any[])
        .filter((f: any) => f.type === 'reference' && f.relationshipName) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((f: any) => `${RELATIONSHIP_PREFIX}${f.relationshipName as string}`) // eslint-disable-line @typescript-eslint/no-explicit-any
      : [];
    this._displayOptions = [...plainFields, ...refEntries];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _extractRelationshipOptions(metadata: any): RelationshipOption[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!metadata || !Array.isArray(metadata.fields)) return [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (metadata.fields as any[])
      .filter((f: any) => f.type === 'reference' && f.relationshipName && Array.isArray(f.referenceTo) && f.referenceTo.length > 0) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        relationshipName: f.relationshipName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        referenceTo: f.referenceTo
      }));
  }

  public handleOptionSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    if (!this.isDrilledIn) {
      // Top level: must be a → entry to drill in
      if (!value.startsWith(RELATIONSHIP_PREFIX)) return;
      const relName = value.slice(RELATIONSHIP_PREFIX.length);
      const rel = this._relationshipOptions.find(r => r.relationshipName === relName);
      if (!rel) return;
      this._drillStack = [{ relationshipName: rel.relationshipName, referenceTo: rel.referenceTo, metadata: null }];
      this._displayOptions = [];
      this.dispatchEvent(new CustomEvent('relationships__loadfields', {
        detail: { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo }
      }));
    } else if (value.startsWith(RELATIONSHIP_PREFIX)) {
      // Drill deeper — find the reference field in the current level's metadata
      const relName = value.slice(RELATIONSHIP_PREFIX.length);
      const currentMeta = this._drillStack[this._drillStack.length - 1].metadata;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const refField = currentMeta?.fields?.find((f: any) => f.relationshipName === relName); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!refField) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const referenceTo: string[] = refField.referenceTo;
      this._drillStack = [...this._drillStack, { relationshipName: relName, referenceTo, metadata: null }];
      this._displayOptions = [];
      this.dispatchEvent(new CustomEvent('relationships__loadfields', {
        detail: { relationshipName: relName, referenceTo }
      }));
    } else {
      // Plain field selection — build the qualified field name from the stack path
      // Top of stack is stack[0] (the model key); deeper levels are the dotted prefix
      const topRelName = this._drillStack[0].relationshipName;
      const prefix = this._drillStack.slice(1).map(l => l.relationshipName).join('.');
      const qualifiedField = prefix ? `${prefix}.${value}` : value;

      const current = (this.relationships || []).find(r => r.relationshipName === topRelName);
      const currentFields = current ? current.fields : [];
      if (currentFields.includes(qualifiedField)) return;
      this.dispatchEvent(new CustomEvent('relationships__fieldschanged', {
        detail: { relationshipName: topRelName, fields: [...currentFields, qualifiedField] }
      }));
    }
  }

  public handleBackOneLevel(): void {
    if (this._drillStack.length <= 1) {
      // Back to top
      this._drillStack = [];
      this._updateDisplayOptions();
    } else {
      // Pop one level and rebuild options from the parent level's metadata
      const newStack = this._drillStack.slice(0, -1);
      this._drillStack = newStack;
      const parentMeta = newStack[newStack.length - 1].metadata;
      if (parentMeta) {
        this._buildDrilledOptions(parentMeta);
      } else {
        this._displayOptions = [];
      }
    }
  }

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const relationshipName = target.dataset.relationship;
    const field = target.dataset.field;
    if (!relationshipName || !field) return;
    const current = (this.relationships || []).find(r => r.relationshipName === relationshipName);
    const newFields = current ? current.fields.filter(f => f !== field) : [];
    this.dispatchEvent(new CustomEvent('relationships__fieldschanged', { detail: { relationshipName, fields: newFields } }));
  }

  public handleRelationshipRemoved(e: Event): void {
    e.preventDefault();
    const relationshipName = (e.target as HTMLElement).dataset.relationship;
    if (!relationshipName) return;
    if (this._drillStack[0]?.relationshipName === relationshipName) {
      this._drillStack = [];
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('relationships__remove', { detail: { relationshipName } }));
  }
}
