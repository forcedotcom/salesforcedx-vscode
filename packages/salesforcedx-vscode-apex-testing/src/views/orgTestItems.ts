/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ResolvedPackageInfo, ToolingTestClass } from '../testDiscovery/schemas';
import * as vscode from 'vscode';
import { LOCAL_NAMESPACE_KEY, UNPACKAGED_PACKAGE_ID, UNPACKAGED_PACKAGE_KEY } from '../constants';
import { nls } from '../messages';
import { createOrgApexClassUri } from '../utils/orgApexClassProvider';
import { createClassId, createMethodId, createPackageId } from '../utils/testItemUtils';
import { getFullClassName } from '../utils/testUtils';

/**
 * A test class grouped by full name, with one or more Tooling API entries (e.g. from multiple discovery runs).
 */
export type ClassEntry = { fullClassName: string; entries: ToolingTestClass[] };

/**
 * Tree of test classes: namespace key → package key → list of class entries.
 * Used to build the Test Explorer hierarchy (Namespace → Package → Class → Method).
 */
export type NamespacePackageStructure = Map<string, Map<string, ClassEntry[]>>;

/**
 * Builds a map from Apex class ID to namespace prefix for the given test classes.
 * Used when resolving package membership (e.g. InstalledSubscriberPackage fallback in subscriber orgs).
 */
export const buildClassIdToNamespace = (apexClasses: ToolingTestClass[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const cls of apexClasses) {
    if (cls.id && typeof cls.id === 'string') {
      map.set(cls.id, (cls.namespacePrefix ?? '').trim());
    }
  }
  return map;
};

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
    let pkMap = structure.get(nsKey);
    if (!pkMap) {
      pkMap = new Map();
      structure.set(nsKey, pkMap);
    }
    return pkMap;
  };

  const addToPackage = (nsKey: string, pkgKey: string, fullClassName: string, entries: ToolingTestClass[]): void => {
    const pkMap = ensureNamespace(nsKey);
    let list = pkMap.get(pkgKey);
    if (!list) {
      list = [];
      pkMap.set(pkgKey, list);
    }
    list.push({ fullClassName, entries });
  };

  for (const cls of apexClasses) {
    const fullClassName = getFullClassName(cls);
    const namespaceLabel = (cls.namespacePrefix ?? '').trim();
    const namespaceKey = namespaceLabel === '' ? LOCAL_NAMESPACE_KEY : namespaceLabel;
    const pkgInfo = cls.id ? classIdToPackage.get(cls.id) : undefined;
    const pkgKey = pkgInfo?.package2Id ?? (namespaceLabel !== '' ? '1gp' : UNPACKAGED_PACKAGE_KEY);
    addToPackage(namespaceKey, pkgKey, fullClassName, [cls]);
  }

  // Merge duplicate fullClassName within same package (e.g. from multiple discovery entries)
  for (const pkMap of structure.values()) {
    for (const [pkgKey, list] of pkMap) {
      const byFullName = new Map<string, ToolingTestClass[]>();
      for (const { fullClassName, entries } of list) {
        const existing = byFullName.get(fullClassName) ?? [];
        existing.push(...entries);
        byFullName.set(fullClassName, existing);
      }
      pkMap.set(
        pkgKey,
        [...byFullName.entries()].map(([fullClassName, entries]) => ({ fullClassName, entries }))
      );
    }
  }

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
 * Returns the display label and stable ID for a package node in the Test Explorer.
 * Handles unpackaged, 1GP (namespaced), and 2GP (including Unlocked suffix when applicable).
 */
export const getPackageLabelAndId = (
  nsKey: string,
  pkgKey: string,
  classEntriesList: ClassEntry[],
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
  const info = firstClass.id ? classIdToPackage.get(firstClass.id) : undefined;
  const baseName = info?.packageName ?? pkgKey;
  const packageLabel = info?.containerOptions === 'Unlocked' ? `${baseName} (Unlocked)` : baseName;
  return { packageLabel, packageId: createPackageId(nsKey, pkgKey) };
};

/**
 * Context required to create class and method TestItems. Passed to createClassAndMethodsFactory.
 */
export interface CreateClassAndMethodsContext {
  controller: vscode.TestController;
  classItems: Map<string, vscode.TestItem>;
  methodItems: Map<string, vscode.TestItem>;
  classNameToUri: Map<string, vscode.Uri>;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
}

/**
 * Returns a function that creates a class TestItem and its method TestItems, and registers them in the given maps.
 * Used when building the Test Explorer tree so run/debug can resolve class/method items by id.
 */
export const createClassAndMethodsFactory = (
  ctx: CreateClassAndMethodsContext
): ((fullClassName: string, classEntries: ToolingTestClass[]) => vscode.TestItem) => {
  const { controller, classItems, methodItems, classNameToUri, orgOnlyTag, inWorkspaceTag } = ctx;

  return (fullClassName: string, classEntries: ToolingTestClass[]): vscode.TestItem => {
    const baseClassName = classEntries[0].name;
    const localUri = classNameToUri.get(baseClassName);
    const uri = localUri ?? createOrgApexClassUri(baseClassName);
    const isOrgOnly = !localUri;

    const classItem = controller.createTestItem(createClassId(fullClassName), baseClassName, uri);
    if (isOrgOnly && orgOnlyTag) {
      classItem.tags = [orgOnlyTag];
    } else if (inWorkspaceTag) {
      classItem.tags = [inWorkspaceTag];
    }
    classItems.set(fullClassName, classItem);

    const methodNames = new Set<string>();
    for (const entry of classEntries) {
      for (const testMethod of entry.testMethods ?? []) {
        methodNames.add(testMethod.name);
      }
    }
    for (const methodName of methodNames) {
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
    }
    return classItem;
  };
};

/**
 * Returns the display label for a namespace node. Local namespace is localized; others use the key as-is.
 */
export const getNamespaceDisplayLabel = (nsKey: string): string =>
  nsKey === LOCAL_NAMESPACE_KEY ? nls.localize('test_explorer_local_namespace_label') : nsKey;
