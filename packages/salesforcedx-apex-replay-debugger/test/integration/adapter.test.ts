/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import { DebugClient } from '@vscode/debugadapter-testsupport';
import { readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { type LaunchRequestArguments } from '../../src/adapter/types';

const CONFIG_DIR = URI.file(join(__dirname, 'config')).fsPath;
const THREAD_ID = 1;

describe('Replay debugger adapter - integration', () => {
  let dc: DebugClient;

  beforeEach(async () => {
    // Use dc.start(4712) to debug the adapter during
    // tests (adapter needs to be launched in debug mode separately).
    dc = new DebugClient('node', '../salesforcedx-vscode-apex-replay-debugger/dist/apexReplayDebug.js', 'apex-replay');
    dc.defaultTimeout = 10_000;
    await dc.start();
    await dc.initializeRequest();
  });

  afterEach(async () => {
    await dc.stop();
  });

  it('Recursive stack', async () => {
    const classAPath = join(CONFIG_DIR, 'recursive', 'classes', 'A.cls');
    const classBPath = join(CONFIG_DIR, 'recursive', 'classes', 'B.cls');
    const classRecursivePath = join(CONFIG_DIR, 'recursive', 'classes', 'RecursiveTest.cls');
    const lineBpInfo = [
      { uri: pathToFileURL(classAPath).href, typeref: 'A', lines: [42] },
      { uri: pathToFileURL(classBPath).href, typeref: 'B', lines: [42] },
      { uri: pathToFileURL(classRecursivePath).href, typeref: 'RecursiveTest', lines: [7] }
    ];
    const logFilePath = join(CONFIG_DIR, 'logs', 'recursive.log');
    await launch(dc, logFilePath, lineBpInfo);
    await setBreakpoints(dc, classAPath, [42]);
    await setBreakpoints(dc, classBPath, [42]);
    await assertStoppedOnEntry(dc, logFilePath);

    // Verify stopped on first breakpoint.
    const firstBreakpoint = readStoppedState(dc, 'breakpoint', classBPath, 42, 'top');
    await dc.continueRequest({ threadId: THREAD_ID });
    expect(await firstBreakpoint).toMatchSnapshot('B breakpoint');

    // Verify stopped on second breakpoint.
    const secondBreakpoint = readStoppedState(dc, 'breakpoint', classAPath, 42, 'top');
    await dc.continueRequest({ threadId: THREAD_ID });
    expect(await secondBreakpoint).toMatchSnapshot('A breakpoint');

    // Step out to test class.
    const stepOut = readStoppedState(dc, 'step', classRecursivePath, 7, 'top');
    await dc.stepOutRequest({ threadId: THREAD_ID });
    expect(await stepOut).toMatchSnapshot('step out');
  });

  it('Static variable of one class in different frames', async () => {
    const classStaticVarsAPath = join(CONFIG_DIR, 'statics', 'classes', 'StaticVarsA.cls');
    const logFilePath = join(CONFIG_DIR, 'logs', 'statics.log');
    await launch(dc, logFilePath, [
      { uri: pathToFileURL(classStaticVarsAPath).href, typeref: 'StaticVarsA', lines: [9] }
    ]);
    await setBreakpoints(dc, classStaticVarsAPath, [9]);
    await assertStoppedOnEntry(dc, logFilePath);

    // Verify static variables in every frame at the first breakpoint.
    const breakpoint = readStoppedState(dc, 'breakpoint', classStaticVarsAPath, 9, 'all');
    await dc.continueRequest({ threadId: THREAD_ID });
    expect(await breakpoint).toMatchSnapshot();
  });
});

const launch = async (dc: DebugClient, logFilePath: string, lineBreakpointInfo: LineBreakpointInfo[]) => {
  const args: LaunchRequestArguments = {
    logFileContents: await readFile(logFilePath, 'utf8'),
    logFilePath,
    logFileName: basename(logFilePath),
    stopOnEntry: true,
    trace: true,
    lineBreakpointInfo
  };
  expect((await dc.launchRequest(args)).success).toBe(true);
};

const setBreakpoints = async (dc: DebugClient, classPath: string, lines: number[]) => {
  const response = await dc.setBreakpointsRequest({
    source: { path: classPath },
    lines,
    breakpoints: lines.map(line => ({ line }))
  });
  expect(response.success).toBe(true);
  expect(response.body.breakpoints).toHaveLength(lines.length);
  response.body.breakpoints.forEach(bp => {
    expect(bp.verified).toBe(true);
    expect(bp.source?.path).toBe(classPath);
    expect(lines).toContain(bp.line);
  });
};

const assertStoppedOnEntry = async (dc: DebugClient, logFilePath: string) => {
  const entry = dc.assertStoppedLocation('entry', { path: logFilePath, line: 1 });
  // The adapter emits 'stopped' for configurationDone without a response.
  await Promise.race([dc.configurationDoneRequest({}), entry]);
  expect((await entry).body.stackFrames).toHaveLength(1);
};

const readStoppedState = async (dc: DebugClient, reason: string, path: string, line: number, frames: 'top' | 'all') => {
  const response = await dc.assertStoppedLocation(reason, { path, line });
  const stackFrames = response.body.stackFrames;
  const variables = await Promise.all(
    (frames === 'top' ? stackFrames.slice(0, 1) : stackFrames).map(async frame => {
      const scopes = (await dc.scopesRequest({ frameId: frame.id })).body.scopes;
      expect(scopes.map(scope => scope.name)).toEqual(['Local', 'Static', 'Global']);
      const local = await dc.variablesRequest({ variablesReference: scopes[0].variablesReference });
      const staticVariables = await dc.variablesRequest({ variablesReference: scopes[1].variablesReference });
      return { frameId: frame.id, local: local.body.variables, static: staticVariables.body.variables };
    })
  );

  return {
    stackFrames: stackFrames.map(frame => ({
      ...frame,
      ...(frame.source && {
        source: {
          ...frame.source,
          ...(frame.source.path && {
            path: `<fixtures>/${relative(CONFIG_DIR, frame.source.path).replaceAll('\\', '/')}`
          })
        }
      })
    })),
    variables
  };
};
