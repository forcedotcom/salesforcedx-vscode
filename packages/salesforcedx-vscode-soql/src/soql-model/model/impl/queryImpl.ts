/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Bind,
  From,
  GroupBy,
  HeaderComments,
  Limit,
  Offset,
  OrderBy,
  Query,
  RecordTrackingType,
  Select,
  SyntaxOptions,
  Update,
  Where,
  With
} from '../model';

export class QueryImpl implements Query {
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
    this.with = soqlwith;
  }
  public toSoqlSyntax(options?: SyntaxOptions): string {
    const opts = options ?? new SyntaxOptions();
    let syntax = '';
    if (this.headerComments) {
      syntax += `${this.headerComments.toSoqlSyntax(opts)}`;
    }
    if (this.select) {
      syntax += `${this.select.toSoqlSyntax(opts)}\n`;
    }
    if (this.from) {
      syntax += `${' '.repeat(opts.indent)}${this.from.toSoqlSyntax(opts)}\n`;
    }
    if (this.where) {
      syntax += `${' '.repeat(opts.indent)}${this.where.toSoqlSyntax(opts)}\n`;
    }
    if (this.with) {
      syntax += `${' '.repeat(opts.indent)}${this.with.toSoqlSyntax(opts)}\n`;
    }
    if (this.groupBy) {
      syntax += `${' '.repeat(opts.indent)}${this.groupBy.toSoqlSyntax(opts)}\n`;
    }
    if (this.orderBy) {
      syntax += `${' '.repeat(opts.indent)}${this.orderBy.toSoqlSyntax(opts)}\n`;
    }
    if (this.limit) {
      syntax += `${' '.repeat(opts.indent)}${this.limit.toSoqlSyntax(opts)}\n`;
    }
    if (this.offset) {
      syntax += `${' '.repeat(opts.indent)}${this.offset.toSoqlSyntax(opts)}\n`;
    }
    if (this.bind) {
      syntax += `${' '.repeat(opts.indent)}${this.bind.toSoqlSyntax(opts)}\n`;
    }
    if (this.recordTrackingType) {
      syntax += `${' '.repeat(opts.indent)}${this.recordTrackingType.toSoqlSyntax(opts)}\n`;
    }
    if (this.update) {
      syntax += `${' '.repeat(opts.indent)}${this.update.toSoqlSyntax(opts)}\n`;
    }
    return syntax;
  }
}
