import { expect } from 'chai';

// Defines a Mocha test suite to group tests of similar kind together
describe('Extension Tests', () => {
  // Defines a Mocha unit test
  it('Something 1', () => {
    expect([1, 2, 3].indexOf(5)).to.equal(-1);
    expect([1, 2, 3].indexOf(1)).to.equal(0);
  });
  it('Something 1', () => {
    expect([1, 2, 3].indexOf(5)).to.equal(-1);
    expect([1, 2, 3].indexOf(1)).to.equal(0);
  });
});
