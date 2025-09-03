/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, AuthInfo, ConfigAggregator, Org } from '@salesforce/core';
import { ConfigUtil, notificationService, Table } from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../../../src/channels';
import {
  determineConnectedStatusForNonScratchOrg,
  removeExpiredAndDeletedOrgs,
  displayRemainingOrgs,
  shouldRemoveOrg,
  getConnectionStatusFromError
} from '../../../src/commands/orgList';
import { nls } from '../../../src/messages';
import { getAuthFieldsFor } from '../../../src/util/orgUtil';

// Mock the dependencies
jest.mock('@salesforce/core', () => ({
  AuthRemover: {
    create: jest.fn()
  },
  AuthInfo: {
    listAllAuthorizations: jest.fn()
  },
  Org: {
    create: jest.fn(),
    Fields: {
      DEV_HUB_USERNAME: 'DevHubUsername'
    }
  },
  ConfigAggregator: {
    create: jest.fn().mockImplementation(() => ({
      getPropertyValue: jest.fn()
    }))
  },
  OrgConfigProperties: {
    TARGET_DEV_HUB: 'target-dev-hub',
    TARGET_ORG: 'target-org'
  }
}));
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  notificationService: {
    showSuccessfulExecution: jest.fn()
  },
  SfWorkspaceChecker: jest.fn(),
  ContinueResponse: jest.fn(),
  LibraryCommandletExecutor: jest.fn(),
  Table: jest.fn(),
  ConfigUtil: {
    getConfigValue: jest.fn(),
    getUsernameFor: jest.fn(),
    getAllAliasesFor: jest.fn().mockReturnValue(['alias1', 'alias2'])
  }
}));
jest.mock('../../../src/channels', () => ({
  channelService: {
    appendLine: jest.fn()
  },
  OUTPUT_CHANNEL: {}
}));
jest.mock('../../../src/telemetry', () => ({
  telemetryService: {
    sendException: jest.fn()
  }
}));
jest.mock('../../../src/util/orgUtil', () => ({
  getAuthFieldsFor: jest.fn()
}));
jest.mock('../../../src/messages', () => ({
  nls: {
    localize: jest.fn()
  }
}));
jest.mock('../../../src/commands/util', () => ({
  PromptConfirmGatherer: jest.fn(),
  SfCommandlet: jest.fn()
}));

