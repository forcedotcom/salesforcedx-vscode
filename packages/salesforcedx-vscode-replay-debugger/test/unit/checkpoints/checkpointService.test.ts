/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
//import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ActionScriptEnum,
  ApexExecutionOverlayAction,
  CheckpointInfoActionScriptNode,
  CheckpointInfoActionScriptTypeNode,
  CheckpointInfoIterationNode,
  CheckpointNode,
  checkpointService,
  parseCheckpointInfoFromBreakpoint,
  processBreakpointChangedForCheckpoints
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

  afterEach(() => {
    clearOutCheckpoints();
    // empty any arrays used for testing
    bpAdd = [];
    bpRemove = [];
    bpChange = [];
  });

  it('adds a single checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
      'checkpoint',
      undefined
    );
    const breakpointId1 = breakpointId + '1';
    (breakpoint1 as any)._id = breakpointId1;
    bpAdd.push(breakpoint1);
    const breakpoint2 = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
  });

  it('add then remove checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
  });

  it('add and then change checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
      'checkpoint',
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
  });

  it('changing a checkpoint by removing the checkpoint condition removes the checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
  });

  it('changing a checkpoint by changing the breakpoint type removes the checkpoint', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
      'checkpoint', // keep the checkpoint condition
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
  });

  it('changing the logMessage can change the ActionScriptType', async () => {
    const range = new vscode.Range(lineInput - 1, 0, lineInput - 1, 0);
    const uri = vscode.Uri.parse(uriInput);
    const location = new vscode.Location(uri, range);
    const breakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      'checkpoint',
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
      'checkpoint',
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
      'checkpoint',
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
      'checkpoint',
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
      'checkpoint',
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
    'salesforcedx-vscode-replay-debugger-checkpoints.enabled',
    false
  );
  return enabled;
}
