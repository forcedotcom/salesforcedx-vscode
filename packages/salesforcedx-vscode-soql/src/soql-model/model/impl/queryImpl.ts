/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Note: Cannot use 'node:os' here because this file is bundled by webpack for browser (soql-builder-ui)
// and webpack 4 (used by lwc-services) doesn't support the node: protocol
// eslint-disable-next-line unicorn/prefer-node-protocol
import * as os from 'os';
import { Bind, From, GroupBy, HeaderComments, Limit, Offset, OrderBy, Query, RecordTrackingType, Select, SyntaxOptions, Update, Where, With } from '../model';
import { SoqlModelObjectImpl } from './soqlModelObjectImpl';

export class QueryImpl extends SoqlModelObjectImpl implements Query {
  public headerComments?: HeaderComments;
  public with?: With;
  constructor(
    public select?: Select,
    public from?: From,
    public where?: Where,
    soqlwith?: With,
    public groupBy?: GroupBy,
    public orderBy?: OrderBy,
    public limit?: Limit,
    public offset?: Offset,
    public bind?: Bind,
    public recordTrackingType?: RecordTrackingType,
    public update?: Update
  ) {
    super();
    this.with = soqlwith;
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
    const opts = this.getSyntaxOptions(options);
    let syntax = '';
    if (this.headerComments) {
      syntax += `${this.headerComments.toSoqlSyntax(opts)}`;
    }
    if (this.select) {
      syntax += `${this.select.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.from) {
      syntax += `${' '.repeat(opts.indent)}${this.from.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.where) {
      syntax += `${' '.repeat(opts.indent)}${this.where.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.with) {
      syntax += `${' '.repeat(opts.indent)}${this.with.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.groupBy) {
      syntax += `${' '.repeat(opts.indent)}${this.groupBy.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.orderBy) {
      syntax += `${' '.repeat(opts.indent)}${this.orderBy.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.limit) {
      syntax += `${' '.repeat(opts.indent)}${this.limit.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.offset) {
      syntax += `${' '.repeat(opts.indent)}${this.offset.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.bind) {
      syntax += `${' '.repeat(opts.indent)}${this.bind.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.recordTrackingType) {
      syntax += `${' '.repeat(opts.indent)}${this.recordTrackingType.toSoqlSyntax(opts)}${os.EOL}`;
    }
    if (this.update) {
      syntax += `${' '.repeat(opts.indent)}${this.update.toSoqlSyntax(opts)}${os.EOL}`;
    }
    return syntax;
  }
}
