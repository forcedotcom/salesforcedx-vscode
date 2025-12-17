/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { SUITE_PARENT_ID } from '../../../src/constants';
import {
  createClassId,
  createMethodId,
  createSuiteClassId,
  createSuiteId,
  extractClassName,
  extractSuiteName,
  gatherTests,
  getTestName,
  isClass,
  isMethod,
  isSuite,
  isSuiteClass,
  parseTestId
} from '../../../src/utils/testItemUtils';

describe('testItemUtils', () => {
  describe('parseTestId', () => {
    it('should parse suite ID', () => {
      const result = parseTestId('suite:MyTestSuite');
      expect(result.type).toBe('suite');
      expect(result.name).toBe('MyTestSuite');
    });

    it('should parse class ID', () => {
      const result = parseTestId('class:MyTestClass');
      expect(result.type).toBe('class');
      expect(result.name).toBe('MyTestClass');
    });

    it('should parse method ID', () => {
      const result = parseTestId('method:MyTestClass.testMethod');
      expect(result.type).toBe('method');
      expect(result.name).toBe('MyTestClass.testMethod');
      expect(result.className).toBe('MyTestClass');
    });

    it('should parse suite-class ID', () => {
      const result = parseTestId('suite-class:MySuite:MyClass');
      expect(result.type).toBe('suite-class');
      expect(result.name).toBe('MyClass');
      expect(result.suiteName).toBe('MySuite');
      expect(result.className).toBe('MyClass');
    });

    it('should return unknown for invalid ID', () => {
      const result = parseTestId('invalid:id');
      expect(result.type).toBe('unknown');
      expect(result.name).toBe('invalid:id');
    });
  });

  describe('isSuite', () => {
    it('should return true for suite ID', () => {
      expect(isSuite('suite:MySuite')).toBe(true);
    });

    it('should return false for non-suite ID', () => {
      expect(isSuite('class:MyClass')).toBe(false);
      expect(isSuite('method:MyClass.method')).toBe(false);
    });
  });

  describe('isClass', () => {
    it('should return true for class ID', () => {
      expect(isClass('class:MyClass')).toBe(true);
    });

    it('should return false for non-class ID', () => {
      expect(isClass('suite:MySuite')).toBe(false);
      expect(isClass('method:MyClass.method')).toBe(false);
    });
  });

  describe('isMethod', () => {
    it('should return true for method ID', () => {
      expect(isMethod('method:MyClass.testMethod')).toBe(true);
    });

    it('should return false for non-method ID', () => {
      expect(isMethod('suite:MySuite')).toBe(false);
      expect(isMethod('class:MyClass')).toBe(false);
    });
  });

  describe('isSuiteClass', () => {
    it('should return true for suite-class ID', () => {
      expect(isSuiteClass('suite-class:MySuite:MyClass')).toBe(true);
    });

    it('should return false for non-suite-class ID', () => {
      expect(isSuiteClass('suite:MySuite')).toBe(false);
      expect(isSuiteClass('class:MyClass')).toBe(false);
    });
  });

  describe('getTestName', () => {
    it('should extract name from suite TestItem', () => {
      const testItem = {
        id: 'suite:MySuite',
        label: 'MySuite'
      } as unknown as vscode.TestItem;
      expect(getTestName(testItem)).toBe('MySuite');
    });

    it('should extract name from class TestItem', () => {
      const testItem = {
        id: 'class:MyClass',
        label: 'MyClass'
      } as unknown as vscode.TestItem;
      expect(getTestName(testItem)).toBe('MyClass');
    });

    it('should extract name from method TestItem', () => {
      const testItem = {
        id: 'method:MyClass.testMethod',
        label: 'testMethod'
      } as unknown as vscode.TestItem;
      expect(getTestName(testItem)).toBe('MyClass.testMethod');
    });
  });

  describe('createSuiteId', () => {
    it('should create suite ID', () => {
      expect(createSuiteId('MySuite')).toBe('suite:MySuite');
    });
  });

  describe('createClassId', () => {
    it('should create class ID', () => {
      expect(createClassId('MyClass')).toBe('class:MyClass');
    });
  });

  describe('createMethodId', () => {
    it('should create method ID', () => {
      expect(createMethodId('MyClass', 'testMethod')).toBe('method:MyClass.testMethod');
    });
  });

  describe('createSuiteClassId', () => {
    it('should create suite-class ID', () => {
      expect(createSuiteClassId('MySuite', 'MyClass')).toBe('suite-class:MySuite:MyClass');
    });
  });

  describe('extractSuiteName', () => {
    it('should extract suite name from suite ID', () => {
      expect(extractSuiteName('suite:MySuite')).toBe('MySuite');
    });

    it('should extract suite name from suite-class ID', () => {
      expect(extractSuiteName('suite-class:MySuite:MyClass')).toBe('MySuite');
    });

    it('should return undefined for non-suite ID', () => {
      expect(extractSuiteName('class:MyClass')).toBeUndefined();
    });
  });

  describe('extractClassName', () => {
    it('should extract class name from class ID', () => {
      expect(extractClassName('class:MyClass')).toBe('MyClass');
    });

    it('should extract class name from method ID', () => {
      expect(extractClassName('method:MyClass.testMethod')).toBe('MyClass');
    });

    it('should extract class name from suite-class ID', () => {
      expect(extractClassName('suite-class:MySuite:MyClass')).toBe('MyClass');
    });

    it('should return undefined for non-class ID', () => {
      expect(extractClassName('suite:MySuite')).toBeUndefined();
    });
  });

  describe('gatherTests', () => {
    const createMockTestItem = (id: string, label: string, children: vscode.TestItem[] = []): vscode.TestItem => {
      const childrenMap = new Map<string, vscode.TestItem>();
      children.forEach(child => childrenMap.set(child.id, child));

      return {
        id,
        label,
        children: {
          size: children.length,
          forEach: (callback: (item: vscode.TestItem) => void) => {
            children.forEach(callback);
          },
          get: (testId: string) => childrenMap.get(testId),
          has: (testId: string) => childrenMap.has(testId),
          values: () => children.values(),
          keys: () => childrenMap.keys(),
          entries: () => childrenMap.entries(),
          [Symbol.iterator]: () => childrenMap[Symbol.iterator]()
        }
      } as unknown as vscode.TestItem;
    };

    const createMockTestItemCollection = (items: vscode.TestItem[]): vscode.TestItemCollection => {
      const itemsMap = new Map<string, vscode.TestItem>();
      items.forEach(item => itemsMap.set(item.id, item));

      return {
        size: items.length,
        forEach: (callback: (item: vscode.TestItem) => void) => {
          items.forEach(callback);
        },
        get: (id: string) => itemsMap.get(id),
        has: (id: string) => itemsMap.has(id),
        values: () => itemsMap.values(),
        keys: () => itemsMap.keys(),
        entries: () => itemsMap.entries(),
        [Symbol.iterator]: () => itemsMap[Symbol.iterator]()
      } as unknown as vscode.TestItemCollection;
    };

    it('should gather suite items', () => {
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite');
      const suiteItems = new Map([['MySuite', suiteItem]]);
      const request = {
        include: [suiteItem],
        exclude: undefined,
        profile: undefined,
        preserveFocus: undefined
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, suiteItems);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('suite:MySuite');
    });

    it('should gather class items', () => {
      const classItem = createMockTestItem('class:MyClass', 'MyClass');
      const request = {
        include: [classItem]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, new Map());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('class:MyClass');
    });

    it('should expand class to methods', () => {
      const method1 = createMockTestItem('method:MyClass.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:MyClass.testMethod2', 'testMethod2');
      const classItem = createMockTestItem('class:MyClass', 'MyClass', [method1, method2]);
      const request = {
        include: [classItem]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, new Map());
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toContain('method:MyClass.testMethod1');
      expect(result.map(r => r.id)).toContain('method:MyClass.testMethod2');
    });

    it('should gather method items directly', () => {
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const request = {
        include: [methodItem]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, new Map());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('method:MyClass.testMethod');
    });

    it('should expand suite-class placeholder to parent suite', () => {
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite');
      const suiteClassItem = createMockTestItem('suite-class:MySuite:MyClass', 'MyClass');
      const suiteItems = new Map([['MySuite', suiteItem]]);
      const request = {
        include: [suiteClassItem]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, suiteItems);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('suite:MySuite');
    });

    it('should skip suite-class placeholder if parent suite not found', () => {
      const suiteClassItem = createMockTestItem('suite-class:MySuite:MyClass', 'MyClass');
      const suiteItems = new Map();
      const request = {
        include: [suiteClassItem]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, suiteItems);
      expect(result).toHaveLength(0);
    });

    it('should expand suite parent to its children', () => {
      const suite1 = createMockTestItem('suite:Suite1', 'Suite1');
      const suite2 = createMockTestItem('suite:Suite2', 'Suite2');
      const suiteParent = createMockTestItem(SUITE_PARENT_ID, 'Suites', [suite1, suite2]);
      const request = {
        include: [suiteParent]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);
      const suiteItems = new Map([
        ['Suite1', suite1],
        ['Suite2', suite2]
      ]);

      const result = gatherTests(request, controllerItems, suiteItems);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toContain('suite:Suite1');
      expect(result.map(r => r.id)).toContain('suite:Suite2');
    });

    it('should exclude items when exclude is provided', () => {
      const method1 = createMockTestItem('method:MyClass.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:MyClass.testMethod2', 'testMethod2');
      const classItem = createMockTestItem('class:MyClass', 'MyClass', [method1, method2]);
      const request = {
        include: [classItem],
        exclude: [method2],
        profile: undefined,
        preserveFocus: undefined
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, new Map());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('method:MyClass.testMethod1');
    });

    it('should gather all items when include is not provided', () => {
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite');
      const classItem = createMockTestItem('class:MyClass', 'MyClass');
      const controllerItems = createMockTestItemCollection([suiteItem, classItem]);
      const request = {
        include: undefined,
        exclude: undefined,
        profile: undefined,
        preserveFocus: undefined
      } as unknown as vscode.TestRunRequest;
      const suiteItems = new Map([['MySuite', suiteItem]]);

      const result = gatherTests(request, controllerItems, suiteItems);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty include array', () => {
      const request = {
        include: [],
        exclude: undefined,
        profile: undefined,
        preserveFocus: undefined
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, new Map());
      expect(result).toHaveLength(0);
    });

    it('should handle nested class expansion', () => {
      const method1 = createMockTestItem('method:Class1.method1', 'method1');
      const method2 = createMockTestItem('method:Class1.method2', 'method2');
      const class1 = createMockTestItem('class:Class1', 'Class1', [method1, method2]);
      const method3 = createMockTestItem('method:Class2.method3', 'method3');
      const class2 = createMockTestItem('class:Class2', 'Class2', [method3]);
      const request = {
        include: [class1, class2]
      } as unknown as vscode.TestRunRequest;
      const controllerItems = createMockTestItemCollection([]);

      const result = gatherTests(request, controllerItems, new Map());
      expect(result).toHaveLength(3);
      expect(result.map(r => r.id)).toContain('method:Class1.method1');
      expect(result.map(r => r.id)).toContain('method:Class1.method2');
      expect(result.map(r => r.id)).toContain('method:Class2.method3');
    });
  });
});
