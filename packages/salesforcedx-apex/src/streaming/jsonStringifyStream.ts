/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable, ReadableOptions } from 'stream';
import { elapsedTime } from '../utils';
import { LoggerLevel } from '@salesforce/core';
import { isArray, isObject, isPrimitive } from '../narrowing';

interface JSONStringifyStreamOptions extends ReadableOptions {
  object: unknown;
}

export class JSONStringifyStream extends Readable {
  private sent: boolean = false;
  private lastYielded: unknown | undefined;
  private readonly object: unknown;

  constructor(options: JSONStringifyStreamOptions) {
    super({ ...options, objectMode: false });
    this.object = options.object;
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private *stringify(obj: unknown): Generator<string> {
    if (isObject(obj)) {
      yield* this.handleObject(obj, true);
    } else if (isArray(obj)) {
      yield* this.handleArray(obj as unknown[], true);
    } else if (isPrimitive(obj)) {
      yield JSON.stringify(obj);
    }
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private *yieldWithTracking(value: string): Generator<string> {
    this.lastYielded = value;
    yield value;
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private *handleObject(obj: object, isLast: boolean): Generator<string> {
    yield* this.yieldWithTracking('{');
    const entries = Object.entries(obj);
    for (let index = 0; index < entries.length; index++) {
      const [key, value] = entries[index];
      yield* this.yieldWithTracking(`"${key}":`);
      if (isObject(value)) {
        yield* this.handleObject(value, index === entries.length - 1);
      } else if (isArray(value)) {
        yield* this.handleArray(value, index === entries.length - 1);
      } else {
        yield* this.yieldWithTracking(JSON.stringify(value));
      }
      if (index !== entries.length - 1 && this.lastYielded !== ',') {
        yield* this.yieldWithTracking(',');
      }
    }
    yield* this.yieldWithTracking('}');
    if (!isLast && this.lastYielded !== ',') {
      yield* this.yieldWithTracking(',');
    }
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private *handleArray(
    unknownArray: unknown[],
    isLast: boolean
  ): Generator<string> {
    yield* this.yieldWithTracking('[');
    for (let index = 0; index < unknownArray.length; index++) {
      const entry = unknownArray[index];
      if (isObject(entry)) {
        yield* this.handleObject(entry, index === unknownArray.length - 1);
      } else if (isArray(entry)) {
        yield* this.handleArray(entry, index === unknownArray.length - 1);
      } else {
        yield* this.yieldWithTracking(JSON.stringify(entry));
      }
      if (index !== unknownArray.length - 1 && this.lastYielded !== ',') {
        yield* this.yieldWithTracking(',');
      }
    }
    yield* this.yieldWithTracking(']');
    if (!isLast && this.lastYielded !== ',') {
      yield* this.yieldWithTracking(',');
    }
  }

  _read(): void {
    if (!this.sent) {
      const generator = this.stringify(this.object);
      for (const chunk of generator) {
        this.push(chunk);
      }
      this.sent = true;
    } else {
      this.push(null);
    }
  }

  static from(json: unknown): JSONStringifyStream {
    return new JSONStringifyStream({ object: json });
  }
}
