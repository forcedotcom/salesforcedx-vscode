/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ActionScriptEnum } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/commands';
import {
  CHECKPOINT,
  CHECKPOINTS_LOCK_STRING
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import * as AsyncLock from 'async-lock';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ApexExecutionOverlayAction,
  CheckpointInfoActionScriptNode,
  CheckpointInfoActionScriptTypeNode,
  CheckpointInfoIterationNode,
  CheckpointNode,
  checkpointService,
  parseCheckpointInfoFromBreakpoint,
  processBreakpointChangedForCheckpoints,
  sfdxToggleCheckpoint
} from '../../../src/breakpoints/checkpointService';

describe('Checkpoint Service - unit', () => {
  if (!checkpointsEnabled()) {
    console.log(
      'Checkpoints are not enabled, skipping CheckpointService tests'
    );
    return;
  }

  const breakpointId = '6c1d848c-fake-4c2c-8b90-5fabe1740da4';
  const breakpointEnabled = true;
  const actionObjectId = '1doxx000000FAKE';
  const uriInput = 'file:///bar.cls';
  const sourceFileInput = 'foo.cls';
  const typeRefInput = 'foo';
  const lineInput = 5;

  const checkpointOverlayAction: ApexExecutionOverlayAction = {
    ActionScript: '',
    ActionScriptType: ActionScriptEnum.None,
    ExecutableEntityName: typeRefInput,
    IsDumpingHeap: true,
    Iteration: 1,
    Line: lineInput
  };

  // Clean out the checkpoint list after each usage to ensure that
  // each test has a clean slate. Also has the added benefit of
  // additional testing for deleteCheckpointNode
  afterEach(() => {
    clearOutCheckpoints();
  });

  it('Verify checkpoint arguments and pre-set default values', async () => {
    const checkpointOverlayActionWithNoTypeRef: ApexExecutionOverlayAction = {
      ActionScript: '',
      ActionScriptType: ActionScriptEnum.None,
      ExecutableEntityName: undefined,
      IsDumpingHeap: true,
      Iteration: 1,
      Line: lineInput
    };
    const cpNode = checkpointService.createCheckpointNode(
      breakpointId,
      breakpointEnabled,
      uriInput,
      sourceFileInput,
      checkpointOverlayActionWithNoTypeRef
    );

    // Verify the typeRef is undefined until set
    expect(cpNode.getCheckpointTypeRef()).to.be.equal(undefined);
    cpNode.setCheckpointTypeRef(typeRefInput);

    // Verify get methods are returning what was input
    expect(cpNode.getCheckpointUri()).to.be.equal(uriInput);
    expect(cpNode.getCheckpointLineNumber()).to.be.equal(lineInput);

    // grab the json created from the object's internal ApexExecutionOverlayAction and
    // rount trip it back into an ApexExecutionOverlayAction and verify the values
    const jsonString = cpNode.createJSonStringForOverlayAction();
    const overlayAction = JSON.parse(jsonString) as ApexExecutionOverlayAction;

    // verify that the overlay action contains all inpput information
    expect(overlayAction.ExecutableEntityName).to.be.equal(typeRefInput);
    expect(overlayAction.Line).to.be.equal(lineInput);

    // verify the default values
    // IsDumpingHeap is initialized to true
    // Iteration is initalizied to 1
    // ActionScriptType is initalized to ActionScriptEnum.None
    // ActionScript is an empty string
    expect(overlayAction.IsDumpingHeap).to.be.equal(true);
    expect(overlayAction.Iteration).to.be.equal(1);
    expect(overlayAction.ActionScriptType).to.be.equal(ActionScriptEnum.None);
    expect(overlayAction.ActionScript).to.be.equal('');
  });

  it('Verify CheckpointNode has 3 child CheckpointInfoNodes after creation', async () => {
    const cpNode = checkpointService.createCheckpointNode(
      breakpointId,
      breakpointEnabled,
      uriInput,
      sourceFileInput,
      checkpointOverlayAction
    );

    expect(cpNode.getChildren().length).to.be.eq(3);

    // Verify that CheckpointNode as 3 child CheckpointInfo when the node was initially created and
    // only one of each type was created.
    let totalCheckpointInfoActionScriptNode = 0;
    let totalCheckpointInfoActionScriptTypeNode = 0;
    let totalCheckpointInfoIterationNode = 0;
    let totalUnknownNodeTypes = 0;
    for (const infoNode of cpNode.getChildren()) {
      // Can't do a switch on instance of but utilizing the constructor
      // can get around this
      switch (infoNode.constructor) {
        case CheckpointInfoActionScriptNode: {
          totalCheckpointInfoActionScriptNode++;
          break;
        }
        case CheckpointInfoActionScriptTypeNode: {
          totalCheckpointInfoActionScriptTypeNode++;
          break;
        }
        case CheckpointInfoIterationNode: {
          totalCheckpointInfoIterationNode++;
          break;
        }
        default: {
          totalUnknownNodeTypes++;
        }
      }
    }
    expect(totalCheckpointInfoActionScriptNode).to.be.eq(1);
    expect(totalCheckpointInfoActionScriptTypeNode).to.be.eq(1);
    expect(totalCheckpointInfoIterationNode).to.be.eq(1);
    expect(totalUnknownNodeTypes).to.be.eq(0);
  });

  it('CheckpointNode, Action Command Result tests', async () => {
    const cpNode = checkpointService.createCheckpointNode(
      breakpointId,
      breakpointEnabled,
      uriInput,
      sourceFileInput,
      checkpointOverlayAction
    );

    expect(cpNode.getActionCommandResultId()).to.be.eq(undefined);

    cpNode.setActionCommandResultId(actionObjectId);
    expect(cpNode.getActionCommandResultId()).to.be.eq(actionObjectId);

    expect(cpNode.getChildren().length).to.be.eq(3);
  });
});

