/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { showTraceFlagExpiration } from '../traceflag-time-decorator';

export class DeveloperLogTraceFlag {
  private static instance: DeveloperLogTraceFlag;
  private active: boolean;
  private traceflagId: string;
  private startDate: Date;
  private expirationDate: Date;
  private debugLevelId: string;
  private prevApexCodeDebugLevel: string;
  private prevVFDebugLevel: string;

  public MILLISECONDS_PER_SECOND = 60000;
  public LOG_TIMER_LENGTH_MINUTES = 30;

  private constructor() {
    this.active = false;
  }

  public static getInstance() {
    if (!DeveloperLogTraceFlag.instance) {
      DeveloperLogTraceFlag.instance = new DeveloperLogTraceFlag();
    }
    return DeveloperLogTraceFlag.instance;
  }

  public createTraceFlagInfo() {
    this.startDate = new Date();
    this.expirationDate = new Date(
      Date.now() + this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_SECOND
    );
  }

  public setTraceFlagDebugLevelInfo(
    id: string,
    startDate: string,
    expirationDate: string,
    debugLevelId: string,
    oldApexCodeDebugLevel: string,
    oldVFDebugLevel: string
  ) {
    this.traceflagId = id;
    this.startDate = new Date(startDate);
    this.expirationDate = new Date(expirationDate);
    this.debugLevelId = debugLevelId;
    this.prevApexCodeDebugLevel = oldApexCodeDebugLevel;
    this.prevVFDebugLevel = oldVFDebugLevel;
    this.active = true;
  }

  public setDebugLevelInfo(
    debugLevelId: string,
    oldApexCodeDebugLevel = APEX_CODE_DEBUG_LEVEL,
    oldVFDebugLevel = VISUALFORCE_DEBUG_LEVEL
  ) {
    this.debugLevelId = debugLevelId;
    this.prevApexCodeDebugLevel = oldApexCodeDebugLevel;
    this.prevVFDebugLevel = oldVFDebugLevel;
  }

  public setTraceFlagId(id: string) {
    this.traceflagId = id;
  }

  public turnOnLogging() {
    this.active = true;
    showTraceFlagExpiration(this.getExpirationDate().toLocaleString());
  }

  public isValidDateLength() {
    const currDate = new Date().valueOf();
    return (
      this.expirationDate.getTime() - currDate >
      this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_SECOND
    );
  }

  public validateDates() {
    if (!this.isValidDateLength()) {
      this.startDate = new Date();
      this.expirationDate = new Date(
        Date.now() +
          this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_SECOND
      );
    }
  }

  public turnOffLogging() {
    this.active = false;
  }

  public isActive() {
    return this.active;
  }

  public getPrevApexCodeDebugLevel() {
    return this.prevApexCodeDebugLevel;
  }

  public getPrevVFCodeDebugLevel() {
    return this.prevVFDebugLevel;
  }

  public getDebugLevelId() {
    return this.debugLevelId;
  }

  public getTraceFlagId() {
    return this.traceflagId;
  }

  public getStartDate() {
    return this.startDate;
  }

  public getExpirationDate() {
    return this.expirationDate;
  }
}
