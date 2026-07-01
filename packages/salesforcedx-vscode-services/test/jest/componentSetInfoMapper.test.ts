/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { toComponentSetInfo } from '../../src/owned/componentSetInfoMapper';

describe('toComponentSetInfo', () => {
  it('maps a ComponentSet to owned ComponentSetInfo', async () => {
    const fake = {
      size: 1,
      sourceApiVersion: '62.0',
      projectDirectory: '/proj',
      getSourceComponents: () => [
        {
          fullName: 'MyClass',
          type: { name: 'ApexClass' },
          xml: '/p/MyClass.cls-meta.xml',
          content: '/p/MyClass.cls',
          walkContent: () => ['/p/MyClass.cls']
        }
      ],
      getPackageXml: () => Promise.resolve('<Package/>')
    };
    const info = await toComponentSetInfo(fake as never);
    expect(info.size).toBe(1);
    expect(info.sourceApiVersion).toBe('62.0');
    expect(info.projectDirectory).toBe('/proj');
    expect(info.components[0]).toMatchObject({ fullName: 'MyClass', type: 'ApexClass' });
    expect(info.packageXml).toBe('<Package/>');
  });

  it('maps component with contentPaths from walkContent', async () => {
    const fake = {
      size: 1,
      sourceApiVersion: '61.0',
      projectDirectory: '/project',
      getSourceComponents: () => [
        {
          fullName: 'MyBundle',
          type: { name: 'LightningComponentBundle' },
          xml: '/p/MyBundle/MyBundle.js-meta.xml',
          content: undefined,
          walkContent: () => ['/p/MyBundle/MyBundle.js', '/p/MyBundle/MyBundle.html', '/p/MyBundle/MyBundle.css']
        }
      ],
      getPackageXml: () => Promise.resolve('<Package version="61.0"/>')
    };
    const info = await toComponentSetInfo(fake as never);
    expect(info.components[0]).toMatchObject({
      fullName: 'MyBundle',
      type: 'LightningComponentBundle',
      xmlPath: '/p/MyBundle/MyBundle.js-meta.xml',
      contentPaths: ['/p/MyBundle/MyBundle.js', '/p/MyBundle/MyBundle.html', '/p/MyBundle/MyBundle.css']
    });
  });

  it('maps component without xml or content', async () => {
    const fake = {
      size: 1,
      sourceApiVersion: undefined,
      projectDirectory: undefined,
      getSourceComponents: () => [
        {
          fullName: 'StandardObject',
          type: { name: 'CustomObject' },
          xml: undefined,
          content: undefined,
          walkContent: () => []
        }
      ],
      getPackageXml: () => Promise.resolve('<Package/>')
    };
    const info = await toComponentSetInfo(fake as never);
    expect(info.components[0]).toMatchObject({
      fullName: 'StandardObject',
      type: 'CustomObject',
      contentPaths: []
    });
    expect(info.components[0].xmlPath).toBeUndefined();
    expect(info.sourceApiVersion).toBeUndefined();
    expect(info.projectDirectory).toBeUndefined();
  });

  it('handles multiple components', async () => {
    const fake = {
      size: 2,
      sourceApiVersion: '63.0',
      projectDirectory: '/multi',
      getSourceComponents: () => [
        {
          fullName: 'Class1',
          type: { name: 'ApexClass' },
          xml: '/p/Class1.cls-meta.xml',
          content: '/p/Class1.cls',
          walkContent: () => ['/p/Class1.cls']
        },
        {
          fullName: 'Class2',
          type: { name: 'ApexClass' },
          xml: '/p/Class2.cls-meta.xml',
          content: '/p/Class2.cls',
          walkContent: () => ['/p/Class2.cls']
        }
      ],
      getPackageXml: () => Promise.resolve('<Package><version>63.0</version></Package>')
    };
    const info = await toComponentSetInfo(fake as never);
    expect(info.size).toBe(2);
    expect(info.components).toHaveLength(2);
    expect(info.components[0].fullName).toBe('Class1');
    expect(info.components[1].fullName).toBe('Class2');
  });
});
