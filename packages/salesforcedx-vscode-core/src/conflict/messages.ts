/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { ConflictDetectionMessages } from '../commands/util';

export const getConflictMessagesFor = (logName: string): ConflictDetectionMessages | undefined => {
  const warningMessageKey = 'conflict_detect_conflicts_during_deploy';
  const messagesByLogName: Map<string, ConflictDetectionMessages> = new Map([
    [
      'deploy_with_sourcepath',
      {
        warningMessageKey,
        commandHint: inputs => {
          const commands: string[] = [];
          (inputs as string[]).forEach(input => {
            commands.push(
              new SfCommandBuilder().withArg('project:deploy:start').withFlag('--sourcepath', input).build().toString()
            );
          });
          const hints = commands.join('\n  ');

          return hints;
        }
      }
    ],
    [
      'deploy_with_manifest',
      {
        warningMessageKey,
        commandHint: input => {
          return new SfCommandBuilder()
            .withArg('project:deploy:start')
            .withFlag('--manifest', input as string)
            .build()
            .toString();
        }
      }
    ]
  ]);

  const conflictMessages = messagesByLogName.get(logName);
  if (!conflictMessages) {
    throw new Error(`No conflict messages found for ${logName}`);
  }
  return conflictMessages;
};
