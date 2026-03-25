/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Package2MemberRecord, ResolvedPackageInfo } from './schemas';
import type { Connection } from '@salesforce/core';
import type { InstalledSubscriberPackage, Package2 } from '@salesforce/types/tooling';

const PACKAGE2_MEMBER_BATCH_SIZE = 200;

const packageResolutionCache: Map<string, Map<string, ResolvedPackageInfo>> = new Map();

/** Org keys where Package2/Package2Member are not available (e.g. subscriber orgs). Skip resolution. */
const packageResolutionUnavailableOrgs = new Set<string>();

/** Optional org info from defaultOrgRef (Services); when provided, avoids file read to get orgId. */
type PackageResolutionOrgInfo = { orgId?: string; username?: string };

/**
 * Returns a cache key for the current org from defaultOrgRef (Services) org info.
 */
export const getPackageResolutionCacheKey = (orgInfo: PackageResolutionOrgInfo): string =>
  orgInfo.orgId ?? orgInfo.username ?? 'unknown';

/**
 * Returns true if package resolution (Package2/Package2Member) is not available for this org
 * (e.g. subscriber org where those objects or columns are not queryable).
 * Call after resolvePackage2Members so the org may have been marked unavailable on failure.
 */
export const isPackageResolutionUnavailable = (orgInfo: PackageResolutionOrgInfo): boolean =>
  packageResolutionUnavailableOrgs.has(getPackageResolutionCacheKey(orgInfo));

/** Resets cache and unavailable-org set. For testing only. */
export const resetPackageResolutionState = (): void => {
  packageResolutionCache.clear();
  packageResolutionUnavailableOrgs.clear();
};

/** Returns true if the error indicates Package2Member (or Package2) is not available in this org. */
const isPackage2UnavailableError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes('package2member') ||
    lower.includes('package2') ||
    lower.includes('is not supported') ||
    lower.includes('invalid type') ||
    lower.includes('sobject type') ||
    lower.includes('unknown error') ||
    lower.includes('no such column')
  );
};

/** True when the error is "no such column" for the given field (e.g. subscriber orgs where Package2Member has SubjectId but not MetadataComponentId). */
const isNoSuchColumnForField = (error: unknown, field: string): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return lower.includes('no such column') && lower.includes(field.toLowerCase());
};

/** Thrown when MetadataComponentId is not available so caller should try SubjectId. */
class TrySubjectIdError extends Error {
  constructor() {
    super('TrySubjectId');
    this.name = 'TrySubjectIdError';
  }
}

const getComponentId = (m: Package2MemberRecord): string | undefined => m.MetadataComponentId ?? m.SubjectId;

/**
 * Resolves package info from InstalledSubscriberPackage (subscriber orgs).
 * - Classes with a namespace: match by SubscriberPackage.NamespacePrefix.
 * - Classes with no namespace: when there is exactly one installed package with no namespace
 * (e.g. Trigger Actions Framework), assign those classes to it. Uses ApexClass.ManageableState
 * when available so only "installed"/"installedEditable" classes are assigned (Skyline's
 * resolveNoNamespaceInstalledItem logic).
 * See: https://github.com/mitchspano/Skyline/blob/main/extension/src/modules/s/metadataExplorer/packageResolver.ts
 */
