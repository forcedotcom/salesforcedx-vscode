/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { getLanguageService } from '@salesforce/salesforcedx-visualforce-markup-language-server';
import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import * as embeddedSupport from '../../src/modes/embeddedSupport';

describe('HTML Embedded Support', () => {
  const htmlLanguageService = getLanguageService();

  const assertLanguageId = (value: string, expectedLanguageId: string): void => {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const position = document.positionAt(offset);

    const docRegions = embeddedSupport.getDocumentRegions(htmlLanguageService, document);
    const languageId = docRegions.getLanguageAtPosition(position);

    assert.equal(languageId, expectedLanguageId);
  };

  const assertEmbeddedLanguageContent = (value: string, languageId: string, expectedContent: string): void => {
    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const docRegions = embeddedSupport.getDocumentRegions(htmlLanguageService, document);
    const content = docRegions.getEmbeddedDocument(languageId);
    assert.equal(content.getText(), expectedContent);
  };

  it('Should handle styles tag', () => {
    assertLanguageId('|<html><style>foo { }</style></html>', 'html');
    assertLanguageId('<html|><style>foo { }</style></html>', 'html');
    assertLanguageId('<html><st|yle>foo { }</style></html>', 'html');
    assertLanguageId('<html><style>|foo { }</style></html>', 'css');
    assertLanguageId('<html><style>foo| { }</style></html>', 'css');
    assertLanguageId('<html><style>foo { }|</style></html>', 'css');
    assertLanguageId('<html><style>foo { }</sty|le></html>', 'html');
  });

  it('Should handle styles tag for incomplete HTML', () => {
    assertLanguageId('|<html><style>foo { }', 'html');
    assertLanguageId('<html><style>fo|o { }', 'css');
    assertLanguageId('<html><style>foo { }|', 'css');
  });

  it('Should handle style tag in attribute', () => {
    assertLanguageId('<div id="xy" |style="color: red"/>', 'html');
    assertLanguageId('<div id="xy" styl|e="color: red"/>', 'html');
    assertLanguageId('<div id="xy" style=|"color: red"/>', 'html');
    assertLanguageId('<div id="xy" style="|color: red"/>', 'css');
    assertLanguageId('<div id="xy" style="color|: red"/>', 'css');
    assertLanguageId('<div id="xy" style="color: red|"/>', 'css');
    assertLanguageId('<div id="xy" style="color: red"|/>', 'html');
    assertLanguageId('<div id="xy" style=\'color: r|ed\'/>', 'css');
    assertLanguageId('<div id="xy" style|=color:red/>', 'html');
    assertLanguageId('<div id="xy" style=|color:red/>', 'css');
    assertLanguageId('<div id="xy" style=color:r|ed/>', 'css');
    assertLanguageId('<div id="xy" style=color:red|/>', 'css');
    assertLanguageId('<div id="xy" style=color:red/|>', 'html');
  });

  it('Should handle embedded styles', () => {
    assertEmbeddedLanguageContent('<html><style>foo { }</style></html>', 'css', '             foo { }               ');
    assertEmbeddedLanguageContent(
      '<html><script>var i = 0;</script></html>',
      'css',
      '                                        '
    );
    assertEmbeddedLanguageContent(
      '<html><style>foo { }</style>Hello<style>foo { }</style></html>',
      'css',
      '             foo { }                    foo { }               '
    );
    assertEmbeddedLanguageContent(
      '<html>\n  <style>\n    foo { }  \n  </style>\n</html>\n',
      'css',
      '\n         \n    foo { }  \n  \n\n'
    );

    assertEmbeddedLanguageContent('<div style="color: red"></div>', 'css', '         __{color: red}       ');
    assertEmbeddedLanguageContent('<div style=color:red></div>', 'css', '        __{color:red}      ');
  });

  it('Should handle script tag', () => {
    assertLanguageId('|<html><script>var i = 0;</script></html>', 'html');
    assertLanguageId('<html|><script>var i = 0;</script></html>', 'html');
    assertLanguageId('<html><scr|ipt>var i = 0;</script></html>', 'html');
    assertLanguageId('<html><script>|var i = 0;</script></html>', 'javascript');
    assertLanguageId('<html><script>var| i = 0;</script></html>', 'javascript');
    assertLanguageId('<html><script>var i = 0;|</script></html>', 'javascript');
    assertLanguageId('<html><script>var i = 0;</scr|ipt></html>', 'html');

    assertLanguageId('<script type="text/javascript">var| i = 0;</script>', 'javascript');
    assertLanguageId('<script type="text/ecmascript">var| i = 0;</script>', 'javascript');
    assertLanguageId('<script type="application/javascript">var| i = 0;</script>', 'javascript');
    assertLanguageId('<script type="application/ecmascript">var| i = 0;</script>', 'javascript');
    assertLanguageId('<script type="application/typescript">var| i = 0;</script>', void 0);
    assertLanguageId("<script type='text/javascript'>var| i = 0;</script>", 'javascript');
  });

  it('Should handle script tag in attribute', () => {
    assertLanguageId('<div |onKeyUp="foo()" onkeydown=\'bar()\'/>', 'html');
    assertLanguageId('<div onKeyUp=|"foo()" onkeydown=\'bar()\'/>', 'html');
    assertLanguageId('<div onKeyUp="|foo()" onkeydown=\'bar()\'/>', 'javascript');
    assertLanguageId('<div onKeyUp="foo(|)" onkeydown=\'bar()\'/>', 'javascript');
    assertLanguageId('<div onKeyUp="foo()|" onkeydown=\'bar()\'/>', 'javascript');
    assertLanguageId('<div onKeyUp="foo()"| onkeydown=\'bar()\'/>', 'html');
    assertLanguageId('<div onKeyUp="foo()" onkeydown=|\'bar()\'/>', 'html');
    assertLanguageId('<div onKeyUp="foo()" onkeydown=\'|bar()\'/>', 'javascript');
    assertLanguageId('<div onKeyUp="foo()" onkeydown=\'bar()|\'/>', 'javascript');
    assertLanguageId('<div onKeyUp="foo()" onkeydown=\'bar()\'|/>', 'html');

    assertLanguageId('<DIV ONKEYUP|=foo()</DIV>', 'html');
    assertLanguageId('<DIV ONKEYUP=|foo()</DIV>', 'javascript');
    assertLanguageId('<DIV ONKEYUP=f|oo()</DIV>', 'javascript');
    assertLanguageId('<DIV ONKEYUP=foo(|)</DIV>', 'javascript');
    assertLanguageId('<DIV ONKEYUP=foo()|</DIV>', 'javascript');
    assertLanguageId('<DIV ONKEYUP=foo()<|/DIV>', 'html');

    assertLanguageId('<label data-content="|Checkbox"/>', 'html');
    assertLanguageId('<label on="|Checkbox"/>', 'html');
  });

  it('Should handle script content', () => {
    assertEmbeddedLanguageContent(
      '<html><script>var i = 0;</script></html>',
      'javascript',
      '              var i = 0;                '
    );
    assertEmbeddedLanguageContent(
      '<script type="text/javascript">var i = 0;</script>',
      'javascript',
      '                               var i = 0;         '
    );

    assertEmbeddedLanguageContent(
      '<div onKeyUp="foo()" onkeydown="bar()"/>',
      'javascript',
      '              foo();            bar();  '
    );
  });
});
