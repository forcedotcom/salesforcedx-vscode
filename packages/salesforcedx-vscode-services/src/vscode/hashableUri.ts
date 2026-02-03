/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Equal from 'effect/Equal';
import * as Hash from 'effect/Hash';
import { URI } from 'vscode-uri';

/** it's vscode-uri but add Effect's hash/equal interface so we can more easily dedupe them  (hashMap, hashSet) */
export class HashableUri extends URI {
  protected constructor(scheme: string, authority?: string, path?: string, query?: string, fragment?: string) {
    super(scheme, authority, path, query, fragment);
  }

  public static fromUri(uri: URI): HashableUri {
    return new HashableUri(uri.scheme, uri.authority, uri.path, uri.query, uri.fragment);
  }

  public [Equal.symbol](that: Equal.Equal): boolean {
    return (
      that instanceof URI &&
      this.scheme === that.scheme &&
      this.authority === that.authority &&
      this.path === that.path &&
      this.query === that.query &&
      this.fragment === that.fragment
    );
  }

  public [Hash.symbol](): number {
    const hashes = [this.scheme, this.authority, this.path, this.query, this.fragment].map(Hash.hash);
    return hashes.slice(1).reduce((acc, h) => (acc * 31) ^ h, hashes[0]);
  }

  public with(change: {
    scheme?: string;
    authority?: string | null;
    path?: string | null;
    query?: string | null;
    fragment?: string | null;
  }): HashableUri {
    return HashableUri.fromUri(super.with(change));
  }

  public static file(path: string): HashableUri {
    return HashableUri.fromUri(URI.file(path));
  }

  public static parse(value: string, _strict?: boolean): HashableUri {
    return HashableUri.fromUri(URI.parse(value, _strict));
  }

  public static from(components: {
    scheme: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): HashableUri {
    return HashableUri.fromUri(URI.from(components));
  }
}
