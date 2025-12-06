/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config, ConfigAggregator, OrgConfigProperties, StateAggregator } from '@salesforce/core';
import { ConfigUtil } from '../../../src/config/configUtil';
import { SF_CONFIG_DISABLE_TELEMETRY } from '../../../src/constants';
import { ConfigAggregatorProvider } from '../../../src/providers/configAggregatorProvider';

describe('ConfigUtil', () => {
  let mockConfigAggregator: any;

  beforeEach(() => {
    mockConfigAggregator = {
      getPropertyValue: jest.fn(),
      getLocation: jest.fn()
    };
    jest.spyOn(ConfigAggregatorProvider.prototype, 'getConfigAggregator').mockResolvedValue(mockConfigAggregator);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserConfiguredApiVersion', () => {
    it('should return API version when set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('58.0');
      const result = await ConfigUtil.getUserConfiguredApiVersion();
      expect(result).toBe('58.0');
      expect(mockConfigAggregator.getPropertyValue).toHaveBeenCalledWith(OrgConfigProperties.ORG_API_VERSION);
    });

    it('should return undefined when not set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue(undefined);
      const result = await ConfigUtil.getUserConfiguredApiVersion();
      expect(result).toBeUndefined();
    });
  });

  describe('getTargetOrgOrAlias', () => {
    it('should return target org when set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('my-org');
      const result = await ConfigUtil.getTargetOrgOrAlias();
      expect(result).toBe('my-org');
      expect(mockConfigAggregator.getPropertyValue).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG);
    });

    it('should return undefined when not set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue(undefined);
      const result = await ConfigUtil.getTargetOrgOrAlias();
      expect(result).toBeUndefined();
    });
  });

  describe('isGlobalTargetOrg', () => {
    it('should return true when target org is global', async () => {
      mockConfigAggregator.getLocation.mockReturnValue(ConfigAggregator.Location.GLOBAL);
      const result = await ConfigUtil.isGlobalTargetOrg();
      expect(result).toBe(true);
    });

    it('should return false when target org is local', async () => {
      mockConfigAggregator.getLocation.mockReturnValue(ConfigAggregator.Location.LOCAL);
      const result = await ConfigUtil.isGlobalTargetOrg();
      expect(result).toBe(false);
    });
  });

  describe('getTemplatesDirectory', () => {
    it('should return templates directory when set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('/path/to/templates');
      const result = await ConfigUtil.getTemplatesDirectory();
      expect(result).toBe('/path/to/templates');
      expect(mockConfigAggregator.getPropertyValue).toHaveBeenCalledWith(
        OrgConfigProperties.ORG_CUSTOM_METADATA_TEMPLATES
      );
    });

    it('should return undefined when not set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue(undefined);
      const result = await ConfigUtil.getTemplatesDirectory();
      expect(result).toBeUndefined();
    });
  });

  describe('isTelemetryDisabled', () => {
    it('should return true when telemetry is disabled', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('true');
      const result = await ConfigUtil.isTelemetryDisabled();
      expect(result).toBe(true);
      expect(mockConfigAggregator.getPropertyValue).toHaveBeenCalledWith(SF_CONFIG_DISABLE_TELEMETRY);
    });

    it('should return false when telemetry is enabled', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('false');
      const result = await ConfigUtil.isTelemetryDisabled();
      expect(result).toBe(false);
    });
  });

  describe('getTargetDevHubOrAlias', () => {
    it('should return dev hub when set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('my-devhub');
      const result = await ConfigUtil.getTargetDevHubOrAlias();
      expect(result).toBe('my-devhub');
      expect(mockConfigAggregator.getPropertyValue).toHaveBeenCalledWith(OrgConfigProperties.TARGET_DEV_HUB);
    });

    it('should return undefined when not set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue(undefined);
      const result = await ConfigUtil.getTargetDevHubOrAlias();
      expect(result).toBeUndefined();
    });
  });

  describe('getGlobalTargetDevHubOrAlias', () => {
    it('should return global dev hub when set', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue('global-devhub')
      };
      jest.spyOn(Config, 'create').mockResolvedValue(mockConfig as any);
      const result = await ConfigUtil.getGlobalTargetDevHubOrAlias();
      expect(result).toBe('global-devhub');
    });

    it('should return undefined when not set', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue(undefined)
      };
      jest.spyOn(Config, 'create').mockResolvedValue(mockConfig as any);
      const result = await ConfigUtil.getGlobalTargetDevHubOrAlias();
      expect(result).toBeUndefined();
    });
  });

  describe('getAllAliasesFor', () => {
    it('should return aliases for username', async () => {
      const mockStateAggregator = {
        aliases: {
          getAll: jest.fn().mockReturnValue(['alias1', 'alias2'])
        }
      };
      jest.spyOn(StateAggregator, 'getInstance').mockResolvedValue(mockStateAggregator as any);
      jest.spyOn(StateAggregator, 'clearInstance').mockImplementation();

      const result = await ConfigUtil.getAllAliasesFor('test@example.com');
      expect(result).toEqual(['alias1', 'alias2']);
      expect(StateAggregator.clearInstance).toHaveBeenCalled();
    });
  });

  describe('getUsernameFor', () => {
    it('should return username when alias exists', async () => {
      const mockStateAggregator = {
        aliases: {
          getUsername: jest.fn().mockReturnValue('test@example.com')
        }
      };
      jest.spyOn(StateAggregator, 'getInstance').mockResolvedValue(mockStateAggregator as any);

      const result = await ConfigUtil.getUsernameFor('my-alias');
      expect(result).toBe('test@example.com');
    });

    it('should return input when no alias found', async () => {
      const mockStateAggregator = {
        aliases: {
          getUsername: jest.fn().mockReturnValue(undefined)
        }
      };
      jest.spyOn(StateAggregator, 'getInstance').mockResolvedValue(mockStateAggregator as any);

      const result = await ConfigUtil.getUsernameFor('test@example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('getUsername', () => {
    it('should return username when target org is set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('my-alias');
      const mockStateAggregator = {
        aliases: {
          getUsername: jest.fn().mockReturnValue('test@example.com')
        }
      };
      jest.spyOn(StateAggregator, 'getInstance').mockResolvedValue(mockStateAggregator as any);

      const result = await ConfigUtil.getUsername();
      expect(result).toBe('test@example.com');
    });

    it('should return undefined when target org is not set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue(undefined);
      const result = await ConfigUtil.getUsername();
      expect(result).toBeUndefined();
    });
  });

  describe('getDevHubUsername', () => {
    it('should return dev hub username when set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue('devhub-alias');
      const mockStateAggregator = {
        aliases: {
          getUsername: jest.fn().mockReturnValue('devhub@example.com')
        }
      };
      jest.spyOn(StateAggregator, 'getInstance').mockResolvedValue(mockStateAggregator as any);

      const result = await ConfigUtil.getDevHubUsername();
      expect(result).toBe('devhub@example.com');
    });

    it('should return undefined when dev hub is not set', async () => {
      mockConfigAggregator.getPropertyValue.mockReturnValue(undefined);
      const result = await ConfigUtil.getDevHubUsername();
      expect(result).toBeUndefined();
    });
  });
});
