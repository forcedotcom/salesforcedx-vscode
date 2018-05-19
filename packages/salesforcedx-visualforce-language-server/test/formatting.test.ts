/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as fs from 'fs';
import * as path from 'path';

import * as assert from 'assert';
import {
  FormattingOptions,
  Range,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import { getLanguageModes } from '../src/modes/languageModes';

import { format } from '../src/modes/formatting';

describe('HTML Embedded Formatting', () => {
  function assertFormat(
    value: string,
    expected: string,
    options?: any,
    formatOptions?: FormattingOptions,
    message?: string
  ): void {
    const languageModes = getLanguageModes({ css: true, javascript: true });
    if (options) {
      languageModes.getAllModes().forEach(m => m.configure(options));
    }

    let rangeStartOffset = value.indexOf('|');
    let rangeEndOffset;
    if (rangeStartOffset !== -1) {
      value =
        value.substr(0, rangeStartOffset) + value.substr(rangeStartOffset + 1);

      rangeEndOffset = value.indexOf('|');
      value =
        value.substr(0, rangeEndOffset) + value.substr(rangeEndOffset + 1);
    } else {
      rangeStartOffset = 0;
      rangeEndOffset = value.length;
    }
    const document = TextDocument.create(
      'test://test/test.html',
      'html',
      0,
      value
    );
    const range = Range.create(
      document.positionAt(rangeStartOffset),
      document.positionAt(rangeEndOffset)
    );
    if (!formatOptions) {
      formatOptions = FormattingOptions.create(2, true);
    }

    const result = format(
      languageModes,
      document,
      range,
      formatOptions,
      void 0,
      { css: true, javascript: true }
    );

    const actual = applyEdits(document, result);
    assert.equal(actual, expected, message);
  }

  function assertFormatWithFixture(
    fixtureName: string,
    expectedPath: string,
    options?: any,
    formatOptions?: FormattingOptions
  ): void {
    const input = fs
      .readFileSync(path.join(__dirname, 'fixtures', 'inputs', fixtureName))
      .toString();
    const expected = fs
      .readFileSync(path.join(__dirname, 'fixtures', 'expected', expectedPath))
      .toString();
    assertFormat(input, expected, options, formatOptions, expectedPath);
  }

  it('Should handle HTML only', () => {
    assertFormat(
      '<html><body><p>Hello</p></body></html>',
      '<html>\n\n<body>\n  <p>Hello</p>\n</body>\n\n</html>'
    );
    assertFormat(
      '|<html><body><p>Hello</p></body></html>|',
      '<html>\n\n<body>\n  <p>Hello</p>\n</body>\n\n</html>'
    );
    assertFormat(
      '<html>|<body><p>Hello</p></body>|</html>',
      '<html><body>\n  <p>Hello</p>\n</body></html>'
    );
  });

  it('Should handle HTML & Scripts', () => {
    assertFormat(
      '<html><head><script></script></head></html>',
      '<html>\n\n<head>\n  <script></script>\n</head>\n\n</html>'
    );
    assertFormat(
      '<html><head><script>var x=1;</script></head></html>',
      '<html>\n\n<head>\n  <script>var x = 1;</script>\n</head>\n\n</html>'
    );
    assertFormat(
      '<html><head><script>\nvar x=2;\n</script></head></html>',
      '<html>\n\n<head>\n  <script>\n    var x = 2;\n  </script>\n</head>\n\n</html>'
    );
    assertFormat(
      '<html><head>\n  <script>\nvar x=3;\n</script></head></html>',
      '<html>\n\n<head>\n  <script>\n    var x = 3;\n  </script>\n</head>\n\n</html>'
    );
    assertFormat(
      '<html><head>\n  <script>\nvar x=4;\nconsole.log("Hi");\n</script></head></html>',
      '<html>\n\n<head>\n  <script>\n    var x = 4;\n    console.log("Hi");\n  </script>\n</head>\n\n</html>'
    );
    assertFormat(
      '<html><head>\n  |<script>\nvar x=5;\n</script>|</head></html>',
      '<html><head>\n  <script>\n    var x = 5;\n  </script></head></html>'
    );
  });

  it('HTML & Scripts - Fixtures', () => {
    assertFormatWithFixture('19813.html', '19813.html');
    assertFormatWithFixture(
      '19813.html',
      '19813-4spaces.html',
      void 0,
      FormattingOptions.create(4, true)
    );
    assertFormatWithFixture(
      '19813.html',
      '19813-tab.html',
      void 0,
      FormattingOptions.create(1, false)
    );
    assertFormatWithFixture('21634.html', '21634.html');
  });

  it('Should handle script end tag', () => {
    assertFormat(
      '<html>\n<head>\n  <script>\nvar x  =  0;\n</script></head></html>',
      '<html>\n\n<head>\n  <script>\n    var x = 0;\n  </script>\n</head>\n\n</html>'
    );
  });

  it('Should handle HTML & multiple scripts', () => {
    assertFormat(
      '<html><head>\n<script>\nif(x){\nbar(); }\n</script><script>\nfunction(x){    }\n</script></head></html>',
      '<html>\n\n<head>\n  <script>\n    if (x) {\n      bar();\n    }\n  </script>\n  <script>\n    function(x) {}\n  </script>\n</head>\n\n</html>'
    );
  });

  it('Should handle HTML & styles', () => {
    assertFormat(
      '<html><head>\n<style>\n.foo{display:none;}\n</style></head></html>',
      '<html>\n\n<head>\n  <style>\n    .foo {\n      display: none;\n    }\n  </style>\n</head>\n\n</html>'
    );
  });

  it('Should handle EndWithNewline', () => {
    const options = {
      visualforce: {
        format: {
          endWithNewline: true
        }
      }
    };
    assertFormat(
      '<html><body><p>Hello</p></body></html>',
      '<html>\n\n<body>\n  <p>Hello</p>\n</body>\n\n</html>\n',
      options
    );
    assertFormat(
      '<html>|<body><p>Hello</p></body>|</html>',
      '<html><body>\n  <p>Hello</p>\n</body></html>',
      options
    );
    assertFormat(
      '<html><head><script>\nvar x=1;\n</script></head></html>',
      '<html>\n\n<head>\n  <script>\n    var x = 1;\n  </script>\n</head>\n\n</html>\n',
      options
    );
  });

  it('Should handle inside script', () => {
    assertFormat(
      '<html><head>\n  <script>\n|var x=6;|\n</script></head></html>',
      '<html><head>\n  <script>\n  var x = 6;\n</script></head></html>'
    );
    assertFormat(
      '<html><head>\n  <script>\n|var x=6;\nvar y=  9;|\n</script></head></html>',
      '<html><head>\n  <script>\n  var x = 6;\n  var y = 9;\n</script></head></html>'
    );
  });

  it('Should handle range after new line', () => {
    assertFormat(
      '<html><head>\n  |<script>\nvar x=6;\n</script>\n|</head></html>',
      '<html><head>\n  <script>\n    var x = 6;\n  </script>\n</head></html>'
    );
  });
});

function applyEdits(document: TextDocument, edits: TextEdit[]): string {
  let text = document.getText();
  const sortedEdits = edits.sort((a, b) => {
    const startDiff =
      document.offsetAt(b.range.start) - document.offsetAt(a.range.start);
    if (startDiff === 0) {
      return document.offsetAt(b.range.end) - document.offsetAt(a.range.end);
    }
    return startDiff;
  });
  let lastOffset = text.length;
  sortedEdits.forEach(e => {
    const startOffset = document.offsetAt(e.range.start);
    const endOffset = document.offsetAt(e.range.end);
    assert.ok(startOffset <= endOffset);
    assert.ok(endOffset <= lastOffset);
    text =
      text.substring(0, startOffset) +
      e.newText +
      text.substring(endOffset, text.length);
    lastOffset = startOffset;
  });
  return text;
}
