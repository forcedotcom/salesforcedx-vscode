/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { ConflictDetectionMessages } from '../commands/util';
import { nls } from '../messages';

export const getConflictMessagesFor = (logName: string): ConflictDetectionMessages | undefined => {
  const warningMessageKey = 'conflict_detect_conflicts_during_deploy';
  const retrieveWarningMessageKey = 'conflict_detect_conflicts_during_retrieve';
  const messagesByLogName: Map<string, ConflictDetectionMessages> = new Map([
    [
      'deploy_with_sourcepath',
      {
        warningMessageKey,
        commandHint: inputs =>
          (Array.isArray(inputs) ? inputs : [inputs])
            .map(input =>
              new SfCommandBuilder().withArg('project:deploy:start').withFlag('--sourcepath', input).build().toString()
            )
            .join('\n  ')
      }
    ],
    [
      'deploy_with_manifest',
      {
        warningMessageKey,
        commandHint: input =>
          new SfCommandBuilder()
            .withArg('project:deploy:start')
            .withFlag('--manifest', Array.isArray(input) ? input[0] : input)
            .build()
            .toString()
      }
    ],
    [
      'retrieve_with_sourcepath',
      {
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
      }
    ],
    [
      'project_retrieve_start_default_scratch_org',
      {
        warningMessageKey: retrieveWarningMessageKey,
        commandHint: () => nls.localize('pull_conflicts_error')
      }
    ],
    [
      'project_deploy_start_default_scratch_org',
      {
        warningMessageKey,
        commandHint: () => nls.localize('push_conflicts_error')
      }
    ]
  ]);

  const conflictMessages = messagesByLogName.get(logName);
  if (!conflictMessages) {
    throw new Error(`No conflict messages found for ${logName}`);
  }
  return conflictMessages;
};
