/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CompilerDiagnostic } from '@lwc/errors';
import { TextDocument } from 'vscode-languageserver';
import templateLinter from '../../src/template/linter';

let mockWarnings: CompilerDiagnostic[] | null = null;

jest.mock('@lwc/template-compiler', () => {
  const actual = jest.requireActual('@lwc/template-compiler') as Record<string, unknown>;
  return {
    __esModule: true,
    ...actual,
    default: (...args: unknown[]) => {
      if (mockWarnings) {
        return { warnings: mockWarnings };
      }
      return (actual.default as Function)(...args);
    }
  };
});

it('returns a list of all the template compilation errors', () => {
  const content =
    '<template><template if:true="invalidExpression"></template>{Math.random()}<lighting-card></lighting-card></template>';
  const document = TextDocument.create('test://test.html', 'html', 0, content);

  const diagnostics = templateLinter(document);
  expect(diagnostics).toHaveLength(3);
  expect(diagnostics[0].message).toMatch(/If directive should be an expression/);
  expect(diagnostics[0].range).toMatchObject({
    start: { character: 20 },
    end: { character: 47 }
  });
  expect(diagnostics[1].message).toMatch(/Invalid expression/);
  expect(diagnostics[1].range).toMatchObject({
    start: { character: 59 },
    end: { character: 74 }
  });
  expect(diagnostics[2].message).toMatch(/<lighting- is not a valid namespace, sure you didn't mean "<lightning-"?/);
  expect(diagnostics[2].range).toMatchObject({
    start: { character: 74 },
    end: { character: 84 }
  });
});

it('does not include URL or codeDescription when warning has no url', () => {
  const content = '<template><template if:true="invalidExpression"></template></template>';
  const document = TextDocument.create('test://test.html', 'html', 0, content);

  const diagnostics = templateLinter(document);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).not.toContain('More Details:');
  expect(diagnostics[0].codeDescription).toBeUndefined();
});

it('includes URL in message and codeDescription when warning has url', () => {
  mockWarnings = [
    {
      message: 'LWC1054: If directive should be an expression',
      code: 1054,
      level: 1,
      location: { line: 1, column: 0, start: 10, length: 37 },
      url: 'https://lwc.dev/guide/reference#lwc1054'
    }
  ];

  const content = '<template><template if:true="invalidExpression"></template></template>';
  const document = TextDocument.create('test://test.html', 'html', 0, content);

  const diagnostics = templateLinter(document);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).toContain('More Details: https://lwc.dev/guide/reference#lwc1054');
  expect(diagnostics[0].code).toBe(1054);
  expect(diagnostics[0].codeDescription).toEqual({ href: 'https://lwc.dev/guide/reference#lwc1054' });

  mockWarnings = null;
});
