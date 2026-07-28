/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  downloadAndOpenOrgMetadata,
  ORG_METADATA_DOWNLOAD_COMMAND,
  provideOrgMetadataCodeLenses
} from '../../../src/orgVfs/orgMetadataCodeLensProvider';

describe('org metadata code lens', () => {
  it('offers the shared download command for an org-only document', () => {
    const uri = URI.parse('sf-org-data:/orgs/00d/org-metadata/ApexClass/Example');
    const lenses = provideOrgMetadataCodeLenses({ uri } as vscode.TextDocument);

    expect(lenses).toHaveLength(1);
    expect(lenses[0].command).toEqual({
      command: ORG_METADATA_DOWNLOAD_COMMAND,
      title: 'Download into workspace',
      tooltip: 'Download into workspace',
      arguments: [uri]
    });
  });

  it('opens the workspace file and closes the virtual document after download', async () => {
    const canonicalUri = URI.parse('sf-org-data:/orgs/00d/org-metadata/ApexClass/Example');
    const workspaceUri = URI.file('/workspace/Example.cls');
    const download = jest.fn(async () => workspaceUri);
    const closeVirtualDocument = jest.fn(async () => undefined);
    (vscode.window.showTextDocument as jest.Mock).mockResolvedValue({});

    await downloadAndOpenOrgMetadata(canonicalUri, download, closeVirtualDocument);

    expect(download).toHaveBeenCalledWith(canonicalUri);
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(workspaceUri, { preview: false });
    expect(closeVirtualDocument).toHaveBeenCalledWith(canonicalUri);
    expect((vscode.window.showTextDocument as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      closeVirtualDocument.mock.invocationCallOrder[0]
    );
  });
});
