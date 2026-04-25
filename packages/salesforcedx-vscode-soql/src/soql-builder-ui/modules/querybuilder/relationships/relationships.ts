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

export type RelationshipOption = {
  relationshipName: string;
  referenceTo: string[];
};

type ActiveDrill = {
  relationshipName: string;
  referenceTo: string[];
};

export default class Relationships extends LightningElement {
  // Committed relationships (have at least one field in the model)
  @api public relationships: SubqueryJson[] = [];
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    this._relationshipOptions = this._extractRelationshipOptions(metadata);
    this._updateDisplayOptions();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _displayOptions: string[] = [];
  @track public _activeDrill: ActiveDrill | null = null;
  @track private _relationshipOptions: RelationshipOption[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;

  public get i18n() {
    return messages;
  }

  public get isDrilledIn(): boolean {
    return this._activeDrill !== null;
  }

  public get placeholderText(): string {
    return this.isDrilledIn ? messages.placeholder_search_fields : messages.placeholder_search_object;
  }

  public get breadcrumbLabel(): string {
    return this._activeDrill ? `${RELATIONSHIP_PREFIX}${this._activeDrill.relationshipName}` : '';
  }

  public get activeRelationshipFields(): string[] {
    if (!this._activeDrill) return [];
    const rel = (this.relationships || []).find(r => r.relationshipName === this._activeDrill.relationshipName);
    return rel ? rel.fields : [];
  }

  private _updateDisplayOptions(): void {
    if (this._activeDrill) return;
    const activeNames = new Set((this.relationships || []).map(r => r.relationshipName));
    this._displayOptions = this._relationshipOptions
      .filter(r => !activeNames.has(r.relationshipName))
      .map(r => `${RELATIONSHIP_PREFIX}${r.relationshipName}`);
  }

  @api
  public setDrillFields(fields: string[]): void {
    this._displayOptions = fields;
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

    if (!this._activeDrill) {
      if (value.startsWith(RELATIONSHIP_PREFIX)) {
        const relName = value.slice(RELATIONSHIP_PREFIX.length);
        const rel = this._relationshipOptions.find(r => r.relationshipName === relName);
        if (!rel) return;
        this._activeDrill = { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo };
        this._displayOptions = [];
        this.dispatchEvent(new CustomEvent('relationships__loadfields', {
          detail: { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo }
        }));
      }
    } else {
      const { relationshipName } = this._activeDrill;
      const current = (this.relationships || []).find(r => r.relationshipName === relationshipName);
      const currentFields = current ? current.fields : [];
      if (currentFields.includes(value)) return;
      this.dispatchEvent(new CustomEvent('relationships__fieldschanged', {
        detail: { relationshipName, fields: [...currentFields, value] }
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
    const current = (this.relationships || []).find(r => r.relationshipName === relationshipName);
    const newFields = current ? current.fields.filter(f => f !== field) : [];
    this.dispatchEvent(new CustomEvent('relationships__fieldschanged', { detail: { relationshipName, fields: newFields } }));
  }

  public handleRelationshipRemoved(e: Event): void {
    e.preventDefault();
    const relationshipName = (e.target as HTMLElement).dataset.relationship;
    if (!relationshipName) return;
    if (this._activeDrill?.relationshipName === relationshipName) {
      this._activeDrill = null;
      this._updateDisplayOptions();
    }
    this.dispatchEvent(new CustomEvent('relationships__remove', { detail: { relationshipName } }));
  }
}
