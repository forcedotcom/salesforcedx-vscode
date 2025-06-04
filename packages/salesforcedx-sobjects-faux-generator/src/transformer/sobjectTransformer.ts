/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import type { CancellationToken } from '@salesforce/salesforcedx-utils';
import { EventEmitter } from 'node:events';
// import { ERROR_EVENT, EXIT_EVENT, FAILURE_CODE, STDERR_EVENT, STDOUT_EVENT, SUCCESS_CODE } from '../constants';
import { describeGlobal, describeSObjects } from '../describe/sObjectDescribe';
import { generateFauxClasses } from '../generator/fauxClassGenerator';
import { writeTypeNamesFile, generateAllMetadata } from '../generator/soqlMetadataGenerator';
import { generateAllTypes } from '../generator/typingGenerator';
// import { nls } from '../messages';
import { getMinNames, getMinObjects } from '../retriever/minObjectRetriever';
import { sobjectTypeFilter } from '../retriever/orgObjectRetriever';
import { SObjectCategory, SObjectRefreshResult, SObjectRefreshSource } from '../types';

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
  const { sobjectNames, sobjects } =
    args.source === 'startupmin'
      ? { sobjectNames: getMinNames(), sobjects: getMinObjects() }
      : await getNamesAndTypes(args.conn, args.category, args.source);

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
    // TODO: logging?
    // TODO: error handling
    // TODO: cancellable wrapper for fns.
    // TODO: event handling
  };
};

const getNamesAndTypes = async (conn: Connection, category: SObjectCategory, source: SObjectRefreshSource) => {
  const sobjectNames = (await describeGlobal(conn)).filter(sobjectTypeFilter(category, source));
  const sobjects = await describeSObjects(conn, sobjectNames);
  return { sobjectNames, sobjects };
};
// export class SObjectTransformer {
//   private emitter: EventEmitter;
//   private cancellationToken: CancellationToken | undefined;
//   private result: SObjectRefreshResult;
//   private retrievers: SObjectDefinitionRetriever[];
//   private generators: SObjectGenerator[] = [];

//   public constructor({
//     emitter,
//     retrievers,
//     generators,
//     cancellationToken
//   }: {
//     emitter: EventEmitter;
//     retrievers: SObjectDefinitionRetriever[];
//     generators: SObjectGenerator[];
//     cancellationToken?: CancellationToken;
//   }) {
//     this.emitter = emitter;
//     this.generators = generators;
//     this.retrievers = retrievers;
//     this.cancellationToken = cancellationToken;
//     this.result = { data: { cancelled: false } };
//   }

//   public async transform(): Promise<SObjectRefreshResult> {
//     const pathToStateFolder = projectPaths.stateFolder();

//     if (!(await fileOrFolderExists(pathToStateFolder))) {
//       return await this.errorExit(nls.localize('no_generate_if_not_in_project', pathToStateFolder));
//     }

//     const output: SObjectRefreshData = this.initializeData(pathToStateFolder);

//     for (const retriever of this.retrievers) {
//       if (this.didCancel()) {
//         return this.cancelExit();
//       }

//       if (this.result.error) {
//         return this.errorExit(this.result.error.message);
//       }

//       try {
//         await retriever.retrieve(output);
//       } catch (err) {
//         return this.errorExit(err.message);
//       }
//     }

//     for (const gen of this.generators) {
//       if (this.didCancel()) {
//         return this.cancelExit();
//       }

//       if (this.result.error) {
//         return this.errorExit(this.result.error.message);
//       }

//       try {
//         gen.generate(output);
//       } catch (err) {
//         return this.errorExit(err.message);
//       }
//     }

//     this.result.data.standardObjects = output.getStandard().length;
//     this.result.data.customObjects = output.getCustom().length;

//     return this.successExit();
//   }

//   private didCancel(): boolean {
//     return Boolean(this.cancellationToken?.isCancellationRequested);
//   }

//   private errorExit(message: string, stack?: string): Promise<SObjectRefreshResult> {
//     this.emitter.emit(STDERR_EVENT, `${message}\n`);
//     this.emitter.emit(ERROR_EVENT, new Error(message));
//     this.emitter.emit(EXIT_EVENT, FAILURE_CODE);
//     this.result.error = { message, stack };
//     return Promise.reject(this.result);
//   }

//   private successExit(): Promise<SObjectRefreshResult> {
//     this.emitter.emit(EXIT_EVENT, SUCCESS_CODE);
//     return Promise.resolve(this.result);
//   }

//   private cancelExit(): Promise<SObjectRefreshResult> {
//     this.emitter.emit(EXIT_EVENT, FAILURE_CODE);
//     this.result.data.cancelled = true;
//     return Promise.resolve(this.result);
//   }

//   private logSObjects(sobjectKind: string, processedLength: number) {
//     if (processedLength > 0) {
//       this.emitter.emit(STDOUT_EVENT, nls.localize('processed_sobjects_length_text', processedLength, sobjectKind));
//     }
//   }
// }
