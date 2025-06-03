/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection, SfProjectJson } from '@salesforce/core';
import { CancellationToken } from '@salesforce/salesforcedx-utils';
import { ConfigUtil, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { EventEmitter } from 'node:events';
import { CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectSelector, SObjectShortDescription } from '../describe';
import { FauxClassGenerator } from '../generator/fauxClassGenerator';
import { SOQLMetadataGenerator } from '../generator/soqlMetadataGenerator';
import { TypingGenerator } from '../generator/typingGenerator';
import { MinObjectRetriever, OrgObjectDetailRetriever, OrgObjectRetriever } from '../retriever';
import { SObjectCategory, SObjectDefinitionRetriever, SObjectGenerator, SObjectRefreshSource } from '../types';
import { SObjectTransformer } from './sobjectTransformer';

export class SObjectTransformerFactory {
  public static async create({
    emitter,
    cancellationToken,
    category,
    source,
    sfProject
  }: {
    emitter: EventEmitter;
    cancellationToken: CancellationToken;
    category: SObjectCategory;
    source: SObjectRefreshSource;
    sfProject?: SfProjectJson;
  }): Promise<SObjectTransformer> {
    const retrievers: SObjectDefinitionRetriever[] = [];
    const generators: SObjectGenerator[] = [];
    const standardGenerator = new FauxClassGenerator('STANDARD', STANDARDOBJECTS_DIR);
    const customGenerator = new FauxClassGenerator('CUSTOM', CUSTOMOBJECTS_DIR);

    if (source === 'startupmin') {
      retrievers.push(new MinObjectRetriever());
      generators.push(standardGenerator);
    } else {
      const connection = await createConnection(sfProject);

      retrievers.push(
        new OrgObjectRetriever(connection),
        new OrgObjectDetailRetriever(connection, new GeneralSObjectSelector(category, source))
      );

      if (category === 'STANDARD' || category === 'ALL') {
        generators.push(standardGenerator);
      }

      if (category === 'CUSTOM' || category === 'ALL') {
        generators.push(customGenerator);
      }
    }

    generators.push(new TypingGenerator());
    generators.push(new SOQLMetadataGenerator(category));

    return new SObjectTransformer(emitter, retrievers, generators, cancellationToken);
  }
}

export class GeneralSObjectSelector implements SObjectSelector {
  private category: SObjectCategory;
  private source: SObjectRefreshSource;

  public constructor(category: SObjectCategory, source: SObjectRefreshSource) {
    this.category = category;
    this.source = source;
  }

  public select(sobject: SObjectShortDescription): boolean {
    const isCustomObject = sobject.custom === true && this.category === 'CUSTOM';
    const isStandardObject = sobject.custom === false && this.category === 'STANDARD';

    if (this.category === 'ALL' && this.source === 'manual') {
      return true;
    } else if (
      this.category === 'ALL' &&
      (this.source === 'startupmin' || this.source === 'startup') &&
      isRequiredSObject(sobject.name)
    ) {
      return true;
    } else if ((isCustomObject || isStandardObject) && this.source === 'manual' && isRequiredSObject(sobject.name)) {
      return true;
    }
    return false;
  }
}

/* Ignore all sobjects that end with Share or History or Feed or Event */

const isRequiredSObject = (sobject: string): boolean => !/Share$|History$|Feed$|.+Event$/.test(sobject);

// precedence user override > project config > connection default
const createConnection = async (sfProject?: SfProjectJson): Promise<Connection> => {
  const apiVersion =
    (await ConfigUtil.getUserConfiguredApiVersion()) ??
    (await sfProject?.getContents().sourceApiVersion) ??
    (await WorkspaceContextUtil.getInstance().getConnection()).getApiVersion();

  const updatedConn = await WorkspaceContextUtil.getInstance().getConnection();
  updatedConn.setApiVersion(apiVersion);

  // @ts-expect-error - TODO: remove when core-bundle is no longer used
  return updatedConn;
};
