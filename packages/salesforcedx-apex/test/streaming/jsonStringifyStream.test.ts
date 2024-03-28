/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { Readable } from 'stream';
import { JSONStringifyStream } from '../../src/streaming';

describe('JSONStringifyStream', () => {
  it('should create an instance from a JSON object', () => {
    const json = { key: 'value' };
    const stream = JSONStringifyStream.from(json);

    expect(stream).to.be.an.instanceOf(JSONStringifyStream);
    expect(stream).to.be.an.instanceOf(Readable);
  });

  it('should stringify a JSON object', (done) => {
    const json = { key: 'value' };
    const stream = JSONStringifyStream.from(json);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(json));
      done();
    });
  });

  it('should handle empty objects', (done) => {
    const json = {};
    const stream = JSONStringifyStream.from(json);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(json));
      done();
    });
  });

  it('should handle complex objects ending with a key/array', (done) => {
    const json = {
      key1: 'value1',
      key2: { key3: 'value3' },
      key4: ['value4', 'value5']
    };
    const stream = JSONStringifyStream.from(json);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(json));
      done();
    });
  });

  it('should handle complex objects ending with a key/object', (done) => {
    const json = {
      key1: 'value1',
      key4: ['value4', 'value5'],
      key2: { key3: 'value3' }
    };
    const stream = JSONStringifyStream.from(json);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(json));
      done();
    });
  });

  it('should handle string values', (done) => {
    const value = 'string';
    const stream = JSONStringifyStream.from(value);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(value));
      done();
    });
  });

  it('should handle number values', (done) => {
    const value = 123;
    const stream = JSONStringifyStream.from(value);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(value));
      done();
    });
  });

  it('should handle boolean values', (done) => {
    const value = true;
    const stream = JSONStringifyStream.from(value);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(value));
      done();
    });
  });

  it('should handle null values', (done) => {
    const value = null as unknown;
    const stream = JSONStringifyStream.from(value);

    let result = '';
    stream.on('data', (chunk) => {
      result += chunk;
    });

    stream.on('end', () => {
      expect(result).to.equal(JSON.stringify(value));
      done();
    });
  });
});
