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

class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const getProperty = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

const getJson = async (path: string): Promise<unknown> => {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  const body: unknown = JSON.parse(await response.text());
  if (!response.ok) {
    const error = getProperty(body, 'error');
    const code = getProperty(error, 'code');
    const message = getProperty(error, 'message');
    throw new ApiRequestError(
      typeof code === 'string' ? code : 'REQUEST_FAILED',
      typeof message === 'string' ? message : `Request failed with HTTP ${response.status}.`
    );
  }
  return body;
};

const getNames = (body: unknown, property: 'fields' | 'sObjects'): string[] => {
  const values = getProperty(body, property);
  if (!Array.isArray(values)) {
    throw new ApiRequestError('INVALID_RESPONSE', `The server response is missing ${property}.`);
  }
  return values.flatMap(value => {
    const name = getProperty(value, 'name');
    return typeof name === 'string' ? [name] : [];
  });
};

const formatQuery = (sObject: string, fields: string[]): string => {
  if (!sObject) {
    return '';
  }
  const selection = fields.length > 0 ? ` ${fields.join(', ')}` : '';
  return `SELECT${selection}\n    FROM ${sObject}`;
};

export class HttpSoqlBuilderHost implements SoqlBuilderHost {
  public readonly kind = 'http';
  private listener: SoqlBuilderStateListener | undefined;
  private requestSequence = 0;
  private state: SoqlBuilderState = createInitialSoqlBuilderState();

  public dispose(): void {
    this.listener = undefined;
    this.requestSequence += 1;
  }

  public async initialize(listener: SoqlBuilderStateListener): Promise<void> {
    this.listener = listener;
    this.state = { ...this.state, errorMessage: undefined, isObjectsLoading: true };
    this.publish();
    try {
      const response = await getJson('/api/sobjects');
      this.state = {
        ...this.state,
        isObjectsLoading: false,
        sObjects: getNames(response, 'sObjects')
      };
    } catch (error) {
      this.applyError(error, 'Unable to load Salesforce objects.');
    }
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
    const request = ++this.requestSequence;
    this.state = {
      ...this.state,
      availableFields: [],
      errorMessage: undefined,
      isFieldsLoading: true,
      query: { fields: [], originalSoqlStatement: formatQuery(sObject, []), sObject }
    };
    this.publish();
    void this.loadFields(sObject, request);
  }

  private applyError(error: unknown, fallbackMessage: string): void {
    const requestError = error instanceof ApiRequestError ? error : undefined;
    this.state = {
      ...this.state,
      errorMessage: requestError?.message ?? fallbackMessage,
      hasNoDefaultOrg: requestError?.code === 'NO_DEFAULT_ORG',
      isFieldsLoading: false,
      isObjectsLoading: false
    };
  }

  private async loadFields(sObject: string, request: number): Promise<void> {
    try {
      const response = await getJson(`/api/sobjects/${encodeURIComponent(sObject)}`);
      if (request !== this.requestSequence) {
        return;
      }
      this.state = {
        ...this.state,
        availableFields: getNames(response, 'fields'),
        isFieldsLoading: false
      };
    } catch (error) {
      if (request !== this.requestSequence) {
        return;
      }
      this.applyError(error, `Unable to load fields for ${sObject}.`);
    }
    this.publish();
  }

  private publish(): void {
    this.listener?.(this.state);
  }
}