// Verify that the vscode.debug.onDidChangeBreakpoints cal
describe('Verify checkpoint callback for vscode.debug.onDidChangeBreakpoints', () => {
  if (!checkpointsEnabled()) {
    console.log(
      'Checkpoints not enabled, skipping Verify checkpoint callback for vscode.debug.onDidChangeBreakpoints'
    );
    return;
  }

  // constant empty list
  const bpEmpty: vscode.Breakpoint[] = [];

  // These lists will get populated during the tests and cleared out after each one
  let bpAdd: vscode.Breakpoint[] = [];
  let bpRemove: vscode.Breakpoint[] = [];
  let bpChange: vscode.Breakpoint[] = [];

  const uriInput = 'file:///bar.cls';
  const lineInput = 5;
  // The breakpoint Id is a string, for tests with multiple breakpoints use this
  // as a base and append a number onto it.
  const breakpointId = '6c1d848c-fake-4c2c-8b90-5fabe1740da4';

  let lockSpy: sinon.SinonSpy;
  beforeEach(() => {
    lockSpy = sinon.spy(AsyncLock.prototype, 'acquire');
  });

  afterEach(() => {
    clearOutCheckpoints();
    // empty any arrays used for testing
    bpAdd = [];
    bpRemove = [];
    bpChange = [];
    lockSpy.restore();
  });

  it('adds a single checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    (breakpoint as any)._id = breakpointId;
    bpAdd.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that a single checkpoint has been added to the checkpoint service
    const theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (!theNode) {
      assert.fail(
        'Should have created a single node in the checkpointService and did not.'
      );
    }
    expect(lockSpy.calledOnce).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });

  it('adds multiple checkpoints', async () => {
    // Note: VS Code is going to ensure things like not having multiple breakpoints on the same line however
    // for the purposes of expediency only the IDs will be different for these tests
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint1 = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    const breakpointId1 = breakpointId + '1';
    (breakpoint1 as any)._id = breakpointId1;
    bpAdd.push(breakpoint1);
    const breakpoint2 = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    const breakpointId2 = breakpointId + '2';
    (breakpoint2 as any)._id = breakpointId2;
    bpAdd.push(breakpoint2);

    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that a single checkpoint has been added to the checkpoint service
    const theNode1 = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId1
    );
    if (!theNode1) {
      assert.fail(
        'Should have created a node in the checkpointService with id: ' +
          breakpointId1
      );
    }

    const theNode2 = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId2
    );
    if (!theNode2) {
      assert.fail(
        'Should have created a node in the checkpointService with id: ' +
          breakpointId2
      );
    }
    expect(lockSpy.calledTwice).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(1).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });

  it('add then remove checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    (breakpoint as any)._id = breakpointId;
    bpAdd.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that a single checkpoint has been added to the checkpoint service
    const theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (!theNode) {
      assert.fail(
        'Should have created a single node in the checkpointService and did not.'
      );
    }

    // Add the breakpoint to the removal list
    bpRemove.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpEmpty,
      removed: bpRemove,
      changed: bpChange
    });

    const deletedNote = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    // The node should be undefined as it was deleted
    if (deletedNote) {
      assert.fail('Should have removed the checkpoint node and did not.');
    }
    // Expect one lock call for add and one for delete
    expect(lockSpy.calledTwice).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(1).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });

  it('add and then change checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    (breakpoint as any)._id = breakpointId;
    bpAdd.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that a single checkpoint has been added to the checkpoint service
    let theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (!theNode) {
      assert.fail(
        'Should have created a single node in the checkpointService and did not.'
      );
    } else {
      expect(theNode.isCheckpointEnabled()).to.be.equal(true);
      expect(theNode.getIteration()).to.be.equal(1);
    }

    // Create the changed breakpoint which is the same breakpoint but has just been disabled
    const breakpoint2 = new vscode.SourceBreakpoint(
      location,
      false,
      CHECKPOINT,
      '4'
    );
    (breakpoint2 as any)._id = breakpointId;
    bpChange.push(breakpoint2);
    await processBreakpointChangedForCheckpoints({
      added: bpEmpty,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that the checkpoint has been updated, that the enabled flag is set to false and
    // the iterations has been updated from 1 to 4
    theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (!theNode) {
      assert.fail(
        'Should have created a single node in the checkpointService and did not.'
      );
    } else {
      expect(theNode.isCheckpointEnabled()).to.be.equal(false);
      expect(theNode.getIteration()).to.be.equal(4);
    }

    // Expect one lock call for add and one for change
    expect(lockSpy.calledTwice).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(1).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });

  it('changing a checkpoint by removing the checkpoint condition removes the checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    (breakpoint as any)._id = breakpointId;
    bpAdd.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that a single checkpoint has been added to the checkpoint service
    let theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (!theNode) {
      assert.fail(
        'Should have created a single node in the checkpointService and did not.'
      );
    }

    // Create the changed breakpoint which is the same breakpoint but has just been disabled
    const breakpoint2 = new vscode.SourceBreakpoint(
      location,
      false,
      undefined, // change the condition from 'checkpoint' to undefined
      undefined
    );
    (breakpoint2 as any)._id = breakpointId;
    bpChange.push(breakpoint2);
    await processBreakpointChangedForCheckpoints({
      added: bpEmpty,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that the checkpoint has been updated and that the enabled flag is set to false
    theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (theNode) {
      assert.fail(
        'Removing the checkpoint condition should have caused the checkpoint to be removed and did not'
      );
    }
    // Expect one lock call for add and one for change
    expect(lockSpy.calledTwice).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(1).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });

  it('changing a checkpoint by changing the breakpoint type removes the checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    (breakpoint as any)._id = breakpointId;
    bpAdd.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that a single checkpoint has been added to the checkpoint service
    let theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (!theNode) {
      assert.fail(
        'Should have created a single node in the checkpointService and did not.'
      );
    }

    // Create the changed breakpoint which is the same breakpoint but has just been disabled
    const breakpoint2 = new vscode.FunctionBreakpoint(
      'FunctionName',
      false,
      CHECKPOINT, // keep the checkpoint condition
      undefined
    );
    (breakpoint2 as any)._id = breakpointId;
    bpChange.push(breakpoint2);
    await processBreakpointChangedForCheckpoints({
      added: bpEmpty,
      removed: bpRemove,
      changed: bpChange
    });

    // Verify that the checkpoint has been updated and that the enabled flag is set to false
    theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (theNode) {
      assert.fail(
        'Changing the breakpoint type from SourceBreakpoint to another breakpoint type should have caused the checkpoint to be removed and did not'
      );
    }
    // Expect one lock call for add and one for change
    expect(lockSpy.calledTwice).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(1).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });

  it('changing the logMessage can change the ActionScriptType', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    (breakpoint as any)._id = breakpointId;
    bpAdd.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpAdd,
      removed: bpRemove,
      changed: bpChange
    });

    // The first breakpoint should have no ActionScript or ActionScriptType
    let theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (theNode) {
      expect(theNode.getActionScriptType()).to.be.equal(ActionScriptEnum.None);
      expect(theNode.getActionScript()).to.be.equal('');
    } else {
      assert.fail('Did not create the initial breakpoint');
    }

    // Update the breakpoint to an Apex action
    const apexLogMessage = 'SomeApexClass.SomeApexStaticFunction()';
    (breakpoint as any).logMessage = apexLogMessage;
    bpChange.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpEmpty,
      removed: bpRemove,
      changed: bpChange
    });

    theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (theNode) {
      expect(theNode.getActionScriptType()).to.be.equal(ActionScriptEnum.Apex);
      expect(theNode.getActionScript()).to.be.equal(apexLogMessage);
    } else {
      assert.fail('Unable to get node after Apex logMessage update');
    }
    bpChange.pop();

    // Update the breakpoint to a SOQL action
    const soqlLogMessage = 'select something from something where something';
    (breakpoint as any).logMessage = soqlLogMessage;
    bpChange.push(breakpoint);
    await processBreakpointChangedForCheckpoints({
      added: bpEmpty,
      removed: bpRemove,
      changed: bpChange
    });

    theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
      breakpointId
    );
    if (theNode) {
      expect(theNode.getActionScriptType()).to.be.equal(ActionScriptEnum.SOQL);
      expect(theNode.getActionScript()).to.be.equal(soqlLogMessage);
    } else {
      assert.fail('Unable to get node after SOQL logMessage update');
    }

    // Expect one lock call for add and two for change
    expect(lockSpy.calledThrice).to.equal(true);
    expect(lockSpy.getCall(0).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(1).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
    expect(lockSpy.getCall(2).args[0]).to.equal(CHECKPOINTS_LOCK_STRING);
  });
});

