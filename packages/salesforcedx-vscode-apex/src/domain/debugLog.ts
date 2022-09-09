/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class DebugLog {
  private _log: string | undefined;
  private _lines: string[] | undefined;
  private userDebugEventIdentifier = 'USER_DEBUG';
  // Todo: QA on Windows machines to validate/verify
  // newLine aka '\n' works as expected
  private newLineCharacter = '\n';

  constructor(logOrLogLines: string | string[]) {
    if (Array.isArray(logOrLogLines)) {
      this._lines = logOrLogLines;
    } else {
      this._log = logOrLogLines;
    }
  }

  public value(): string {
    if (!this._log && this._lines && this._lines.length > 0) {
      this._log = this._lines!.join(this.newLineCharacter);
    }
    return this._log!;
  }

  public debugStatements(): string {
    const userDebugStatements = this.lines(this.userDebugEventIdentifier);
    const userDebugStatementsText = userDebugStatements.join(
      this.newLineCharacter
    );
    return userDebugStatementsText;
  }

  private lines(filter?: string): string[] {
    if (!this._lines) {
      this._lines = this._log!.split(this.newLineCharacter);
    }
    return filter
      ? this._lines.filter(line => line.includes(filter))
      : this._lines;
  }
}
