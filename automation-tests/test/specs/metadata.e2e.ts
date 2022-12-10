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

describe('Metadata', async () => {
  let scratchOrg: ScratchOrg = undefined;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('Metadata', false);
    await scratchOrg.setUp();
  });

  step('sub-category', async () => {
    step('what?', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('what?', async () => {

    debugger;

    // TODO: implement
    expect(1).toBe(1);
  });

  /*
    * Using the default template...
      * Create an Apex Class
      *   SFDX: Create Apex Class
      * Create an LWC
      *   SFDX: Create Lightning Web Component
      * Create an Aura Component
      *   SFDX: Create Aura Component
      *   what about Aura Event
      *   or any of the others, like Aura App?

    * Using a local template...
      * Create an Apex Class
    * Using a remote template...
      * Create an Apex Class
    * deploy the class that was created
    * rename (eg LWC) - or is rename too specific?  maybe a 2.0 nice to have
    * e2e - create an Apex call, use the template to create, update the class file, which doesn’t compile or deploy, perform a fix, then deploy again
    * flow for LWC is different -
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    */



  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
