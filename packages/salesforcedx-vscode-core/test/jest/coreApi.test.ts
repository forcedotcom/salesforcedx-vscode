/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContext } from '../../src/context';
import { SalesforceProjectConfig } from '../../src/salesforceProject/salesforceProjectConfig';
import type { SalesforceVSCodeCoreApi } from '../../src';

describe('SalesforceVSCodeCoreApi', () => {
  it('exposes the legacy workspace and project configuration contracts', () => {
    const services = {
      WorkspaceContext,
      SalesforceProjectConfig
    } satisfies Pick<SalesforceVSCodeCoreApi['services'], 'WorkspaceContext' | 'SalesforceProjectConfig'>;
    const context = services.WorkspaceContext.getInstance(true);

    context.orgShape = 'Scratch';
    context.devHubId = '00Ddevhub';
    context.orgEdition = 'Developer';

    expect(services.SalesforceProjectConfig).toBeDefined();
    expect({ orgShape: context.orgShape, devHubId: context.devHubId, orgEdition: context.orgEdition }).toEqual({
      orgShape: 'Scratch',
      devHubId: '00Ddevhub',
      orgEdition: 'Developer'
    });
  });
});
