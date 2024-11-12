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
export const createHeapDumpResultForTriggers = (): ApexHeapDump => {
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
              symbols: ['Trigger.isbefore', 'Trigger.isdelete', 'Trigger.isundelete', 'Trigger.isupdate'],
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
};

// HeapDump with no String typename entries entries
export const createHeapDumpWithNoStringTypes = (): ApexHeapDump => {
  const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
  heapdump.setOverlaySuccessResult({
    HeapDump: {
      extents: [
        {
          collectionType: null,
          count: 1,
          definition: [{}],
          extent: [
            {
              address: '0x7c6064ee',
              isStatic: false,
              size: 4,
              symbols: ['theDate'],
              value: {
                value: '2018-09-13 00:00:00'
              }
            }
          ],
          totalSize: 4,
          typeName: 'Date'
        },
        {
          collectionType: null,
          count: 1,
          definition: [
            {
              name: 'value',
              type: 'Boolean'
            }
          ],
          extent: [
            {
              address: '0x557be9a9',
              isStatic: false,
              size: 5,
              symbols: ['theBoolean'],
              value: {
                value: true
              }
            }
          ],
          totalSize: 5,
          typeName: 'Boolean'
        },
        {
          collectionType: null,
          count: 1,
          definition: [
            {
              name: 'value',
              type: 'Double'
            }
          ],
          extent: [
            {
              address: '0x6b112109',
              isStatic: false,
              size: 12,
              symbols: ['theDouble'],
              value: {
                value: 3.14159
              }
            }
          ],
          totalSize: 12,
          typeName: 'Double'
        },
        {
          collectionType: null,
          count: 1,
          definition: [
            {
              name: 'value',
              type: 'Double'
            }
          ],
          extent: [
            {
              address: '0x74cb38fc',
              isStatic: false,
              size: 8,
              symbols: ['theInt'],
              value: {
                value: 5
              }
            }
          ],
          totalSize: 8,
          typeName: 'Integer'
        },
        {
          collectionType: null,
          count: 1,
          definition: [
            {
              name: 'value',
              type: 'Double'
            }
          ],
          extent: [
            {
              address: '0x538519dc',
              isStatic: false,
              size: 12,
              symbols: ['theLong'],
              value: {
                value: 4271990
              }
            }
          ],
          totalSize: 12,
          typeName: 'Long'
        },
        {
          collectionType: null,
          count: 2,
          definition: [
            {
              name: 'MyBoolean',
              type: 'Boolean'
            },
            {
              name: 'MyDate',
              type: 'Date'
            },
            {
              name: 'MyDouble',
              type: 'Double'
            },
            {
              name: 'MyInteger',
              type: 'Integer'
            },
            {
              name: 'MyLong',
              type: 'Long'
            }
          ],
          extent: [
            {
              address: '0x3557adc7',
              isStatic: false,
              size: 32,
              symbols: ['foo'],
              value: {
                entry: [
                  {
                    keyDisplayValue: 'MyBoolean',
                    value: {
                      value: false
                    }
                  },
                  {
                    keyDisplayValue: 'MyDate',
                    value: {
                      value: 'Thu Sep 13 00:00:00 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'MyDouble',
                    value: {
                      value: 4.37559
                    }
                  },
                  {
                    keyDisplayValue: 'MyInteger',
                    value: {
                      value: 10
                    }
                  },
                  {
                    keyDisplayValue: 'MyLong',
                    value: {
                      value: 4271993
                    }
                  }
                ]
              }
            }
          ],
          totalSize: 64,
          typeName: 'SomeTypeName'
        }
      ]
    }
  } as ApexExecutionOverlayResultCommandSuccess);

  return heapdump;
};

// Heapdump with typeName string entries
export const createHeapDumpWithStrings = (): ApexHeapDump => {
  const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
  heapdump.setOverlaySuccessResult({
    HeapDump: {
      extents: [
        {
          collectionType: null,
          count: 2,
          definition: [
            {
              name: 'stringValue',
              type: 'char[]'
            }
          ],
          extent: [
            {
              address: '0x47a32f5b',
              isStatic: false,
              size: 104,
              symbols: ['theString'],
              value: {
                value:
                  'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'
              }
            },
            {
              address: '0x6cda5efc',
              isStatic: false,
              size: 9,
              symbols: null,
              value: {
                value: '9/13/2018'
              }
            }
          ],
          totalSize: 113,
          typeName: 'String'
        }
      ]
    }
  } as ApexExecutionOverlayResultCommandSuccess);
  return heapdump;
};

// Partial heapdump with a nested reference, used to verify both leaf reference
// parsing and putting a variable together from the leaves.
export const createHeapDumpWithNestedRefs = (): ApexHeapDump => {
  const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
  heapdump.setOverlaySuccessResult({
    HeapDump: {
      extents: [
        {
          collectionType: null,
          count: 2,
          definition: [
            {
              name: 'innerVariable',
              type: 'NonStaticClassWithVariablesToInspect'
            },
            {
              name: 'MyBoolean',
              type: 'Boolean'
            },
            {
              name: 'MyDate',
              type: 'Date'
            },
            {
              name: 'MyDouble',
              type: 'Double'
            },
            {
              name: 'MyInteger',
              type: 'Integer'
            },
            {
              name: 'MyLong',
              type: 'Long'
            },
            {
              name: 'MyString',
              type: 'String'
            }
          ],
          extent: [
            {
              address: '0x3557adc7',
              isStatic: false,
              size: 32,
              symbols: ['foo'],
              value: {
                entry: [
                  {
                    keyDisplayValue: 'innerVariable',
                    value: {
                      value: '0x55260a7a'
                    }
                  },
                  {
                    keyDisplayValue: 'MyBoolean',
                    value: {
                      value: false
                    }
                  },
                  {
                    keyDisplayValue: 'MyDate',
                    value: {
                      value: 'Thu Sep 13 00:00:00 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'MyDouble',
                    value: {
                      value: 4.37559
                    }
                  },
                  {
                    keyDisplayValue: 'MyInteger',
                    value: {
                      value: 10
                    }
                  },
                  {
                    keyDisplayValue: 'MyLong',
                    value: {
                      value: 4271993
                    }
                  },
                  {
                    keyDisplayValue: 'MyString',
                    value: {
                      value: '0x47a32f5b'
                    }
                  }
                ]
              }
            },
            {
              address: '0x55260a7a',
              isStatic: false,
              size: 32,
              symbols: null,
              value: {
                entry: [
                  {
                    keyDisplayValue: 'innerVariable',
                    value: {
                      value: null
                    }
                  },
                  {
                    keyDisplayValue: 'MyBoolean',
                    value: {
                      value: true
                    }
                  },
                  {
                    keyDisplayValue: 'MyDate',
                    value: {
                      value: 'Thu Sep 13 00:00:00 GMT 2018'
                    }
                  },
                  {
                    keyDisplayValue: 'MyDouble',
                    value: {
                      value: 3.14159
                    }
                  },
                  {
                    keyDisplayValue: 'MyInteger',
                    value: {
                      value: 5
                    }
                  },
                  {
                    keyDisplayValue: 'MyLong',
                    value: {
                      value: 4271990
                    }
                  },
                  {
                    keyDisplayValue: 'MyString',
                    value: {
                      value: '0x6cda5efc'
                    }
                  }
                ]
              }
            }
          ],
          totalSize: 64,
          typeName: 'NonStaticClassWithVariablesToInspect'
        },
        {
          collectionType: null,
          count: 2,
          definition: [
            {
              name: 'stringValue',
              type: 'char[]'
            }
          ],
          extent: [
            {
              address: '0x47a32f5b',
              isStatic: false,
              size: 104,
              symbols: ['theString'],
              value: {
                value:
                  'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'
              }
            },
            {
              address: '0x6cda5efc',
              isStatic: false,
              size: 9,
              symbols: null,
              value: {
                value: '9/13/2018'
              }
            }
          ],
          totalSize: 113,
          typeName: 'String'
        }
      ]
    }
  } as ApexExecutionOverlayResultCommandSuccess);
  return heapdump;
};

// Partial heapdump with a circular reference
export const createHeapDumpWithCircularRefs = (): ApexHeapDump => {
  const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
  heapdump.setOverlaySuccessResult({
    HeapDump: {
      className: 'CircularRefTest',
      extents: [
        {
          collectionType: null,
          count: 1,
          definition: [
            {
              name: 'cfList',
              type: 'List<CircularReference>'
            },
            {
              name: 'someInt',
              type: 'Integer'
            }
          ],
          extent: [
            {
              address: '0x717304ef',
              isStatic: false,
              size: 12,
              symbols: ['cf1'],
              value: {
                entry: [
                  {
                    keyDisplayValue: 'cfList',
                    value: {
                      value: '0x614edc98'
                    }
                  },
                  {
                    keyDisplayValue: 'someInt',
                    value: {
                      value: 5
                    }
                  }
                ]
              }
            }
          ],
          totalSize: 12,
          typeName: 'CircularReference'
        },
        {
          collectionType: 'CircularReference',
          count: 1,
          definition: [],
          extent: [
            {
              address: '0x614edc98',
              isStatic: false,
              size: 8,
              symbols: null,
              value: {
                value: [
                  {
                    value: '0x717304ef'
                  }
                ]
              }
            }
          ],
          totalSize: 8,
          typeName: 'List<CircularReference>'
        }
      ]
    }
  } as ApexExecutionOverlayResultCommandSuccess);
  return heapdump;
};
