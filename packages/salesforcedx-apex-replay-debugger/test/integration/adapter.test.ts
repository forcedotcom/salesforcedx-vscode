/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import Uri from 'vscode-uri';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../src/adapter/apexReplayDebug';
import { LineBreakpointInfo } from '../../src/breakpoints';
import { LINE_BREAKPOINT_INFO_REQUEST } from '../../src/constants';
import { GoldFileUtil } from './goldFileUtil';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const CONFIG_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'test',
  'integration',
  'config'
);
const LOG_FOLDER = path.join(CONFIG_DIR, 'logs');
const LINE_BREAKPOINT_INFO: LineBreakpointInfo[] = [];

// tslint:disable:no-unused-expression
describe('Replay debugger adapter - integration', function() {
  // tslint:disable-next-line:no-invalid-this
  this.timeout(320000);
  let goldFileUtil: GoldFileUtil;
  let dc: DebugClient;
  let projectPath: string;
  let classA: string;
  let classB: string;
  let classRecursive: string;
  const classAValidLines = [42];
  const classBValidLines = [42];
  const classRecursiveValidLines = [7];

  before(async () => {
    projectPath = path.join(process.cwd(), PROJECT_NAME);
    console.log(`projectPath: ${projectPath}`);

    classA = Uri.file(
      `${projectPath}/force-app/main/default/classes/A.cls`
    ).toString();
    classB = Uri.file(
      `${projectPath}/force-app/main/default/classes/B.cls`
    ).toString();
    classRecursive = Uri.file(
      `${projectPath}/force-app/main/default/classes/RecursiveTest.cls`
    ).toString();
    if (process.platform === 'win32') {
      classA = classA.replace('%3A', ':');
      classB = classB.replace('%3A', ':');
      classRecursive = classRecursive.replace('%3A', ':');
    }
    console.log(
      `classA: ${classA}. classB: ${classB}. classRecursive: ${classRecursive}`
    );
    LINE_BREAKPOINT_INFO.push(
      {
        uri: classA,
        typeref: 'A',
        lines: classAValidLines
      },
      {
        uri: classB,
        typeref: 'B',
        lines: classBValidLines
      },
      {
        uri: classRecursive,
        typeref: 'RecursiveTest',
        lines: classRecursiveValidLines
      }
    );
    // Use dc.start(4712) to debug the adapter during
    // tests (adapter needs to be launched in debug mode separately).
    dc = new DebugClient(
      'node',
      './out/src/adapter/apexReplayDebug.js',
      'apex-replay'
    );
    await dc.start();
    dc.defaultTimeout = 10000;
  });

  after(async () => {
    if (dc) {
      dc.stop();
    }
  });

  it('Should not attach', async () => {
    try {
      await dc.attachRequest({});
      expect.fail('Debugger client should have thrown an error');
      // tslint:disable-next-line:no-empty
    } catch (error) {}
  });

  it('Recursive stack', async () => {
    const testName = 'recursive';
    const logFilePath = path.join(LOG_FOLDER, `${testName}.log`);
    goldFileUtil = new GoldFileUtil(
      dc,
      path.join(LOG_FOLDER, `${testName}.gold`)
    );

    await dc.customRequest(LINE_BREAKPOINT_INFO_REQUEST, LINE_BREAKPOINT_INFO);

    const launchResponse = await dc.launchRequest({
      sfdxProject: projectPath,
      logFile: logFilePath,
      stopOnEntry: true,
      trace: true
    } as LaunchRequestArguments);
    expect(launchResponse.success).to.equal(true);

    try {
      const classAPath = Uri.parse(classA).fsPath;
      const classBPath = Uri.parse(classB).fsPath;
      const classRecursivePath = Uri.parse(classRecursive).fsPath;
      console.log(
        `classBPath: ${classAPath}. classBPath: ${classBPath}. classRecursivePath: ${classRecursivePath}`
      );
      let addBreakpointsResponse = await dc.setBreakpointsRequest(
        createBreakpointsArgs(classAPath, classAValidLines)
      );
      assertBreakpointsCreated(
        addBreakpointsResponse,
        1,
        classAPath,
        classAValidLines
      );
      addBreakpointsResponse = await dc.setBreakpointsRequest(
        createBreakpointsArgs(classBPath, classBValidLines)
      );
      assertBreakpointsCreated(
        addBreakpointsResponse,
        1,
        classBPath,
        classBValidLines
      );

      dc.configurationDoneRequest({});

      // Verify stopped on the first line of debug log
      const stackTraceResponse = await dc.assertStoppedLocation('entry', {
        path: logFilePath,
        line: 1
      });
      expect(stackTraceResponse.body.stackFrames.length).to.equal(1);
      // Verify stopped on first breakpoint
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertTopState(
        'breakpoint',
        classBPath,
        classBValidLines[0]
      );
      // Verify stopped on second breakpoint
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertTopState(
        'breakpoint',
        classAPath,
        classAValidLines[0]
      );
      // Step out to test class
      await dc.stepOutRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertTopState(
        'step',
        classRecursivePath,
        classRecursiveValidLines[0]
      );
    } finally {
      const disconnectResponse = await dc.disconnectRequest({});
      expect(disconnectResponse.success).to.equal(true);
    }
  });
});

function createBreakpointsArgs(
  classPath: string,
  lineNumbers: number[]
): DebugProtocol.SetBreakpointsArguments {
  const result: DebugProtocol.SetBreakpointsArguments = {
    source: {
      path: classPath
    },
    lines: lineNumbers,
    breakpoints: []
  };
  lineNumbers.forEach(lineNumber =>
    result.breakpoints!.push({ line: lineNumber })
  );
  return result;
}

function assertBreakpointsCreated(
  response: DebugProtocol.SetBreakpointsResponse,
  expectedNumOfBreakpoints: number,
  expectedSourcePath: string,
  expectedLineNumbers: number[]
) {
  expect(response.success).to.equal(true);
  expect(response.body.breakpoints.length).to.equal(expectedNumOfBreakpoints);
  response.body.breakpoints.forEach(bp => {
    expect(bp.verified).to.be.true;
    expect(bp.source!.path).to.equal(expectedSourcePath);
    expect(expectedLineNumbers).to.include(bp.line!);
  });
}