// Checkpoints rely on the information from conditional source breakpoint.
// The pieces of those and what they belong to are as follows:
// hitCondition = Iteration
// logMessage = actionScript with the following criteria
//  1. if the logMessage is empty or undefined then the ActionScriptType is ActionScriptEnum.None
//  2. if the logMessage starts with 'select' then the ActionScriptType is ActionScriptEnum.SOQL
//  3. if the logMessage isn't empty and doesn't start with 'select' then it is treated as ActionScriptEnum.Apex
// IsDumpingHeap defaults to true, there's currently no way to reset this.
describe('Checkpoint parsing from SourceBreakpoint', () => {
  if (!checkpointsEnabled()) {
    console.log(
      'Checkpoints not enabled, skipping Checkpoint parsing from SourceBreakpoint'
    );
    return;
  }

  const uriInput = 'file:///bar.cls';
  const lineInput = 5;

  it('parse overlay action with default values', async () => {
    // Create the range (line 5 of the file but 0 base means we need to subtract one for the breakpoint range)
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    const overlayAction = parseCheckpointInfoFromBreakpoint(breakpoint);
    expect(overlayAction.ActionScript).to.be.equal('');
    expect(overlayAction.ActionScriptType).to.be.equal(ActionScriptEnum.None);
    expect(overlayAction.IsDumpingHeap).to.be.equal(true);
    expect(overlayAction.Iteration).to.be.equal(1);
    expect(overlayAction.Line).to.be.equal(5);
    expect(overlayAction.ExecutableEntityName).to.be.equal(undefined);
  });

  it('parse overlay action with hitCondition (iteration)', async () => {
    // Create the range (line 5 of the file but 0 base means we need to subtract one for the breakpoint range)
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      '3'
    );
    const overlayAction = parseCheckpointInfoFromBreakpoint(breakpoint);
    expect(overlayAction.ActionScript).to.be.equal('');
    expect(overlayAction.ActionScriptType).to.be.equal(ActionScriptEnum.None);
    expect(overlayAction.IsDumpingHeap).to.be.equal(true);
    expect(overlayAction.Iteration).to.be.equal(3);
    expect(overlayAction.Line).to.be.equal(5);
    expect(overlayAction.ExecutableEntityName).to.be.equal(undefined);
  });

  it('parse overlay action with logMessage that is SOQL', async () => {
    // Create the range (line 5 of the file but 0 base means we need to subtract one for the breakpoint range)
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    const logMessage = 'select something from something';
    (breakpoint as any).logMessage = logMessage;
    const overlayAction = parseCheckpointInfoFromBreakpoint(breakpoint);
    expect(overlayAction.ActionScript).to.be.equal(logMessage);
    expect(overlayAction.ActionScriptType).to.be.equal(ActionScriptEnum.SOQL);
    expect(overlayAction.IsDumpingHeap).to.be.equal(true);
    expect(overlayAction.Iteration).to.be.equal(1);
    expect(overlayAction.Line).to.be.equal(5);
    expect(overlayAction.ExecutableEntityName).to.be.equal(undefined);
  });

  it('parse overlay action with logMessage that is Apex', async () => {
    // Create the range (line 5 of the file but 0 base means we need to subtract one for the breakpoint range)
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      undefined
    );
    const logMessage = 'SomeApexClass.SomeApexStaticFunction()';
    (breakpoint as any).logMessage = logMessage;
    const overlayAction = parseCheckpointInfoFromBreakpoint(breakpoint);
    expect(overlayAction.ActionScript).to.be.equal(logMessage);
    expect(overlayAction.ActionScriptType).to.be.equal(ActionScriptEnum.Apex);
    expect(overlayAction.IsDumpingHeap).to.be.equal(true);
    expect(overlayAction.Iteration).to.be.equal(1);
    expect(overlayAction.Line).to.be.equal(5);
    expect(overlayAction.ExecutableEntityName).to.be.equal(undefined);
  });
});

