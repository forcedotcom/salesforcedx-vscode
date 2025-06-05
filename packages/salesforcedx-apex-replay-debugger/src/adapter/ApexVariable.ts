import { Variable } from '@vscode/debugadapter';

export class ApexVariable extends Variable {
  public readonly type: string;
  public readonly apexRef: string | undefined;
  public readonly evaluateName: string;

  public constructor(name: string, value: string, type: string, ref = 0, apexRef?: string) {
    super(name, value, ref);
    this.type = type;
    this.apexRef = apexRef;
    this.evaluateName = value;
  }
}
