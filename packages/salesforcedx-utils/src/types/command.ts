export interface Command {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];
  readonly logName?: string;

  toString(): string;
  toCommand(): string;
}
