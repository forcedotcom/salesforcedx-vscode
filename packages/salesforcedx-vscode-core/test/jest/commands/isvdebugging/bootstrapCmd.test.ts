import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import { INSTALLED_PACKAGES, IsvDebugBootstrapExecutor, ISVDEBUGGER, PACKAGE_XML } from '../../../../src/commands/isvdebugging/bootstrapCmd';

describe('isvdebugging unit test', () => {

  const TOOLS_FOLDER = 'tools';
  let relativeToolsFolderStub: jest.SpyInstance;

  let isvDebugBootstrapExecutorInst: IsvDebugBootstrapExecutor;

  beforeEach(() => {
    relativeToolsFolderStub = jest.spyOn(projectPaths, 'relativeToolsFolder').mockReturnValue(TOOLS_FOLDER);
  });

  it('should be defined', () => {
    isvDebugBootstrapExecutorInst = new IsvDebugBootstrapExecutor();
    expect(isvDebugBootstrapExecutorInst).toBeDefined();
  });

  it('should test readonly relativeMetadataTempPath property', () => {
    isvDebugBootstrapExecutorInst = new IsvDebugBootstrapExecutor();
    expect(isvDebugBootstrapExecutorInst.relativeMetadataTempPath).toEqual(path.join(TOOLS_FOLDER, ISVDEBUGGER));
    expect(relativeToolsFolderStub).toBeCalled();
  });

  it('should test readonly relativeApexPackageXmlPath property', () => {
    isvDebugBootstrapExecutorInst = new IsvDebugBootstrapExecutor();
    expect(isvDebugBootstrapExecutorInst.relativeApexPackageXmlPath).toEqual(path.join(isvDebugBootstrapExecutorInst.relativeMetadataTempPath, PACKAGE_XML));
  });

  it('should test readonly relativeInstalledPackagesPath property', () => {
    isvDebugBootstrapExecutorInst = new IsvDebugBootstrapExecutor();
    expect(isvDebugBootstrapExecutorInst.relativeInstalledPackagesPath).toEqual(path.join(TOOLS_FOLDER, INSTALLED_PACKAGES));
    expect(relativeToolsFolderStub).toBeCalled();
  });
});
