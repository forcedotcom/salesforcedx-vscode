/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexVariableContainer } from './variableContainer';

export class ApexDebugStackFrameInfo {
  public readonly frameNumber: number;
  public readonly signature: string;
  public statics: Map<string, ApexVariableContainer>;
  public locals: Map<string, ApexVariableContainer>;
  public globals: Map<string, ApexVariableContainer>;

  public constructor(frameNumber: number, signature: string) {
    this.frameNumber = frameNumber;
    this.signature = signature;
    this.statics = new Map<string, ApexVariableContainer>();
    this.locals = new Map<string, ApexVariableContainer>();
    this.globals = new Map<string, ApexVariableContainer>();
  }
}
