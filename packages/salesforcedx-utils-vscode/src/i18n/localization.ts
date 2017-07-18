import * as util from 'util';

export const BASE_FILE_NAME = 'i18n';
export const BASE_FILE_EXTENSION = 'js';
export const DEFAULT_LOCALE = 'en';

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

  private getLabel(label: string): string | undefined {
    if (this.messages[label]) {
      return this.messages[label];
    } else if (this.delegate) {
      return this.delegate.messages[label];
    } else {
      return undefined;
    }
  }

  public localize(label: string, ...args: any[]): string {
    const possibleLabel = this.getLabel(label);

    if (!possibleLabel) {
      throw new Error("Message '" + label + "' doesn't exist");
    }

    if (args.length >= 1) {
      const expectedNumArgs = possibleLabel.split('%s').length - 1;
      if (args.length !== expectedNumArgs) {
        throw new Error(
          'Wrong number of args for message: ' +
            label +
            '\nExpect ' +
            expectedNumArgs +
            ' got ' +
            args.length
        );
      }

      args.unshift(this.messages[label]);
      return util.format.apply(util, args);
    }

    return possibleLabel;
  }
}
