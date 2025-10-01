/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { rewriteClassArgument, rewriteNamespaceLens } from '../../src/namespaceLensRewriter';

describe('rewriteNamespaceLens Unit Tests', () => {
  const createMockCodeLens = (title: string, args?: string[]): vscode.CodeLens => ({
    range: new vscode.Range(0, 0, 0, 10),
    isResolved: true,
    command: {
      title,
      command: 'test.command',
      arguments: args
    }
  });

  describe('when the org has a namespace set in it', () => {
    it('should return lens unchanged', () => {
      const lens = createMockCodeLens('Run Test', ['MyNamespace.MyClass.testMethod']);
      const rewriter = rewriteNamespaceLens('MyNamespace')('MyNamespace');
      const result = rewriter(lens);

      expect(result).toBe(lens);
      expect(result.command?.arguments).toEqual(['MyNamespace.MyClass.testMethod']);
    });

    it('should return lens with no project namespace', () => {
      const lens = createMockCodeLens('Run Test', ['MyNamespace.MyClass.testMethod']);
      const rewriter = rewriteNamespaceLens('MyNamespace')();
      const result = rewriter(lens);

      expect(result).toBe(lens);
      expect(result.command?.arguments).toEqual(['MyNamespace.MyClass.testMethod']);
    });

    it('should not rewrite arguments with different namespace than project namespace', () => {
      const lens = createMockCodeLens('Run Test', ['OtherNamespace.MyClass.testMethod']);
      const rewriter = rewriteNamespaceLens()('MyNamespace');

      const result = rewriter(lens);

      expect(result.command?.arguments).toEqual(['OtherNamespace.MyClass.testMethod']);
    });
  });

  describe('when lens has no command or title', () => {
    it('should return lens unchanged when command is undefined', () => {
      const lens: vscode.CodeLens = {
        range: new vscode.Range(0, 0, 0, 10),
        isResolved: true
      };
      const rewriter = rewriteNamespaceLens()();

      const result = rewriter(lens);

      expect(result).toBe(lens);
    });

    it('should return lens unchanged when title is empty string', () => {
      const lens: vscode.CodeLens = {
        range: new vscode.Range(0, 0, 0, 10),
        isResolved: true,
        command: {
          title: '',
          command: 'test.command'
        }
      };
      const rewriter = rewriteNamespaceLens()();

      const result = rewriter(lens);

      expect(result).toBe(lens);
    });

    it('should return lens unchanged when namespaceFromProject is undefined', () => {
      const lens = createMockCodeLens('Run Test', ['MyNamespace.MyClass.testMethod']);
      const rewriter = rewriteNamespaceLens()();

      const result = rewriter(lens);

      expect(result).toBe(lens);
      expect(result.command?.arguments).toEqual(['MyNamespace.MyClass.testMethod']);
    });
  });

  describe('single test scenarios', () => {
    const singleTestTitles = ['Run Test', 'Debug Test'];
    const rewriter = rewriteNamespaceLens()('MyNamespace');

    singleTestTitles.forEach(title => {
      describe(`with title "${title}"`, () => {
        it('should rewrite namespace.class.method to class.method', () => {
          const lens = createMockCodeLens(title, ['MyNamespace.MyClass.testMethod']);

          const result = rewriter(lens);

          expect(result.command?.arguments).toEqual(['MyClass.testMethod']);
        });

        it('should handle multiple arguments', () => {
          const lens = createMockCodeLens(title, [
            'MyNamespace.MyClass.testMethod1',
            'MyNamespace.AnotherClass.testMethod2'
          ]);

          const result = rewriter(lens);

          expect(result.command?.arguments).toEqual(['MyClass.testMethod1', 'AnotherClass.testMethod2']);
        });

        it('should not modify arguments that do not match pattern', () => {
          const lens = createMockCodeLens(title, [
            'MyClass.testMethod', // no namespace
            'MyNamespace.MyClass', // only namespace.class, no method (insufficient segments for single test)
            'SomeOtherArg'
          ]);

          const result = rewriter(lens);
          expect(result.command?.arguments).toEqual(['MyClass.testMethod', 'MyNamespace.MyClass', 'SomeOtherArg']);
        });

        it('should handle empty arguments array', () => {
          const lens = createMockCodeLens(title, []);
          const result = rewriter(lens);
          expect(result.command?.arguments).toEqual([]);
        });

        it('should handle undefined arguments', () => {
          const lens = createMockCodeLens(title);
          const result = rewriter(lens);
          expect(result.command?.arguments).toBeUndefined();
        });
      });
    });
  });

  describe('all tests scenarios', () => {
    const allTestTitles = ['Run All Tests', 'Debug All Tests'];
    const rewriter = rewriteNamespaceLens()('MyNamespace');

    allTestTitles.forEach(title => {
      describe(`with title "${title}"`, () => {
        it('should rewrite namespace.class to class', () => {
          const lens = createMockCodeLens(title, ['MyNamespace.MyClass']);

          const result = rewriter(lens);

          expect(result.command?.arguments).toEqual(['MyClass']);
        });

        it('should handle multiple arguments', () => {
          const lens = createMockCodeLens(title, ['MyNamespace.MyClass', 'MyNamespace.AnotherClass']);

          const result = rewriter(lens);

          expect(result.command?.arguments).toEqual(['MyClass', 'AnotherClass']);
        });

        it('should not modify arguments that do not match pattern', () => {
          const lens = createMockCodeLens(title, [
            'MyClass', // no namespace
            'SomeOtherArg'
          ]);

          const result = rewriter(lens);

          expect(result.command?.arguments).toEqual(['MyClass', 'SomeOtherArg']);
        });

        it('should handle empty arguments array', () => {
          const lens = createMockCodeLens(title, []);

          const result = rewriter(lens);

          expect(result.command?.arguments).toEqual([]);
        });

        it('should handle undefined arguments', () => {
          const lens = createMockCodeLens(title);

          const result = rewriter(lens);

          expect(result.command?.arguments).toBeUndefined();
        });
      });
    });
  });

  describe('other', () => {
    it('should not modify lens with unrecognized title', () => {
      const lens = createMockCodeLens('Some Other Command', ['MyNamespace.MyClass.testMethod']);
      const rewriter = rewriteNamespaceLens()('MyNamespace');

      const result = rewriter(lens);

      expect(result.command?.arguments).toEqual(['MyNamespace.MyClass.testMethod']);
    });

    it('should preserve original lens properties', () => {
      const originalRange = new vscode.Range(1, 5, 2, 10);
      const lens: vscode.CodeLens = {
        range: originalRange,
        isResolved: true,
        command: {
          title: 'Run Test',
          command: 'test.command',
          arguments: ['MyNamespace.MyClass.testMethod']
        }
      };
      const rewriter = rewriteNamespaceLens()('MyNamespace');

      const result = rewriter(lens);

      expect(result.range).toBe(originalRange);
      expect(result.command?.title).toBe('Run Test');
      expect(result.command?.command).toBe('test.command');
      expect(result.command?.arguments).toEqual(['MyClass.testMethod']);
    });

    it('should handle mixed matching and non-matching arguments', () => {
      const lens = createMockCodeLens('Run Test', [
        'MyNamespace.TestClass.testMethod', // should be rewritten
        'OtherNamespace.TestClass.testMethod', // should not be rewritten
        'TestClass.testMethod' // should not be rewritten
      ]);
      const rewriter = rewriteNamespaceLens()('MyNamespace');

      const result = rewriter(lens);

      expect(result.command?.arguments).toEqual([
        'TestClass.testMethod',
        'OtherNamespace.TestClass.testMethod',
        'TestClass.testMethod'
      ]);
    });

    it('should handle different namespace names', () => {
      const lens = createMockCodeLens('Run Test', ['VeryDeepNamespace.MyClass.testMethod']);
      const rewriter = rewriteNamespaceLens()('VeryDeepNamespace');

      const result = rewriter(lens);

      expect(result.command?.arguments).toEqual(['MyClass.testMethod']);
    });

    it('should work with both single and all test commands in sequence', () => {
      const singleTestLens = createMockCodeLens('Run Test', ['MyNamespace.TestClass.testMethod']);
      const allTestsLens = createMockCodeLens('Run All Tests', ['MyNamespace.TestClass']);
      const rewriter = rewriteNamespaceLens()('MyNamespace');

      const singleResult = rewriter(singleTestLens);
      const allResult = rewriter(allTestsLens);

      expect(singleResult.command?.arguments).toEqual(['TestClass.testMethod']);
      expect(allResult.command?.arguments).toEqual(['TestClass']);
    });
  });
});

describe('rewriteClassArgument Unit Tests', () => {
  const noOrgNamespaceRewriter = rewriteClassArgument()('MyNamespace');
  it('should rewrite namespace.class to class', () => {
    const result = noOrgNamespaceRewriter('MyNamespace.MyClass');
    expect(result).toEqual('MyClass');
  });

  it('should not rewrite class if namespace is not in project', () => {
    const result = rewriteClassArgument()()('MyNamespace.MyClass');
    expect(result).toEqual('MyNamespace.MyClass');
  });

  it('should not rewrite class if namespace is not in org', () => {
    const result = noOrgNamespaceRewriter('MyClass');
    expect(result).toEqual('MyClass');
  });

  it('should not rewrite other namespaces', () => {
    const result = noOrgNamespaceRewriter('OtherNamespace.MyClass');
    expect(result).toEqual('OtherNamespace.MyClass');
  });

  it('should not rewrite if the project and org have the same namespace', () => {
    const result = rewriteClassArgument('MyNamespace')('MyNamespace')('MyNamespace.MyClass');
    expect(result).toEqual('MyNamespace.MyClass');
  });
});
