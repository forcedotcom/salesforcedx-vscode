/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type {
  DeployMessage,
  DeployResult,
  FileResponseFailure
} from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';

const makeKey = (type: string, name: string): string => `${type}#${name}`;

const toDeployMessageArray = (raw: DeployMessage | DeployMessage[] | undefined): DeployMessage[] => {
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
};

/**
 * Merge file-level failures with `response.details.componentFailures`, matching
 * plugin-deploy-retrieve `DeployResultFormatter.getFileResponseFailures` / `sf project deploy start`.
 */
export const getMergedDeployFailures = Effect.fn('getMergedDeployFailures')(function* (result: DeployResult) {
  const { isSDRFailure, makeFileResponseFailure } = yield* (yield* (yield* ExtensionProviderService).getServicesApi)
    .services.ComponentSetService;

  const failures = result.getFileResponses().filter(isSDRFailure);
  const deployMessages = toDeployMessageArray(result.response?.details?.componentFailures);

  if (deployMessages.length <= failures.length) {
    return failures;
  }

  const failureKeySet = new Set(failures.map(f => makeKey(f.type, f.fullName)));

  const extras = deployMessages.reduce<FileResponseFailure[]>((acc, m) => {
    if (m.componentType && failureKeySet.has(makeKey(m.componentType, m.fullName))) {
      return acc;
    }
    acc.push(
      makeFileResponseFailure({
        fullName: m.fullName,
        type: m.componentType ?? 'UNKNOWN',
        error: m.problem ?? 'UNKNOWN',
        problemType: m.problemType ?? 'Error'
      })
    );
    return acc;
  }, []);

  return [...failures, ...extras];
});
