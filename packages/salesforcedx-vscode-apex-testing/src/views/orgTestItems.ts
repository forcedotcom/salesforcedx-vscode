/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ResolvedPackageInfo, ToolingTestClass } from '../testDiscovery/schemas';
import * as Array from 'effect/Array';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { LOCAL_NAMESPACE_KEY, UNPACKAGED_PACKAGE_ID, UNPACKAGED_PACKAGE_KEY } from '../constants';
import { nls } from '../messages';
import { createClassId, createMethodId, createPackageId } from '../utils/testItemUtils';
import { getFullClassName } from '../utils/toolingTestClassHelpers';

/**
 * A test class grouped by full name, with one or more Tooling API entries (e.g. from multiple discovery runs).
 * entries is non-empty so entries[0] is safe.
 */
type ClassEntry = {
  fullClassName: string;
  entries: Array.NonEmptyArray<ToolingTestClass>;
};

/**
 * Tree of test classes: namespace key → package key → list of class entries.
 * Used to build the Test Explorer hierarchy (Namespace → Package → Class → Method).
 */
type NamespacePackageStructure = Map<string, Map<string, ClassEntry[]>>;

/**
 * Builds a map from Apex class ID to namespace prefix for the given test classes.
 * Used when resolving package membership (e.g. InstalledSubscriberPackage fallback in subscriber orgs).
 */
export const buildClassIdToNamespace = (apexClasses: ToolingTestClass[]): Map<string, Option.Option<string>> =>
  new Map(apexClasses.flatMap(cls => (Option.isSome(cls.id) ? [[cls.id.value, cls.namespacePrefix] as const] : [])));

/**
 * Groups test classes by namespace and package (2GP / 1GP / unpackaged).
 * Deduplicates classes with the same full name within each package (e.g. from multiple discovery entries).
 *
 * @param apexClasses - Apex test classes from the Tooling API
 * @param classIdToPackage - Resolved package info from resolvePackage2Members
 */
export const buildNamespacePackageStructure = (
  apexClasses: ToolingTestClass[],
  classIdToPackage: Map<string, ResolvedPackageInfo>
): NamespacePackageStructure => {
  const structure = new Map<string, Map<string, ClassEntry[]>>();

  const ensureNamespace = (nsKey: string): Map<string, ClassEntry[]> => {
    const existing = structure.get(nsKey);
    if (existing) {
      return existing;
    }
    const pkMap = new Map<string, ClassEntry[]>();
    structure.set(nsKey, pkMap);
    return pkMap;
  };

  const addToPackage = (
    nsKey: string,
    pkgKey: string,
    fullClassName: string,
    entries: Array.NonEmptyArray<ToolingTestClass>
  ): void => {
    const pkMap = ensureNamespace(nsKey);
    const existing = pkMap.get(pkgKey);
    const list = existing ?? [];
    if (!existing) {
      pkMap.set(pkgKey, list);
    }
    list.push({ fullClassName, entries });
  };

  apexClasses.forEach(cls => {
    const fullClassName = getFullClassName(cls);
    const namespaceKey = Option.match(cls.namespacePrefix, { onNone: () => LOCAL_NAMESPACE_KEY, onSome: ns => ns });
    const pkgInfo = Option.match(cls.id, { onNone: () => undefined, onSome: id => classIdToPackage.get(id) });
    const pkgKey = pkgInfo?.package2Id ?? (Option.isSome(cls.namespacePrefix) ? '1gp' : UNPACKAGED_PACKAGE_KEY);
    addToPackage(namespaceKey, pkgKey, fullClassName, Array.make(cls));
  });

  // Merge duplicate fullClassName within same package (e.g. from multiple discovery entries)
  structure.forEach(pkMap =>
    pkMap.forEach((list, pkgKey) => {
      const byFullName = new Map<string, ToolingTestClass[]>();
      list.forEach(({ fullClassName, entries }) => {
        const existing = byFullName.get(fullClassName) ?? [];
        existing.push(...entries);
        byFullName.set(fullClassName, existing);
      });
      pkMap.set(
        pkgKey,
        [...byFullName.entries()].flatMap(([fullClassName, entries]) =>
          Array.isNonEmptyArray(entries) ? [{ fullClassName, entries }] : []
        )
      );
    })
  );

  return structure;
};

/**
 * Returns namespace keys in display order: Local first, then others alphabetically.
 */
export const sortNamespaceKeys = (structure: NamespacePackageStructure): string[] =>
  [...structure.keys()].toSorted((a, b) =>
    a === LOCAL_NAMESPACE_KEY ? -1 : b === LOCAL_NAMESPACE_KEY ? 1 : a.localeCompare(b)
  );

/**
 * Returns package keys in display order. For the local namespace, Unpackaged is first; otherwise order is unchanged.
 */
export const getPackageKeysOrdered = (nsKey: string, packageKeys: string[]): string[] =>
  nsKey === LOCAL_NAMESPACE_KEY && packageKeys.includes(UNPACKAGED_PACKAGE_KEY)
    ? [UNPACKAGED_PACKAGE_KEY, ...packageKeys.filter(k => k !== UNPACKAGED_PACKAGE_KEY)]
    : packageKeys;

