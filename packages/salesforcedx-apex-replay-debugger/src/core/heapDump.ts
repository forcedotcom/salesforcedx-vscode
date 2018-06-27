/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexExecutionOverlayResultCommandSuccess } from '../commands';

export class ApexHeapDump {
  private readonly heapDumpId: string;
  private readonly className: string;
  private readonly namespace: string;
  private readonly line: number;
  private overlaySuccessResut:
    | ApexExecutionOverlayResultCommandSuccess
    | undefined;
  public constructor(
    heapDumpId: string,
    className: string,
    namespace: string,
    line: number
  ) {
    this.heapDumpId = heapDumpId;
    this.className = className;
    this.namespace = namespace;
    this.line = line;
  }
  public getHeapDumpId(): string {
    return this.heapDumpId;
  }
  public getClassName(): string {
    return this.className;
  }
  public getNamespace(): string {
    return this.namespace;
  }
  public getLine(): number {
    return this.line;
  }
  public getOverlaySuccessResult():
    | ApexExecutionOverlayResultCommandSuccess
    | undefined {
    return this.overlaySuccessResut;
  }
  public setOverlaySuccessResult(
    overlaySuccessResult: ApexExecutionOverlayResultCommandSuccess
  ): void {
    this.overlaySuccessResut = overlaySuccessResult;
  }
  /* tslint:disable */
  public toString = (): string => {
    return `HeapDumpId: ${this.heapDumpId}, ClassName: ${this
      .className}, Namespace: ${this.namespace}, Line: ${this.line}`;
  }; /* This semi-colon is the reason for the tslint, formatting keeps adding it */
  /* tslint:enable */
}
