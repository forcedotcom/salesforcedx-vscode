/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import type { CancellationToken } from '@salesforce/salesforcedx-utils';
import { fileOrFolderExists, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import { EventEmitter } from 'node:events';
import { ERROR_EVENT, EXIT_EVENT, FAILURE_CODE, STDERR_EVENT, STDOUT_EVENT, SUCCESS_CODE } from '../constants';
import { describeGlobal, describeSObjects } from '../describe/sObjectDescribe';
import { SObjectShortDescription } from '../describe/types';
import { generateFauxClasses } from '../generator/fauxClassGenerator';
import { writeTypeNamesFile, generateAllMetadata } from '../generator/soqlMetadataGenerator';
import { generateAllTypes } from '../generator/typingGenerator';
import { nls } from '../messages';
import { getMinNames, getMinObjects } from '../retriever/minObjectRetriever';
import { sobjectTypeFilter } from '../retriever/orgObjectRetriever';
import {
  SObject,
  SObjectCategory,
  SObjectDefinitionRetriever,
  SObjectGenerator,
  SObjectRefreshOutput as SObjectRefreshData,
  SObjectRefreshResult,
  SObjectRefreshSource
} from '../types';

type SObjectRefreshTransformData = SObjectRefreshData & {
  typeNames: SObjectShortDescription[];
  standard: SObject[];
  custom: SObject[];
  error?: { message: string; stack?: string };
};

type WriteSobjectFilesArgs = {
  emitter: EventEmitter;
  cancellationToken: CancellationToken;
} & (
  | {
      source: Extract<SObjectRefreshSource, 'startupmin'>;
      category: Extract<SObjectCategory, 'STANDARD'>;
    }
  | {
      source: Exclude<SObjectRefreshSource, 'startupmin'>;
      category: SObjectCategory;
      conn: Connection;
    }
);

export const writeSobjectFiles = async (args: WriteSobjectFilesArgs): Promise<SObjectRefreshResult> => {
  const sobjectNames =
    args.source === 'startupmin'
      ? getMinNames()
      : (await describeGlobal(args.conn)).filter(sobjectTypeFilter(args.category, args.source));
  // TODO: cancellable wrapper for fns.
  const sobjects = args.source === 'startupmin' ? getMinObjects() : await describeSObjects(args.conn, sobjectNames);
  await Promise.all([
    generateFauxClasses(sobjects),
    generateAllTypes(sobjects),
    writeTypeNamesFile(sobjectNames),
    generateAllMetadata(sobjects)
  ]);
  return {
    data: {
      cancelled: false,
      standardObjects: sobjects.standard.length,
      customObjects: sobjects.custom.length
    }
    // TODO: error handling
    // TODO: cancellable wrapper for fns.
  };
};

export class SObjectTransformer {
  private emitter: EventEmitter;
  private cancellationToken: CancellationToken | undefined;
  private result: SObjectRefreshResult;
  private retrievers: SObjectDefinitionRetriever[];
  private generators: SObjectGenerator[] = [];

  public constructor({
    emitter,
    retrievers,
    generators,
    cancellationToken
  }: {
    emitter: EventEmitter;
    retrievers: SObjectDefinitionRetriever[];
    generators: SObjectGenerator[];
    cancellationToken?: CancellationToken;
  }) {
    this.emitter = emitter;
    this.generators = generators;
    this.retrievers = retrievers;
    this.cancellationToken = cancellationToken;
    this.result = { data: { cancelled: false } };
  }

  public async transform(): Promise<SObjectRefreshResult> {
    const pathToStateFolder = projectPaths.stateFolder();

    if (!(await fileOrFolderExists(pathToStateFolder))) {
      return await this.errorExit(nls.localize('no_generate_if_not_in_project', pathToStateFolder));
    }

    const output: SObjectRefreshData = this.initializeData(pathToStateFolder);

    for (const retriever of this.retrievers) {
      if (this.didCancel()) {
        return this.cancelExit();
      }

      if (this.result.error) {
        return this.errorExit(this.result.error.message);
      }

      try {
        await retriever.retrieve(output);
      } catch (err) {
        return this.errorExit(err.message);
      }
    }

    for (const gen of this.generators) {
      if (this.didCancel()) {
        return this.cancelExit();
      }

      if (this.result.error) {
        return this.errorExit(this.result.error.message);
      }

      try {
        gen.generate(output);
      } catch (err) {
        return this.errorExit(err.message);
      }
    }

    this.result.data.standardObjects = output.getStandard().length;
    this.result.data.customObjects = output.getCustom().length;

    return this.successExit();
  }

  private initializeData(pathToStateFolder: string): SObjectRefreshData {
    const output: SObjectRefreshTransformData = {
      addTypeNames: names => {
        output.typeNames = output.typeNames.concat(names);
      },
      getTypeNames: () => output.typeNames,

      addStandard: defs => {
        output.standard = output.standard.concat(defs);
        this.result.data.standardObjects = output.standard.length;
        this.logSObjects('Standard', defs.length);
      },
      getStandard: () => output.standard,

      addCustom: defs => {
        output.custom = output.custom.concat(defs);
        this.result.data.customObjects = output.custom.length;
        this.logSObjects('Custom', defs.length);
      },
      getCustom: () => output.custom,

      setError: (message, stack) => {
        this.result.error = { message, stack };
      },

      sfdxPath: pathToStateFolder,

      typeNames: [],
      custom: [],
      standard: []
    };
    return output;
  }

  private didCancel(): boolean {
    return Boolean(this.cancellationToken?.isCancellationRequested);
  }

  private errorExit(message: string, stack?: string): Promise<SObjectRefreshResult> {
    this.emitter.emit(STDERR_EVENT, `${message}\n`);
    this.emitter.emit(ERROR_EVENT, new Error(message));
    this.emitter.emit(EXIT_EVENT, FAILURE_CODE);
    this.result.error = { message, stack };
    return Promise.reject(this.result);
  }

  private successExit(): Promise<SObjectRefreshResult> {
    this.emitter.emit(EXIT_EVENT, SUCCESS_CODE);
    return Promise.resolve(this.result);
  }

  private cancelExit(): Promise<SObjectRefreshResult> {
    this.emitter.emit(EXIT_EVENT, FAILURE_CODE);
    this.result.data.cancelled = true;
    return Promise.resolve(this.result);
  }

  private logSObjects(sobjectKind: string, processedLength: number) {
    if (processedLength > 0) {
      this.emitter.emit(STDOUT_EVENT, nls.localize('processed_sobjects_length_text', processedLength, sobjectKind));
    }
  }
}
