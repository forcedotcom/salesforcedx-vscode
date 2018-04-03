import { AnonymousSubscription } from 'rxjs/Subscription';

/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export abstract class BaseCommand {
  private readonly queryString: string | undefined;
  private readonly commandName: string;
  private readonly commandMethod: string;
  private readonly request: AnonymousSubscription | undefined;

  public constructor(
    commandPath: string,
    commandMethod: string,
    queryString?: string,
    request?: any | undefined
  ) {
    this.commandName = commandPath;
    this.commandMethod = commandMethod;
    this.queryString = queryString;
    this.request = request;
  }

  public getCommandUrl(): string {
    const urlElements = [
      //this.apiPath,
      this.commandName
    ];
    return urlElements.join('/');
  }

  public getCommandMethod(): string {
    return this.commandMethod;
  }

  public getQueryString(): string | undefined {
    return this.queryString;
  }

  public getRequest(): any | undefined {
    return this.request;
  }
}
