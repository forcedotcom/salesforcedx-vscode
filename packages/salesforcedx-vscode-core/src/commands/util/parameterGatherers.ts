import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';

export class SimpleGatherer<T> implements ParametersGatherer<T> {
  private input: T;

  constructor(input: T) {
    this.input = input;
  }

  public async gather(): Promise<ContinueResponse<T>> {
    return {
      type: 'CONTINUE',
      data: this.input
    };
  }
}
