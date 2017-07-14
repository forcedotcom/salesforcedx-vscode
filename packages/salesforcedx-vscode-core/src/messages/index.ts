import util = require('util');

const locale = 'en_US';

export let localize = function(label: string, ...args: any[]): string {
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

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 */
const messages: Messages = {
  en_US: {
    channel_name: 'SalesforceDX CLI',
    channel_starting_message: 'Starting ',
    channel_end_with_exit_code: 'ended with exit code %s',
    channel_end_with_sfdx_not_found:
      'The SFDX CLI is not installed. Install it from https://developer.salesforce.com/tools/sfdxcli',
    channel_end_with_error: 'ended with error %s',
    channel_end: 'ended',

    notification_successful_execution_message: 'Successfully executed %s',
    notification_canceled_execution_message: '%s canceled',
    notification_unsuccessful_execution_message: 'Failed to execute %s',
    notification_show_button_text: 'Show',

    task_view_running_message: '[Running] %s',

    status_bar_text: `$(x) %s`,
    status_bar_tooltip: 'Click to cancel the command'
  }
};
