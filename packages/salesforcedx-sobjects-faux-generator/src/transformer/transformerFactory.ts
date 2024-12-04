/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, SfProject } from '@salesforce/core-bundle';
import { ConfigUtil, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { EventEmitter } from 'events';
import { CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectSelector, SObjectShortDescription } from '../describe';
import { FauxClassGenerator, TypingGenerator } from '../generator';
import { SOQLMetadataGenerator } from '../generator/soqlMetadataGenerator';
import { MinObjectRetriever, OrgObjectDetailRetriever, OrgObjectRetriever } from '../retriever';
import { SObjectCategory, SObjectDefinitionRetriever, SObjectGenerator, SObjectRefreshSource } from '../types';
import { SObjectTransformer } from './sobjectTransformer';

export type CancellationToken = {
  isCancellationRequested: boolean;
};

export class SObjectTransformerFactory {
  public static async create(
    emitter: EventEmitter,
    cancellationToken: CancellationToken,
    category: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<SObjectTransformer> {
    const retrievers: SObjectDefinitionRetriever[] = [];
    const generators: SObjectGenerator[] = [];
    const standardGenerator = new FauxClassGenerator(SObjectCategory.STANDARD, STANDARDOBJECTS_DIR);
    const customGenerator = new FauxClassGenerator(SObjectCategory.CUSTOM, CUSTOMOBJECTS_DIR);

    if (source === SObjectRefreshSource.StartupMin) {
      retrievers.push(new MinObjectRetriever());
      generators.push(standardGenerator);
    } else {
      const connection = await SObjectTransformerFactory.createConnection();

      retrievers.push(
        new OrgObjectRetriever(connection),
        new OrgObjectDetailRetriever(connection, new GeneralSObjectSelector(category, source))
      );

      if (category === SObjectCategory.STANDARD || category === SObjectCategory.ALL) {
        generators.push(standardGenerator);
      }

      if (category === SObjectCategory.CUSTOM || category === SObjectCategory.ALL) {
        generators.push(customGenerator);
      }
    }

    generators.push(new TypingGenerator());
    generators.push(new SOQLMetadataGenerator(category));

    return new SObjectTransformer(emitter, retrievers, generators, cancellationToken);
  }

  public static async createConnection(): Promise<Connection> {
    const userApiVersionOverride = await ConfigUtil.getUserConfiguredApiVersion();
    const workspaceContextUtil = WorkspaceContextUtil.getInstance();
    const connection = await workspaceContextUtil.getConnection();
    const connectionForSourceApiVersion = await Connection.create({
      authInfo: await AuthInfo.create({ username: connection.getUsername() })
    });
    const sourceApiVersion = await SObjectTransformerFactory.getSourceApiVersion();
    // precedence user override > project config > connection default
    connectionForSourceApiVersion.setApiVersion(
      userApiVersionOverride || sourceApiVersion || connection.getApiVersion()
    );

    return connectionForSourceApiVersion;
  }

  private static async getSourceApiVersion(): Promise<string | undefined> {
    try {
      const sfProject = await SfProject.resolve();
      return sfProject.getSfProjectJson().getContents().sourceApiVersion;
    } catch (e) {
      // If we can't resolve a project, then undefined
      return undefined;
    }
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
    const isCustomObject = sobject.custom === true && this.category === SObjectCategory.CUSTOM;
    const isStandardObject = sobject.custom === false && this.category === SObjectCategory.STANDARD;

    if (this.category === SObjectCategory.ALL && this.source === SObjectRefreshSource.Manual) {
      return true;
    } else if (
      this.category === SObjectCategory.ALL &&
      (this.source === SObjectRefreshSource.StartupMin || this.source === SObjectRefreshSource.Startup) &&
      this.isRequiredSObject(sobject.name)
    ) {
      return true;
    } else if (
      (isCustomObject || isStandardObject) &&
      this.source === SObjectRefreshSource.Manual &&
      this.isRequiredSObject(sobject.name)
    ) {
      return true;
    }
    return false;
  }

  private isRequiredSObject(sobject: string): boolean {
    // Ignore all sobjects that end with Share or History or Feed or Event
    return !/Share$|History$|Feed$|.+Event$/.test(sobject);
  }
}
