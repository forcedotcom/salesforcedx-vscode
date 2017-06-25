/**
 * This is the actual shape of the Command interface that we want to expose
 * externally. Once this is stable enough, we can move it into an api folder
 * instead of the impl folder.
 */
export interface Command {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];
}

export { CommandBuilder, SfdxCommandBuilder } from './commandBuilder';
