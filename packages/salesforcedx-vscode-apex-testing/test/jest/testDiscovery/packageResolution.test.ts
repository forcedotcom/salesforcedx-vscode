/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import {
  resetPackageResolutionState,
  getPackageResolutionCacheKey,
  isPackageResolutionUnavailable,
  resolvePackage2Members
} from '../../../src/testDiscovery/packageResolution';

describe('packageResolution', () => {
  let mockConnection: Partial<Connection>;
  let mockToolingQuery: jest.Mock;

  beforeEach(() => {
    mockToolingQuery = jest.fn();
    mockConnection = {
      getAuthInfoFields: jest.fn().mockReturnValue({ orgId: 'org123', username: 'user@example.com' }),
      tooling: {
        query: mockToolingQuery
      } as unknown as Connection['tooling']
    };
  });

  describe('getPackageResolutionCacheKey', () => {
    it('should return orgId when available', () => {
      const key = getPackageResolutionCacheKey(mockConnection as Connection);
      expect(key).toBe('org123');
    });

    it('should return username when orgId is missing', () => {
      (mockConnection.getAuthInfoFields as jest.Mock).mockReturnValue({ username: 'fallback@example.com' });
      const key = getPackageResolutionCacheKey(mockConnection as Connection);
      expect(key).toBe('fallback@example.com');
    });

    it('should return "unknown" when getAuthInfoFields throws', () => {
      (mockConnection.getAuthInfoFields as jest.Mock).mockImplementation(() => {
        throw new Error('auth failed');
      });
      const key = getPackageResolutionCacheKey(mockConnection as Connection);
      expect(key).toBe('unknown');
    });
  });

  describe('isPackageResolutionUnavailable', () => {
    it('should return false when org has not been marked unavailable', () => {
      expect(isPackageResolutionUnavailable(mockConnection as Connection)).toBe(false);
    });

    it('should return true after resolvePackage2Members fails with Package2Member unavailable error', async () => {
      mockToolingQuery.mockRejectedValueOnce(new Error("sObject type 'Package2Member' is not supported."));
      await resolvePackage2Members(mockConnection as Connection, ['01p000000000001AAA']);
      expect(isPackageResolutionUnavailable(mockConnection as Connection)).toBe(true);
    });
  });

  describe('resolvePackage2Members', () => {
    beforeEach(() => {
      resetPackageResolutionState();
    });

    it('should return empty map for empty class IDs', async () => {
      const result = await resolvePackage2Members(mockConnection as Connection, []);
      expect(result.size).toBe(0);
      expect(mockToolingQuery).not.toHaveBeenCalled();
    });

    it('should return empty map for class IDs with no Package2Member', async () => {
      mockToolingQuery
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });
      const result = await resolvePackage2Members(mockConnection as Connection, [
        '01p000000000001AAA',
        '01p000000000002AAA'
      ]);
      expect(result.size).toBe(0);
      expect(mockToolingQuery).toHaveBeenCalledTimes(3);
      expect(mockToolingQuery.mock.calls[0][0]).toContain('MetadataComponentId');
      expect(mockToolingQuery.mock.calls[1][0]).toContain('SubjectId');
      expect(mockToolingQuery.mock.calls[2][0]).toContain('Package2');
    });

    it('should resolve 2GP package info when Package2Member and Package2 exist', async () => {
      mockToolingQuery
        .mockResolvedValueOnce({
          records: [{ Id: 'm1', MetadataComponentId: '01p000000000001AAA', Package2Id: '0Ho000000000001AAA' }]
        })
        .mockResolvedValueOnce({
          records: [
            {
              Id: '0Ho000000000001AAA',
              Name: 'My Package',
              NamespacePrefix: 'myns'
            }
          ]
        });
      const result = await resolvePackage2Members(mockConnection as Connection, ['01p000000000001AAA']);
      expect(result.size).toBe(1);
      const info = result.get('01p000000000001AAA');
      expect(info).toBeDefined();
      expect(info?.package2Id).toBe('0Ho000000000001AAA');
      expect(info?.packageName).toBe('My Package');
      expect(info?.namespacePrefix).toBe('myns');
      expect(mockToolingQuery).toHaveBeenCalledTimes(2);
    });

    it('should return empty map and not throw when Package2Member query fails', async () => {
      mockToolingQuery.mockRejectedValueOnce(new Error('Permission denied'));
      const result = await resolvePackage2Members(mockConnection as Connection, ['01p000000000001AAA']);
      expect(result.size).toBe(0);
    });

    it('should return empty map and not throw when Package2 query fails', async () => {
      mockToolingQuery
        .mockResolvedValueOnce({
          records: [{ Id: 'm1', MetadataComponentId: '01p000000000001AAA', Package2Id: '0Ho000000000001AAA' }]
        })
        .mockRejectedValueOnce(new Error('Package2 not found'));
      const result = await resolvePackage2Members(mockConnection as Connection, ['01p000000000001AAA']);
      expect(result.size).toBe(0);
    });

    it('should skip empty or invalid class IDs', async () => {
      mockToolingQuery
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });
      const result = await resolvePackage2Members(mockConnection as Connection, ['', '01p000000000001AAA']);
      expect(result.size).toBe(0);
      expect(mockToolingQuery).toHaveBeenCalledWith(expect.stringContaining('01p000000000001AAA'));
      expect(mockToolingQuery).not.toHaveBeenCalledWith(expect.stringContaining("''"));
    });

    it('should cache results for same org', async () => {
      mockToolingQuery
        .mockResolvedValueOnce({
          records: [{ Id: 'm1', MetadataComponentId: '01pAAA', Package2Id: '0HoAAA' }]
        })
        .mockResolvedValueOnce({
          records: [{ Id: '0HoAAA', Name: 'Pkg', NamespacePrefix: null }]
        });
      const result1 = await resolvePackage2Members(mockConnection as Connection, ['01pAAA']);
      expect(result1.size).toBe(1);
      expect(mockToolingQuery).toHaveBeenCalledTimes(2);
      const result2 = await resolvePackage2Members(mockConnection as Connection, ['01pAAA']);
      expect(result2.size).toBe(1);
      expect(mockToolingQuery).toHaveBeenCalledTimes(2);
    });

    it('should try SubjectId when MetadataComponentId fails with no such column (e.g. subscriber org)', async () => {
      const classId = '01p000000000001AAA';
      const noSuchColumnError = new Error(
        "No such column 'MetadataComponentId' on entity 'Package2Member'. If you are attempting to use a custom field, be sure to append the '__c' after the custom field name."
      );
      mockToolingQuery
        .mockRejectedValueOnce(noSuchColumnError)
        .mockResolvedValueOnce({
          records: [{ Id: 'm1', SubjectId: classId, Package2Id: '0Ho000000000001AAA' }]
        })
        .mockResolvedValueOnce({
          records: [{ Id: '0Ho000000000001AAA', Name: 'My Unlocked Package', NamespacePrefix: null }]
        });
      const result = await resolvePackage2Members(mockConnection as Connection, [classId]);
      expect(result.size).toBe(1);
      const info = result.get(classId);
      expect(info).toBeDefined();
      expect(info?.package2Id).toBe('0Ho000000000001AAA');
      expect(info?.packageName).toBe('My Unlocked Package');
      expect(mockToolingQuery).toHaveBeenCalledTimes(3);
      expect(mockToolingQuery.mock.calls[0][0]).toContain('MetadataComponentId');
      expect(mockToolingQuery.mock.calls[1][0]).toContain('SubjectId');
      expect(mockToolingQuery.mock.calls[2][0]).toContain('Package2');
    });

    it('should resolve package via fallback when direct query returns no rows (e.g. unlocked in subscriber org)', async () => {
      const classId = '01p000000000003AAA';
      mockToolingQuery
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({
          records: [{ Id: '0Ho000000000002AAA', Name: 'Unlocked Package', NamespacePrefix: null }]
        })
        .mockResolvedValueOnce({
          records: [{ MetadataComponentId: classId, Package2Id: '0Ho000000000002AAA' }]
        });
      const result = await resolvePackage2Members(mockConnection as Connection, [classId]);
      expect(result.size).toBe(1);
      const info = result.get(classId);
      expect(info).toBeDefined();
      expect(info?.package2Id).toBe('0Ho000000000002AAA');
      expect(info?.packageName).toBe('Unlocked Package');
      expect(info?.namespacePrefix).toBeNull();
      expect(mockToolingQuery).toHaveBeenCalledTimes(4);
      expect(mockToolingQuery.mock.calls[0][0]).toContain('MetadataComponentId');
      expect(mockToolingQuery.mock.calls[1][0]).toContain('SubjectId');
      expect(mockToolingQuery.mock.calls[2][0]).toContain('Package2');
      expect(mockToolingQuery.mock.calls[3][0]).toContain('Package2Member');
      expect(mockToolingQuery.mock.calls[3][0]).toContain('Package2Id');
    });

    it('should resolve from InstalledSubscriberPackage when Package2Member fails and classIdToNamespace is provided', async () => {
      const classId = '01p000000000001AAA';
      const noSuchColumnMetadata = new Error("No such column 'MetadataComponentId' on entity 'Package2Member'.");
      const noSuchColumnPackage2Id = new Error("No such column 'Package2Id' on entity 'Package2Member'.");
      mockToolingQuery
        .mockRejectedValueOnce(noSuchColumnMetadata)
        .mockRejectedValueOnce(noSuchColumnPackage2Id)
        .mockResolvedValueOnce({
          records: [
            {
              Id: '0Hi000000000001AAA',
              SubscriberPackageId: '033xx000000001AAA',
              SubscriberPackage: {
                NamespacePrefix: 'taf',
                Name: 'Trigger Actions Framework'
              }
            }
          ]
        });
      const classIdToNamespace = new Map<string, string>([
        [classId, 'taf'],
        ['01p000000000002AAA', '']
      ]);
      const result = await resolvePackage2Members(
        mockConnection as Connection,
        [classId, '01p000000000002AAA'],
        classIdToNamespace
      );
      expect(result.size).toBe(1);
      const info = result.get(classId);
      expect(info).toBeDefined();
      expect(info?.packageName).toBe('Trigger Actions Framework');
      expect(info?.namespacePrefix).toBe('taf');
      expect(info?.package2Id).toBe('033xx000000001AAA');
      expect(mockToolingQuery).toHaveBeenCalledTimes(3);
      expect(mockToolingQuery.mock.calls[2][0]).toContain('InstalledSubscriberPackage');
    });

    it('should resolve no-namespace classes to single no-namespace package (Skyline resolveNoNamespaceInstalledItem)', async () => {
      const classId = '01p000000000001AAA';
      mockToolingQuery
        .mockRejectedValueOnce(new Error("No such column 'MetadataComponentId' on entity 'Package2Member'."))
        .mockRejectedValueOnce(new Error("No such column 'Package2Id' on entity 'Package2Member'."))
        .mockResolvedValueOnce({
          records: [
            {
              Id: '0Hi000000000001AAA',
              SubscriberPackageId: '033xx000000001AAA',
              SubscriberPackage: {
                NamespacePrefix: null,
                Name: 'Trigger Actions Framework'
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          records: [{ Id: classId, ManageableState: 'installedEditable' }]
        });
      const classIdToNamespace = new Map<string, string>([[classId, '']]);
      const result = await resolvePackage2Members(mockConnection as Connection, [classId], classIdToNamespace);
      expect(result.size).toBe(1);
      const info = result.get(classId);
      expect(info).toBeDefined();
      expect(info?.packageName).toBe('Trigger Actions Framework');
      expect(info?.containerOptions).toBe('Unlocked');
      expect(mockToolingQuery).toHaveBeenCalledTimes(4);
      expect(mockToolingQuery.mock.calls[2][0]).toContain('InstalledSubscriberPackage');
      expect(mockToolingQuery.mock.calls[3][0]).toContain('ApexClass');
      expect(mockToolingQuery.mock.calls[3][0]).toContain('ManageableState');
    });

    it('should only resolve no-namespace classes with installed ManageableState (null/empty excluded)', async () => {
      const installedId = '01p000000000001AAA';
      const unpackagedId = '01p000000000002AAA';
      mockToolingQuery
        .mockRejectedValueOnce(new Error("No such column 'MetadataComponentId' on entity 'Package2Member'."))
        .mockRejectedValueOnce(new Error("No such column 'Package2Id' on entity 'Package2Member'."))
        .mockResolvedValueOnce({
          records: [
            {
              Id: '0Hi000000000001AAA',
              SubscriberPackageId: '033xx000000001AAA',
              SubscriberPackage: {
                NamespacePrefix: null,
                Name: 'Trigger Actions Framework'
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          records: [
            { Id: installedId, ManageableState: 'installed' },
            { Id: unpackagedId, ManageableState: null }
          ]
        });
      const classIdToNamespace = new Map<string, string>([
        [installedId, ''],
        [unpackagedId, '']
      ]);
      const result = await resolvePackage2Members(
        mockConnection as Connection,
        [installedId, unpackagedId],
        classIdToNamespace
      );
      expect(result.size).toBe(1);
      expect(result.get(installedId)?.packageName).toBe('Trigger Actions Framework');
      expect(result.has(unpackagedId)).toBe(false);
    });

    it('when org is unavailable but cache has entries for requested ids, returns cached resolution', async () => {
      const classId = '01p000000000001AAA';
      const noSuchColumnMetadata = new Error("No such column 'MetadataComponentId' on entity 'Package2Member'.");
      const noSuchColumnPackage2Id = new Error("No such column 'Package2Id' on entity 'Package2Member'.");
      mockToolingQuery
        .mockRejectedValueOnce(noSuchColumnMetadata)
        .mockRejectedValueOnce(noSuchColumnPackage2Id)
        .mockResolvedValueOnce({
          records: [
            {
              Id: '0Hi000000000001AAA',
              SubscriberPackageId: '033xx000000001AAA',
              SubscriberPackage: {
                NamespacePrefix: null,
                Name: 'Trigger Actions Framework'
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          records: [{ Id: classId, ManageableState: 'installedEditable' }]
        });
      const classIdToNamespace = new Map<string, string>([[classId, '']]);
      const first = await resolvePackage2Members(mockConnection as Connection, [classId], classIdToNamespace);
      expect(first.size).toBe(1);
      expect(first.get(classId)?.packageName).toBe('Trigger Actions Framework');
      const second = await resolvePackage2Members(mockConnection as Connection, [classId], classIdToNamespace);
      expect(second.size).toBe(1);
      expect(second.get(classId)?.packageName).toBe('Trigger Actions Framework');
      expect(mockToolingQuery).toHaveBeenCalledTimes(4);
    });
  });
});