const resolveFromInstalledSubscriberPackages = async (
  connection: Connection,
  classIdToNamespace: Map<string, string>
): Promise<Map<string, ResolvedPackageInfo>> => {
  const result = new Map<string, ResolvedPackageInfo>();
  if (classIdToNamespace.size === 0) {
    return result;
  }
  const packageQuery =
    'SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name FROM InstalledSubscriberPackage ORDER BY SubscriberPackage.NamespacePrefix';
  try {
    const packageResult = await connection.tooling.query<InstalledSubscriberPackage>(packageQuery);
    const records = packageResult.records ?? [];

    const byNamespace = new Map<string, InstalledSubscriberPackage>();
    const noNamespacePackages: InstalledSubscriberPackage[] = [];
    for (const rec of records) {
      const ns = (rec.SubscriberPackage?.NamespacePrefix ?? '').trim();
      if (ns !== '') {
        byNamespace.set(ns, rec);
      } else {
        noNamespacePackages.push(rec);
      }
    }
    const noNsClassIdsAssigned: string[] = [];
    for (const [classId, namespacePrefix] of classIdToNamespace) {
      const ns = (namespacePrefix ?? '').trim();
      if (ns !== '') {
        const pkg = byNamespace.get(ns);
        if (pkg?.SubscriberPackage?.Name != null && pkg.SubscriberPackageId) {
          result.set(classId, {
            package2Id: pkg.SubscriberPackageId,
            packageName: pkg.SubscriberPackage.Name,
            namespacePrefix: pkg.SubscriberPackage.NamespacePrefix ?? null
          });
        }
        continue;
      }

      if (noNamespacePackages.length !== 1) {
        continue;
      }

      const singleNoNsPkg = noNamespacePackages[0];
      const subPkg = singleNoNsPkg?.SubscriberPackage;
      if (!subPkg?.Name || !singleNoNsPkg.SubscriberPackageId) {
        continue;
      }

      noNsClassIdsAssigned.push(classId);
      result.set(classId, {
        package2Id: singleNoNsPkg.SubscriberPackageId,
        packageName: subPkg.Name,
        namespacePrefix: subPkg.NamespacePrefix ?? null,
        containerOptions: 'Unlocked'
      });
    }

    if (noNamespacePackages.length === 1 && noNsClassIdsAssigned.length > 0) {
      const unpackagedClassIds = await getUnpackagedApexClassIds(connection, noNsClassIdsAssigned);
      for (const classId of noNsClassIdsAssigned) {
        if (unpackagedClassIds.has(normalizeId(classId))) {
          result.delete(classId);
        }
      }
    }
  } catch {
    // InstalledSubscriberPackage not available or query failed; skip subscriber resolution
  }
  return result;
};

/** Normalize Salesforce Id to 15-char form so 15-char (e.g. discovery) and 18-char (e.g. Tooling query) match. */
const normalizeId = (id: string): string => (id.length >= 15 ? id.substring(0, 15) : id);

/**
 * ManageableState values that indicate the class is unpackaged (not from an installed package).
 * We remove from the no-namespace package only when we have positive evidence of unpackaged.
 * Any other value (installed, installedEditable, released, beta, etc.) keeps the class in the package.
 */
const UNPACKAGED_STATES = new Set(['', 'unmanaged']);

/**
 * Returns the set of ApexClass Ids that have ManageableState indicating unpackaged
 * (null, empty, or 'unmanaged'). We use "remove when unpackaged" so that any other
 * ManageableState value (installed, released, beta, etc.) keeps the class in the
 * single no-namespace package. Ids are normalized to 15-char so discovery (15-char)
 * and Tooling query (18-char) match. On query failure, returns empty set so we don't
 * remove any (keep all in package).
 */
const getUnpackagedApexClassIds = async (connection: Connection, classIds: string[]): Promise<Set<string>> => {
  const out = new Set<string>();
  if (classIds.length === 0) {
    return out;
  }
  const batchSize = 200;
  for (let i = 0; i < classIds.length; i += batchSize) {
    const batch = classIds.slice(i, i + batchSize);
    const inClause = batch.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
    const q = `SELECT Id, ManageableState FROM ApexClass WHERE Id IN (${inClause})`;
    try {
      const res = await connection.tooling.query<{ Id: string; ManageableState?: string }>(q);
      for (const rec of res.records ?? []) {
        if (!rec.Id) continue;
        const state = (rec.ManageableState ?? '').trim().toLowerCase();
        if (UNPACKAGED_STATES.has(state)) {
          out.add(normalizeId(rec.Id));
        }
      }
    } catch {
      return new Set();
    }
  }
  return out;
};

/**
 * Resolves ApexClass IDs to their owning Package2 (2GP) via Tooling API.
 * Package2 and Package2Member exist only in dev hub/packaging orgs, not in subscriber orgs
 * where packages are installed. If those objects are unavailable, returns empty map and skips
 * further queries for that org.
 * When optional classIdToNamespace is provided and Package2Member resolution fails, tries
 * InstalledSubscriberPackage (subscriber org) and matches by namespace to get package names.
 * Returns a map from ApexClass Id to package info. Classes not in any Package2Member are omitted
 * (caller treats them as unpackaged or 1GP based on namespace from discovery).
 */