describe('Verify SFDX Toggle Checkpoint callback, sfdxToggleCheckpoint', () => {
  if (!checkpointsEnabled()) {
    console.log(
      'Checkpoints not enabled, skipping Verify SFDX Toggle Checkpoint callback, sfdxToggleCheckpoint'
    );
    return;
  }

  const cpService = require('../../../src/breakpoints/checkpointService');

  const breakpointEnabled = true;
  const uriInput = vscode.Uri.parse('file:///bar.cls');
  const lineInput = 5;

  // These need to be stubbed in order to not require an open file in an active editor with a selection.
  // tslint had to be disabled for these two variables because, being stubs, they're not directly called
  // in here and it'll cause lint to fail.
  /* tslint:disable */
  const fetchActiveEditorUriStub = sinon
    .stub(cpService, 'fetchActiveEditorUri')
    .returns(uriInput);
  const fetchActiveSelectionLineNumberStub = sinon
    .stub(cpService, 'fetchActiveSelectionLineNumber')
    .returns(lineInput - 1);
  /* tslint:enable */
  let addBreakpointsStub: sinon.SinonStub;
  let removeBreakpointsStub: sinon.SinonStub;
  let bpAdd: vscode.Breakpoint[] = [];
  let bpArr: vscode.Breakpoint[] = [];

  afterEach(async () => {
    addBreakpointsStub.restore();
    removeBreakpointsStub.restore();
    bpAdd = [];
    bpArr = [];
    clearOutCheckpoints();
    await clearExistingBreakpoints();
  });

  it('Toggle adds a new checkpoint breakpoint on a line with no existing breakpoint or checkpoint', async () => {
    addBreakpointsStub = sinon.stub(vscode.debug, 'addBreakpoints');
    removeBreakpointsStub = sinon.stub(vscode.debug, 'removeBreakpoints');
    // With no existing breakpoints the toggle will create one
    // and call addBreakpoints.
    await sfdxToggleCheckpoint();
    // Nothing should be deleted
    expect(removeBreakpointsStub.notCalled).to.be.equal(true);
    // Add should be called once with a single argument
    expect(addBreakpointsStub.calledOnce).to.be.equal(true);
    bpArr = addBreakpointsStub.getCall(0).args[0];
    expect(bpArr.length).to.be.equal(1);
    // The condition in the add should be a checkpoint
    expect((bpArr[0] as vscode.SourceBreakpoint).condition).to.be.equal(
      CHECKPOINT
    );
    // Verify the uri/line information
    expect(
      (bpArr[0] as vscode.SourceBreakpoint).location.uri.toString()
    ).to.be.equal(uriInput.toString());
    expect(
      (bpArr[0] as vscode.SourceBreakpoint).location.range.start.line
    ).to.be.equal(lineInput - 1);
  });

  it('Toggle an existing non-checkpoint breakpoint recreates the breakpoint as a checkopint breakpoint', async () => {
    // create a non-checkpoint breakpoint which will be the existing breakpoint
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const location = new vscode.Location(uriInput, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      breakpointEnabled,
      undefined,
      undefined
    );
    // This is necessary to add an existing breakpoint to find
    bpAdd.push(breakpoint);
    await vscode.debug.addBreakpoints(bpAdd);

    addBreakpointsStub = sinon.stub(vscode.debug, 'addBreakpoints');
    removeBreakpointsStub = sinon.stub(vscode.debug, 'removeBreakpoints');
    // With an existing breakpoints the old one will have to be deleted before the and call addBreakpoints.
    await sfdxToggleCheckpoint();

    // Verify the remove arguments
    expect(removeBreakpointsStub.calledOnce).to.be.equal(true);
    bpArr = removeBreakpointsStub.getCall(0).args[0];
    expect(bpArr.length).to.be.equal(1);
    expect(
      breakpointsHaveSameUriAndSourceLine(breakpoint, bpArr[0])
    ).to.be.equal(true);
    // The condition in the remove should be undefined
    expect((bpArr[0] as vscode.SourceBreakpoint).condition).to.be.equal(
      undefined
    );

    // Verify the add arguments which should be the same
    expect(addBreakpointsStub.calledOnce).to.be.equal(true);
    bpArr = addBreakpointsStub.getCall(0).args[0];
    expect(bpArr.length).to.be.equal(1);
    expect(
      breakpointsHaveSameUriAndSourceLine(breakpoint, bpArr[0])
    ).to.be.equal(true);
    // The condition in the add should be a checkpoint
    expect((bpArr[0] as vscode.SourceBreakpoint).condition).to.be.equal(
      CHECKPOINT
    );
  });

  it('Toggling an existing non-checkpoint breakpoint only keeps the hitCondition', async () => {
    // create a non-checkpoint breakpoint with a hit condition
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const location = new vscode.Location(uriInput, range);
    const hitCondition = '4';
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      breakpointEnabled,
      undefined,
      hitCondition
    );
    bpAdd.push(breakpoint);
    await vscode.debug.addBreakpoints(bpAdd);

    addBreakpointsStub = sinon.stub(vscode.debug, 'addBreakpoints');
    removeBreakpointsStub = sinon.stub(vscode.debug, 'removeBreakpoints');
    // With an existing breakpoints the old one will have to be deleted before the and call addBreakpoints.
    await sfdxToggleCheckpoint();

    // Verify the remove arguments
    expect(removeBreakpointsStub.calledOnce).to.be.equal(true);
    bpArr = removeBreakpointsStub.getCall(0).args[0];
    expect(bpArr.length).to.be.equal(1);
    expect(
      breakpointsHaveSameUriAndSourceLine(breakpoint, bpArr[0])
    ).to.be.equal(true);
    // The condition in the remove should be undefined
    expect((bpArr[0] as vscode.SourceBreakpoint).condition).to.be.equal(
      undefined
    );

    // Verify the add arguments which should be the same
    expect(addBreakpointsStub.calledOnce).to.be.equal(true);
    bpArr = addBreakpointsStub.getCall(0).args[0];
    expect(bpArr.length).to.be.equal(1);
    expect(
      breakpointsHaveSameUriAndSourceLine(breakpoint, bpArr[0])
    ).to.be.equal(true);
    // The condition in the add should be a checkpoint
    expect((bpArr[0] as vscode.SourceBreakpoint).condition).to.be.equal(
      CHECKPOINT
    );
    expect(bpArr[0].hitCondition).to.be.equal(hitCondition);
    expect(bpArr[0].logMessage).to.be.equal(undefined);
    expect(bpArr[0].enabled).to.be.equal(true);
  });

  it('Toggle an existing checkpoint breakpoint removes the breakpoint', async () => {
    // create a checkpoint breakpoint to remove
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const location = new vscode.Location(uriInput, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      breakpointEnabled,
      CHECKPOINT,
      undefined
    );
    // This is necessary to add an existing breakpoint to find
    bpAdd.push(breakpoint);
    await vscode.debug.addBreakpoints(bpAdd);

    addBreakpointsStub = sinon.stub(vscode.debug, 'addBreakpoints');
    removeBreakpointsStub = sinon.stub(vscode.debug, 'removeBreakpoints');
    await sfdxToggleCheckpoint();

    // Add should not have been called
    expect(addBreakpointsStub.notCalled).to.be.equal(true);

    // Verify remove was called once and breakpoint argument matches
    expect(removeBreakpointsStub.calledOnce).to.be.equal(true);
    bpArr = removeBreakpointsStub.getCall(0).args[0];
    expect(bpArr.length).to.be.equal(1);
    expect(
      breakpointsHaveSameUriAndSourceLine(breakpoint, bpArr[0])
    ).to.be.equal(true);
    // The condition in the remove should be undefined
    expect((bpArr[0] as vscode.SourceBreakpoint).condition).to.be.equal(
      CHECKPOINT
    );
  });
});

