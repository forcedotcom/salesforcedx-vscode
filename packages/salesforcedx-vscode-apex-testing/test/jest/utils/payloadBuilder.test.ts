/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AsyncTestConfiguration, TestLevel, TestService } from '@salesforce/apex-node';
import * as vscode from 'vscode';
import { buildTestPayload } from '../../../src/utils/payloadBuilder';

describe('payloadBuilder', () => {
  let mockTestService: jest.Mocked<TestService>;

  const createMockTestItem = (id: string, label: string): vscode.TestItem =>
    ({
      id,
      label,
      children: {
        size: 0,
        forEach: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        values: jest.fn().mockReturnValue([]),
        keys: jest.fn(),
        entries: jest.fn(),
        [Symbol.iterator]: jest.fn()
      }
    }) as unknown as vscode.TestItem;

  beforeEach(() => {
    mockTestService = {
      buildAsyncPayload: jest.fn()
    } as any;
  });

  describe('buildTestPayload', () => {
    it('should build payload for suite', async () => {
      const suiteItem = createMockTestItem('suite:MyTestSuite', 'MyTestSuite');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await buildTestPayload(mockTestService, [suiteItem], ['MyTestSuite'], false);

      expect(result.hasSuite).toBe(true);
      expect(result.hasClass).toBe(false);
      expect(result.payload).toBe(mockPayload);
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        undefined,
        undefined,
        'MyTestSuite',
        undefined,
        true // !codeCoverage (false)
      );
    });

    it('should build payload for single class', async () => {
      const classItem = createMockTestItem('class:MyTestClass', 'MyTestClass');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await buildTestPayload(mockTestService, [classItem], ['MyTestClass'], false);

      expect(result.hasSuite).toBe(false);
      expect(result.hasClass).toBe(true);
      expect(result.payload).toBe(mockPayload);
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        undefined,
        'MyTestClass',
        undefined,
        undefined,
        true // !codeCoverage (false)
      );
    });

    it('should build payload for methods from same class', async () => {
      const method1 = createMockTestItem('method:MyClass.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:MyClass.testMethod2', 'testMethod2');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await buildTestPayload(
        mockTestService,
        [method1, method2],
        ['MyClass.testMethod1', 'MyClass.testMethod2'],
        false
      );

      expect(result.hasSuite).toBe(false);
      expect(result.hasClass).toBe(false);
      expect(result.payload).toBe(mockPayload);
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        'MyClass.testMethod1,MyClass.testMethod2',
        undefined,
        undefined,
        undefined,
        true // !codeCoverage (false)
      );
    });

    it('should build payload for methods from different classes', async () => {
      const method1 = createMockTestItem('method:Class1.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:Class2.testMethod2', 'testMethod2');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await buildTestPayload(
        mockTestService,
        [method1, method2],
        ['Class1.testMethod1', 'Class2.testMethod2'],
        false
      );

      expect(result.hasSuite).toBe(false);
      expect(result.hasClass).toBe(false);
      expect(result.payload).toBe(mockPayload);
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        'Class1.testMethod1,Class2.testMethod2',
        undefined,
        undefined,
        undefined,
        true // !codeCoverage (false)
      );
    });

    it('should handle code coverage enabled', async () => {
      const classItem = createMockTestItem('class:MyTestClass', 'MyTestClass');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      await buildTestPayload(mockTestService, [classItem], ['MyTestClass'], true);

      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        undefined,
        'MyTestClass',
        undefined,
        undefined,
        false // !codeCoverage (true)
      );
    });

    it('should throw error if suite name cannot be determined', async () => {
      const suiteItem = createMockTestItem('suite:', 'InvalidSuite');

      await expect(buildTestPayload(mockTestService, [suiteItem], ['InvalidSuite'], false)).rejects.toThrow();
    });

    it('should throw error if payload is not built', async () => {
      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(undefined);

      await expect(buildTestPayload(mockTestService, [], [], false)).rejects.toThrow();
    });

    it('should throw error when mixing suite and class without methods', async () => {
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite');
      const classItem = createMockTestItem('class:MyClass', 'MyClass');

      // When mixing suite and class without method expansion, payload cannot be built
      await expect(
        buildTestPayload(mockTestService, [suiteItem, classItem], ['MySuite', 'MyClass'], false)
      ).rejects.toThrow();
    });

    it('should handle empty test names array', async () => {
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await buildTestPayload(mockTestService, [suiteItem], [], false);

      expect(result.hasSuite).toBe(true);
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalled();
    });

    it('should handle mixed class and method names', async () => {
      const classItem = createMockTestItem('class:MyClass', 'MyClass');
      const methodItem = createMockTestItem('method:OtherClass.testMethod', 'testMethod');
      const mockPayload: AsyncTestConfiguration = {
        testLevel: TestLevel.RunSpecifiedTests
      } as AsyncTestConfiguration;

      (mockTestService.buildAsyncPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await buildTestPayload(
        mockTestService,
        [classItem, methodItem],
        ['MyClass', 'OtherClass.testMethod'],
        false
      );

      expect(result.hasClass).toBe(false);
      // When method names are present, always use them
      expect(mockTestService.buildAsyncPayload).toHaveBeenCalledWith(
        TestLevel.RunSpecifiedTests,
        'OtherClass.testMethod',
        undefined,
        undefined,
        undefined,
        true
      );
    });

    it('should build payload manually for namespaced methods', async () => {
      // Namespaced method: Namespace.Class.Method (3 parts)
      const method1 = createMockTestItem(
        'method:CodeBuilder.ApplicationTest.testMethod1',
        'testMethod1'
      );
      const method2 = createMockTestItem(
        'method:CodeBuilder.ApplicationTest.testMethod2',
        'testMethod2'
      );

      const result = await buildTestPayload(
        mockTestService,
        [method1, method2],
        ['CodeBuilder.ApplicationTest.testMethod1', 'CodeBuilder.ApplicationTest.testMethod2'],
        false
      );

      expect(result.hasSuite).toBe(false);
      expect(result.hasClass).toBe(false);
      // Should construct payload manually, NOT call buildAsyncPayload
      expect(mockTestService.buildAsyncPayload).not.toHaveBeenCalled();
      // Payload should have the full class name (Namespace.Class) in className field
      expect(result.payload).toEqual({
        tests: [
          {
            className: 'CodeBuilder.ApplicationTest',
            testMethods: ['testMethod1', 'testMethod2']
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage: true
      });
    });

    it('should build payload manually for mixed namespaced and non-namespaced methods', async () => {
      const method1 = createMockTestItem('method:FooTest.testFoo', 'testFoo');
      const method2 = createMockTestItem(
        'method:CodeBuilder.ApplicationTest.testApp',
        'testApp'
      );

      const result = await buildTestPayload(
        mockTestService,
        [method1, method2],
        ['FooTest.testFoo', 'CodeBuilder.ApplicationTest.testApp'],
        true // code coverage enabled
      );

      expect(result.hasSuite).toBe(false);
      expect(result.hasClass).toBe(false);
      // Should construct payload manually because there are namespaced methods
      expect(mockTestService.buildAsyncPayload).not.toHaveBeenCalled();
      // Payload should have entries for both classes
      expect(result.payload).toEqual({
        tests: [
          { className: 'FooTest', testMethods: ['testFoo'] },
          { className: 'CodeBuilder.ApplicationTest', testMethods: ['testApp'] }
        ],
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage: false // code coverage enabled
      });
    });
  });
});
