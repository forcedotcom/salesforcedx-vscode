/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import {
  ScratchOrg
} from '../ScratchOrg';

describe('Templates', async () => {
  let scratchOrg: ScratchOrg = undefined;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('Templates', false);
    await scratchOrg.setUp();
  });

  step('Aura Components', async () => {
    step('Create Aura Component', async () => {
      // Right-click (or command palette) and run SFDX: Create Aura Component
        // name auraComponentTest1
        // select default directory
      // run "SFDX: Push Source to Default Scratch Org"
      // run "SFDX: Rename Component"
        // name auraComponentTest1b
      // diff folder?
      // run "SFDX: Push Source to Default Scratch Org"
      // diff folder?

      // TODO: implement
      expect(1).toBe(1);
    });

    step('Create Aura Event', async () => {
      // Right-click (or command palette) and run SFDX: Create Aura Event
        // name auraEventTest1
        // select default directory
      // run "SFDX: Push Source to Default Scratch Org"
      // run "SFDX: Rename Component"
        // name auraEventTest1b
      // diff folder?

      // TODO: implement
      expect(1).toBe(1);
    });

    step('Create Apex Class', async () => {
      // Right-click (or command palette) and run SFDX: Create Apex Class
        // name apexClassTest1
        // select default directory
      // run "SFDX: Push Source to Default Scratch Org"
      // run "SFDX: Rename Component"
        // nope, there's is only the built-in rename
      // run the standard rename
        // name apexClassTest1b
      // run "SFDX: Push Source to Default Scratch Org"
        // should get an error
      // open apexClassTest1b.cls
      // change "apexClassTest1" to "apexClassTest1b" (in both places)
      // run "SFDX: Push Source to Default Scratch Org"
        // should get success

      // diff folder?


      // TODO: implement
      expect(1).toBe(1);
    });




    step('Lightning Web Component', async () => {
      // Right-click (or command palette) and run SFDX: Create Lightning Web Component
        // name lightningWebComponentTest1
        // select default directory
      // run "SFDX: Push Source to Default Scratch Org"
      // run "SFDX: Rename Component"
        // name lightningWebComponentTest1b
      // diff folder?
      // run "SFDX: Push Source to Default Scratch Org"
      // diff folder?



      // TODO: implement
      expect(1).toBe(1);
    });
  });

  /*
  bugs
    Aura
      created Aura component
        no "push to org" command in explorer
        no "push to org" command when right-click in file
        in the command palette, there is "SFDX: Push Source to Default Scratch Org"
          ...tried right-clicking on
            ...the component
            ...on aura
            ...on default
            ...on main
            ...on force-app
      created Aura event
        right-clicked, and it says, "SFDX: Rename Component"
          -> should be "SFDX: Rename Event"


    Apex
      created Aura component
        no "push to org" command in explorer

    LWC
      Preview component locally isn't working (an no errors were reported)


  */

  // step('Apex Classes', async () => {
  //   step('what?', async () => {
  //     // TODO: implement
  //     expect(1).toBe(1);
  //   });
  // });

  // step('Lightning Web Components', async () => {
  //   step('what?', async () => {
  //     // TODO: implement
  //     expect(1).toBe(1);
  //   });
  // });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
