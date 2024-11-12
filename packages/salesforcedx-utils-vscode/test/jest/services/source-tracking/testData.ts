/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const testData = {
  statusResponse: [
    {
      type: 'ApexClass',
      state: 'modify',
      fullName: 'CommunitiesLandingController',
      filePath: 'force-app/main/default/classes/CommunitiesLandingController.cls',
      origin: 'local',
      ignored: false,
      conflict: false
    },
    {
      type: 'ApexClass',
      state: 'modify',
      fullName: 'CommunitiesLandingControllerTest',
      filePath: 'force-app/main/default/classes/CommunitiesLandingControllerTest.cls',
      origin: 'local',
      ignored: false,
      conflict: false
    },
    {
      type: 'ApexClass',
      state: 'modify',
      fullName: 'ProductController',
      filePath: 'force-app/main/default/classes/ProductController.cls',
      origin: 'local',
      ignored: false,
      conflict: false
    },
    {
      type: 'Profile',
      origin: 'remote',
      state: 'add',
      fullName: 'Admin',
      ignored: true,
      conflict: false
    },
    {
      type: 'Audience',
      origin: 'remote',
      state: 'add',
      fullName: 'Default',
      ignored: false,
      conflict: false
    }
  ],
  noChangesResponse: []
};
