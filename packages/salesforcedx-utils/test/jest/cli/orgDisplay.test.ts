/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Org, StateAggregator, ConfigAggregator } from '@salesforce/core';
import { OrgDisplay } from '../../../src';

// Mock the Salesforce Core classes
jest.mock('@salesforce/core', () => ({
  AuthInfo: {
    create: jest.fn()
  },
  Connection: {
    create: jest.fn()
  },
  Org: {
    create: jest.fn()
  },
  StateAggregator: {
    getInstance: jest.fn()
  },
  ConfigAggregator: {
    create: jest.fn()
  }
}));

describe('OrgDisplay unit tests.', () => {
  let orgDisplay: OrgDisplay;
  let mockAuthInfo: any;
  let mockConnection: any;
  let mockOrg: any;
  let mockStateAggregator: any;
  let mockConfigAggregator: any;

  beforeEach(() => {
    orgDisplay = new OrgDisplay();

    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock AuthInfo
    mockAuthInfo = {
      getUsername: jest.fn().mockReturnValue('test@example.com'),
      getFields: jest.fn().mockReturnValue({
        username: 'test@example.com',
        orgId: '00D1234567890123',
        accessToken: 'test-token',
        instanceUrl: 'https://test.salesforce.com',
        clientId: 'test-client-id'
      })
    };

    // Setup mock Connection
    mockConnection = {
      identity: jest.fn().mockResolvedValue({}),
      singleRecordQuery: jest.fn().mockResolvedValue({
        Id: '00D1234567890123',
        Name: 'Test Org',
        CreatedDate: '2024-01-01T00:00:00.000+0000',
        CreatedBy: { Username: 'admin@example.com' },
        OrganizationType: 'Enterprise'
      }),
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'test-token'
    };

    // Setup mock Org
    mockOrg = {
      getDevHubOrg: jest.fn()
    };

    // Setup mock StateAggregator
    mockStateAggregator = {
      aliases: {
        getAll: jest.fn().mockReturnValue([]),
        getUsername: jest.fn().mockImplementation(usernameOrAlias => usernameOrAlias)
      }
    };

    // Setup mock ConfigAggregator
    mockConfigAggregator = {
      getPropertyValue: jest.fn().mockReturnValue(undefined)
    };

    jest.mocked(AuthInfo).create.mockResolvedValue(mockAuthInfo);
    jest.mocked(Connection).create.mockResolvedValue(mockConnection);
    jest.mocked(Org).create.mockResolvedValue(mockOrg);
    jest.mocked(StateAggregator).getInstance.mockResolvedValue(mockStateAggregator);
    jest.mocked(ConfigAggregator).create.mockResolvedValue(mockConfigAggregator);
  });

  it('Should create instance.', () => {
    expect(orgDisplay).toBeInstanceOf(OrgDisplay);
  });

  it('Should be able to successfully get org info with username provided.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result).toEqual({
      username: 'test@example.com',
      devHubId: '',
      id: '00D1234567890123',
      createdBy: 'admin@example.com',
      createdDate: '2024-01-01T00:00:00.000+0000',
      expirationDate: '',
      status: 'Active',
      edition: 'Enterprise',
      orgName: 'Test Org',
      accessToken: 'test-token',
      instanceUrl: 'https://test.salesforce.com',
      clientId: 'test-client-id',
      apiVersion: '',
      alias: '',
      connectionStatus: 'Connected',
      password: ''
    });
  });

  it('Should get username from config when not provided.', async () => {
    // Mock ConfigAggregator to return username from target-org property
    mockConfigAggregator.getPropertyValue.mockReturnValue('test@example.com');
    const result = await orgDisplay.getOrgInfo();
    expect(result.username).toBe('test@example.com');
  });

  it('Should get username from config and resolve alias when alias is provided.', async () => {
    // Mock ConfigAggregator to return an alias
    mockConfigAggregator.getPropertyValue.mockReturnValue('test-alias');
    // Mock StateAggregator to resolve alias to username
    mockStateAggregator.aliases.getUsername.mockReturnValue('test@example.com');

    const result = await orgDisplay.getOrgInfo();
    expect(result.username).toBe('test@example.com');
  });

  it('Should throw error when no username can be found.', async () => {
    await expect(orgDisplay.getOrgInfo()).rejects.toThrow(
      'No username provided and no default username found in project config or state'
    );
  });

  it('Should handle scratch org detection.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock auth fields to indicate scratch org
    mockAuthInfo.getFields.mockReturnValue({
      username: 'test@example.com',
      orgId: '00D1234567890123',
      accessToken: 'test-token',
      instanceUrl: 'https://test.salesforce.com',
      clientId: 'test-client-id',
      devHubUsername: 'devhub@example.com'
    });

    // Mock dev hub org
    const mockHubOrg = {
      getConnection: jest.fn().mockReturnValue({
        singleRecordQuery: jest.fn().mockResolvedValue({
          Status: 'Active',
          CreatedBy: { Username: 'admin@example.com' },
          CreatedDate: '2024-01-01T00:00:00.000+0000',
          ExpirationDate: '2024-12-31T00:00:00.000+0000',
          Edition: 'Developer',
          OrgName: 'Test Scratch Org'
        })
      })
    };
    mockOrg.getDevHubOrg.mockResolvedValue(mockHubOrg);

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.devHubId).toBe('devhub@example.com');
    expect(result.edition).toBe('Developer');
    expect(result.status).toBe('Active');
    expect(result.expirationDate).toBe('2024-12-31T00:00:00.000+0000');
  });

  it('Should handle sandbox org detection.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock org query for sandbox
    mockConnection.singleRecordQuery.mockResolvedValue({
      Id: '00D1234567890123',
      Name: 'Test Sandbox',
      CreatedDate: '2024-01-01T00:00:00.000+0000',
      CreatedBy: { Username: 'admin@example.com' },
      OrganizationType: 'Enterprise',
      InstanceName: 'NA1',
      IsSandbox: true
    });

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.edition).toBe('Sandbox');
  });

  it('Should retrieve alias when available.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock state aggregator to return aliases
    mockStateAggregator.aliases.getAll.mockReturnValue(['test-alias']);

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.alias).toBe('test-alias');
  });

  it('Should return empty string when no alias is available.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock state aggregator to return empty array
    mockStateAggregator.aliases.getAll.mockReturnValue([]);

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.alias).toBe('');
  });

  it('Should handle authentication errors gracefully and show error in status field.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock AuthInfo.create to throw an authentication error
    const authError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    jest.mocked(AuthInfo).create.mockRejectedValue(authError);

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.username).toBe('test@example.com');
    expect(result.status).toBe('Unable to refresh session: expired access/refresh token');
    expect(result.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
    // Should still return basic org structure even with error
    expect(result.id).toBe('');
    expect(result.instanceUrl).toBe('');
    expect(result.accessToken).toBe('');
  });

  it('Should handle connection errors gracefully and show error in status field.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock connection.identity to throw an authentication error
    const connectionError = new Error(
      'Error authenticating with the refresh token due to: expired access/refresh token'
    );
    mockConnection.identity.mockRejectedValue(connectionError);

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.username).toBe('test@example.com');
    expect(result.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
    // Should still have other org info since AuthInfo creation succeeded
    expect(result.accessToken).toBe('test-token');
    expect(result.instanceUrl).toBe('https://test.salesforce.com');
  });

  it('Should handle SOQL query errors gracefully and return error status.', async () => {
    const orgDisplayWithUsername = new OrgDisplay('test@example.com');

    // Mock singleRecordQuery to throw an authentication error
    const queryError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    mockConnection.singleRecordQuery.mockRejectedValue(queryError);

    const result = await orgDisplayWithUsername.getOrgInfo();

    expect(result.username).toBe('test@example.com');
    expect(result.status).toBe('Unable to refresh session: expired access/refresh token');
    expect(result.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
    // Should still have auth info since AuthInfo and Connection creation succeeded
    expect(result.accessToken).toBe('test-token');
    expect(result.instanceUrl).toBe('https://test.salesforce.com');
  });
});