function breakpointsHaveSameUriAndSourceLine(
  bp1: vscode.Breakpoint,
  bp2: vscode.Breakpoint
): boolean {
  // both breakpoints are source breakpoints
  if (
    bp1 instanceof vscode.SourceBreakpoint &&
    bp2 instanceof vscode.SourceBreakpoint
  ) {
    // effectively, the breakpoints are equal of the uri and source lines match
    if (
      bp1.location.uri.toString() === bp2.location.uri.toString() &&
      bp2.location.range.start.line === bp2.location.range.start.line
    ) {
      return true;
    }
  }
  return false;
}

async function clearExistingBreakpoints() {
  await vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
}

// Clean out the checkpoints from the checkpointService (has the added bonus of beating
// on deleteCheckpointNode)
function clearOutCheckpoints() {
  for (const checkpoint of checkpointService.getChildren()) {
    // While every child here is a CheckpointNode, getChildren returns an
    // array of BaseNode and if we want to get at the methods on an actual
    // CheckpointNode we have to do verify the instance.
    if (checkpoint instanceof CheckpointNode) {
      checkpointService.deleteCheckpointNodeIfExists(
        checkpoint.getBreakpointId()
      );
    }
  }
}

function checkpointsEnabled(): boolean {
  const config = vscode.workspace.getConfiguration();
  const enabled = config.get(
    'salesforcedx-vscode-apex-replay-debugger-checkpoints.enabled',
    false
  );
  return enabled;
}
