/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
const MISSING_LABEL_MSG = '!!! MISSING LABEL !!!';
// tslint:disable: no-any
export interface LocalizationProvider {
  localize(label: string, args?: string | string[]): string;
}

export class Localization implements LocalizationProvider {
  private readonly delegate: Message;

  public constructor(delegate: Message) {
    this.delegate = delegate;
  }

  public localize(label: string, args?: string | string[]): string {
    return this.delegate.localize(label, args);
  }
}

export type MessageBundle = {
  readonly [index: string]: string;
};

export class Message implements LocalizationProvider {
  private readonly messages: MessageBundle;

  public constructor(messages: MessageBundle) {
    this.messages = messages;
  }

  public localize(label: string, args?: string | string[]): string {
    let possibleLabel = this.getLabel(label);

    if (typeof args === 'undefined' && possibleLabel) {
      return possibleLabel;
    }

    // Note: We are getting an array of arrays when we want to consume the ...args param
    // e.g. [['value1', 'value2']]
    if (typeof args !== 'undefined' && Array.isArray(args)) {
      args = args[0].constructor === Array ? args[0] : args;
    } else if (typeof args !== 'undefined' && !Array.isArray(args)) {
      args = [args];
    }

    if (!possibleLabel) {
      console.warn(`Missing label for key: ${label}`);
      possibleLabel = `${MISSING_LABEL_MSG} ${label}`;

      if (Array.isArray(args) && args.length >= 1) {
        args.forEach(arg => {
          possibleLabel += ` (${arg})`;
        });
      }
      return possibleLabel;
    }

    if (Array.isArray(args) && args.length >= 1) {
      const expectedNumArgs = possibleLabel.split('%s').length - 1;
      if (args.length !== expectedNumArgs) {
        // just log it, we might want to hide some in some languges on purpose
        console.log(
          `Arguments do not match for label '${label}', got ${
            args.length
          } but want ${expectedNumArgs}`
        );
      }

      args.unshift(possibleLabel);
      // eslint-disable-next-line prefer-spread
      return util.format.apply(util, args);
    }

    return possibleLabel;
  }

  private getLabel(label: string): string | undefined {
    if (this.messages[label]) {
      return this.messages[label];
    } else {
      return undefined;
    }
  }
}
