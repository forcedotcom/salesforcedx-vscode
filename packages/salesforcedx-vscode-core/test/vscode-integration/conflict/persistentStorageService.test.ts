/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileProperties } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import { join } from 'path';
import { PersistentStorageService } from '../../../src/conflict/persistentStorageService';
import { MockContext } from '../telemetry/MockContext';

describe('Persistent Storage Service', () => {
  const props: FileProperties[] = [
    {
      id: '1',
      createdById: '2',
      createdByName: 'Me',
      createdDate: 'Today',
      fileName: join('classes', 'One.cls'),
      fullName: 'One',
      lastModifiedById: '3',
      lastModifiedByName: 'You',
      lastModifiedDate: 'Tomorrow',
      type: 'ApexClass'
    },
    {
      id: '4',
      createdById: '2',
      createdByName: 'Me',
      createdDate: 'Yesterday',
      fileName: join('objects', 'Two.cls'),
      fullName: 'Two',
      lastModifiedById: '2',
      lastModifiedByName: 'Me',
      lastModifiedDate: 'Yesterday',
      type: 'CustomObject'
    }
  ];

  beforeEach(() => {
    const mockContext = new MockContext(false);
    PersistentStorageService.initialize(mockContext);
  });

  it('Should store and retrieve file properties in Memento cache', () => {
    const cache = PersistentStorageService.getInstance();
    cache.setPropertiesForFiles(props);
    expect(cache.getPropertiesForFile(join('classes', 'One.cls'))).to.deep.equal({lastModifiedDate: 'Tomorrow'});
    expect(cache.getPropertiesForFile(join('objects', 'Two.cls'))).to.deep.equal({lastModifiedDate: 'Yesterday'});
    cache.setPropertiesForFile(join('classes', 'One.cls'), undefined);
    cache.setPropertiesForFile(join('objects', 'Two.cls'), undefined);
    expect(cache.getPropertiesForFile(join('classes', 'One.cls'))).to.equal(undefined);
    expect(cache.getPropertiesForFile(join('objects', 'Two.cls'))).to.equal(undefined);
  });

});
