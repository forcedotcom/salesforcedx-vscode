/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import type { CancellationToken } from '@salesforce/salesforcedx-utils';
import { EventEmitter } from 'node:events';
import { ERROR_EVENT, EXIT_EVENT, FAILURE_CODE, STDERR_EVENT, STDOUT_EVENT, SUCCESS_CODE } from '../constants';
import { describeGlobal, describeSObjects } from '../describe/sObjectDescribe';
import { generateFauxClasses } from '../generator/fauxClassGenerator';
import { writeTypeNamesFile, generateAllMetadata } from '../generator/soqlMetadataGenerator';
import { generateAllTypes } from '../generator/typingGenerator';
import { nls } from '../messages';
import { getMinNames, getMinObjects } from '../retriever/minObjectRetriever';
import { SObjectCategory, SObjectRefreshResult, SObjectRefreshSource } from '../types';
import { capitalize } from '../utils';
import { sobjectTypeFilter } from './sobjectFilter';

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
      conn?: Connection;
    }
);

export const writeSobjectFiles = async (args: WriteSobjectFilesArgs): Promise<SObjectRefreshResult> => {
  try {
    const { sobjectNames, sobjects } =
      // if you have no connection, we can ONLY do the startup min
      args.source === 'startupmin' || !args.conn
        ? { sobjectNames: getMinNames(), sobjects: getMinObjects() }
        : await getNamesAndTypes(args.conn, args.category, args.source);

    if (!args.cancellationToken.isCancellationRequested) {
      Array.from(
        Object.entries(sobjects).map(([category, objects]) => {
          args.emitter.emit(
            STDOUT_EVENT,
            nls.localize('processed_sobjects_length_text', objects.length, capitalize(category))
          );
        })
      );
    }
    // those describes are the slow part.  Not much point cancelling now, it's just file transforms and writes
    if (!args.cancellationToken.isCancellationRequested) {
      await Promise.all([
        generateFauxClasses(sobjects),
        generateAllTypes(sobjects),
        writeTypeNamesFile(sobjectNames),
        generateAllMetadata(sobjects)
      ]);
    }

    args.emitter.emit(EXIT_EVENT, !args.cancellationToken.isCancellationRequested ? SUCCESS_CODE : FAILURE_CODE);

    return {
      data: {
        cancelled: args.cancellationToken.isCancellationRequested,
        standardObjects: sobjects.standard.length,
        customObjects: sobjects.custom.length
      }
    };
  } catch (error) {
    args.emitter.emit(STDERR_EVENT, `${error instanceof Error ? error.message : String(error)}\n`);
    args.emitter.emit(ERROR_EVENT, error);
    args.emitter.emit(EXIT_EVENT, FAILURE_CODE);
    return Promise.reject({
      error: error instanceof Error ? error : new Error(String(error)),
      data: { cancelled: false }
    });
  }
};

const getNamesAndTypes = async (conn: Connection, category: SObjectCategory, source: SObjectRefreshSource) => {
  const sobjectNames = (await describeGlobal(conn)).filter(sobjectTypeFilter(category, source));
  const sobjects = await describeSObjects(conn, sobjectNames);
  return { sobjectNames, sobjects };
};
