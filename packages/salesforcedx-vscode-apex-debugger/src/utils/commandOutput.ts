/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class CommandOutput {
  private objectId: string;
  private stdErr: string;
  private stdOut: string;
  private cmdMsg: string;
  private cmdAction: string;

  public setId(id: string): void {
    this.objectId = id;
  }

  public setStdErr(err: string): void {
    this.stdErr = err;
  }

  public setStdOut(out: string): void {
    this.stdOut = out;
  }

  public setCmdMsg(msg: string): void {
    this.cmdMsg = msg;
  }

  public setCmdAction(action: string): void {
    this.cmdAction = action;
  }

  public getId(): string {
    return this.objectId;
  }

  public getStdErr(): string {
    return this.stdErr;
  }

  public getStdOut(): string {
    return this.stdOut;
  }

  public getCmdMsg(): string {
    return this.cmdMsg;
  }

  public getCmdAction(): string {
    return this.cmdAction;
  }
}
