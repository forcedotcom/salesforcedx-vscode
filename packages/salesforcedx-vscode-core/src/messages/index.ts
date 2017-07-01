import util = require('util');

const locale = 'en_US';

export let get = function(label: string, ...args: any[]): string {
  if (!messages[locale]) {
    throw new Error("Locale '" + locale + "' doesn't exist");
  }
  if (!messages[locale][label]) {
    throw new Error("Message '" + label + "' doesn't exist");
  }
  if (args) {
    const expectedNumArgs = messages[locale][label].split('%s').length - 1;
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

    args.unshift(messages[locale][label]);
    return util.format.apply(util, args);
  }
  return messages[locale][label];
};

type Messages = {
  readonly [index: string]: {
    readonly [index: string]: string;
  };
};

const messages: Messages = {
  en_US: {
    channel_name: 'SalesforceDX CLI',
    channel_starting_message: 'Starting ',
    channel_end_with_exit_code: 'ended with exit code %s',
    channel_end: 'ended'
  }
};
