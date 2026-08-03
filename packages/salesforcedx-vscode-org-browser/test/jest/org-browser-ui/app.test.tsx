/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 24,
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, 12) }, (_value, index) => ({
        index,
        key: index,
        size: 24,
        start: index * 24
      })),
    scrollToIndex: jest.fn()
  })
}));

import type { OrgBrowserHostMessage, OrgBrowserLabels, OrgBrowserNode } from '../../../src/browser/protocol';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../../src/org-browser-ui/app';
import { vscodeApiMock } from './setup';

const typeNode = (id: string): OrgBrowserNode => ({
  id: `type:${id}`,
  kind: 'type',
  label: id,
  xmlName: id,
  expandable: true,
  presence: 'org',
  actions: ['refresh', 'retrieve']
});

const localTypeNode = (id: string): OrgBrowserNode => ({ ...typeNode(id), presence: 'both' });

const componentNode = (id: string, parentId: string): OrgBrowserNode => ({
  id: `component:ApexClass:${id}`,
  parentId,
  kind: 'component',
  label: id,
  xmlName: 'ApexClass',
  fullName: id,
  expandable: false,
  presence: 'org',
  actions: ['retrieve']
});

const send = (message: OrgBrowserHostMessage): void => {
  void act(() => globalThis.dispatchEvent(new MessageEvent('message', { data: message })));
};

const typeFilter = {
  showLocal: true,
  showOrg: true,
  typeFilter: undefined,
  componentFilter: undefined,
  typeIsRegex: false,
  componentIsRegex: false
} as const;

