import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/src';
import {
  ComponentSet,
  DeployResult,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { CancellationToken } from 'vscode';
import { DeployRetrieveExecutor } from '../../../../src/commands/baseDeployRetrieve';
import * as betaDeployRetrieveUtils from '../../../../src/commands/util/betaDeployRetrieve';
import { WorkspaceContext } from '../../../../src/context';
import * as sdrUtils from '../../../../src/services/sdr/componentSetUtils';

jest.mock('../../../../src/commands/baseDeployRetrieve', () => {
  return {
    ...jest.requireActual('../../../../src/commands/baseDeployRetrieve'),
    RetrieveExecutor: jest.fn()
  };
});

describe('DeployRetrieveExecutor', () => {
  const mockWorkspaceContext = {} as any;
  const dummySourceConflictError = {
    name: 'SourceConflictError',
    message: '2 conflicts detected',
    data: [
      {
        state: 'Conflict',
        fullName: 'Test_Apex_Class_1',
        type: 'ApexClass',
        filePath:
          '/Users/kenneth.lewis/scratchpad/TestProject-…ault/classes/Test_Apex_Class_1.cls-meta.xml'
      },
      {
        state: 'Conflict',
        fullName: 'Test_Apex_Class_1',
        type: 'ApexClass',
        filePath:
          '/Users/kenneth.lewis/scratchpad/TestProject-…/main/default/classes/Test_Apex_Class_1.cls'
      }
    ]
  };
  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let setApiVersionOnStub: jest.SpyInstance;
  let formatExceptionStub: jest.SpyInstance;

  class TestDeployRetrieveExecutor extends DeployRetrieveExecutor<{}> {
    public error: any;
    public handleSourceConflictErrorCalled: boolean = false;
    private errorName: string | undefined;

    protected doOperation(
      components: ComponentSet,
      token?: CancellationToken | undefined
    ): Promise<(DeployResult | RetrieveResult) | undefined> {
      if (this.errorName) {
        const e = {} as any;
        e.name = this.errorName;
        throw e;
      }
      throw dummySourceConflictError;
    }
    protected postOperation(
      result: (DeployResult | RetrieveResult) | undefined
    ): Promise<void> {
      return Promise.resolve(undefined);
    }
    protected handleSourceConflictError(
      e: any
    ): Promise<CancelResponse | ContinueResponse<string>> {
      this.handleSourceConflictErrorCalled = true;
      this.error = e;
      return { type: 'CONTINUE', data: e.data } as any;
    }
    constructor(s: string, t: string, errorName?: string) {
      super(s, t);
      this.errorName = errorName;
    }

    protected getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return new Promise(resolve => resolve(new ComponentSet()));
    }
  }

  beforeEach(() => {
    workspaceContextGetInstanceSpy = jest
      .spyOn(WorkspaceContext, 'getInstance')
      .mockReturnValue(mockWorkspaceContext);
    setApiVersionOnStub = jest
      .spyOn(sdrUtils, 'setApiVersionOn')
      .mockImplementation(jest.fn());
    formatExceptionStub = jest
      .spyOn(betaDeployRetrieveUtils, 'formatException')
      .mockImplementation(jest.fn());
  });

  describe('run', () => {
    it('should handle a SourceConflictError', async () => {
      const executor = new TestDeployRetrieveExecutor('', '');

      await executor.run({ type: 'CONTINUE', data: {} });

      expect(executor.handleSourceConflictErrorCalled).toBe(true);
      expect(executor.error).toBe(dummySourceConflictError);
      expect(formatExceptionStub).not.toHaveBeenCalled();
    });

    it('should format and throw a non-SourceConflictError', async () => {
      const executor = new TestDeployRetrieveExecutor(
        '',
        '',
        'NonSourceConflictError'
      );

      try {
        await executor.run({ type: 'CONTINUE', data: {} });
      } catch (error) {}

      expect(executor.handleSourceConflictErrorCalled).toBe(false);
      expect(formatExceptionStub).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NonSourceConflictError' })
      );
    });
  });
});
