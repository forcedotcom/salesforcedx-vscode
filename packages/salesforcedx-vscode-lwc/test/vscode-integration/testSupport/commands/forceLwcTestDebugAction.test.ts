/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { getDebugConfiguration } from '../../../../src/testSupport/commands/forceLwcTestDebugAction';

describe('Force LWC Test Debug - Code Action', () => {
  describe('Debug Test Case', () => {
    const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
    const sfdxProjectPath = path.join(root, 'project', 'mockSfdxProject');
    const lwcTestExecutablePath = path.join(
      sfdxProjectPath,
      'node_modules',
      '.bin',
      'lwc-jest'
    );
    const testRelativePath = path.join(
      'force-app',
      'main',
      'default',
      'lwc',
      'mockComponent',
      '__tests__',
      'mockTest.test.js'
    );
    const testFsPath = path.join(sfdxProjectPath, testRelativePath);
    const testName = 'mockTestName';
    it('Should generate debug configuration for single test case', () => {
      const debugConfiguration = getDebugConfiguration(
        lwcTestExecutablePath,
        sfdxProjectPath,
        testFsPath,
        testName
      );
      expect(debugConfiguration).to.deep.equal({
        type: 'node',
        request: 'launch',
        name: 'Debug LWC test(s)',
        cwd: sfdxProjectPath,
        runtimeExecutable: lwcTestExecutablePath,
        args: [
          '--debug',
          '--',
          '--runTestsByPath',
          /^win32/.test(process.platform) ? testRelativePath : testFsPath,
          '--testNamePattern',
          '"mockTestName"'
        ],
        console: 'integratedTerminal',
        internalConsoleOptions: 'openOnSessionStart',
        port: 9229,
        disableOptimisticBPs: true
      });
    });
  });
});
