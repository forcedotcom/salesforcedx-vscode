/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject } from '@salesforce/core';
import { expect } from 'chai';
import { stub } from 'sinon';

import { SfdxProjectJsonParser } from '../../src/cli/sfdxProjectJsonParser';

const SFDX_PROJECT_PATH = 'fakeSfdxProjectPath';

/* tslint:disable:no-unused-expression */
describe('getPackageDirectoriesGlobString', () => {
  it('should return one package directory', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({
          packageDirectories: [{ path: 'force-app' }]
        })
      })
    );
    const parser = new SfdxProjectJsonParser();
    const packageDirectories = await parser.getPackageDirectoryPaths(
      SFDX_PROJECT_PATH
    );
    expect(packageDirectories).length.to.equal(1);
    expect(packageDirectories[0]).to.equal('force-app');
    sfdxProjectStub.restore();
  });

  it('should return multiple package directories', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({
          packageDirectories: [
            { path: 'package1' },
            { path: 'package2' },
            { path: 'package3' }
          ]
        })
      })
    );
    const parser = new SfdxProjectJsonParser();
    const packageDirectories = await parser.getPackageDirectoryPaths(
      SFDX_PROJECT_PATH
    );
    expect(packageDirectories).length.to.equal(3);
    expect(packageDirectories[0]).to.equal('package1');
    expect(packageDirectories[1]).to.equal('package2');
    expect(packageDirectories[2]).to.equal('package3');
    sfdxProjectStub.restore();
  });

  it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({ resolveProjectConfig: () => ({}) })
    );
    let errorWasThrown = false;
    try {
      const parser = new SfdxProjectJsonParser();
      await parser.getPackageDirectoryPaths(SFDX_PROJECT_PATH);
    } catch (error) {
      errorWasThrown = true;
      expect(error.name).to.equal('NoPackageDirectoriesFound');
    } finally {
      expect(errorWasThrown).to.be.true;
      sfdxProjectStub.restore();
    }
  });

  it('should throw an error if packageDirectories does not specify any paths', async () => {
    const sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({ packageDirectories: [] })
      })
    );
    let errorWasThrown = false;
    try {
      const parser = new SfdxProjectJsonParser();
      await parser.getPackageDirectoryPaths(SFDX_PROJECT_PATH);
    } catch (error) {
      errorWasThrown = true;
      expect(error.name).to.equal('NoPackageDirectoryPathsFound');
    } finally {
      expect(errorWasThrown).to.be.true;
      sfdxProjectStub.restore();
    }
  });
});
