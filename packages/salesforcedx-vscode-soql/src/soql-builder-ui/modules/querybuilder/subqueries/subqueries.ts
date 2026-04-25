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

export type ChildRelationshipOption = {
  relationshipName: string;
  childSObject: string;
};

// What relationship we're currently drilled into (null = top-level view)
type ActiveSubqueryDrill = {
  relationshipName: string;
  childSObject: string;
};

export default class Subqueries extends LightningElement {
  @api public subqueries: SubqueryJson[] = [];
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    this._childRelationships = this._extractChildRelationships(metadata);
    this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayOptions: string[] = [];
  @track public _activeDrill: ActiveSubqueryDrill | null = null;
  @track private _childRelationships: ChildRelationshipOption[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;

  public get i18n() {
    return messages;
  }

  public get isDrilledIn(): boolean {
    return this._activeDrill !== null;
  }

  public get breadcrumbLabel(): string {
    return this._activeDrill ? `${RELATIONSHIP_PREFIX}${this._activeDrill.relationshipName}` : '';
  }

  // The raw field names already selected for the drilled-in subquery (used to exclude from dropdown)
  public get activeSubqueryFields(): string[] {
    if (!this._activeDrill) return [];
    const sq = (this.subqueries || []).find(s => s.relationshipName === this._activeDrill.relationshipName);
    return sq ? sq.fields : [];
  }

  // All committed subquery pills to show at top level
  public get hasSubqueries(): boolean {
    return (this.subqueries || []).length > 0;
  }

  private _updateDisplayOptions(): void {
    if (this._activeDrill) return; // drilled-in options are set via setDrillFields()
    const alreadyActive = new Set((this.subqueries || []).map(s => s.relationshipName));
    const relOptions = this._childRelationships
      .filter(cr => !alreadyActive.has(cr.relationshipName))
      .map(cr => `${RELATIONSHIP_PREFIX}${cr.relationshipName}`);
    this._displayOptions = relOptions;
  }

  // Called by app when child sObject fields are ready
  @api
  public setDrillFields(fields: string[]): void {
    this._displayOptions = fields;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _extractChildRelationships(metadata: any): ChildRelationshipOption[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!metadata || !Array.isArray(metadata.childRelationships)) return [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (metadata.childRelationships as any[])
      .filter((cr: any) => cr.relationshipName && cr.childSObject) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((cr: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        relationshipName: cr.relationshipName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        childSObject: cr.childSObject
      }));
  }

  public handleOptionSelection(e: CustomEvent): void {
    e.preventDefault();
    const value: string = e.detail?.value;
    if (!value) return;

    if (!this._activeDrill) {
      // Top-level: selecting a → relationship drills in
      if (value.startsWith(RELATIONSHIP_PREFIX)) {
        const relName = value.slice(RELATIONSHIP_PREFIX.length);
        const rel = this._childRelationships.find(cr => cr.relationshipName === relName);
        if (!rel) return;
        this._activeDrill = { relationshipName: rel.relationshipName, childSObject: rel.childSObject };
        this._displayOptions = [];
        this.dispatchEvent(new CustomEvent('subqueries__loadfields', {
          detail: { relationshipName: rel.relationshipName, childSObject: rel.childSObject }
        }));
      }
    } else {
      // Drilled in: selecting a field adds it to this subquery
      const { relationshipName } = this._activeDrill;
      const current = (this.subqueries || []).find(s => s.relationshipName === relationshipName);
      const currentFields = current ? current.fields : [];
      if (currentFields.includes(value)) return;
      const newFields = [...currentFields, value];
      this.dispatchEvent(new CustomEvent('subqueries__fieldschanged', {
        detail: { relationshipName, fields: newFields }
      }));
    }
  }

  public handleBackToTop(): void {
    this._activeDrill = null;
    this._updateDisplayOptions();
  }

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const relationshipName = target.dataset.relationship;
    const field = target.dataset.field;
    if (!relationshipName || !field) return;
    const current = (this.subqueries || []).find(s => s.relationshipName === relationshipName);
    const newFields = current ? current.fields.filter(f => f !== field) : [];
    this.dispatchEvent(new CustomEvent('subqueries__fieldschanged', { detail: { relationshipName, fields: newFields } }));
  }

  public handleSubqueryRemoved(e: Event): void {
    e.preventDefault();
    const relationshipName = (e.target as HTMLElement).dataset.relationship;
    if (!relationshipName) return;
    // If we were drilled into this one, back out
    if (this._activeDrill?.relationshipName === relationshipName) {
      this._activeDrill = null;
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('subqueries__remove', { detail: { relationshipName } }));
  }
}
