/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';

export const BASE_FILE_NAME = 'i18n';
export const BASE_FILE_EXTENSION = 'js';
export const DEFAULT_LOCALE = 'en';
export const MISSING_LABEL_MSG = '!!! MISSING LABEL !!!';

export interface Config {
  locale: string;
}

export interface LocalizationProvider {
  localize(label: string, ...args: any[]): string;
}

export class Localization implements LocalizationProvider {
  private readonly delegate: Message;

  public constructor(delegate: Message) {
    this.delegate = delegate;
  }

  public localize(label: string, ...args: any[]): string {
    return this.delegate.localize(label, ...args);
  }
}

export type MessageBundle = {
  readonly [index: string]: string;
};

export class Message implements LocalizationProvider {
  private readonly delegate?: Message;
  private readonly messages: MessageBundle;

  public constructor(messages: MessageBundle, delegate?: Message) {
    this.messages = messages;
    this.delegate = delegate;
  }

  public localize(label: string, ...args: any[]): string {
    let possibleLabel = this.getLabel(label);

    if (!possibleLabel) {
      console.warn(`Missing label for key: ${label}`);
      possibleLabel = `${MISSING_LABEL_MSG} ${label}`;
      if (args.length >= 1) {
        args.forEach(arg => {
          possibleLabel += ` (${arg})`;
        });
      }
      return possibleLabel;
    }

    if (args.length >= 1) {
      const expectedNumArgs = possibleLabel.split('%s').length - 1;
      if (args.length !== expectedNumArgs) {
        // just log it, we might want to hide some in some languges on purpose
        console.log(
          `Arguments do not match for label '${label}', got ${args.length} but want ${expectedNumArgs}`
        );
      }

      args.unshift(possibleLabel);
      return util.format.apply(util, args as [any, ...any[]]);
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
