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
import { FauxClassGenerator } from '../generator/fauxClassGenerator';
import { SOQLMetadataGenerator } from '../generator/soqlMetadataGenerator';
import { TypingGenerator } from '../generator/typingGenerator';
import { MinObjectRetriever } from '../retriever/minObjectRetriever';
import { OrgObjectDetailRetriever, OrgObjectRetriever } from '../retriever/orgObjectRetriever';
import { SObjectCategory, SObjectRefreshSource } from '../types';
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
    const commonGenerators = [new TypingGenerator(), new SOQLMetadataGenerator(category)];

    if (source === 'startupmin') {
      return new SObjectTransformer({
        emitter,
        retrievers: [new MinObjectRetriever()],
        generators: [new FauxClassGenerator('STANDARD', STANDARDOBJECTS_DIR), ...commonGenerators],
        cancellationToken
      });
    }
    const connection = await createConnection(sfProject);
    return new SObjectTransformer({
      emitter,
      retrievers: [new OrgObjectRetriever(connection), new OrgObjectDetailRetriever(connection, category, source)],
      generators: [
        ...(category === 'STANDARD' || category === 'ALL'
          ? [new FauxClassGenerator('STANDARD', STANDARDOBJECTS_DIR)]
          : []),
        ...(category === 'CUSTOM' || category === 'ALL' ? [new FauxClassGenerator('CUSTOM', CUSTOMOBJECTS_DIR)] : []),
        ...commonGenerators
      ],
      cancellationToken
    });
  }
}

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
