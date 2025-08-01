# Retrieve Puzzle

## Problem

When trying to retrieve metadata in the browser environment, we get the error below.
This error occurs when importing from the Source Deploy Retrieve (SDR) package:

## full error text

ERR [Extension Host] MetadataTransferError: Metadata API request failed: Component conversion failed: Readable.from is not available in the browser
at \_MetadataApiRetrieve.pollStatus (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:261975:25)
at async try (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:305930:18)
DUE TO:
ConversionError: Component conversion failed: Readable.from is not available in the browser
at MetadataConverter.convert (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:304521:17)
at async extract (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:262231:31)
at async \_MetadataApiRetrieve.post (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:262437:61)
at async \_MetadataApiRetrieve.pollStatus (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:261966:26)
at async try (http://localhost:3000/static/extensions/0/dist/browser.js#vscode-extension:305930:18)
