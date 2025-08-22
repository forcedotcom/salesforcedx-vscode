/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';
import { WorkspaceContextUtil } from '../../../../src';
import { UNAUTHENTICATED_USER } from '../../../../src/constants';
import * as telemetryUtils from '../../../../src/helpers/telemetryUtils';
import { getTelemetryUserId, SharedTelemetryProvider } from '../../../../src/services/userService';

jest.mock('../../../../src/context/workspaceContextUtil');

describe('UserService', () => {
  describe('getTelemetryUserId', () => {
    const globalTelemetryUserId = 'e45rdcfy7ygvhu8uhbnjiiugdrgb';
    const testOrgId = '00D000000000000EAA';
    const testUserId = 'test@example.com';

    let fakeExtensionContext: ExtensionContext;
    let fakeGet: jest.SpyInstance;
    let fakeUpdate: jest.SpyInstance;
    let workspaceContextMock: Partial<WorkspaceContextUtil>;
    let mockOrgId: string | undefined;
    let mockUsername: string | undefined;

    beforeEach(() => {
      fakeGet = jest.fn();
      fakeUpdate = jest.fn();
      fakeExtensionContext = {
        globalState: {
          get: fakeGet,
          update: fakeUpdate
        },
        extension: {
          id: 'test.extension.id'
        }
      } as unknown as ExtensionContext;

      // Initialize mock values
      mockOrgId = undefined;
      mockUsername = undefined;

      // Mock WorkspaceContextUtil with getter properties
      workspaceContextMock = {};
      Object.defineProperty(workspaceContextMock, 'orgId', {
        get: () => mockOrgId,
        configurable: true
      });
      Object.defineProperty(workspaceContextMock, 'username', {
        get: () => mockUsername,
        configurable: true
      });
      (WorkspaceContextUtil.getInstance as jest.Mock).mockReturnValue(workspaceContextMock);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return telemetryUserId when defined in globalState', async () => {
      fakeGet.mockReturnValueOnce(globalTelemetryUserId);
      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);
      expect(uId).toBe(globalTelemetryUserId);
    });

    it('should return hashed combination of orgId and userId when both are available', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      // The result should be a SHA-256 hash
      expect(uId).toHaveLength(64); // SHA-256 produces 64-character hex string
      expect(uId).toMatch(/^[a-f0-9]{64}$/); // Should be hex characters only
    });

    it('should return anonymous user ID when orgId or userId is not available', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = undefined;
      mockUsername = undefined;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      expect(uId).toBe(UNAUTHENTICATED_USER);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', UNAUTHENTICATED_USER);
    });

    it('should return anonymous user ID when only orgId is available but username is missing', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = undefined;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      expect(uId).toBe(UNAUTHENTICATED_USER);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', UNAUTHENTICATED_USER);
    });

    it('should generate consistent hash for the same orgId and userId combination', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId1 = await getTelemetryUserId(fakeExtensionContext, undefined);

      // Reset and test again
      fakeGet.mockReturnValueOnce(undefined);
      const uId2 = await getTelemetryUserId(fakeExtensionContext, undefined);

      expect(uId1).toBe(uId2); // Should be deterministic
      expect(uId1).toHaveLength(64);
    });

    it('should replace anonymous user ID with hash when user authorizes to org', async () => {
      const anonymousUserId = UNAUTHENTICATED_USER;
      fakeGet.mockReturnValueOnce(anonymousUserId); // Existing anonymous user ID
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      // Should generate hash and update globalState
      expect(uId).toHaveLength(64); // SHA-256 hash
      expect(uId).toMatch(/^[a-f0-9]{64}$/);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', uId);
    });

    it('should keep existing anonymous user ID when no org authorization available', async () => {
      const anonymousUserId = UNAUTHENTICATED_USER;
      fakeGet.mockReturnValueOnce(anonymousUserId); // Existing anonymous user ID
      mockOrgId = undefined;
      mockUsername = undefined;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      // Should keep the same anonymous user ID
      expect(uId).toBe(anonymousUserId);
      expect(fakeUpdate).not.toHaveBeenCalled();
    });

    it('should preserve existing hash when user authorizes to a different org', async () => {
      const existingHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      fakeGet.mockReturnValueOnce(existingHash); // Existing non-anonymous hash
      mockOrgId = 'differentOrgId123';
      mockUsername = 'different@user.com';

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      // Should keep the original hash, not generate new one
      expect(uId).toBe(existingHash);
      expect(fakeUpdate).not.toHaveBeenCalled();
    });

    it('should store hash in globalState when undefined and org data available', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      // Should generate hash and store it
      expect(uId).toHaveLength(64);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', uId);
    });

    it('should store anonymous user ID when undefined and no org data', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = undefined;
      mockUsername = undefined;

      const uId = await getTelemetryUserId(fakeExtensionContext, undefined);

      // Should use anonymous user ID and store it
      expect(uId).toBe(UNAUTHENTICATED_USER);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', UNAUTHENTICATED_USER);
    });

    it('should skip shared user ID check when extension is Core extension', async () => {
      const coreExtensionContext = {
        globalState: {
          get: fakeGet,
          update: fakeUpdate
        },
        extension: {
          id: 'salesforce.salesforcedx-vscode-core'
        }
      } as unknown as ExtensionContext;

      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = undefined;
      mockUsername = undefined;

      const getSharedTelemetryUserIdSpy = jest.spyOn(telemetryUtils, 'getSharedTelemetryUserId');

      const uId = await getTelemetryUserId(coreExtensionContext, undefined);

      // Should NOT call getSharedTelemetryUserId for Core extension
      expect(getSharedTelemetryUserIdSpy).not.toHaveBeenCalled();
      expect(uId).toBe(UNAUTHENTICATED_USER);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', UNAUTHENTICATED_USER);
    });

    it('should use provided SharedTelemetryProvider when available', async () => {
      const sharedUserId = 'shared-telemetry-user-id';
      const mockProvider: SharedTelemetryProvider = {
        getSharedTelemetryUserId: jest.fn().mockResolvedValue(sharedUserId)
      };

      const uId = await getTelemetryUserId(fakeExtensionContext, mockProvider);

      expect(mockProvider.getSharedTelemetryUserId).toHaveBeenCalled();
      expect(uId).toBe(sharedUserId);
      expect(fakeGet).not.toHaveBeenCalled(); // Should not check global state when shared ID is available
    });

    it('should fall back to local logic when SharedTelemetryProvider returns undefined', async () => {
      const mockProvider: SharedTelemetryProvider = {
        getSharedTelemetryUserId: jest.fn().mockResolvedValue(undefined)
      };
      fakeGet.mockReturnValueOnce(globalTelemetryUserId);

      const uId = await getTelemetryUserId(fakeExtensionContext, mockProvider);

      expect(mockProvider.getSharedTelemetryUserId).toHaveBeenCalled();
      expect(uId).toBe(globalTelemetryUserId);
      expect(fakeGet).toHaveBeenCalled(); // Should check global state when shared ID is not available
    });
  });
});
