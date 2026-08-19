/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  createInitialSoqlBuilderState,
  type SoqlBuilderHost,
  type SoqlBuilderState,
  type SoqlBuilderStateListener
} from '@salesforce/soql-builder-ui';

const standaloneObjects = ['Account', 'Contact', 'Opportunity'];
const standaloneFields: Record<string, string[]> = {
  Account: ['Id', 'Name', 'Industry', 'Type'],
  Contact: ['Id', 'Name', 'Email', 'AccountId'],
  Opportunity: ['Id', 'Name', 'Amount', 'StageName']
};

const formatQuery = (sObject: string, fields: string[]): string => {
  if (!sObject) {
    return '';
  }
  const selection = fields.length > 0 ? ` ${fields.join(', ')}` : '';
  return `SELECT${selection}\n    FROM ${sObject}`;
};

/** Browser-only adapter proving that the UI package has no VS Code dependency. */
export class StandaloneSoqlBuilderHost implements SoqlBuilderHost {
  public readonly kind = 'standalone';
  private listener: SoqlBuilderStateListener | undefined;
  private state: SoqlBuilderState = createInitialSoqlBuilderState();

  public dispose(): void {
    this.listener = undefined;
  }

  public initialize(listener: SoqlBuilderStateListener): void {
    this.listener = listener;
    this.state = { ...this.state, sObjects: [...standaloneObjects] };
    this.publish();
  }

  public selectFields(fields: string[]): void {
    this.state = {
      ...this.state,
      query: {
        ...this.state.query,
        fields: [...fields],
        originalSoqlStatement: formatQuery(this.state.query.sObject, fields)
      }
    };
    this.publish();
  }

  public selectSObject(sObject: string): void {
    this.state = {
      ...this.state,
      availableFields: [...(standaloneFields[sObject] ?? [])].toSorted(),
      query: {
        fields: [],
        originalSoqlStatement: formatQuery(sObject, []),
        sObject
      }
    };
    this.publish();
  }

  private publish(): void {
    this.listener?.(this.state);
  }
}
