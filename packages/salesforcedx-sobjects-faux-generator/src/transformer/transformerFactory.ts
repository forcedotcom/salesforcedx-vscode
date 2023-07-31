/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import { workspace } from 'vscode';

import { AuthInfo, Connection, SfProject } from '@salesforce/core';
import { ConfigUtil, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';

import { CUSTOMOBJECTS_DIR, STANDARDOBJECTS_DIR } from '../constants';
import { SObjectSelector, SObjectShortDescription } from '../describe';
import { FauxClassGenerator, TypingGenerator } from '../generator';
import { SOQLMetadataGenerator } from '../generator/soqlMetadataGenerator';
import { MinObjectRetriever, OrgObjectDetailRetriever, OrgObjectRetriever } from '../retriever';
import {
    SObjectCategory, SObjectDefinitionRetriever, SObjectGenerator, SObjectRefreshSource
} from '../types';
import { SObjectTransformer } from './sobjectTransformer';

export interface CancellationToken {
  isCancellationRequested: boolean;
}

export class SObjectTransformerFactory {
  public static async create(
    emitter: EventEmitter,
    cancellationToken: CancellationToken,
    category: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<SObjectTransformer> {
    const retrievers: SObjectDefinitionRetriever[] = [];
    const generators: SObjectGenerator[] = [];
    const standardGenerator = new FauxClassGenerator(
      SObjectCategory.STANDARD,
      STANDARDOBJECTS_DIR
    );
    const customGenerator = new FauxClassGenerator(
      SObjectCategory.CUSTOM,
      CUSTOMOBJECTS_DIR
    );

    if (source === SObjectRefreshSource.StartupMin) {
      retrievers.push(new MinObjectRetriever());
      generators.push(standardGenerator);
    } else {
      const connection = await SObjectTransformerFactory.createConnection();

      retrievers.push(
        new OrgObjectRetriever(connection),
        new OrgObjectDetailRetriever(
          connection,
          await SObjectSelectorFactory.create(category, source)
        )
      );

      if (
        category === SObjectCategory.STANDARD ||
        category === SObjectCategory.PROJECT ||
        category === SObjectCategory.ALL
      ) {
        generators.push(standardGenerator);
      }

      if (
        category === SObjectCategory.CUSTOM ||
        category === SObjectCategory.PROJECT ||
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

  protected isRequiredSObject(sobject: string): boolean {
    // Ignore all sobjects that end with Share or History or Feed or Event
    return !/Share$|History$|Feed$|.+Event$/.test(sobject);
  }
}
export class ProjectSObjectSelector extends GeneralSObjectSelector {
  private projectSObjects: Set<string>;

  public constructor(category: SObjectCategory, source: SObjectRefreshSource) {
    super(category, source);
    this.projectSObjects = new Set<string>();
  }

  public select(sobject: SObjectShortDescription): boolean {
    return (
      this.projectSObjects.has(sobject.name) &&
      this.isRequiredSObject(sobject.name)
    );
  }

  /**
   * Scans the project for sobjects and adds them to the list of sobjects to retrieve
   */
  public async scanForProjectSObjects(): Promise<void> {
    const dirs: string[] = await this.getPackageDirs();
    // look for objects in the project
    const files = (await this.findObjectsInProject(dirs)).map(file => {
      // get the index of the objects directory's end including the separator
      const objectsEndIndex = file.indexOf('objects') + 8;
      const objectsDir = file.substring(objectsEndIndex);
      // get the index of the next separator
      const nextSeparatorIndex = objectsDir.indexOf(path.sep);
      // get the object name
      return objectsDir.substring(0, nextSeparatorIndex);
    });

    this.projectSObjects = new Set<string>(files);
  }

  private async getPackageDirs(): Promise<string[]> {
    const sfProject = await SfProject.resolve();
    return sfProject.getUniquePackageDirectories().map(p => p.fullPath);
  }

  /**
   * Find all the objects in the project that are sobjects and return the path relative to
   * the directory inwhich they were found.
   * @param dirs
   * @returns
   */
  private async findObjectsInProject(dirs: string[]) {
    const pattern = path.join('**', 'objects', '**');
    return (
      await Promise.all(
        dirs.map(async dir => {
          const files = await workspace.findFiles(
            path.join(path.relative(process.cwd(), dir), pattern)
          );
          return files.map(file => {
            const relativePath = path.relative(dir, file.fsPath);
            return relativePath;
          });
        })
      )
    ).flat();
  }
}

export class SObjectSelectorFactory {
  public static async create(
    category: SObjectCategory,
    source: SObjectRefreshSource
  ): Promise<SObjectSelector> {
    if (category === SObjectCategory.PROJECT) {
      const selector = new ProjectSObjectSelector(category, source);
      await selector.scanForProjectSObjects();
      return selector;
    }
    return new GeneralSObjectSelector(category, source);
  }
}
