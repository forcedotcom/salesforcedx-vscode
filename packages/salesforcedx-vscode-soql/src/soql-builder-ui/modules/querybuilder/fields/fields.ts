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
import { SELECT_COUNT } from '../services/model';
import { messages } from 'querybuilder/messages';

export const SELECT_ALL_OPTION = 'ALL FIELDS';
export const CLEAR_OPTION = '- Clear Selection -';
export const RELATIONSHIP_PREFIX = '→ ';

export type RelationshipField = {
  relationshipName: string;
  referenceTo: string[];
};

export default class Fields extends LightningElement {
  @api public set fields(fields: string[]) {
    this._baseFields = fields || [];
    this._updateDisplayFields();
  }
  public get fields(): string[] {
    return this._displayFields;
  }
  @api public selectedFields: string[] = [];
  @api public hasError = false;
  @api public isLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public set sobjectMetadata(metadata: any) {
    this._sobjectMetadata = metadata;
    this._relationshipFields = this._extractRelationshipFields(metadata);
    this._updateDisplayFields();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get sobjectMetadata(): any {
    return this._sobjectMetadata;
  }

  @track public _activeRelationship: RelationshipField | null = null;
  @track public _displayFields: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sobjectMetadata: any = null;
  private _baseFields: string[] = [];
  private _relationshipFields: RelationshipField[] = [];

  public selectPlaceHolderText = messages.placeholder_search_fields;

  public get i18n() {
    return messages;
  }
  public _displayFieldsBase: string[];

  public get breadcrumbLabel(): string {
    return this._activeRelationship ? `${RELATIONSHIP_PREFIX}${this._activeRelationship.relationshipName}` : '';
  }

  public get isDrilledIn(): boolean {
    return this._activeRelationship !== null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _extractRelationshipFields(metadata: any): RelationshipField[] {
    if (!metadata || !Array.isArray(metadata.fields)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return metadata.fields
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) =>
          f.type === 'reference' &&
          f.relationshipName &&
          Array.isArray(f.referenceTo) &&
          f.referenceTo.length > 0
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({
        relationshipName: f.relationshipName as string,
        referenceTo: f.referenceTo as string[]
      }));
  }

  private _updateDisplayFields(): void {
    if (this._activeRelationship) {
      // When drilled in, fields are set externally via setParentFields()
      return;
    }
    const relOptions = this._relationshipFields.map(r => `${RELATIONSHIP_PREFIX}${r.relationshipName}`);
    this._displayFields = [
      CLEAR_OPTION,
      SELECT_ALL_OPTION,
      SELECT_COUNT,
      ...this._baseFields,
      ...relOptions
    ];
  }

  public handleFieldSelection(e: CustomEvent): void {
    e.preventDefault();
    if (!e.detail || !e.detail.value) return;

    const value: string = e.detail.value;

    if (value.startsWith(RELATIONSHIP_PREFIX)) {
      const relName = value.slice(RELATIONSHIP_PREFIX.length);
      const rel = this._relationshipFields.find(r => r.relationshipName === relName);
      if (rel) {
        this._activeRelationship = rel;
        const loadRelEvent = new CustomEvent('fields__loadrelationship', {
          detail: { relationshipName: rel.relationshipName, referenceTo: rel.referenceTo }
        });
        this.dispatchEvent(loadRelEvent);
      }
      return;
    }

    let selection = [];
    if (value.toLowerCase() === SELECT_COUNT.toLowerCase()) {
      selection.push(SELECT_COUNT);
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: selection } }));
    } else if (value === SELECT_ALL_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__selectall', {}));
    } else if (value === CLEAR_OPTION) {
      this.dispatchEvent(new CustomEvent('fields__clearall', {}));
    } else {
      selection = this.selectedFields.filter(
        (v) => v.toLowerCase() !== SELECT_COUNT.toLowerCase()
      );
      // Prefix with relationship name when drilled in
      const fieldToAdd = this._activeRelationship
        ? `${this._activeRelationship.relationshipName}.${value}`
        : value;
      selection.push(fieldToAdd);
      this.dispatchEvent(new CustomEvent('fields__selected', { detail: { fields: selection } }));
    }
  }

  public handleBackToBase(): void {
    this._activeRelationship = null;
    this._updateDisplayFields();
  }

  // Called by app when parent sObject fields are loaded
  @api
  public setParentFields(fields: string[]): void {
    this._displayFields = [...fields];
  }

  public handleFieldRemoved(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('fields__selected', {
        detail: {
          fields: this.selectedFields.filter(
            (value) => value !== (e.target as HTMLElement).dataset.field
          )
        }
      })
    );
  }
}