describe('orgList command', () => {
  beforeEach(() => {
    // Mock nls.localize
    (nls.localize as jest.Mock).mockImplementation((key: string, ...args: string[]) => `${key}_${args.join('_')}`);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock Table.createTable method
    const mockTableInstance = {
      createTable: jest.fn().mockReturnValue('mocked table output')
    };
    (Table as jest.Mock).mockImplementation(() => mockTableInstance);
  });

  it('should be a simple smoke test to verify basic functionality', () => {
    // Basic test to ensure the command structure is correct
    expect(typeof getAuthFieldsFor).toBe('function');
    expect(channelService.appendLine).toBeDefined();
    expect(notificationService.showSuccessfulExecution).toBeDefined();
    expect(AuthInfo.listAllAuthorizations).toBeDefined();
    expect(AuthRemover.create).toBeDefined();
  });

  describe('determineConnectedStatusForNonScratchOrg', () => {
    const mockOrg = {
      getField: jest.fn(),
      refreshAuth: jest.fn(),
      getUsername: jest.fn().mockReturnValue('test@example.com')
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (Org.create as jest.Mock).mockResolvedValue(mockOrg);
    });

    it('should return undefined for scratch orgs', async () => {
      mockOrg.getField.mockReturnValue('hub@example.com'); // Has DEV_HUB_USERNAME

      const result = await determineConnectedStatusForNonScratchOrg('scratch@example.com');

      expect(result).toBeUndefined();
      expect(mockOrg.refreshAuth).not.toHaveBeenCalled();
    });

    it('should return Connected for valid non-scratch org', async () => {
      mockOrg.getField.mockReturnValue(null); // No DEV_HUB_USERNAME
      mockOrg.refreshAuth.mockResolvedValue(undefined);

      const result = await determineConnectedStatusForNonScratchOrg('prod@example.com');

      expect(result).toBe('Connected');
      expect(mockOrg.refreshAuth).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockOrg.getField.mockReturnValue(null);
      const error = new Error('Connection failed');
      mockOrg.refreshAuth.mockRejectedValue(error);

      const result = await determineConnectedStatusForNonScratchOrg('invalid@example.com');

      // Should return error status from getConnectionStatusFromError
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle org creation failure', async () => {
      (Org.create as jest.Mock).mockRejectedValue(new Error('Org not found'));

      const result = await determineConnectedStatusForNonScratchOrg('notfound@example.com');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('shouldRemoveOrg', () => {
    it('should return true for invalid_login errors', () => {
      const error = new Error('invalid_login: authentication failure');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return true for no such org errors', () => {
      const error = new Error('no such org exists');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return true for NamedOrgNotFound errors', () => {
      const error = new Error('NamedOrgNotFound: org does not exist');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return true for NoAuthInfoFound errors', () => {
      const error = new Error('noauthinfoFound: no auth info');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Some other error');
      expect(shouldRemoveOrg(error)).toBe(false);
    });
  });

  describe('getConnectionStatusFromError', () => {
    it('should return specific message for expired access token', () => {
      const error = new Error('expired access/refresh token');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Unable to refresh session: expired access/refresh token');
    });

    it('should return maintenance message', () => {
      const error = new Error('System is under maintenance');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Down (Maintenance)');
    });

    it('should return invalid org message for removable errors', () => {
      const error = new Error('invalid_login: authentication failure');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Invalid org: test@example.com');
    });

    it('should return original message for unknown errors', () => {
      const error = new Error('Unknown error');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Unknown error');
    });

    it('should handle string errors', () => {
      const result = getConnectionStatusFromError('String error');
      expect(result).toBe('String error');
    });
  });

  describe('removeExpiredAndDeletedOrgs', () => {
    const mockAuthRemover = {
      removeAuth: jest.fn()
    };

    const mockOrgAuths = [
      {
        username: 'valid@example.com',
        isDevHub: false,
        error: undefined
      },
      {
        username: 'devhub@example.com',
        isDevHub: true,
        error: undefined
      },
      {
        username: 'expired@example.com',
        isDevHub: false,
        error: undefined
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      (AuthInfo.listAllAuthorizations as jest.Mock).mockResolvedValue(mockOrgAuths);
      (AuthRemover.create as jest.Mock).mockResolvedValue(mockAuthRemover);
      mockAuthRemover.removeAuth.mockResolvedValue(undefined);
    });

    it('should skip dev hubs', async () => {
      (getAuthFieldsFor as jest.Mock).mockResolvedValue({});

      await removeExpiredAndDeletedOrgs();

      expect(getAuthFieldsFor).not.toHaveBeenCalledWith('devhub@example.com');
    });

    it('should remove expired orgs', async () => {
      const pastDate = new Date('2020-01-01').toISOString();
      (getAuthFieldsFor as jest.Mock)
        .mockResolvedValueOnce({}) // valid@example.com - no expiration
        .mockResolvedValueOnce({ expirationDate: pastDate }); // expired@example.com

      const result = await removeExpiredAndDeletedOrgs();

      expect(mockAuthRemover.removeAuth).toHaveBeenCalledWith('expired@example.com');
      expect(result).toContain('expired@example.com');
    });

    it('should handle getAuthFieldsFor errors', async () => {
      (getAuthFieldsFor as jest.Mock).mockRejectedValue(new Error('Auth fields error'));

      const result = await removeExpiredAndDeletedOrgs();

      // Should handle gracefully and continue
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('displayRemainingOrgs', () => {
    const mockOrgAuths = [
      {
        username: 'test@example.com',
        aliases: ['testOrg'],
        isDevHub: false,
        isScratch: false,
        orgId: '00D000000000000EAA'
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      (AuthInfo.listAllAuthorizations as jest.Mock).mockResolvedValue(mockOrgAuths);
      (getAuthFieldsFor as jest.Mock).mockResolvedValue({});

      // Mock ConfigAggregator
      const mockConfigAggregator = {
        getPropertyValue: jest.fn().mockImplementation((key: string) => {
          if (key === 'target-dev-hub') return 'devhub@example.com';
          if (key === 'target-org') return 'prod@example.com';
          return undefined;
        })
      };
      (ConfigAggregator.create as jest.Mock).mockResolvedValue(mockConfigAggregator);

      // Mock ConfigUtil methods
      (ConfigUtil as any).getConfigValue.mockImplementation((key: string) => {
        if (key === 'target-dev-hub') return 'devhub@example.com';
        if (key === 'target-org') return 'prod@example.com';
        return undefined;
      });
      (ConfigUtil as any).getUsernameFor.mockImplementation((key: string) => {
        if (key === 'target-dev-hub') return 'devhub@example.com';
        if (key === 'target-org') return 'prod@example.com';
        return undefined;
      });
      (ConfigUtil as any).getAllAliasesFor.mockReturnValue(['alias1', 'alias2']);
    });

    it('should display message when no orgs found', async () => {
      (AuthInfo.listAllAuthorizations as jest.Mock).mockResolvedValue([]);

      await displayRemainingOrgs();

      expect(channelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('org_list_no_orgs_found'));
    });

    it('should create and display table for orgs', async () => {
      await displayRemainingOrgs();

      expect(Table).toHaveBeenCalled();
      expect(channelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('mocked table output'));
    });

    it('should add legend for emoji markers', async () => {
      await displayRemainingOrgs();

      expect(channelService.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Legend:  🌳=Default DevHub, 🍁=Default Org')
      );
    });

    it('should handle errors gracefully', async () => {
      (AuthInfo.listAllAuthorizations as jest.Mock).mockRejectedValue(new Error('List error'));

      await displayRemainingOrgs();

      expect(channelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('org_list_display_error'));
    });
  });
});
