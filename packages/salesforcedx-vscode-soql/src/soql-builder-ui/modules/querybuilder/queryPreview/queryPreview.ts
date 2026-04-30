/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { api, LightningElement } from 'lwc';
import { messages } from 'querybuilder/messages';
import type { SoqlSegment } from '../services/soqlSegmenter';

export default class QueryPreview extends LightningElement {
  @api
  public soqlStatement;

  @api
  public segments: SoqlSegment[] = [];

  @api
  public activeContextPath: string[] = [];

  public get i18n() {
    return messages;
  }

  public get hasSegments(): boolean {
    return this.segments.length > 1;
  }

  public get renderedSegments(): Array<SoqlSegment & { cssClass: string }> {
    return this.segments.map(seg => ({
      ...seg,
      cssClass: this._segmentClass(seg)
    }));
  }

  private _pathsEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  private _segmentClass(seg: SoqlSegment): string {
    const classes = ['query-segment'];
    if (seg.isSubquery) {
      classes.push('query-segment--subquery');
      if (this._pathsEqual(seg.contextPath, this.activeContextPath)) {
        classes.push('query-segment--active');
      }
    }
    return classes.join(' ');
  }

  public handleSegmentClick(e: Event): void {
    const target = e.currentTarget as HTMLElement;
    const segId = target.dataset.segId;
    const seg = this.segments.find(s => s.id === segId);
    if (!seg || !seg.isSubquery) return;
    this.dispatchEvent(new CustomEvent('preview__navigate', {
      detail: { contextPath: seg.contextPath }
    }));
  }
}
