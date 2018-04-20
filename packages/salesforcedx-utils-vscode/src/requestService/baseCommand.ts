/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export abstract class BaseCommand {
  protected readonly queryString: string | undefined;

  public constructor(queryString?: string) {
    this.queryString = queryString;
  }

  public abstract getCommandUrl(): string;

  public getQueryString(): string | undefined {
    return this.queryString;
  }

  public abstract getRequest(): string | undefined;
}
