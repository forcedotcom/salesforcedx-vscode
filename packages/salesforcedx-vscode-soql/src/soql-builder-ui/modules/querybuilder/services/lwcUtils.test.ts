import { lwcIndexableArray } from './lwcUtils';

describe('Lwc Utils Should', () => {
  it('turn simple array into an indexed array', () => {
    const indexableArray = lwcIndexableArray(['one', 'two', 'three']);
    expect(indexableArray[0]).toEqual({ index: 0, item: 'one' });
    expect(indexableArray[1]).toEqual({ index: 1, item: 'two' });
    expect(indexableArray[2]).toEqual({ index: 2, item: 'three' });
  });
});
