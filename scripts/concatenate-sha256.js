#!/usr/bin/env node

const fs = require('fs');

const packageVersion = JSON.parse(fs.readFileSync('./lerna.json', 'utf8')).version;

const HEADER = `Currently, Visual Studio Code extensions are not signed or verified on the
Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash
Algorithm (SHA) of each extension that we publish. To verify the extensions,
make sure that their SHA values match the values in the list below.

1. Instead of installing the Visual Code Extension directly from within Visual
   Studio Code, download the VS Code extension that you want to check by
   following the instructions at
   https://code.visualstudio.com/docs/editor/extension-gallery#_common-questions.
   For example, download,
   https://salesforce.gallery.vsassets.io/_apis/public/gallery/publisher/salesforce/extension/salesforcedx-vscode-core/${packageVersion}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage.

2. From a terminal, run:

shasum -a 256 <location_of_the_downloaded_file>

3. Confirm that the SHA in your output matches the value in this list of SHAs.

`;

const FOOTER = `

4. Change the filename extension for the file that you downloaded from .zip to
.vsix.

5. In Visual Studio Code, from the Extensions view, select ... > Install from
VSIX.

6. Install the verified VSIX file.
`;

const sha256 = fs.readFileSync('./SHA256', 'utf8');
const content = HEADER + sha256 + FOOTER;
fs.writeFileSync('./SHA256.md', content);
