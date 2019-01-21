import chalk from 'chalk';
import { OutputChannel, window } from 'vscode';

const OUTPUT_CHANNEL_NAME = 'Aura VSCode Extension';

let outputChannel: OutputChannel | undefined;
function getOutputChannel(): OutputChannel {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }

  return outputChannel;
}

// Use booth outputChannel and standard console log for debugging purposes
export const logger = {
  log(...msg: string[]) {
    const formatted = msg.join(' ');
    console.log(formatted);

    getOutputChannel().append(formatted);
    getOutputChannel().append('\n');
  },

  warn(...msg: string[]) {
    const formatted = msg.join(' ');
    console.warn(formatted);

    getOutputChannel().append(chalk.yellow(formatted));
    getOutputChannel().append('\n');
  },

  error(...msg: string[]) {
    const formatted = msg.join(' ');
    console.error(formatted);

    getOutputChannel().append(chalk.red(formatted));
    getOutputChannel().append('\n');
  }
};
