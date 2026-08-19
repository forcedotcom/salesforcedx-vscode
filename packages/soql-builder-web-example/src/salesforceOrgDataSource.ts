/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator } from '@salesforce/core';

export type SObjectSummary = {
  custom: boolean;
  label: string;
  name: string;
  queryable: boolean;
};

export type SObjectFieldSummary = {
  label: string;
  name: string;
  nillable: boolean;
  type: string;
};

export interface OrgDataSource {
  describeSObject(sObjectName: string): Promise<SObjectFieldSummary[]>;
  listSObjects(): Promise<SObjectSummary[]>;
}

export const isValidSObjectName = (value: string): boolean => /^[A-Za-z][A-Za-z0-9_]*$/.test(value);

export class SalesforceOrgDataSource implements OrgDataSource {
  private connection: Connection | undefined;

  constructor(private readonly targetOrg: string) {}

  public async describeSObject(sObjectName: string): Promise<SObjectFieldSummary[]> {
    if (!isValidSObjectName(sObjectName)) {
      throw new Error(`Invalid Salesforce object API name: ${sObjectName}`);
    }
    const connection = await this.getConnection();
    const description = await connection.describe(sObjectName);
    return description.fields
      .map(field => ({
        label: field.label,
        name: field.name,
        nillable: field.nillable,
        type: field.type
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name));
  }

  public async listSObjects(): Promise<SObjectSummary[]> {
    const connection = await this.getConnection();
    const description = await connection.describeGlobal();
    return description.sobjects
      .filter(sObject => sObject.queryable)
      .map(sObject => ({
        custom: sObject.custom,
        label: sObject.label,
        name: sObject.name,
        queryable: sObject.queryable
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name));
  }

  private async getConnection(): Promise<Connection> {
    if (this.connection) {
      return this.connection;
    }
    const state = await StateAggregator.getInstance();
    const username = state.aliases.resolveUsername(this.targetOrg);
    const authInfo = await AuthInfo.create({ username });
    this.connection = await Connection.create({ authInfo });
    return this.connection;
  }
}
