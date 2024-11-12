/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { WorkspaceContext } from '../../../../src/context/workspaceContext';
import { SalesforceProjectConfig } from '../../../../src/salesforceProject';
import { componentSetUtils } from '../../../../src/services/sdr/componentSetUtils';

describe('componentSetUtils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setApiVersion', () => {
    it('should validate that apiVersion is set via ConfigUtil when present', async () => {
      // *** Set (faked) componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.apiVersion = 'not set';

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue('40.0');
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionSpy = jest.spyOn(componentSetUtils, 'getOrgApiVersion');

      await componentSetUtils.setApiVersion(componentSet);

      expect(componentSet.apiVersion).toBe('40.0');
      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(getOrgApiVersionSpy).not.toHaveBeenCalled();
    });

    it('should validate that if no user-configured API Version is present, then the API version is set from the org ', async () => {
      // *** Set (faked) componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.apiVersion = 'not set';

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue(undefined);
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionMock = jest.spyOn(componentSetUtils, 'getOrgApiVersion').mockResolvedValue('42.0');

      await componentSetUtils.setApiVersion(componentSet);

      expect(componentSet.apiVersion).toBe('42.0');
      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(getOrgApiVersionMock).toHaveBeenCalled();
    });

    it('should validate that source API passed in is the one returned', async () => {
      // *** Set (faked) componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.apiVersion = '44.0';

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue(undefined);
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionMock = jest.spyOn(componentSetUtils, 'getOrgApiVersion').mockResolvedValue('');

      await componentSetUtils.setApiVersion(componentSet);

      expect(componentSet.apiVersion).toBe('44.0');
      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(getOrgApiVersionMock).toHaveBeenCalled();
    });
  });

  describe('setSourceApiVersion', () => {
    it('should validate that sourceApiVersion is set from the ComponentSet (metadata file) when present', async () => {
      // *** Set (faked) componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.sourceApiVersion = '54.0';

      const getValueMock = jest.fn().mockResolvedValue('53.0');
      SalesforceProjectConfig.getValue = getValueMock;

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue('52.0');
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionMock = jest.spyOn(componentSetUtils, 'getOrgApiVersion').mockResolvedValue('51.0');

      await componentSetUtils.setSourceApiVersion(componentSet);

      expect(componentSet.sourceApiVersion).toBe('54.0');
      expect(getValueMock).not.toHaveBeenCalled();
      expect(getUserConfiguredApiVersionMock).not.toHaveBeenCalled();
      expect(getOrgApiVersionMock).not.toHaveBeenCalled();
    });

    it('should validate that sourceApiVersion is set from SalesforceProjectConfig when not set via a ComponentSet (metadata file)', async () => {
      // *** set/fake componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.sourceApiVersion = undefined;

      const getValueMock = jest.fn().mockResolvedValue('53.0');
      SalesforceProjectConfig.getValue = getValueMock;

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue(undefined);
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionMock = jest.spyOn(componentSetUtils, 'getOrgApiVersion').mockResolvedValue('51.0');

      await componentSetUtils.setSourceApiVersion(componentSet);

      expect(componentSet.sourceApiVersion).toBe('53.0');
      expect(getValueMock).toHaveBeenCalled();
      expect(getUserConfiguredApiVersionMock).not.toHaveBeenCalled();
      expect(getOrgApiVersionMock).not.toHaveBeenCalled();
    });

    it('should validate that sourceApiVersion is set from getUserConfiguredApiVersion when not set through componentSet or SalesforceProjectConfig', async () => {
      // *** set/fake componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.sourceApiVersion = undefined;

      const getValueMock = jest.fn().mockResolvedValue(undefined);
      SalesforceProjectConfig.getValue = getValueMock;

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue('52.0');
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionMock = jest.spyOn(componentSetUtils, 'getOrgApiVersion').mockResolvedValue('51.0');

      await componentSetUtils.setSourceApiVersion(componentSet);

      expect(componentSet.sourceApiVersion).toBe('52.0');
      expect(getValueMock).toHaveBeenCalled();
      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(getOrgApiVersionMock).not.toHaveBeenCalled();
    });

    it('should validate that sourceApiVersion is set from the highest API supported (via getOrgApiVersion)', async () => {
      // *** set/fake componentSet.sourceApiVersion
      const componentSet = new ComponentSet();
      componentSet.sourceApiVersion = undefined;

      const getValueMock = jest.fn().mockResolvedValue(undefined);
      SalesforceProjectConfig.getValue = getValueMock;

      const getUserConfiguredApiVersionMock = jest.fn().mockResolvedValue(undefined);
      ConfigUtil.getUserConfiguredApiVersion = getUserConfiguredApiVersionMock;

      const getOrgApiVersionMock = jest.spyOn(componentSetUtils, 'getOrgApiVersion').mockResolvedValue('51.0');

      await componentSetUtils.setSourceApiVersion(componentSet);

      expect(componentSet.sourceApiVersion).toBe('51.0');
      expect(getValueMock).toHaveBeenCalled();
      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(getOrgApiVersionMock).toHaveBeenCalled();
    });
  });

  describe('getOrgApiVersion', () => {
    it("should validate that the Org's API version is returned", async () => {
      const workspaceContextFake = {
        getConnection: async () => {
          return {
            getApiVersion: () => '60.0'
          };
        }
      };
      const getInstanceMock = jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue(workspaceContextFake as any);

      const orgApiVersion = await componentSetUtils.getOrgApiVersion();

      expect(orgApiVersion).toBe('60.0');
      expect(getInstanceMock).toHaveBeenCalled();
    });
  });
});
