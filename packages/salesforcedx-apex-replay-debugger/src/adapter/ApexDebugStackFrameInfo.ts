import { VariableContainer } from './VariableContainer';

export class ApexDebugStackFrameInfo {
  public readonly frameNumber: number;
  public readonly signature: string;
  public statics: Map<string, VariableContainer>;
  public locals: Map<string, VariableContainer>;
  public globals: Map<string, VariableContainer>;

  public constructor(frameNumber: number, signature: string) {
    this.frameNumber = frameNumber;
    this.signature = signature;
    this.statics = new Map<string, VariableContainer>();
    this.locals = new Map<string, VariableContainer>();
    this.globals = new Map<string, VariableContainer>();
  }
}
