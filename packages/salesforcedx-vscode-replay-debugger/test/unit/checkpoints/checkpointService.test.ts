/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ActionScriptEnum,
  ApexExecutionOverlayAction,
  CheckpointInfoActionScriptNode,
  CheckpointInfoActionScriptTypeNode,
  CheckpointInfoIterationNode,
  CheckpointNode,
  checkpointService,
  CheckpointService
} from '../../../src/breakpoints/checkpointService';
import { MAX_ALLOWED_CHECKPOINTS } from '../../../src/constants';

describe('Checkpoint Service - unit', () => {
  const config = vscode.workspace.getConfiguration();
  const checkpointsEnabled = config.get(
    'salesforcedx-vscode-replay-debugger-checkpoints.enabled',
    false
  );
  if (!checkpointsEnabled) {
    console.log(
      'Checkpoints are not enabled, skipping CheckpointService tests'
    );
    return;
  }

  let executeCreateApexExecutionOverlayActionCommandStub: sinon.SinonStub;
  let executeRemoveApexExecutionOverlayActionCommandStub: sinon.SinonStub;

  const actionObjectId = '1doxx000000FAKE';
  const uriInput = 'file:///bar.cls';
  const sourceFileInput = 'foo.cls';
  const typeRefInput = 'foo';
  const lineInput = 5;
  beforeEach(() => {
    executeCreateApexExecutionOverlayActionCommandStub = sinon.stub(
      CheckpointService.prototype,
      'executeCreateApexExecutionOverlayActionCommand'
    );
    executeRemoveApexExecutionOverlayActionCommandStub = sinon.stub(
      CheckpointService.prototype,
      'executeRemoveApexExecutionOverlayActionCommand'
    );
  });

  // Clean out the checkpoint list after each usage to ensure that
  // each test has a clean slate. Also has the added benefit of
  // additional testing for deleteCheckpointNode
  afterEach(() => {
    executeCreateApexExecutionOverlayActionCommandStub.restore();
    executeRemoveApexExecutionOverlayActionCommandStub.restore();
    clearOutCheckpoints();
  });

  it('Verify checkpoint arguments and pre-set default values', async () => {
    const cpNode = await checkpointService.getOrCreateCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput
    );

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
    const cpNode = await checkpointService.getOrCreateCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput
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

  it('Should not create duplicate values for the same Uri/Line number inputs', async () => {
    const originalNode = await checkpointService.getOrCreateCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput
    );

    // The uri and line number are what makes a checkpoint node unique. If
    // a the same uri and line number are passed into addCheckpointNode then
    // the returned checkpoint will be the one originally created. Realistically,
    // dupes can't happen with the way that breakpoints/checkpoints are created.
    const copiedNode = await checkpointService.getOrCreateCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput
    );

    // The copied node should be the original node, do a deep verification
    expect(originalNode).to.deep.equal(copiedNode);
  });

  it('canAddCheckpointNote returns true until MAX_ALLOWED_CHECKPOINTS', async () => {
    // Create MAX_ALLOWED_CHECKPOINTS nodes. Before creating each one, validate that
    // canAddCheckpointNote returns true before creation. With the URI and Linenumber
    // making the CheckpointNode unique, change the line number when creating new nodes
    for (let i = 1; i < MAX_ALLOWED_CHECKPOINTS + 1; i++) {
      expect(checkpointService.canAddCheckpointNote()).to.be.eq(true);
      await checkpointService.getOrCreateCheckpointNode(
        uriInput,
        sourceFileInput,
        typeRefInput,
        i
      );
    }
    // after adding 5 nodes expect canAddCheckpointNote to be false
    expect(checkpointService.canAddCheckpointNote()).to.be.eq(false);

    // for giggles, remove a node and verify canAddCheckpointNote is true
    await checkpointService.deleteCheckpointNode(uriInput, 5);
    expect(checkpointService.canAddCheckpointNote()).to.be.eq(true);

    // add the node back and verify false
    await checkpointService.getOrCreateCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      5
    );
    expect(checkpointService.canAddCheckpointNote()).to.be.eq(false);
  });

  it('CheckpointNode, Action Command Result tests', async () => {
    const someErrorMessage = 'This is error text';
    const cpNode = await checkpointService.getOrCreateCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput
    );

    cpNode.setActionCommandResultId(actionObjectId);
    expect(cpNode.getActionCommandResultId()).to.be.eq(actionObjectId);
    expect(cpNode.getActionCommandFailureMessage()).to.be.eq(undefined);

    cpNode.setActionCommandResultFailure(someErrorMessage);
    expect(cpNode.getActionCommandFailureMessage()).to.be.eq(someErrorMessage);
    expect(cpNode.getActionCommandResultId()).to.be.eq(undefined);

    expect(cpNode.getChildren().length).to.be.eq(3);
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
      checkpointService.deleteCheckpointNode(
        checkpoint.getCheckpointUri(),
        checkpoint.getCheckpointLineNumber()
      );
    }
  }
}
