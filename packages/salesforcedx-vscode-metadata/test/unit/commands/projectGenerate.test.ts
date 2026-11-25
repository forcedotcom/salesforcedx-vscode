/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProjectTemplate } from '@salesforce/templates';
import * as vscode from 'vscode';
import { buildTemplateItems } from '../../../src/commands/projectGenerate';

const separatorLabels = (items: vscode.QuickPickItem[]) =>
  items.filter(item => item.kind === vscode.QuickPickItemKind.Separator).map(item => item.label);

const templatesOf = (items: vscode.QuickPickItem[]) =>
  items.flatMap(item => ('projectTemplate' in item ? [item.projectTemplate] : []));

describe('projectGenerate buildTemplateItems', () => {
  it('groups known templates under their separators and drops excluded templates', () => {
    const items = buildTemplateItems(['standard', 'reactexternalapp', 'vueinternalapp', 'nativemobile', 'empty']);

    expect(templatesOf(items)).toEqual(['standard', 'empty', 'vueinternalapp', 'reactexternalapp']);
    expect(separatorLabels(items)).toEqual(['Internal Apps', 'External Apps']);
  });

  it('shows the localized label and detail for a known template', () => {
    const item = buildTemplateItems(['vueinternalapp']).find(i => 'projectTemplate' in i);

    expect(item).toMatchObject({ label: 'Vue Internal App', detail: 'For employees (Salesforce login)' });
  });

  it('lists a template it has no display text for under Other with its raw name', () => {
    // A future template added to @salesforce/templates before this extension knows about it
    const unknown = 'sveltecommunityapp' as ProjectTemplate;
    const items = buildTemplateItems(['standard', unknown]);

    expect(separatorLabels(items)).toEqual(['Other']);
    expect(items.at(-1)).toMatchObject({ label: 'sveltecommunityapp', projectTemplate: unknown });
  });

  it('omits separators for empty groups', () => {
    expect(separatorLabels(buildTemplateItems(['standard', 'empty']))).toEqual([]);
  });
});
