// This is the API that is exposed to external NPM packages. This file is where
// you can "change" the shape of what is actually exposed. So, if you have a
// class with more public fields (to facilitate testing) You could limit the
// exposure here.

export interface Command {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];
}

export { CommandBuilder, SfdxCommandBuilder } from './cli/commandBuilder';
