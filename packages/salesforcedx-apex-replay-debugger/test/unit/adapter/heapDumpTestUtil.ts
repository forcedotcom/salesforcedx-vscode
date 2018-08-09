/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexExecutionOverlayResultCommandSuccess } from '../../../src/commands/apexExecutionOverlayResultCommand';
import { ApexHeapDump } from '../../../src/core';

// Rather than duplicate a large heapdump in multiple places just have a common function return it. The
// heap dump for triggers is ends up bring pretty large but there are only 3 Account records in here.
// This method contains the elements necessary to test the Trigger variables in the heapdump.
export function createHeapDumpResultForTriggers(): ApexHeapDump {
  // This particular heapdump was taken after an insert. The Trigger booleans for isafter and isinsert will
  // be true. isbefore, isdelete, isundelete and isupdate will be false. The Trigger.new and Trigger.newmap
  // will both be populated with 3 Account objects.
  const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
  heapdump.setOverlaySuccessResult({
    HeapDump: {
      extents: [
        {
          collectionType: null,
          count: 3,
          definition: [{}],
          extent: [
            {
              address: '0x5f163c72',
              size: 0,
              symbols: null,
              value: {
                entry: [
                  {
                    keyDisplayValue: 'LastModifiedDate',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'IsDeleted',
                    value: {
                      value: 'false'
                    }
                  },
                  {
                    keyDisplayValue: 'CleanStatus',
                    value: {
                      value: 'Pending'
                    }
                  },
                  {
                    keyDisplayValue: 'OwnerId',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'CreatedById',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'CreatedDate',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'Id',
                    value: {
                      value: '001xx000003Dv3YAAS'
                    }
                  },
                  {
                    keyDisplayValue: 'LastModifiedById',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'SystemModstamp',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'Name',
                    value: {
                      value: 'okToDelete0'
                    }
                  },
                  {
                    keyDisplayValue: 'AccountNumber',
                    value: {
                      value: 'xxx'
                    }
                  }
                ]
              }
            },
            {
              address: '0xf1fabe',
              size: 0,
              symbols: null,
              value: {
                entry: [
                  {
                    keyDisplayValue: 'LastModifiedDate',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'IsDeleted',
                    value: {
                      value: 'false'
                    }
                  },
                  {
                    keyDisplayValue: 'CleanStatus',
                    value: {
                      value: 'Pending'
                    }
                  },
                  {
                    keyDisplayValue: 'OwnerId',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'CreatedById',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'CreatedDate',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'Id',
                    value: {
                      value: '001xx000003Dv3ZAAS'
                    }
                  },
                  {
                    keyDisplayValue: 'LastModifiedById',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'SystemModstamp',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'Name',
                    value: {
                      value: 'okToDelete1'
                    }
                  },
                  {
                    keyDisplayValue: 'AccountNumber',
                    value: {
                      value: 'xxx'
                    }
                  }
                ]
              }
            },
            {
              address: '0x76e9852b',
              size: 0,
              symbols: null,
              value: {
                entry: [
                  {
                    keyDisplayValue: 'LastModifiedDate',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'IsDeleted',
                    value: {
                      value: 'false'
                    }
                  },
                  {
                    keyDisplayValue: 'CleanStatus',
                    value: {
                      value: 'Pending'
                    }
                  },
                  {
                    keyDisplayValue: 'OwnerId',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'CreatedById',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'CreatedDate',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'Id',
                    value: {
                      value: '001xx000003Dv3aAAC'
                    }
                  },
                  {
                    keyDisplayValue: 'LastModifiedById',
                    value: {
                      value: '005xx000001Uta8AAC'
                    }
                  },
                  {
                    keyDisplayValue: 'SystemModstamp',
                    value: {
                      value: 'Mon Jul 30 15:02:51 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'Name',
                    value: {
                      value: 'okToDelete2'
                    }
                  },
                  {
                    keyDisplayValue: 'AccountNumber',
                    value: {
                      value: 'xxx'
                    }
                  }
                ]
              }
            }
          ],
          totalSize: 0,
          typeName: 'Account'
        },
        {
          collectionType: 'Account',
          count: 1,
          definition: [],
          extent: [
            {
              address: '0x7ac2777',
              size: 16,
              symbols: ['Trigger.new'],
              value: {
                value: [
                  {
                    value: '0x5f163c72'
                  },
                  {
                    value: '0xf1fabe'
                  },
                  {
                    value: '0x76e9852b'
                  }
                ]
              }
            }
          ],
          totalSize: 16,
          typeName: 'List<Account>'
        },
        {
          collectionType: 'Account',
          count: 1,
          definition: [],
          extent: [
            {
              address: '0x4266fa43',
              size: 16,
              symbols: ['Trigger.newmap'],
              value: {
                entry: [
                  {
                    keyDisplayValue: '0x5c288675',
                    value: {
                      value: '0x5f163c72'
                    }
                  },
                  {
                    keyDisplayValue: '0x5db01cb1',
                    value: {
                      value: '0xf1fabe'
                    }
                  },
                  {
                    keyDisplayValue: '0x1872dffb',
                    value: {
                      value: '0x76e9852b'
                    }
                  }
                ]
              }
            }
          ],
          totalSize: 16,
          typeName: 'Map<Id,Account>'
        },
        {
          collectionType: null,
          count: 2,
          definition: [
            {
              name: 'value',
              type: 'Boolean'
            }
          ],
          extent: [
            {
              address: '0x10954bcf',
              size: 5,
              symbols: [
                'Trigger.isbefore',
                'Trigger.isdelete',
                'Trigger.isundelete',
                'Trigger.isupdate'
              ],
              value: {
                value: false
              }
            },
            {
              address: '0x63903543',
              size: 5,
              symbols: ['Trigger.isafter', 'Trigger.isinsert'],
              value: {
                value: true
              }
            }
          ],
          totalSize: 10,
          typeName: 'Boolean'
        },
        {
          collectionType: null,
          count: 5,
          definition: [
            {
              name: 'stringValue',
              type: 'char[]'
            }
          ],
          extent: [
            {
              address: '0x72488407',
              size: 15,
              symbols: null,
              value: {
                value: 'currentinstance'
              }
            },
            {
              address: '0x5f87e37c',
              size: 10,
              symbols: null,
              value: {
                value: 'targettype'
              }
            },
            {
              address: '0x5c288675',
              size: 18,
              symbols: null,
              value: {
                value: '001xx000003Dv3YAAS'
              }
            },
            {
              address: '0x5db01cb1',
              size: 18,
              symbols: null,
              value: {
                value: '001xx000003Dv3ZAAS'
              }
            },
            {
              address: '0x1872dffb',
              size: 18,
              symbols: null,
              value: {
                value: '001xx000003Dv3aAAC'
              }
            }
          ],
          totalSize: 79,
          typeName: 'String'
        }
      ]
    }
  } as ApexExecutionOverlayResultCommandSuccess);
  return heapdump;
}
