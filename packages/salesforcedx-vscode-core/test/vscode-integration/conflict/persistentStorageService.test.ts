/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileProperties } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import { PersistentStorageService } from '../../../src/conflict/persistentStorageService';
import { MockContext } from '../telemetry/MockContext';

describe('Persistant Storage Service', () => {
  const props: FileProperties[] = [
    {
      id: '1',
      createdById: '2',
      createdByName: 'Me',
      createdDate: 'Today',
      fileName: 'classes/One.cls',
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
      fileName: 'objects/Two.object',
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
    expect(cache.getPropertiesForFile('classes/One.cls')).to.deep.equal({lastModifiedDate: 'Tomorrow'});
    expect(cache.getPropertiesForFile('objects/Two.object')).to.deep.equal({lastModifiedDate: 'Yesterday'});
    cache.setPropertiesForFile('classes/One.cls', undefined);
    cache.setPropertiesForFile('objects/Two.object', undefined);
    expect(cache.getPropertiesForFile('classes/One.cls')).to.equal(undefined);
    expect(cache.getPropertiesForFile('objects/Two.object')).to.equal(undefined);
  });

});