/**
 * Type guard: ensures list is non-empty and first entry has non-empty entries,
 * so getPackageLabelAndId's classEntriesList[0].entries[0] is safe.
 */
export const isNonEmptyClassEntriesList = (list: ClassEntry[] | undefined): list is Array.NonEmptyArray<ClassEntry> =>
  isNotUndefined(list) && Array.isNonEmptyArray(list) && Array.isNonEmptyArray(list[0].entries);

/**
 * Resolves package info for an Option-wrapped class id against the id→package map.
 * `none` id or missing map entry → `undefined`.
 */
export const resolvePackageInfoForClassId = (
  id: Option.Option<string>,
  classIdToPackage: Map<string, ResolvedPackageInfo>
): ResolvedPackageInfo | undefined =>
  Option.getOrUndefined(Option.flatMapNullable(id, classId => classIdToPackage.get(classId)));

/**
 * Returns the display label and stable ID for a package node in the Test Explorer.
 * Handles unpackaged, 1GP (namespaced), and 2GP (including Unlocked suffix when applicable).
 * Requires classEntriesList to be non-empty with non-empty entries.
 */
export const getPackageLabelAndId = (
  nsKey: string,
  pkgKey: string,
  classEntriesList: Array.NonEmptyArray<ClassEntry>,
  classIdToPackage: Map<string, ResolvedPackageInfo>
): { packageLabel: string; packageId: string } => {
  if (pkgKey === UNPACKAGED_PACKAGE_KEY) {
    return {
      packageLabel: nls.localize('test_explorer_unpackaged_metadata_label'),
      packageId: UNPACKAGED_PACKAGE_ID
    };
  }
  if (pkgKey === '1gp') {
    return {
      packageLabel: nls.localize('test_explorer_1gp_package_label', nsKey),
      packageId: createPackageId(nsKey, '1gp')
    };
  }
  const firstClass = classEntriesList[0].entries[0];
  const info = resolvePackageInfoForClassId(firstClass.id, classIdToPackage);
  const baseName = info?.packageName ?? pkgKey;
  const containerOptions = info ? info.containerOptions : Option.none();
  const packageLabel = Option.match(containerOptions, {
    onNone: () => baseName,
    onSome: option =>
      option === 'Unlocked' ? `${baseName} (Unlocked)` : nls.localize('test_explorer_managed_package_label', baseName)
  });
  return { packageLabel, packageId: createPackageId(nsKey, pkgKey) };
};

/**
 * Context required to create class and method TestItems. Passed to createClassAndMethodsFactory.
 */
type CreateClassAndMethodsContext = {
  controller: vscode.TestController;
  classItems: Map<string, vscode.TestItem>;
  methodItems: Map<string, vscode.TestItem>;
  classNameToUri: Map<string, URI>;
  orgOnlyClassUri: (fullClassName: string) => URI;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
};

/**
 * Returns a function that creates a class TestItem and its method TestItems, and registers them in the given maps.
 * Used when building the Test Explorer tree so run/debug can resolve class/method items by id.
 * classEntries must be non-empty so classEntries[0] is safe.
 */
export const createClassAndMethodsFactory = (
  ctx: CreateClassAndMethodsContext
): ((fullClassName: string, classEntries: Array.NonEmptyArray<ToolingTestClass>) => vscode.TestItem) => {
  const { controller, classItems, methodItems, classNameToUri, orgOnlyClassUri, orgOnlyTag, inWorkspaceTag } = ctx;

  return (fullClassName: string, classEntries: Array.NonEmptyArray<ToolingTestClass>): vscode.TestItem => {
    const baseClassName = classEntries[0].name;
    const localUri = classNameToUri.get(baseClassName);
    const uri = localUri ?? orgOnlyClassUri(fullClassName);
    const isOrgOnly = !localUri;

    const classItem = controller.createTestItem(createClassId(fullClassName), baseClassName, uri);
    classItem.canResolveChildren = true;
    if (isOrgOnly && orgOnlyTag) {
      classItem.tags = [orgOnlyTag];
    } else if (inWorkspaceTag) {
      classItem.tags = [inWorkspaceTag];
    }
    classItems.set(fullClassName, classItem);

    Array.dedupe(classEntries.flatMap(entry => (entry.testMethods ?? []).map(m => m.name))).forEach(methodName => {
      const methodId = `${fullClassName}.${methodName}`;
      const line = classEntries[0].testMethods?.find(m => m.name === methodName)?.line ?? 0;
      const column = classEntries[0].testMethods?.find(m => m.name === methodName)?.column ?? 0;
      const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
      const range = new vscode.Range(position, position);
      const methodItem = controller.createTestItem(createMethodId(fullClassName, methodName), methodName, uri);
      methodItem.range = range;
      if (isOrgOnly && orgOnlyTag) {
        methodItem.tags = [orgOnlyTag];
      } else if (inWorkspaceTag) {
        methodItem.tags = [inWorkspaceTag];
      }
      methodItems.set(methodId, methodItem);
      classItem.children.add(methodItem);
    });
    return classItem;
  };
};

/**
 * Returns the display label for a namespace node. Local namespace is localized; others use the key as-is.
 */
export const getNamespaceDisplayLabel = (nsKey: string): string =>
  nsKey === LOCAL_NAMESPACE_KEY ? nls.localize('test_explorer_local_namespace_label') : nsKey;
