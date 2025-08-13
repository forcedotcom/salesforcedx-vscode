/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';
import { WorkspaceContextUtil } from '../../../../src';
import { UserService } from '../../../../src/services/userService';

jest.mock('../../../../src/context/workspaceContextUtil');

describe('UserService', () => {
  describe('getTelemetryUserId', () => {
    const globalTelemetryUserId = 'e45rdcfy7ygvhu8uhbnjiiugdrgb';
    const testOrgId = '00D000000000000EAA';
    const testUserId = 'test@example.com';

    let fakeExtensionContext: ExtensionContext;
    let getRandomUserIdSpy: jest.SpyInstance;
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

      getRandomUserIdSpy = jest.spyOn(UserService as any, 'getRandomUserId');

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

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(getRandomUserIdSpy).not.toHaveBeenCalled();
      expect(uId).toBe(globalTelemetryUserId);
    });

    it('should return hashed combination of orgId and userId when both are available', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      // The result should be a SHA-256 hash
      expect(uId).toHaveLength(64); // SHA-256 produces 64-character hex string
      expect(uId).toMatch(/^[a-f0-9]{64}$/); // Should be hex characters only
      expect(getRandomUserIdSpy).not.toHaveBeenCalled();
    });

    it('should generate random userId when orgId or userId is not available', async () => {
      const randomId = 'randomGeneratedId123';
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = undefined;
      mockUsername = undefined;
      getRandomUserIdSpy.mockReturnValue(randomId);

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(getRandomUserIdSpy).toHaveBeenCalled();
      expect(uId).toBe(randomId);
    });

    it('should generate random userId when only orgId is available but username is missing', async () => {
      const randomId = 'randomGeneratedId456';
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = undefined;
      getRandomUserIdSpy.mockReturnValue(randomId);

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(getRandomUserIdSpy).toHaveBeenCalled();
      expect(uId).toBe(randomId);
    });

    it('should generate consistent hash for the same orgId and userId combination', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId1 = await UserService.getTelemetryUserId(fakeExtensionContext);

      // Reset and test again
      fakeGet.mockReturnValueOnce(undefined);
      const uId2 = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(uId1).toBe(uId2); // Should be deterministic
      expect(uId1).toHaveLength(64);
    });

    it('should replace random globalStateUserId with hash when user authorizes to org', async () => {
      const randomUserId = 'RANDOM_abc123def456';
      fakeGet.mockReturnValueOnce(randomUserId); // Existing random value
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      // Should generate hash and update globalState
      expect(uId).toHaveLength(64); // SHA-256 hash
      expect(uId).toMatch(/^[a-f0-9]{64}$/);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', uId);
    });

    it('should keep existing random value when no org authorization available', async () => {
      const randomUserId = 'RANDOM_abc123def456';
      fakeGet.mockReturnValueOnce(randomUserId); // Existing random value
      mockOrgId = undefined;
      mockUsername = undefined;

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      // Should keep the same random value
      expect(uId).toBe(randomUserId);
      expect(fakeUpdate).not.toHaveBeenCalled();
    });

    it('should preserve existing hash when user authorizes to a different org', async () => {
      const existingHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      fakeGet.mockReturnValueOnce(existingHash); // Existing non-random hash
      mockOrgId = 'differentOrgId123';
      mockUsername = 'different@user.com';

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      // Should keep the original hash, not generate new one
      expect(uId).toBe(existingHash);
      expect(fakeUpdate).not.toHaveBeenCalled();
    });

    it('should store hash in globalState when undefined and org data available', async () => {
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = testOrgId;
      mockUsername = testUserId;

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      // Should generate hash and store it
      expect(uId).toHaveLength(64);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', uId);
    });

    it('should create and store random userId when undefined and no org data', async () => {
      const randomId = 'RANDOM_generatedId789';
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = undefined;
      mockUsername = undefined;
      getRandomUserIdSpy.mockReturnValue(randomId);

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      // Should generate random ID and store it
      expect(uId).toBe(randomId);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', randomId);
      expect(getRandomUserIdSpy).toHaveBeenCalled();
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

      const randomId = 'RANDOM_coreExtensionId';
      fakeGet.mockReturnValueOnce(undefined); // No existing globalStateUserId
      mockOrgId = undefined;
      mockUsername = undefined;
      getRandomUserIdSpy.mockReturnValue(randomId);

      const getSharedTelemetryUserIdSpy = jest.spyOn(UserService as any, 'getSharedTelemetryUserId');

      const uId = await UserService.getTelemetryUserId(coreExtensionContext);

      // Should NOT call getSharedTelemetryUserId for Core extension
      expect(getSharedTelemetryUserIdSpy).not.toHaveBeenCalled();
      expect(uId).toBe(randomId);
      expect(fakeUpdate).toHaveBeenCalledWith('telemetryUserId', randomId);
    });
  });
});
