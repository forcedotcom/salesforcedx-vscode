/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { ConflictDetectionMessages } from '../commands/util';
import { nls } from '../messages';

const validConflictLogNames = [
  'deploy_with_sourcepath',
  'deploy_with_manifest',
  'retrieve_with_sourcepath',
  'project_retrieve_start_default_scratch_org',
  'project_deploy_start_default_scratch_org'
];

export type ConflictLogName = (typeof validConflictLogNames)[number];

/** Validates and converts a string to ConflictLogName, throwing if invalid */
export const assertConflictLogName = (logName: string): ConflictLogName => {
  if (validConflictLogNames.includes(logName)) {
    return logName;
  }
  throw new Error(`Invalid conflict log name: ${logName}. Expected one of: ${validConflictLogNames.join(', ')}`);
};

/** Returns appropriate conflict messages for the given operation type */
export const getConflictMessagesFor = (logName: ConflictLogName): ConflictDetectionMessages => {
  const warningMessageKey = 'conflict_detect_conflicts_during_deploy';
  const retrieveWarningMessageKey = 'conflict_detect_conflicts_during_retrieve';

  switch (logName) {
    case 'deploy_with_sourcepath':
      return {
        warningMessageKey,
        commandHint: inputs =>
          (Array.isArray(inputs) ? inputs : [inputs])
            .map(input =>
              new SfCommandBuilder().withArg('project:deploy:start').withFlag('--sourcepath', input).build().toString()
            )
            .join('\n  ')
      };

    case 'deploy_with_manifest':
      return {
        warningMessageKey,
        commandHint: input =>
          new SfCommandBuilder()
            .withArg('project:deploy:start')
            .withFlag('--manifest', Array.isArray(input) ? input[0] : input)
            .build()
            .toString()
      };

    case 'retrieve_with_sourcepath':
      return {
        warningMessageKey: retrieveWarningMessageKey,
        commandHint: inputs =>
          (Array.isArray(inputs) ? inputs : [inputs])
            .map(input =>
              new SfCommandBuilder()
                .withArg('project:retrieve:start')
                .withFlag('--sourcepath', input)
                .build()
                .toString()
            )
            .join('\n  ')
      };

    case 'project_retrieve_start_default_scratch_org':
      return {
        warningMessageKey: retrieveWarningMessageKey,
        commandHint: () => nls.localize('pull_conflicts_error')
      };

    case 'project_deploy_start_default_scratch_org':
      return {
        warningMessageKey,
        commandHint: () => nls.localize('push_conflicts_error')
      };
    default:
      throw new Error(`Invalid conflict log name: ${logName}. Expected one of: ${validConflictLogNames.join(', ')}`);
  }
};
