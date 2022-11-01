import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import { IsvDebugBootstrapExecutor, ISVDEBUGGER } from '../../../../src/commands/isvdebugging/bootstrapCmd';

describe('isvdebugging unit test', () => {
  
  const TOOLS_FOLDER = 'tools';
  let relativeToolsFolderStub: jest.SpyInstance;

  let isvDebugBootstrapExecutorInst: IsvDebugBootstrapExecutor;

  beforeEach(() => {
    relativeToolsFolderStub = jest.spyOn(projectPaths, 'relativeToolsFolder').mockReturnValue(TOOLS_FOLDER);
    isvDebugBootstrapExecutorInst = new IsvDebugBootstrapExecutor();

  });

  it('should be defined', () => {
    expect(isvDebugBootstrapExecutorInst).toBeDefined();
  });
  
  it('should test readonly relativeMetdataTempPath property', () => {
    expect(isvDebugBootstrapExecutorInst.relativeMetdataTempPath).toEqual(path.join(TOOLS_FOLDER,ISVDEBUGGER));

  });
});