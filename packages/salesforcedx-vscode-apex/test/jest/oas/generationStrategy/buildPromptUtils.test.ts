/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DocumentSymbol } from 'vscode';
import { nls } from '../../../../src/messages';
import {
  buildClassPrompt,
  getAnnotationsWithParameters,
  getMethodImplementation,
  getPromptForMethodContext
} from '../../../../src/oas/generationStrategy/buildPromptUtils';

/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
describe('getMethodImplementation', () => {
  it('should return the correct method implementation', () => {
    const methodName = 'myMethod';
    const doc = `
      public void myMethod() {
        // Method implementation
      }
    `;
    const methodsDocSymbolMap = new Map<string, DocumentSymbol>();
    methodsDocSymbolMap.set(methodName, {
      name: methodName,
      detail: '',
      kind: 0,
      range: {
        start: { line: 1, character: 0 },
        end: { line: 3, character: 4 }
      },
      selectionRange: {
        start: { line: 1, character: 0 },
        end: { line: 3, character: 4 }
      }
    } as DocumentSymbol);
    const result = getMethodImplementation(methodName, doc, methodsDocSymbolMap);
    expect(result).toBe(`
public void myMethod() {
// Method implementation
}`);
  });

  it('should throw an error if the method is not found', () => {
    const methodName = 'nonExistentMethod';
    const doc = `
      public void myMethod() {
        // Method implementation
      }
    `;
    const methodsDocSymbolMap = new Map<string, DocumentSymbol>();
    expect(() => getMethodImplementation(methodName, doc, methodsDocSymbolMap)).toThrow(
      nls.localize('method_not_found_in_doc_symbols', methodName)
    );
  });
});

describe('getAnnotationsWithParameters', () => {
  it('should return the correct string with one annotation', () => {
    const annotations = [
      {
        name: 'RestResource',
        parameters: {
          urlMapping: '/test'
        }
      }
    ];
    const result = getAnnotationsWithParameters(annotations as any);
    expect(result).toBe('Annotation name: RestResource , Parameters: urlMapping: /test\n');
  });
  it('should return the correct string with multiple annotations', () => {
    const annotations = [
      {
        name: 'RestResource',
        parameters: {
          urlMapping: '/test'
        }
      },
      {
        name: 'AuraEnabled',
        parameters: {}
      }
    ];
    const result = getAnnotationsWithParameters(annotations as any);
    expect(result).toBe(
      'Annotation name: RestResource , Parameters: urlMapping: /test\n, Annotation name: AuraEnabled'
    );
  });
  it('should return the correct string with no annotations', () => {
    const result = getAnnotationsWithParameters([] as any);
    expect(result).toBe('');
  });
});

describe('buildClassPrompt', () => {
  it('should build the correct class prompt', () => {
    const classDetail = {
      name: 'MyClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {}
        }
      ],
      comment: `/**
      * This is a test class
      */`
    };
    const result = buildClassPrompt(classDetail as any);
    expect(result).toBe(
      'The class name of the given method is MyClass.\nThe class is annotated with Annotation name: RestResource.\nThe documentation of the class is This is a test class.\n'
    );
  });

  it('should build the correct class prompt with RestResource annotation', () => {
    const classDetail = {
      name: 'MyClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {
            urlMapping: '/test'
          }
        }
      ],
      comment: `/**
      * This is a test class
      */`
    };
    const result = buildClassPrompt(classDetail as any);
    expect(result).toBe(
      'The class name of the given method is MyClass.\nThe class is annotated with Annotation name: RestResource , Parameters: urlMapping: /test\nThe documentation of the class is This is a test class.\n'
    );
  });
});

describe('getPromptForMethodContext', () => {
  const eligibleAnnotations = ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'];

  eligibleAnnotations.forEach(annotation => {
    it(`should return the correct prompt for ${annotation} annotation`, () => {
      const methodContext = {
        annotations: [
          {
            name: annotation,
            parameters: {}
          }
        ]
      };
      const result = getPromptForMethodContext(methodContext as any);
      expect(result).toBe(
        `For the given method only produce the ${annotation.replace('Http', '').toUpperCase()} verb.\n`
      );
    });
  });
});
