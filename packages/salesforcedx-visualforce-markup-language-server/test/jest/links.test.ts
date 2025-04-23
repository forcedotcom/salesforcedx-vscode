/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as url from 'node:url';
import { TextDocument } from 'vscode-languageserver-types';
import * as htmlLanguageService from '../../src/htmlLanguageService';

type DocumentLink = {
  offset: number;
  target: string;
};

describe('HTML Link Detection', () => {
  const getDocumentContext = (documentUrl: string): htmlLanguageService.DocumentContext => ({
    resolveReference: (ref: string, base?: string) =>
      base ? url.resolve(url.resolve(documentUrl, base), ref) : url.resolve(documentUrl, ref)
  });

  const createDocument = (modelUrl: string, content: string): TextDocument =>
    TextDocument.create(modelUrl, 'html', 0, content);

  const getLanguageLinks = (document: TextDocument, modelUrl: string) =>
    htmlLanguageService.getLanguageService().findDocumentLinks(document, getDocumentContext(modelUrl));

  const testLinkCreation = (modelUrl: string, tokenContent: string, expected: string | null): void => {
    const document = createDocument(modelUrl, `<a href="${tokenContent}">`);
    const links = getLanguageLinks(document, modelUrl);
    const target = links.length > 0 ? links[0].target : null;
    expect(target).toBe(expected);
  };

  const testLinkDetection = (value: string, expectedLinks: DocumentLink[]): void => {
    const documentUri = 'test://test/test.html' as const;
    const document = createDocument(documentUri, value);
    const links = getLanguageLinks(document, document.uri);

    const mappedLinks = links.map(l => ({
      offset: l.range.start.character,
      target: l.target
    }));

    expect(mappedLinks).toEqual(expectedLinks);
  };

  test('Link creation', () => {
    // JavaScript protocol links should be null
    testLinkCreation('http://model/1', 'javascript:void;', null);
    testLinkCreation('http://model/1', ' \tjavascript:alert(7);', null);
    testLinkCreation('http://model/1', ' #relative', null);

    // File system links
    testLinkCreation(
      'http://model/1',
      'file:///C:\\Alex\\src\\path\\to\\file.txt',
      'file:///C:\\Alex\\src\\path\\to\\file.txt'
    );

    // HTTP(S) links
    testLinkCreation('http://model/1', 'http://www.microsoft.com/', 'http://www.microsoft.com/');
    testLinkCreation('http://model/1', 'https://www.microsoft.com/', 'https://www.microsoft.com/');
    testLinkCreation('http://model/1', '//www.microsoft.com/', 'http://www.microsoft.com/');

    // Relative paths
    testLinkCreation('http://model/x/1', 'a.js', 'http://model/x/a.js');
    testLinkCreation('http://model/x/1', './a2.js', 'http://model/x/a2.js');
    testLinkCreation('http://model/x/1', '/b.js', 'http://model/b.js');
    testLinkCreation('http://model/x/y/1', '../../c.js', 'http://model/c.js');

    // File system specific tests
    const fileBase = 'file:///C:/Alex/src/path/to/file.txt' as const;
    testLinkCreation(fileBase, 'javascript:void;', null);
    testLinkCreation(fileBase, ' \tjavascript:alert(7);', null);
    testLinkCreation(fileBase, ' #relative', null);
    testLinkCreation(
      fileBase,
      'file:///C:\\Alex\\src\\path\\to\\file.txt',
      'file:///C:\\Alex\\src\\path\\to\\file.txt'
    );
    testLinkCreation(fileBase, 'http://www.microsoft.com/', 'http://www.microsoft.com/');
    testLinkCreation(fileBase, 'https://www.microsoft.com/', 'https://www.microsoft.com/');
    testLinkCreation(fileBase, '  //www.microsoft.com/', 'http://www.microsoft.com/');
    testLinkCreation(fileBase, 'a.js', 'file:///C:/Alex/src/path/to/a.js');
    testLinkCreation(fileBase, '/a.js', 'file:///a.js');

    // HTTPS specific tests
    const httpsBase = 'https://www.test.com/path/to/file.txt' as const;
    testLinkCreation(
      httpsBase,
      'file:///C:\\Alex\\src\\path\\to\\file.txt',
      'file:///C:\\Alex\\src\\path\\to\\file.txt'
    );
    testLinkCreation(httpsBase, '//www.microsoft.com/', 'https://www.microsoft.com/');

    // Invalid URIs are ignored
    testLinkCreation(httpsBase, '%', null);

    // Bug #18314: Ctrl + Click does not open existing file if folder's name starts with 'c' character
    testLinkCreation(
      'file:///c:/Alex/working_dir/18314-link-detection/test.html',
      '/class/class.js',
      'file:///class/class.js'
    );
  });

  test('Link detection', () => {
    const testUrl = 'test://test' as const;

    testLinkDetection('<img src="foo.png">', [{ offset: 10, target: `${testUrl}/foo.png` }]);
    testLinkDetection('<a href="http://server/foo.html">', [{ offset: 9, target: 'http://server/foo.html' }]);
    testLinkDetection('<img src="">', []);
    testLinkDetection('<LINK HREF="a.html">', [{ offset: 12, target: `${testUrl}/a.html` }]);
    testLinkDetection('<LINK HREF="a.html\n>\n', []);

    // Base href tests
    testLinkDetection('<html><base href="docs/"><img src="foo.png"></html>', [
      { offset: 18, target: `${testUrl}/docs/` },
      { offset: 35, target: `${testUrl}/docs/foo.png` }
    ]);

    const exampleBase = 'http://www.example.com' as const;
    testLinkDetection(`<html><base href="${exampleBase}/page.html"><img src="foo.png"></html>`, [
      { offset: 18, target: `${exampleBase}/page.html` },
      { offset: 62, target: `${exampleBase}/foo.png` }
    ]);
  });
});
