/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as util from '@salesforce/salesforcedx-utils-vscode/out/src/test/orgUtils';
import { expect } from 'chai';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import Uri from 'vscode-uri';
import { LaunchRequestArguments } from '../../src/adapter/apexDebug';
import { LineBreakpointInfo } from '../../src/breakpoints/lineBreakpoint';
import { LINE_BREAKPOINT_INFO_REQUEST } from '../../src/constants';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const SIMPLE_VARIABLES_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'test',
  'integration',
  'config',
  'variables'
);
const SOURCE_FOLDER = path.join(SIMPLE_VARIABLES_DIR, 'source');
const APEX_EXEC_FILE = path.join(SIMPLE_VARIABLES_DIR, 'apexExec', 'test.apex');
const LINE_BREAKPOINT_INFO: LineBreakpointInfo[] = [];

/**
 * These integration tests assume the environment has authenticated to
 * a Dev Hub and it is set as the default Dev Hub.
 */
describe('Interactive debugger adapter - integration', function() {
  // tslint:disable-next-line:no-invalid-this
  this.timeout(320000);
  let dc: DebugClient;
  let userName: string;
  let projectPath: string;
  let apexClassUri: string;

  before(async () => {
    // Create SFDX project
    projectPath = path.join(process.cwd(), PROJECT_NAME);
    console.log(`projectPath: ${projectPath}`);
    await util.createSFDXProject(PROJECT_NAME);
    // Create scratch org with Debug Apex enabled
    util.addFeatureToScratchOrgConfig(PROJECT_NAME, 'DebugApex');
    apexClassUri = Uri.file(
      `${projectPath}/force-app/main/default/classes/BasicVariables.cls`
    ).toString();
    if (process.platform === 'win32') {
      apexClassUri = apexClassUri.replace('%3A', ':');
    }
    console.log(`apexClassUri: ${apexClassUri}`);
    LINE_BREAKPOINT_INFO.push({
      uri: apexClassUri,
      typeref: 'BasicVariables',
      lines: [
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        27,
        29,
        30,
        31,
        32,
        33,
        34,
        36,
        37,
        39,
        40,
        42
      ]
    });
    LINE_BREAKPOINT_INFO.push({
      uri: apexClassUri,
      typeref: 'BasicVariables$MyInnerClass',
      lines: [6, 7]
    });
    userName = await util.createScratchOrg(PROJECT_NAME);
    // Push source to scratch org
    await util.pushSource(SOURCE_FOLDER, PROJECT_NAME, userName);
    // Assign Debug Apex permission to user
    await util.assignPermissionSet('DebugApex', userName);
    // Start debugger client
    // Use dc.start(4711) to debug the adapter during
    // tests (adapter needs to be launched in debug mode separately).
    dc = new DebugClient('node', './out/src/adapter/apexDebug.js', 'apex');
    await dc.start();
    dc.defaultTimeout = 10000;
  });

  after(async () => {
    if (userName) {
      await util.deleteScratchOrg(PROJECT_NAME, userName);
    }
    rimraf.sync(projectPath);
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

  it('End-to-end flow', async () => {
    // Send line breakpoint info
    await dc.customRequest(LINE_BREAKPOINT_INFO_REQUEST, LINE_BREAKPOINT_INFO);
    // Launch Apex Debugger session
    const launchResponse = await dc.launchRequest({
      sfdxProject: projectPath
    } as LaunchRequestArguments);
    expect(launchResponse.success).to.equal(true);
    try {
      // Add breakpoint
      const apexClassPath = Uri.parse(apexClassUri).fsPath;
      console.log(`apexClassPath: ${apexClassPath}`);
      const addBreakpointsResponse = await dc.setBreakpointsRequest({
        source: {
          path: apexClassPath
        },
        lines: [42]
      });
      expect(addBreakpointsResponse.success).to.equal(true);
      expect(addBreakpointsResponse.body.breakpoints.length).to.equal(1);
      expect(addBreakpointsResponse.body.breakpoints[0]).to.deep.equal({
        verified: true,
        source: {
          path: apexClassPath
        },
        line: 42
      } as DebugProtocol.Breakpoint);
      // Invoke Apex method
      execApexNoWait(APEX_EXEC_FILE, userName);
      // Verify stack
      const stackTraceResponse = await dc.assertStoppedLocation('', {
        path: apexClassPath,
        line: 42
      });
      expect(stackTraceResponse.success).to.equal(true);
      expect(stackTraceResponse.body.stackFrames.length).to.equal(2);
      expect(stackTraceResponse.body.stackFrames[0].name).to.equal(
        'BasicVariables.testAll()'
      );
      expect(stackTraceResponse.body.stackFrames[1].name).to.equal(
        'anon.execute()'
      );
      // Verify threads
      const threadResponse = await dc.threadsRequest();
      expect(threadResponse.success).to.equal(true);
      expect(threadResponse.body.threads.length).to.equal(1);
      // Verify scopes
      const scopesResponse = await dc.scopesRequest({
        frameId: stackTraceResponse.body.stackFrames[0].id
      });
      expect(scopesResponse.success).to.equal(true);
      expect(scopesResponse.body.scopes.length).to.equal(3);
      expect(scopesResponse.body.scopes[0].name).to.equal('Local');
      expect(scopesResponse.body.scopes[1].name).to.equal('Static');
      expect(scopesResponse.body.scopes[2].name).to.equal('Global');
      // Verify variables
      const variablesResponse = await dc.variablesRequest({
        variablesReference: scopesResponse.body.scopes[0].variablesReference
      });
      expect(variablesResponse.success).to.equal(true);
      expect(variablesResponse.body.variables.length).is.greaterThan(0);
      // Expand variables
      for (const variable of variablesResponse.body.variables) {
        if (variable.variablesReference === 0) {
          continue;
        }
        const expandResponse = await dc.variablesRequest({
          variablesReference: variable.variablesReference
        });
        expect(expandResponse.success).to.equal(true);
        expect(expandResponse.body.variables.length).is.greaterThan(0);
      }
      // Finish the debugged request
      const nextResponse = await dc.nextRequest({
        threadId: threadResponse.body.threads[0].id
      });
      expect(nextResponse.success).to.equal(true);
      // Delete breakpoint
      const deleteBreakpointsResponse = await dc.setBreakpointsRequest({
        source: {
          path: apexClassPath
        },
        lines: []
      });
      expect(deleteBreakpointsResponse.success).to.equal(true);
      expect(deleteBreakpointsResponse.body.breakpoints.length).to.equal(0);
    } finally {
      // Disconnect Apex Debugger session
      const disconnectResponse = await dc.disconnectRequest({});
      expect(disconnectResponse.success).to.equal(true);
    }
  });
});

function execApexNoWait(
  apexExecFilePath: string,
  userName: string
): CommandExecution {
  return new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:apex:execute')
      .withFlag('--apexcodefile', apexExecFilePath)
      .withFlag('--targetusername', userName)
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
}
