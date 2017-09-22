/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export abstract class BaseCommand {
  private readonly queryString: string | undefined;
  private readonly commandName: string;
  private readonly debuggedRequestId: string;
  private readonly debuggerApiPath = 'services/debug/v41.0';

  public constructor(
    commandName: string,
    debuggedRequestId: string,
    queryString?: string
  ) {
    this.commandName = commandName;
    this.debuggedRequestId = debuggedRequestId;
    this.queryString = queryString;
  }

  public getCommandUrl(): string {
    const urlElements = [
      this.debuggerApiPath,
      this.commandName,
      this.debuggedRequestId
    ];
    return urlElements.join('/');
  }

  public getQueryString(): string | undefined {
    return this.queryString;
  }
}
