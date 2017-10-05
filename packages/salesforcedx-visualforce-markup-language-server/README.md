# vscode-html-languageservice
HTML language service extracted from VSCode to be reused, e.g in the Monaco editor.

[![npm Package](https://img.shields.io/npm/v/vscode-html-languageservice.svg?style=flat-square)](https://www.npmjs.org/package/vscode-html-languageservice)
[![NPM Downloads](https://img.shields.io/npm/dm/vscode-html-languageservice.svg)](https://npmjs.org/package/vscode-html-languageservice)
[![Build Status](https://travis-ci.org/Microsoft/vscode-html-languageservice.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-html-languageservice)

Why?
----
The _vscode-html-languageservice_ contains the language smarts behind the HTML editing experience of Visual Studio Code
and the Monaco editor.
 - *doComplete* provides completion proposals for a given location.
 - *findDocumentHighlights* provides the highlighted symbols for a given position
 - *format* formats the code at the given range.
 - *findDocumentLinks* finds all links in the document
 - *findDocumentSymbols* finds all the symbols in the document

Installation
------------

    npm install --save vscode-html-languageservice