describe('Org Browser React app', () => {
  it('announces readiness and renders controls and roots', () => {
    render(<App />);
    expect(vscodeApiMock.postMessage).toHaveBeenCalledWith({ type: 'ready' });
    expect(vscodeApiMock.postMessage).not.toHaveBeenCalledWith({ type: 'requestInitialData' });
    expect(screen.getByRole('status').textContent).toContain('Retrieving the metadata types');
    send({ type: 'configure', labels });
    expect(vscodeApiMock.postMessage).toHaveBeenCalledWith({ type: 'requestInitialData' });
    send({
      type: 'initialize',
      generation: 2,
      orgId: '00D-test',
      labels,
      filter: {
        showLocal: true,
        showOrg: true,
        text: '',
        typeFilter: undefined,
        componentFilter: undefined,
        typeIsRegex: false,
        componentIsRegex: false
      },
      roots: [typeNode('ApexClass')]
    });
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Local' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Org' }).checked).toBe(true);
    const search = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter metadata' });
    expect(search.placeholder).toContain('/Apex.*/:/.*(Test|Spec)/ (regex)');
    expect(search.title).toBe(search.placeholder);
    const collapseButton = screen.getByRole('button', { name: 'Collapse All' });
    expect(collapseButton.querySelector('svg.toolbar-action-icon')).not.toBeNull();
    expect(collapseButton.textContent).not.toContain('⇤');
  });

  it('debounces filter messages and includes the active generation', () => {
    jest.useFakeTimers();
    render(<App />);
    send({
      type: 'initialize',
      generation: 7,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass')]
    });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter metadata' }), { target: { value: 'Apex*' } });
    expect(vscodeApiMock.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'setFilter' }));
    act(() => jest.advanceTimersByTime(150));
    expect(vscodeApiMock.postMessage).toHaveBeenCalledWith({
      type: 'setFilter',
      generation: 7,
      requestId: 1,
      showLocal: true,
      showOrg: true,
      text: 'Apex*'
    });
    jest.useRealTimers();
  });

  it('renders host errors', () => {
    render(<App />);
    send({ type: 'error', message: 'Catalog unavailable' });
    expect(screen.getByRole('alert').textContent).toContain('Catalog unavailable');
  });

  it.each([
    {
      name: 'disabled presence filters',
      filter: { ...typeFilter, showLocal: false, showOrg: false, text: '' },
      expected: 'Both presence filters are off. Enable Local or Org above to view metadata.'
    },
    {
      name: 'a filter with no matches',
      filter: { ...typeFilter, text: 'MissingType' },
      expected:
        'No metadata types match your current filters. Adjust the Local, Org, or type/component filter controls above to view metadata.'
    },
    {
      name: 'an empty catalog',
      filter: { ...typeFilter, text: '' },
      expected: 'No metadata is available. Use Refresh All to retrieve the latest metadata types from your org.'
    }
  ])('renders guidance for $name', ({ filter, expected }) => {
    render(<App />);
    send({ type: 'initialize', generation: 12, orgId: '00D-test', labels, filter, roots: [] });
    expect(screen.getByRole('status').textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(expected);
  });

  it('renders guidance while metadata types are loading', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 13,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: []
    });
    send({ type: 'loading', requestId: 1, loading: true });
    expect(screen.getByRole('status').textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(
      'Retrieving the metadata types from your org. This might take a bit. Expand a metadata type to see its components. You can retrieve an individual component or all visible components of a type.'
    );
  });

  it('replaces an existing tree with refresh progress until new roots arrive', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 13,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass')]
    });

    send({ type: 'loading', requestId: 1, loading: true });

    expect(screen.queryByRole('tree')).toBeNull();
    expect(screen.getByRole('status').textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(
      'Retrieving the metadata types from your org. This might take a bit. Expand a metadata type to see its components. You can retrieve an individual component or all visible components of a type.'
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Refresh All' }).disabled).toBe(true);
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true');
  });

  it('projects row actions and accessible tree attributes', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 3,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass')]
    });

    const row = screen.getByRole('treeitem', { name: 'ApexClass' });
    expect(row.getAttribute('aria-level')).toBe('1');
    expect(row.getAttribute('aria-posinset')).toBe('1');
    expect(row.getAttribute('aria-setsize')).toBe('1');
    const retrieveButton = screen.getByRole('button', { name: 'Retrieve ApexClass' });
    expect(retrieveButton.querySelector('svg.row-action-icon')).not.toBeNull();
    expect(retrieveButton.textContent).not.toContain('⇩');
    fireEvent.click(retrieveButton);
    expect(vscodeApiMock.postMessage).toHaveBeenCalledWith({
      type: 'retrieve',
      generation: 3,
      requestId: 1,
      nodeId: 'type:ApexClass'
    });
  });

  it('uses italic text instead of a success icon to indicate org-only presence', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 4,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('RemoteClass'), localTypeNode('LocalClass')]
    });

    const remoteRow = screen.getByRole('treeitem', { name: 'RemoteClass' });
    const localRow = screen.getByRole('treeitem', { name: 'LocalClass' });
    expect(remoteRow.querySelector('.node-label')?.classList.contains('is-org-only')).toBe(true);
    expect(localRow.querySelector('.node-label')?.classList.contains('is-org-only')).toBe(false);
    expect(localRow.textContent).not.toContain('✓');
    expect(localRow.title).toContain(labels.presenceBoth);
  });

  it('uses the large spinner while a node is expanding', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 5,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass')]
    });
    send({ type: 'loading', requestId: 1, nodeId: 'type:ApexClass', loading: true });

    const row = screen.getByRole('treeitem', { name: 'ApexClass' });
    expect(row.getAttribute('aria-busy')).toBe('true');
    expect(row.querySelector('.busy-indicator')).not.toBeNull();
  });

  it('renders only the virtual window for a large inventory', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 8,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: Array.from({ length: 10_000 }, (_value, index) => typeNode(`Type${index}`))
    });

    expect(screen.getAllByRole('treeitem')).toHaveLength(12);
    expect(screen.getAllByRole('treeitem')[0].getAttribute('aria-setsize')).toBe('10000');
  });

  it('restores tree state per org without carrying it to another org', () => {
    vscodeApiMock.getState.mockReturnValue({
      version: 1,
      byOrg: {
        '00D-one': {
          version: 1,
          expandedIds: ['type:ApexClass'],
          selectedId: 'type:ApexClass',
          focusedId: 'type:ApexClass',
          scrollTop: 40
        }
      }
    });
    render(<App />);
    send({
      type: 'initialize',
      generation: 9,
      orgId: '00D-one',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass')]
    });
    expect(screen.getByRole('treeitem', { name: 'ApexClass' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('treeitem', { name: 'ApexClass' }).getAttribute('aria-selected')).toBe('true');

    send({
      type: 'initialize',
      generation: 10,
      orgId: '00D-two',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass')]
    });
    expect(screen.getByRole('treeitem', { name: 'ApexClass' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('treeitem', { name: 'ApexClass' }).getAttribute('aria-selected')).toBe('false');
  });

  it('commits restored expansion and children as one projection', () => {
    render(<App />);
    const type = typeNode('ApexClass');
    const component = componentNode('FileUtilities', type.id);
    send({
      type: 'initialize',
      generation: 14,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [type],
      children: [{ parentId: type.id, nodes: [component] }],
      viewState: {
        version: 1,
        expandedIds: [type.id],
        selectedId: component.id,
        focusedId: component.id,
        scrollTop: 20
      }
    });

    expect(screen.getByRole('treeitem', { name: 'ApexClass' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('treeitem', { name: 'FileUtilities' }).getAttribute('aria-selected')).toBe('true');
  });

  it('supports native tree keyboard navigation', () => {
    render(<App />);
    send({
      type: 'initialize',
      generation: 11,
      orgId: '00D-test',
      labels,
      filter: { ...typeFilter, text: '' },
      roots: [typeNode('ApexClass'), typeNode('ApexTrigger')]
    });
    const first = screen.getByRole('treeitem', { name: 'ApexClass' });
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(screen.getByRole('treeitem', { name: 'ApexTrigger' }).tabIndex).toBe(0);
  });
});

const labels: OrgBrowserLabels = {
  local: 'Local',
  org: 'Org',
  filter: 'Filter metadata',
  filterPlaceholder: 'Filter: Apex*, *:*Test* (wildcards) or /Apex.*/:/.*(Test|Spec)/ (regex)',
  clearFilter: 'Clear filter',
  refresh: 'Refresh',
  refreshAll: 'Refresh All',
  retrieve: 'Retrieve',
  collapseAll: 'Collapse All',
  loading:
    'Retrieving the metadata types from your org. This might take a bit.\n\nExpand a metadata type to see its components. You can retrieve an individual component or all visible components of a type.',
  empty: 'No metadata is available.\n\nUse Refresh All to retrieve the latest metadata types from your org.',
  filteredEmpty:
    'No metadata types match your current filters.\n\nAdjust the Local, Org, or type/component filter controls above to view metadata.',
  presenceEmpty: 'Both presence filters are off.\n\nEnable Local or Org above to view metadata.',
  tree: 'Org metadata',
  controls: 'Org Browser controls',
  presenceBoth: 'Both',
  presenceLocal: 'Local only',
  presenceOrg: 'Org only'
};
