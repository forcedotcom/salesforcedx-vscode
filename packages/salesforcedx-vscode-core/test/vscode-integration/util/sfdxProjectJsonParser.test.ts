/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject } from '@salesforce/core';
import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';

import { SfdxProjectJsonParser } from '../../../src/util';

const SFDX_PROJECT_PATH = 'fakeSfdxProjectPath';

/* tslint:disable:no-unused-expression */
describe('SFDX Project JSON Parser', () => {
  let sfdxProjectStub: SinonStub;
  let parser: SfdxProjectJsonParser;

  beforeEach(() => {
    parser = new SfdxProjectJsonParser();
  });

  afterEach(() => {
    sfdxProjectStub.restore();
  });

  describe('Get Project Config Values', () => {
    const bestFood = 'Swiss Cheese Fondue';
    sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
      Promise.resolve({
        resolveProjectConfig: () => ({ bestFood })
      })
    );

    it('Should correctly read sfdx-project config values', async () => {
      expect(await parser.getValue(SFDX_PROJECT_PATH, 'bestFood')).to.equal(
        bestFood
      );
      expect(await parser.getValue(SFDX_PROJECT_PATH, 'bestDrink')).to.be
        .undefined;
    });
  });

  describe('getPackageDirectoryPaths', () => {
    it('should return one package directory', async () => {
      sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
        Promise.resolve({
          resolveProjectConfig: () => ({
            packageDirectories: [{ path: 'force-app' }]
          })
        })
      );
      const packageDirectories = await parser.getPackageDirectoryPaths(
        SFDX_PROJECT_PATH
      );
      expect(packageDirectories).to.eql(['force-app']);
    });

    it('should return multiple package directories', async () => {
      sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
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
      const packageDirectories = await parser.getPackageDirectoryPaths(
        SFDX_PROJECT_PATH
      );
      expect(packageDirectories).to.eql(['package1', 'package2', 'package3']);
    });

    it('should trim whitespace and remove leading slashes from package directories', async () => {
      sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
        Promise.resolve({
          resolveProjectConfig: () => ({
            packageDirectories: [
              { path: '   package1   ' },
              { path: `${path.sep}package2` },
              { path: path.join('package', 'three') }
            ]
          })
        })
      );
      const packageDirectories = await parser.getPackageDirectoryPaths(
        SFDX_PROJECT_PATH
      );
      expect(packageDirectories).to.eql([
        'package1',
        'package2',
        path.join('package', 'three')
      ]);
    });

    it('should throw an error if no package directories are found in the sfdx-project.json', async () => {
      sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
        Promise.resolve({ resolveProjectConfig: () => ({}) })
      );
      let errorWasThrown = false;
      try {
        await parser.getPackageDirectoryPaths(SFDX_PROJECT_PATH);
      } catch (error) {
        errorWasThrown = true;
        expect(error.name).to.equal('NoPackageDirectoriesFound');
      } finally {
        expect(errorWasThrown).to.be.true;
      }
    });

    it('should throw an error if packageDirectories does not specify any paths', async () => {
      sfdxProjectStub = stub(SfdxProject, 'resolve').returns(
        Promise.resolve({
          resolveProjectConfig: () => ({ packageDirectories: [] })
        })
      );
      let errorWasThrown = false;
      try {
        await parser.getPackageDirectoryPaths(SFDX_PROJECT_PATH);
      } catch (error) {
        errorWasThrown = true;
        expect(error.name).to.equal('NoPackageDirectoryPathsFound');
      } finally {
        expect(errorWasThrown).to.be.true;
      }
    });
  });

  describe('getPackageDirectoryFullPaths', () => {
    it('returns the full paths to the package directories', async () => {
      const testPackage = 'testPackage';
      const anotherTestPackage = 'anotherTestPackage';

      const getPackageDirectoryPathsStub = stub(
        SfdxProjectJsonParser.prototype,
        'getPackageDirectoryPaths'
      ).returns([testPackage, anotherTestPackage]);

      const fullPaths = await parser.getPackageDirectoryFullPaths(
        SFDX_PROJECT_PATH
      );

      expect(fullPaths.length).to.equal(2);
      expect(fullPaths[0]).to.equal(path.join(SFDX_PROJECT_PATH, testPackage));
      expect(fullPaths[1]).to.equal(
        path.join(SFDX_PROJECT_PATH, anotherTestPackage)
      );
      getPackageDirectoryPathsStub.restore();
    });
  });
});