export const resolvePackage2Members = async (
  connection: Connection,
  apexClassIds: string[],
  classIdToNamespace?: Map<string, string>,
  orgInfo?: PackageResolutionOrgInfo
): Promise<Map<string, ResolvedPackageInfo>> => {
  const validIds = apexClassIds.filter(id => typeof id === 'string' && id.length > 0);
  if (validIds.length === 0) {
    return new Map();
  }

  const cacheKey = orgInfo ? getPackageResolutionCacheKey(orgInfo) : 'unknown';

  if (packageResolutionUnavailableOrgs.has(cacheKey)) {
    const cachedForUnavailable = packageResolutionCache.get(cacheKey);
    if (cachedForUnavailable?.size) {
      const filteredFromCache = new Map<string, ResolvedPackageInfo>();
      for (const id of validIds) {
        const info = cachedForUnavailable.get(id);
        if (info) {
          filteredFromCache.set(id, info);
        }
      }
      return filteredFromCache;
    }
    return new Map();
  }

  const cached = packageResolutionCache.get(cacheKey);
  const allCached = validIds.every(id => cached?.has(id));
  if (cached && allCached) {
    const filteredFromCache = new Map<string, ResolvedPackageInfo>();
    for (const id of validIds) {
      const info = cached.get(id);
      if (info) {
        filteredFromCache.set(id, info);
      }
    }
    return filteredFromCache;
  }

  const allMembers: Package2MemberRecord[] = [];

  const runMemberQuery = async (field: 'MetadataComponentId' | 'SubjectId', columns?: string): Promise<void> => {
    const selectList = columns ?? `Id, ${field}, Package2Id`;
    for (let i = 0; i < validIds.length; i += PACKAGE2_MEMBER_BATCH_SIZE) {
      const batch = validIds.slice(i, i + PACKAGE2_MEMBER_BATCH_SIZE);
      const inClause = batch.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
      const memberQuery = `SELECT ${selectList} FROM Package2Member WHERE ${field} IN (${inClause})`;

      try {
        const memberResult = await connection.tooling.query<Package2MemberRecord>(memberQuery);
        const count = memberResult.records?.length ?? 0;
        if (count > 0) {
          allMembers.push(...memberResult.records!);
        }
      } catch (error) {
        if (field === 'MetadataComponentId' && isNoSuchColumnForField(error, 'MetadataComponentId')) {
          throw new TrySubjectIdError();
        }
        if (isPackage2UnavailableError(error)) {
          packageResolutionUnavailableOrgs.add(cacheKey);
        }
        throw error;
      }
    }
  };

  let subjectIdOnly = false;
  const tryInstalledSubscriberFallback = async (): Promise<Map<string, ResolvedPackageInfo>> => {
    if (classIdToNamespace?.size) {
      return resolveFromInstalledSubscriberPackages(connection, classIdToNamespace);
    }
    return new Map();
  };

  try {
    await runMemberQuery('MetadataComponentId');
    if (allMembers.length === 0) {
      await runMemberQuery('SubjectId', 'Id, Package2Id, SubjectId, SubjectKeyPrefix');
    }
  } catch (error) {
    if (error instanceof TrySubjectIdError) {
      try {
        // Skyline-style columns: SubjectId, SubjectKeyPrefix, Package2Id (see sfCli.ts)
        await runMemberQuery('SubjectId', 'Id, Package2Id, SubjectId, SubjectKeyPrefix');
        subjectIdOnly = true;
      } catch (e2) {
        if (isPackage2UnavailableError(e2)) {
          packageResolutionUnavailableOrgs.add(cacheKey);
        }
        const fallback = await tryInstalledSubscriberFallback();
        const cache = packageResolutionCache.get(cacheKey) ?? new Map<string, ResolvedPackageInfo>();
        for (const [id, info] of fallback) {
          cache.set(id, info);
        }
        packageResolutionCache.set(cacheKey, cache);
        return fallback;
      }
    } else {
      const fallback = await tryInstalledSubscriberFallback();
      const cache = packageResolutionCache.get(cacheKey) ?? new Map<string, ResolvedPackageInfo>();
      for (const [id, info] of fallback) {
        cache.set(id, info);
      }
      packageResolutionCache.set(cacheKey, cache);
      return fallback;
    }
  }

  const result = new Map<string, ResolvedPackageInfo>();
  const existingCache = packageResolutionCache.get(cacheKey) ?? new Map<string, ResolvedPackageInfo>();

  if (allMembers.length > 0) {
    const package2Ids = [
      ...new Set(
        allMembers.map(m => m.Package2Id).filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    ];
    const package2ById = new Map<string, Package2>();

    for (let i = 0; i < package2Ids.length; i += PACKAGE2_MEMBER_BATCH_SIZE) {
      const batch = package2Ids.slice(i, i + PACKAGE2_MEMBER_BATCH_SIZE);
      const inClause = batch.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
      // ContainerOptions indicates Unlocked vs Managed (see Skyline sfCli.ts)
      const packageQuery = `SELECT Id, Name, NamespacePrefix, ContainerOptions FROM Package2 WHERE Id IN (${inClause})`;

      try {
        const packageResult = await connection.tooling.query<Package2>(packageQuery);
        const count = packageResult.records?.length ?? 0;
        if (count > 0) {
          for (const rec of packageResult.records!) {
            if (rec.Id) {
              package2ById.set(rec.Id, rec);
            }
          }
        }
      } catch {
        packageResolutionCache.set(cacheKey, existingCache);
        return result;
      }
    }

    for (const member of allMembers) {
      const pkgId = member.Package2Id;
      const pkg = pkgId ? package2ById.get(pkgId) : undefined;
      const componentId = getComponentId(member);
      if (!pkg || !componentId || pkg.Id == null || pkg.Name == null) {
        continue;
      }
      const info: ResolvedPackageInfo = {
        package2Id: pkg.Id,
        packageName: pkg.Name,
        namespacePrefix: pkg.NamespacePrefix ?? null,
        containerOptions: pkg.ContainerOptions
      };
      result.set(componentId, info);
      existingCache.set(componentId, info);
    }
  }

  // Fallback: if some class ids are still unresolved (e.g. subscriber org where
  // unlocked package members are only discoverable by querying Package2 then
  // Package2Member per package), query all packages and their members.
  const unresolvedIds = validIds.filter(id => !result.has(id));
  if (unresolvedIds.length > 0) {
    const fallbackResult = await resolvePackage2MembersByPackage(
      connection,
      unresolvedIds,
      existingCache,
      subjectIdOnly,
      cacheKey
    );
    if (fallbackResult && fallbackResult.size > 0) {
      for (const [id, info] of fallbackResult) {
        result.set(id, info);
      }
    }
  }

  packageResolutionCache.set(cacheKey, existingCache);
  return result;
};

/**
 * Fallback: resolve package membership by querying all Package2 in the org, then
 * Package2Member per package. Used when direct MetadataComponentId IN (...) returns
 * no rows (e.g. subscriber org with installed unlocked packages).
 * When subjectIdOnly is true (e.g. org has SubjectId but not MetadataComponentId),
 * queries only SubjectId and Package2Id from Package2Member.
 * Merges into existingCache and returns a result map for the requested apexClassIds only.
 * Returns null if the Package2 list query fails.
 */
const resolvePackage2MembersByPackage = async (
  connection: Connection,
  apexClassIds: string[],
  existingCache: Map<string, ResolvedPackageInfo>,
  subjectIdOnly: boolean,
  cacheKey: string
): Promise<Map<string, ResolvedPackageInfo> | null> => {
  let package2List: Package2[] = [];
  try {
    const packageQuery = 'SELECT Id, Name, NamespacePrefix, ContainerOptions FROM Package2';
    const packageResult = await connection.tooling.query<Package2>(packageQuery);
    const count = packageResult.records?.length ?? 0;
    if (count > 0) {
      package2List = packageResult.records!;
    }
  } catch (error) {
    if (isPackage2UnavailableError(error)) {
      packageResolutionUnavailableOrgs.add(cacheKey);
    }
    return null;
  }

  if (package2List.length === 0) {
    return null;
  }

  const idSet = new Set(apexClassIds);
  const result = new Map<string, ResolvedPackageInfo>();

  const memberSelect = subjectIdOnly
    ? 'SubjectId, SubjectKeyPrefix, Package2Id'
    : 'MetadataComponentId, SubjectId, Package2Id';
  for (const pkg of package2List) {
    if (pkg.Id == null || pkg.Name == null) {
      continue;
    }
    try {
      const memberQuery = `SELECT ${memberSelect} FROM Package2Member WHERE Package2Id = '${pkg.Id.replaceAll("'", "''")}'`;
      const memberResult = await connection.tooling.query<Package2MemberRecord>(memberQuery);
      if (memberResult.records?.length) {
        const info: ResolvedPackageInfo = {
          package2Id: pkg.Id,
          packageName: pkg.Name,
          namespacePrefix: pkg.NamespacePrefix ?? null,
          containerOptions: pkg.ContainerOptions
        };
        for (const member of memberResult.records) {
          const mid = getComponentId(member);
          if (!mid) continue;
          existingCache.set(mid, info);
          if (idSet.has(mid)) {
            result.set(mid, info);
          }
        }
      }
    } catch {
      // Per-package failure (e.g. permission); skip this package and continue
    }
  }

  return result;
};
