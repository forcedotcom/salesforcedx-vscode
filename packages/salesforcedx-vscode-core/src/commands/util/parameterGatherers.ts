import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { RetrieveDescriber } from '../forceSourceRetrieveMetadata';

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

export class RetrieveComponentOutputGatherer
  implements ParametersGatherer<DirFileNameSelection[]> {
  private describer: RetrieveDescriber;

  constructor(describer: RetrieveDescriber) {
    this.describer = describer;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<DirFileNameSelection[]>
  > {
    return { type: 'CONTINUE', data: this.describer.gatherOutputLocations() };
  }
}
