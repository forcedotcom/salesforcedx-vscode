/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { EventEmitter } from 'events';
import { SObjectSelector, SObjectShortDescription } from '../describe';
import { FauxClassGenerator, TypingGenerator } from '../generator';
import { ConfigUtil } from '../generator/configUtil';
import { SOQLMetadataGenerator } from '../generator/soqlMetadataGenerator';
import {
  MinObjectRetriever,
  OrgObjectDetailRetriever,
  OrgObjectRetriever
} from '../retriever';
import {
  SObjectCategory,
  SObjectDefinitionRetriever,
  SObjectGenerator,
  SObjectRefreshSource
} from '../types';
import { SObjectTransformer } from './sobjectTransformer';

export interface CancellationToken {
  isCancellationRequested: boolean;
}

export class SObjectTransformerFactory {
  public static async create(
    emitter: EventEmitter,
    cancellationToken: CancellationToken,
    projectPath: string,
    category: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<SObjectTransformer> {
    const retrievers: SObjectDefinitionRetriever[] = [];
    const generators: SObjectGenerator[] = [];
    const standardGenerator = new FauxClassGenerator(
      SObjectCategory.STANDARD,
      'standardObjects'
    );
    const customGenerator = new FauxClassGenerator(
      SObjectCategory.CUSTOM,
      'customObjects'
    );

    if (source === SObjectRefreshSource.StartupMin) {
      retrievers.push(new MinObjectRetriever());
      generators.push(standardGenerator);
    } else {
      const connection = await SObjectTransformerFactory.createConnection(
        projectPath
      );

      retrievers.push(
        new OrgObjectRetriever(connection),
        new OrgObjectDetailRetriever(
          connection,
          new GeneralSObjectSelector(category, source)
        )
      );

      if (
        category === SObjectCategory.STANDARD ||
        category === SObjectCategory.ALL
      ) {
        generators.push(standardGenerator);
      }

      if (
        category === SObjectCategory.CUSTOM ||
        category === SObjectCategory.ALL
      ) {
        generators.push(customGenerator);
      }
    }

    generators.push(new TypingGenerator());
    generators.push(new SOQLMetadataGenerator(category));

    return new SObjectTransformer(
      emitter,
      retrievers,
      generators,
      cancellationToken
    );
  }

  public static async createConnection(
    projectPath: string
  ): Promise<Connection> {
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: await ConfigUtil.getUsername(projectPath)
      })
    });
    return connection;
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
    const isCustomObject =
      sobject.custom === true && this.category === SObjectCategory.CUSTOM;
    const isStandardObject =
      sobject.custom === false && this.category === SObjectCategory.STANDARD;

    if (
      this.category === SObjectCategory.ALL &&
      this.source === SObjectRefreshSource.Manual
    ) {
      return true;
    } else if (
      this.category === SObjectCategory.ALL &&
      (this.source === SObjectRefreshSource.StartupMin ||
        this.source === SObjectRefreshSource.Startup) &&
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
