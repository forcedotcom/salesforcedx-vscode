/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { ConflictDetectionMessages } from '../commands/util';

export function getConflictMessagesFor(
  logName: string
): ConflictDetectionMessages | undefined {
  const warningMessageKey = 'conflict_detect_conflicts_during_deploy';
  const messagesByLogName: Map<string, ConflictDetectionMessages> = new Map([
    [
      'force_source_deploy_with_sourcepath_beta',
      {
        warningMessageKey,
        commandHint: inputs => {
          const commands: string[] = [];
          (inputs as string[]).forEach(input => {
            commands.push(
              new SfdxCommandBuilder()
                .withArg('force:source:deploy')
                .withFlag('--sourcepath', input)
                .build()
                .toString()
            );
          });
          const hints = commands.join('\n  ');

          return hints;
        }
      }
    ],
    [
      'force_source_deploy_with_sourcepath_beta',
      {
        warningMessageKey,
        commandHint: inputs => {
          const commands: string[] = [];
          (inputs as string[]).forEach(input => {
            commands.push(
              new SfdxCommandBuilder()
                .withArg('force:source:deploy')
                .withFlag('--sourcepath', input)
                .build()
                .toString()
            );
          });
          const hints = commands.join('\n  ');

          return hints;
        }
      }
    ]
  ]);

  const conflictMessages = messagesByLogName.get(logName);
  if (!conflictMessages) {
    throw new Error(`No conflict messages found for ${logName}`);
  }
  return conflictMessages;
}
