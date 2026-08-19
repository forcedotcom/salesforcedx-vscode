/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type SoqlBuilderQuery = {
  fields: string[];
  originalSoqlStatement: string;
  sObject: string;
};

export type SoqlBuilderState = {
  availableFields: string[];
  errorMessage?: string;
  hasNoDefaultOrg: boolean;
  isFieldsLoading: boolean;
  isObjectsLoading: boolean;
  query: SoqlBuilderQuery;
  sObjects: string[];
};

export type SoqlBuilderStateListener = (state: SoqlBuilderState) => void;

/**
 * Boundary implemented by each runtime that hosts the framework-driven app.
 * The UI package deliberately has no knowledge of VS Code or transport messages.
 */
export interface SoqlBuilderHost {
  readonly kind: string;
  dispose(): Promise<void> | void;
  initialize(listener: SoqlBuilderStateListener): Promise<void> | void;
  selectFields(fields: string[]): void;
  selectSObject(sObject: string): void;
}

export type SoqlBuilderLabels = {
  fields: string;
  from: string;
  noDefaultOrg: string;
  query: string;
  spikeDescription: string;
};

export const defaultSoqlBuilderLabels: SoqlBuilderLabels = {
  fields: 'Fields',
  from: 'From',
  noDefaultOrg: 'SOQL Builder requires a default org. Set a default org before using the builder.',
  query: 'SOQL Query',
  spikeDescription:
    'Lit framework spike using VSCode Elements. This vertical slice intentionally covers From, Fields, and query preview only.'
};

export const createInitialSoqlBuilderState = (): SoqlBuilderState => ({
  availableFields: [],
  hasNoDefaultOrg: false,
  isFieldsLoading: false,
  isObjectsLoading: false,
  query: {
    fields: [],
    originalSoqlStatement: '',
    sObject: ''
  },
  sObjects: []
});
