/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService, getMessageFromError } from '@salesforce/effect-ext-utils';
import * as Array from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isError, isString } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  ApexClassManageableStateRow,
  type ContainerOption,
  InstalledSubscriberPackageRow,
  Package2MemberRow,
  Package2Row,
  type ResolvedPackageInfo
} from './schemas';

const PACKAGE2_MEMBER_BATCH_SIZE = 200;

/** Bounded parallelism for chunked Tooling queries. First failing chunk interrupts siblings and short-circuits. */
const BATCH_CONCURRENCY = 5;

/**
 * Package2Member documented columns. Package2Member has no MetadataComponentId or Package2Id
 * (undocumented; INVALID_FIELD on every org tested). SubjectId is the packaged component's Id;
 * SubscriberPackageId (033) is the join key to Package2 (Package2.SubscriberPackageId is Unique).
 * See https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_package2member.htm
 */
const MEMBER_COLUMNS = 'Id, SubjectId, SubjectKeyPrefix, SubscriberPackageId';

/**
 * ManageableState values that indicate the class is unpackaged (not from an installed package).
 * We remove from the no-namespace package only when we have positive evidence of unpackaged.
 * Any other value (installed, installedEditable, released, beta, etc.) keeps the class in the package.
 */
const UNPACKAGED_STATES = new Set(['', 'unmanaged']);

/** Org lacks Package2/Package2Member (e.g. subscriber org) — the `isPackage2UnavailableError` heuristic matched. */
class Package2UnavailableError extends Schema.TaggedError<Package2UnavailableError>()('Package2UnavailableError', {
  message: Schema.String
}) {}

/** Any other Tooling query failure (permission, network, etc.). */
class Package2QueryError extends Schema.TaggedError<Package2QueryError>()('Package2QueryError', {
  message: Schema.String
}) {}

/** In-memory resolution state, held per runtime in the service (replaces the former module-level Map/Set). */
type ResolutionState = {
  /** orgKey → (ApexClass Id → resolved package). Accumulates across calls. */
  readonly byOrg: HashMap.HashMap<string, HashMap.HashMap<string, ResolvedPackageInfo>>;
  /** orgKeys where Package2/Package2Member are not queryable; short-circuits future resolution. */
  readonly unavailable: HashSet.HashSet<string>;
};

