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
  CheckpointMessage,
  CheckpointNode,
  checkpointService
} from '../../../src/breakpoints/checkpointService';

describe('Checkpoint Service - unit', () => {
  it('It should pass arguments and set default values', () => {
    const cpNode = checkpointService.addCheckpointNode('foo.cls', 'foo', 5);
    let overlayAction: ApexExecutionOverlayAction;
    // grab the json string and verify
    const jsonString = cpNode.createJSonStringForOverlayAction();
    overlayAction = JSON.parse(jsonString);
    // verify that the overlay action returned contains all the default information
    expect(overlayAction.IsDumpingHeap).to.be.equal(true);
    expect(overlayAction.ExecutableEntityName).to.be.equal('foo');
    expect(overlayAction.Iteration).to.be.equal(1);
    expect(overlayAction.Line).to.be.equal(5);
    expect(overlayAction.ActionScriptType).to.be.equal(ActionScriptEnum.None);
    expect(overlayAction.ActionScript).to.be.equal('');
  });
});
