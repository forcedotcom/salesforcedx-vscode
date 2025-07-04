/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import { DebugClient } from '@vscode/debugadapter-testsupport';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { ApexReplayDebug } from '../../src/adapter/apexReplayDebug';
import { GoldFileUtil } from './goldFileUtil';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const CONFIG_DIR = path.join(__dirname, '..', '..', 'test', 'integration', 'config');
const LOG_FOLDER = path.join(CONFIG_DIR, 'logs');

describe('Replay debugger adapter - integration', () => {
  jest.setTimeout(320000);
  let goldFileUtil: GoldFileUtil;
  let dc: DebugClient;
  let projectPath: string;
  let lineBpInfo: LineBreakpointInfo[];

  beforeAll(async () => {
    projectPath = path.join(process.cwd(), PROJECT_NAME);
    lineBpInfo = [];
    console.log(`projectPath: ${projectPath}`);

    // Use dc.start(4712) to debug the adapter during
    // tests (adapter needs to be launched in debug mode separately).
    dc = new DebugClient('node', './out/src/adapter/apexReplayDebug.js', 'apex-replay');
    await dc.start();
    dc.defaultTimeout = 10000;
  });

  afterAll(async () => {
    if (dc) {
      await dc.stop();
    }
  });

  it('Recursive stack', async () => {
    let classA = URI.file(`${projectPath}/force-app/main/default/classes/A.cls`).toString();
    let classB = URI.file(`${projectPath}/force-app/main/default/classes/B.cls`).toString();
    let classRecursive = URI.file(`${projectPath}/force-app/main/default/classes/RecursiveTest.cls`).toString();
    const classAValidLines = [42];
    const classBValidLines = [42];
    const classRecursiveValidLines = [7];
    if (process.platform === 'win32') {
      classA = classA.replace('%3A', ':');
      classB = classB.replace('%3A', ':');
      classRecursive = classRecursive.replace('%3A', ':');
    }
    console.log(`classA: ${classA}. classB: ${classB}. classRecursive: ${classRecursive}`);
    lineBpInfo.push(
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
    const testName = 'recursive';
    const logFilePath = path.join(LOG_FOLDER, `${testName}.log`);
    goldFileUtil = new GoldFileUtil(dc, path.join(LOG_FOLDER, `${testName}.gold`));

    const launchResponse = await dc.launchRequest({
      // @ts-expect-error this code added a new property to the LaunchRequestArguments type
      salesforceProject: projectPath,
      logFile: logFilePath,
      stopOnEntry: true,
      trace: true,
      lineBreakpointInfo: lineBpInfo,
      projectPath: undefined
    });
    expect(launchResponse.success).toBe(true);

    try {
      const classAPath = URI.parse(classA).fsPath;
      const classBPath = URI.parse(classB).fsPath;
      const classRecursivePath = URI.parse(classRecursive).fsPath;
      console.log(`classAPath: ${classAPath}. classBPath: ${classBPath}. classRecursivePath: ${classRecursivePath}`);
      let addBreakpointsResponse = await dc.setBreakpointsRequest(createBreakpointsArgs(classAPath, classAValidLines));
      assertBreakpointsCreated(addBreakpointsResponse, 1, classAPath, classAValidLines);
      addBreakpointsResponse = await dc.setBreakpointsRequest(createBreakpointsArgs(classBPath, classBValidLines));
      assertBreakpointsCreated(addBreakpointsResponse, 1, classBPath, classBValidLines);

      await dc.configurationDoneRequest({});
      // Verify stopped on the first line of debug log
      const stackTraceResponse = await dc.assertStoppedLocation('entry', {
        path: logFilePath,
        line: 1
      });
      expect(stackTraceResponse.body.stackFrames).toHaveLength(1);
      // Verify stopped on first breakpoint
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertTopState('breakpoint', classBPath, classBValidLines[0]);
      // Verify stopped on second breakpoint
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertTopState('breakpoint', classAPath, classAValidLines[0]);
      // Step out to test class
      await dc.stepOutRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertTopState('step', classRecursivePath, classRecursiveValidLines[0]);
    } finally {
      const disconnectResponse = await dc.disconnectRequest({});
      expect(disconnectResponse.success).toBe(true);
    }
  });

  it('Static variable of one class in different frames', async () => {
    let classStaticVarsA = URI.file(`${projectPath}/force-app/main/default/classes/StaticVarsA.cls`).toString();
    const classStaticVarsAValidLines = [9];
    if (process.platform === 'win32') {
      classStaticVarsA = classStaticVarsA.replace('%3A', ':');
    }
    console.log(`classStaticVarsA: ${classStaticVarsA}`);
    lineBpInfo.push({
      uri: classStaticVarsA,
      typeref: 'StaticVarsA',
      lines: classStaticVarsAValidLines
    });
    const testName = 'statics';
    const logFilePath = path.join(LOG_FOLDER, `${testName}.log`);
    goldFileUtil = new GoldFileUtil(dc, path.join(LOG_FOLDER, `${testName}.gold`));

    const launchResponse = await dc.launchRequest({
      // @ts-expect-error this code added a new property to the LaunchRequestArguments type
      salesforceProject: projectPath,
      logFile: logFilePath,
      stopOnEntry: true,
      trace: true,
      lineBreakpointInfo: lineBpInfo,
      projectPath: undefined
    });
    expect(launchResponse.success).toBe(true);

    try {
      const classStaticVarsAPath = URI.parse(classStaticVarsA).fsPath;
      console.log(`classStaticVarsAPath: ${classStaticVarsAPath}`);
      const addBreakpointsResponse = await dc.setBreakpointsRequest(
        createBreakpointsArgs(classStaticVarsAPath, classStaticVarsAValidLines)
      );
      assertBreakpointsCreated(addBreakpointsResponse, 1, classStaticVarsAPath, classStaticVarsAValidLines);

      await dc.configurationDoneRequest({});

      // Verify stopped on the first line of debug log
      const stackTraceResponse = await dc.assertStoppedLocation('entry', {
        path: logFilePath,
        line: 1
      });
      expect(stackTraceResponse.body.stackFrames).toHaveLength(1);
      // Verify stopped on first breakpoint
      await dc.continueRequest({
        threadId: ApexReplayDebug.THREAD_ID
      });
      await goldFileUtil.assertEntireState('breakpoint', classStaticVarsAPath, classStaticVarsAValidLines[0]);
    } finally {
      const disconnectResponse = await dc.disconnectRequest({});
      expect(disconnectResponse.success).toBe(true);
    }
  });
});

const createBreakpointsArgs = (classPath: string, lineNumbers: number[]): DebugProtocol.SetBreakpointsArguments => {
  const result: DebugProtocol.SetBreakpointsArguments = {
    source: {
      path: classPath
    },
    lines: lineNumbers,
    breakpoints: []
  };
  lineNumbers.forEach(lineNumber => result.breakpoints!.push({ line: lineNumber }));
  return result;
};

const assertBreakpointsCreated = (
  response: DebugProtocol.SetBreakpointsResponse,
  expectedNumOfBreakpoints: number,
  expectedSourcePath: string,
  expectedLineNumbers: number[]
) => {
  expect(response.success).toBe(true);
  expect(response.body.breakpoints).toHaveLength(expectedNumOfBreakpoints);
  response.body.breakpoints.forEach(bp => {
    expect(bp.verified).toBe(true);
    expect(bp.source?.path).toBe(expectedSourcePath);
    expect(expectedLineNumbers).toContain(bp.line);
  });
};