/** Returns true if the error indicates Package2Member (or Package2) is not available in this org. */
const isPackage2UnavailableError = (error: unknown): boolean => {
  const lower = (isError(error) ? error.message : String(error)).toLowerCase();
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

/** Normalize Salesforce Id to 15-char form so 15-char (e.g. discovery) and 18-char (e.g. Tooling query) match. */
const normalizeId = (id: string): string => (id.length >= 15 ? id.substring(0, 15) : id);

const escapeId = (id: string): string => id.replaceAll("'", "''");
const inClause = (ids: readonly string[]): string => ids.map(id => `'${escapeId(id)}'`).join(',');

const toResolvedFromPackage2 = (pkg: Package2Row): ResolvedPackageInfo => ({
  package2Id: pkg.Id,
  packageName: pkg.Name,
  containerOptions: pkg.ContainerOptions
});

/** ManageableState absent/empty/'unmanaged' ⇒ unpackaged (keep the class out of the single no-namespace package). */
const isUnpackagedState = (state: Option.Option<string>): boolean =>
  UNPACKAGED_STATES.has(
    Option.getOrElse(state, () => '')
      .trim()
      .toLowerCase()
  );

/** Trim + drop empty so `''`/whitespace namespace behaves like `null`/absent (no-namespace bucket). */
const trimmedNamespace = (ns: Option.Option<string>): Option.Option<string> =>
  ns.pipe(
    Option.map(s => s.trim()),
    Option.filter(s => s !== '')
  );

/** Shared accessors: reach ConnectionService / TargetOrgRef ambiently through the Services extension. */
const getServicesApi = Effect.flatMap(ExtensionProviderService, ext => ext.getServicesApi);
const getConnection = Effect.flatMap(getServicesApi, api => api.services.ConnectionService.getConnection());
const getOrgKey = getServicesApi.pipe(
  Effect.flatMap(api => api.services.TargetOrgRef()),
  Effect.flatMap(SubscriptionRef.get),
  Effect.map(info => info.orgId ?? info.username ?? 'unknown')
);

/**
 * Run a Tooling SOQL query and decode each row against `schema`, dropping rows that don't decode
 * (filterMap) rather than failing the whole query. Query rejections classify into the unavailable
 * heuristic vs a generic query error so the caller can mark the org and/or fall back.
 */
const queryDecoded = <A, I>(schema: Schema.Schema<A, I>, connection: Connection, soql: string) =>
  Effect.tryPromise({
    try: () => connection.tooling.query(soql),
    catch: error =>
      isPackage2UnavailableError(error)
        ? new Package2UnavailableError({ message: getMessageFromError(error) })
        : new Package2QueryError({ message: getMessageFromError(error) })
  }).pipe(
    Effect.map(result => result.records ?? []),
    Effect.map(rows => Array.filterMap(rows, row => Schema.decodeUnknownOption(schema)(row)))
  );

/** Query `ids` in IN-clause chunks (bounded concurrency), decode, and flatten to one row list. */
const batchedQuery = <A, I>(
  schema: Schema.Schema<A, I>,
  connection: Connection,
  ids: readonly string[],
  toSoql: (chunk: readonly string[]) => string
) =>
  Effect.forEach(
    Array.chunksOf(ids, PACKAGE2_MEMBER_BATCH_SIZE),
    chunk => queryDecoded(schema, connection, toSoql(chunk)),
    {
      concurrency: BATCH_CONCURRENCY
    }
  ).pipe(Effect.map(Array.flatten));

/**
 * Returns ApexClass Ids (15-char) whose ManageableState indicates unpackaged. On any query failure the
 * result is empty (keep all in package). Used to prune the single no-namespace subscriber package.
 */
const getUnpackagedApexClassIds = Effect.fn('PackageResolutionService.getUnpackagedApexClassIds')(
  (connection: Connection, classIds: readonly string[]) =>
    batchedQuery(
      ApexClassManageableStateRow,
      connection,
      classIds,
      chunk => `SELECT Id, ManageableState FROM ApexClass WHERE Id IN (${inClause(chunk)})`
    ).pipe(
      Effect.map(Array.filter(row => isUnpackagedState(row.ManageableState))),
      Effect.map(rows => HashSet.fromIterable(rows.map(row => normalizeId(row.Id)))),
      Effect.catchAll(() => Effect.succeed(HashSet.empty<string>()))
    )
);

/**
 * Resolves package info from InstalledSubscriberPackage (subscriber orgs).
 * Namespaced classes: match by SubscriberPackage.NamespacePrefix.
 * No-namespace classes: when exactly one installed package has no namespace (e.g. Trigger Actions
 * Framework), assign those classes to it, then drop any that ManageableState proves unpackaged
 * (Skyline's resolveNoNamespaceInstalledItem logic). Any query failure recovers to an empty result.
 * See: https://github.com/mitchspano/Skyline/blob/main/extension/src/modules/s/metadataExplorer/packageResolver.ts
 */
const resolveFromInstalledSubscriberPackages = Effect.fn(
  'PackageResolutionService.resolveFromInstalledSubscriberPackages'
)(function* (connection: Connection, classIdToNamespace: ReadonlyMap<string, Option.Option<string>>) {
  if (classIdToNamespace.size === 0) {
    return HashMap.empty<string, ResolvedPackageInfo>();
  }
  const rows = yield* queryDecoded(
    InstalledSubscriberPackageRow,
    connection,
    'SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name FROM InstalledSubscriberPackage ORDER BY SubscriberPackage.NamespacePrefix'
  ).pipe(Effect.catchAll(() => Effect.succeed(Array.empty<InstalledSubscriberPackageRow>())));

  const byNamespace = HashMap.fromIterable(
    Array.filterMap(rows, row =>
      trimmedNamespace(row.SubscriberPackage.NamespacePrefix).pipe(Option.map(ns => [ns, row] as const))
    )
  );
  const noNamespacePackages = rows.filter(row =>
    trimmedNamespace(row.SubscriberPackage.NamespacePrefix).pipe(Option.isNone)
  );

  const entries = [...classIdToNamespace.entries()];

  // Namespaced classes: package2Id is the SubscriberPackageId (033); no ContainerOptions from this object.
  const namespaced = Array.filterMap(entries, ([classId, ns]) =>
    Option.flatMap(ns, prefix => HashMap.get(byNamespace, prefix)).pipe(
      Option.map(
        row =>
          [
            classId,
            {
              package2Id: row.SubscriberPackageId,
              packageName: row.SubscriberPackage.Name,
              containerOptions: Option.none<ContainerOption>()
            }
          ] as const
      )
    )
  );

  // No-namespace classes only resolve when EXACTLY one no-namespace package exists; head gives none otherwise.
  const singleNoNsPackage = noNamespacePackages.length === 1 ? Array.head(noNamespacePackages) : Option.none();
  const noNsClassIds = Option.isSome(singleNoNsPackage)
    ? Array.filterMap(entries, ([classId, ns]) => (Option.isNone(ns) ? Option.some(classId) : Option.none()))
    : [];
  const unpackaged =
    noNsClassIds.length > 0 ? yield* getUnpackagedApexClassIds(connection, noNsClassIds) : HashSet.empty<string>();
  const noNsResolved = Option.match(singleNoNsPackage, {
    onNone: () => Array.empty<readonly [string, ResolvedPackageInfo]>(),
    onSome: pkg =>
      Array.filterMap(noNsClassIds, classId =>
        HashSet.has(unpackaged, normalizeId(classId))
          ? Option.none()
          : Option.some([
              classId,
              {
                package2Id: pkg.SubscriberPackageId,
                packageName: pkg.SubscriberPackage.Name,
                containerOptions: Option.some<ContainerOption>('Unlocked')
              }
            ] as const)
      )
  });

  return HashMap.fromIterable([...namespaced, ...noNsResolved]);
});

/**
 * Primary path: query Package2Member by SubjectId (the ApexClass Id), then resolve owning packages in a
 * second query keyed by SubscriberPackageId (033) — Package2 has no relationship back to Package2Member.
 * Fails with Package2UnavailableError / Package2QueryError so the caller can mark the org and fall back.
 */
const resolveByMembers = Effect.fn('PackageResolutionService.resolveByMembers')(function* (
  connection: Connection,
  validIds: readonly string[]
) {
  const members = yield* batchedQuery(
    Package2MemberRow,
    connection,
    validIds,
    chunk => `SELECT ${MEMBER_COLUMNS} FROM Package2Member WHERE SubjectId IN (${inClause(chunk)})`
  );
  if (members.length === 0) {
    return HashMap.empty<string, ResolvedPackageInfo>();
  }
  const subscriberPackageIds = Array.dedupe(members.map(m => m.SubscriberPackageId));
  const packages = yield* batchedQuery(
    Package2Row,
    connection,
    subscriberPackageIds,
    // ContainerOptions indicates Unlocked vs Managed (see Skyline sfCli.ts)
    chunk =>
      `SELECT Id, Name, ContainerOptions, SubscriberPackageId FROM Package2 WHERE SubscriberPackageId IN (${inClause(chunk)})`
  );
  const packageBySubscriberId = HashMap.fromIterable(packages.map(pkg => [pkg.SubscriberPackageId, pkg] as const));

  return HashMap.fromIterable(
    Array.filterMap(members, member =>
      HashMap.get(packageBySubscriberId, member.SubscriberPackageId).pipe(
        Option.map(pkg => [member.SubjectId, toResolvedFromPackage2(pkg)] as const)
      )
    )
  );
});

/**
 * Fallback: enumerate all Package2 in the org, then query Package2Member per package by SubscriberPackageId.
 * Used when the direct SubjectId IN (...) query leaves ids unresolved (e.g. members only discoverable by
 * enumerating packages first). The Package2 list failure propagates (caller marks/handles); a per-package
 * member failure just skips that package.
 */
const resolveByPackageEnumeration = Effect.fn('PackageResolutionService.resolveByPackageEnumeration')(function* (
  connection: Connection,
  requestedIds: readonly string[]
) {
  const packages = yield* queryDecoded(
    Package2Row,
    connection,
    'SELECT Id, Name, ContainerOptions, SubscriberPackageId FROM Package2'
  );
  if (packages.length === 0) {
    return HashMap.empty<string, ResolvedPackageInfo>();
  }
  const requested = HashSet.fromIterable(requestedIds);
  const perPackage = yield* Effect.forEach(
    packages,
    pkg =>
      queryDecoded(
        Package2MemberRow,
        connection,
        `SELECT ${MEMBER_COLUMNS} FROM Package2Member WHERE SubscriberPackageId = '${escapeId(pkg.SubscriberPackageId)}'`
      ).pipe(
        Effect.map(members =>
          Array.filterMap(members, member =>
            HashSet.has(requested, member.SubjectId)
              ? Option.some([member.SubjectId, toResolvedFromPackage2(pkg)] as const)
              : Option.none()
          )
        ),
        Effect.catchAll(() => Effect.succeed(Array.empty<readonly [string, ResolvedPackageInfo]>()))
      ),
    { concurrency: BATCH_CONCURRENCY }
  );
  return HashMap.fromIterable(Array.flatten(perPackage));
});

/**
 * Resolves ApexClass IDs to their owning Package2 (2GP) via Tooling API. Package2/Package2Member exist
 * only in dev hub/packaging orgs; on subscriber orgs (or when those objects are unavailable) resolution
 * falls back to InstalledSubscriberPackage matched by namespace. Results and org-unavailability are cached
 * per org for the runtime lifetime. Classes not resolvable are omitted (caller treats them as unpackaged
 * or 1GP based on namespace from discovery).
 */
export class PackageResolutionService extends Effect.Service<PackageResolutionService>()('PackageResolutionService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const stateRef = yield* Ref.make<ResolutionState>({ byOrg: HashMap.empty(), unavailable: HashSet.empty() });

    const markUnavailable = (orgKey: string) =>
      Ref.update(stateRef, state => ({ ...state, unavailable: HashSet.add(state.unavailable, orgKey) }));

    // Only the "org lacks Package2" heuristic marks the org unavailable; generic query errors don't.
    const markIfUnavailable = (orgKey: string) => (error: Package2UnavailableError | Package2QueryError) =>
      Match.value(error).pipe(
        Match.tag('Package2UnavailableError', () => markUnavailable(orgKey)),
        Match.orElse(() => Effect.void)
      );

    // Project the org's cache down to just the requested ids as a plain Map (the tree consumers' shape).
    const projectCache = (
      orgCache: Option.Option<HashMap.HashMap<string, ResolvedPackageInfo>>,
      ids: readonly string[]
    ) =>
      new Map(
        Option.match(orgCache, {
          onNone: () => [],
          onSome: cache =>
            Array.filterMap(ids, id => HashMap.get(cache, id).pipe(Option.map(info => [id, info] as const)))
        })
      );

    // On primary success, resolve any still-missing ids by enumerating packages; failures there stay best-effort.
    const augmentUnresolved = Effect.fn('PackageResolutionService.augmentUnresolved')(function* (
      connection: Connection,
      orgKey: string,
      validIds: readonly string[],
      resolved: HashMap.HashMap<string, ResolvedPackageInfo>
    ) {
      const unresolved = validIds.filter(id => !HashMap.has(resolved, id));
      if (unresolved.length === 0) {
        return resolved;
      }
      const extra = yield* resolveByPackageEnumeration(connection, unresolved).pipe(
        Effect.tapError(markIfUnavailable(orgKey)),
        Effect.catchAll(() => Effect.succeed(HashMap.empty<string, ResolvedPackageInfo>()))
      );
      return HashMap.union(resolved, extra);
    });

    const resolve = Effect.fn('PackageResolutionService.resolve')(function* (
      apexClassIds: readonly string[],
      classIdToNamespace: ReadonlyMap<string, Option.Option<string>> = new Map()
    ) {
      const validIds = apexClassIds.filter(id => isString(id) && id.length > 0);
      if (validIds.length === 0) {
        return new Map<string, ResolvedPackageInfo>();
      }

      const orgKey = yield* getOrgKey;
      const state = yield* Ref.get(stateRef);
      const orgCache = HashMap.get(state.byOrg, orgKey);

      // Known-unavailable org: serve whatever is cached, never re-query.
      if (HashSet.has(state.unavailable, orgKey)) {
        return projectCache(orgCache, validIds);
      }
      // Full cache hit for every requested id.
      if (Option.exists(orgCache, cache => validIds.every(id => HashMap.has(cache, id)))) {
        return projectCache(orgCache, validIds);
      }

      const connection = yield* getConnection;

      const resolved = yield* resolveByMembers(connection, validIds).pipe(
        Effect.flatMap(members => augmentUnresolved(connection, orgKey, validIds, members)),
        Effect.tapError(markIfUnavailable(orgKey)),
        Effect.catchTags({
          Package2UnavailableError: () => resolveFromInstalledSubscriberPackages(connection, classIdToNamespace),
          Package2QueryError: () => resolveFromInstalledSubscriberPackages(connection, classIdToNamespace)
        })
      );

      yield* Ref.update(stateRef, current => ({
        ...current,
        byOrg: HashMap.set(
          current.byOrg,
          orgKey,
          HashMap.union(
            Option.getOrElse(HashMap.get(current.byOrg, orgKey), () => HashMap.empty<string, ResolvedPackageInfo>()),
            resolved
          )
        )
      }));

      // Scope the returned map to the requested ids (resolved may also carry sibling ids from the subscriber fallback).
      return projectCache(Option.some(resolved), validIds);
    });

    return { resolve };
  })
}) {}
