/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { format } from 'node:util';
import { MISSING_LABEL_MSG } from '../constants';
import { LocalizationProvider, MessageBundle } from '../types';

export class Message implements LocalizationProvider {
  private readonly delegate?: Message;
  private readonly messages: MessageBundle;

  constructor(messages: MessageBundle, delegate?: Message) {
    this.messages = messages;
    this.delegate = delegate;
  }

  public localize(label: string, ...args: any[]): string {
    let possibleLabel = this.getLabel(label);

    if (!possibleLabel) {
      console.warn(`Missing label for key: ${label}`);
      possibleLabel = `${MISSING_LABEL_MSG} ${label}`;
      if (args.length > 0) {
        args.forEach(arg => {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          possibleLabel += ` (${arg})`;
        });
      }
      return possibleLabel;
    }

    let labelArgs = args;
    if (args.length > 0) {
      // Count all printf-style format specifiers: %s, %d, %i, %f, %j, %%, etc.
      const formatSpecifiers = possibleLabel.match(/%[sdifj%]/g);
      const expectedNumArgs = formatSpecifiers ? formatSpecifiers.filter(spec => spec !== '%%').length : 0;
      if (args.length !== expectedNumArgs) {
        // just log it, we might want to hide some in some languages on purpose
        console.log(`Arguments do not match for label '${label}', got ${args.length} but want ${expectedNumArgs}`);
        // remove the extra args
        if (args.length > expectedNumArgs) {
          labelArgs = args.slice(0, -(args.length - expectedNumArgs));
        }
      }

      return format(possibleLabel, ...labelArgs);
    }

    return possibleLabel;
  }

  private getLabel(label: string): string | undefined {
    if (this.messages[label]) {
      return this.messages[label];
    } else if (this.delegate) {
      return this.delegate.messages[label];
    } else {
      return undefined;
    }
  }
}
