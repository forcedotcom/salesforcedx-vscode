/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ActionScriptEnum,
  ApexExecutionOverlayAction,
  CheckpointInfoActionScriptNode,
  CheckpointInfoActionScriptTypeNode,
  CheckpointInfoIterationNode,
  CheckpointInfoResultNode,
  CheckpointNode,
  checkpointService
} from '../../../src/breakpoints/checkpointService';
import { MAX_ALLOWED_CHECKPOINTS } from '../../../src/constants';

describe('Checkpoint Service - unit', () => {
  const actionObjectId = '1doxx000000FAKE';
  const uriInput = 'file:///bar.cls';
  const sourceFileInput = 'foo.cls';
  const typeRefInput = 'foo';
  const lineInput = 5;

  // Clean out the checkpoint list after each usage to ensure that
  // each test has a clean slate. Also has the added benefit of
  // additional testing for deleteCheckpointNode
  afterEach(() => {
    clearOutCheckpoints();
  });

  it('Verify checkpoint arguments and pre-set default values', async () => {
    const cpNode = await checkpointService.addCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput,
      false // do not execute the underlying ApexExecutionOverlayCommands
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

  it('Verify CheckpointNode has 4 child CheckpointInfoNodes after creation', async () => {
    const cpNode = await checkpointService.addCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput,
      false // do not execute the underlying ApexExecutionOverlayCommands
    );
    // Note: Since the underlying ApexExecutionOverlayCommand is not being executed on creation,
    // The result node needs to be created manually
    cpNode.setActionCommandResult(actionObjectId, undefined);

    expect(cpNode.getChildren().length).to.be.eq(4);

    // Verify that CheckpointNode as 4 child CheckpointInfo when the node was initially created and
    // only one of each type was created.
    let totalCheckpointInfoActionScriptNode = 0;
    let totalCheckpointInfoActionScriptTypeNode = 0;
    let totalCheckpointInfoIterationNode = 0;
    let totalCheckpointInfoResultNode = 0;
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
        case CheckpointInfoResultNode: {
          totalCheckpointInfoResultNode++;
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
    expect(totalCheckpointInfoResultNode).to.be.eq(1);
    expect(totalUnknownNodeTypes).to.be.eq(0);
  });

  it('Should not create duplicate values for the same Uri/Line number inputs', async () => {
    const originalNode = await checkpointService.addCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput,
      false // do not execute the underlying ApexExecutionOverlayCommands
    );

    // The uri and line number are what makes a checkpoint node unique. If
    // a the same uri and line number are passed into addCheckpointNode then
    // the returned checkpoint will be the one originally created. Realistically,
    // dupes can't happen with the way that breakpoints/checkpoints are created.
    const copiedNode = await checkpointService.addCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput,
      false // do not execute the underlying ApexExecutionOverlayCommands
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
      await checkpointService.addCheckpointNode(
        uriInput,
        sourceFileInput,
        typeRefInput,
        i,
        false // do not execute the underlying ApexExecutionOverlayCommands
      );
    }
    // after adding 5 nodes expect canAddCheckpointNote to be false
    expect(checkpointService.canAddCheckpointNote()).to.be.eq(false);

    // for giggles, remove a node and verify canAddCheckpointNote is true
    await checkpointService.deleteCheckpointNode(uriInput, 5);
    expect(checkpointService.canAddCheckpointNote()).to.be.eq(true);

    // add the node back and verify false
    await checkpointService.addCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      5,
      false // do not execute the underlying ApexExecutionOverlayCommands
    );
    expect(checkpointService.canAddCheckpointNote()).to.be.eq(false);
  });

  // There should only ever be 1 CheckpointInfoResultNode for any given CheckpointNode.
  // setActionCommandResult will delete the exiting result node and replace it with the new one.
  // The reason for this is that the label is set when the node is constructed so changing the
  // result means deleting the old one and creating a new one.
  it('CheckpointNode, CheckpointInfoResultNode child tests', async () => {
    const someErrorMessage = 'This is error text';
    const cpNode = await checkpointService.addCheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput,
      false // do not execute the underlying ApexExecutionOverlayCommands
    );

    // The result node is created with either an actionObjectId or an error message. First create one
    // with an actionObjectId and verify the settings, including the the getActionCommandResultId on
    // the CheckpointNode
    let resultNode = cpNode.setActionCommandResult(actionObjectId, undefined);
    // verify that the getActionObjectId returned from the resultNode is the same as the one returned from getActionCommandResultId
    expect(resultNode.getActionObjectId()).to.be.eq(actionObjectId);
    expect(cpNode.getActionCommandResultId()).to.be.eq(
      resultNode.getActionObjectId()
    );
    expect(cpNode.getActionCommandResultId()).to.be.eq(actionObjectId);
    expect(resultNode.getActionObjectFailureMessage()).to.be.eq(undefined);

    // Create another CheckpointInfoResultNode which should replace the existing one. Set the error
    // message which will make the actionObjectId undefined
    resultNode = cpNode.setActionCommandResult(undefined, someErrorMessage);
    expect(resultNode.getActionObjectFailureMessage()).to.be.eq(
      someErrorMessage
    );
    expect(resultNode.getActionObjectId()).to.be.eq(undefined);
    expect(cpNode.getActionCommandResultId()).to.be.eq(undefined);

    // After setting two results, there should still only be 4 children on the CheckpointNode
    // and only one CheckpointInfoResultNode
    expect(cpNode.getChildren().length).to.be.eq(4);
    // Verify only 1 CheckpointInfoResultNode
    let totalCheckpointInfoResultNode = 0;
    for (const infoNode of cpNode.getChildren()) {
      // Can't do a switch on instance of but utilizing the constructor
      // can get around this
      switch (infoNode.constructor) {
        case CheckpointInfoResultNode: {
          totalCheckpointInfoResultNode++;
          break;
        }
      }
    }
    expect(totalCheckpointInfoResultNode).to.be.eq(1);
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
