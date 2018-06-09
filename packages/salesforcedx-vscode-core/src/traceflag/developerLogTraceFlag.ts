/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { showTraceFlagExpiration } from '../decorators';

export class DeveloperLogTraceFlag {
  private static instance: DeveloperLogTraceFlag;
  private active: boolean;
  private traceflagId: string | undefined;
  private debugLevelId: string | undefined;
  private startDate: Date;
  private expirationDate: Date;

  public MILLISECONDS_PER_SECOND = 60000;
  public LOG_TIMER_LENGTH_MINUTES = 30;

  private constructor() {
    this.active = false;
    this.startDate = new Date();
    this.expirationDate = new Date();
  }

  public static getInstance() {
    if (!DeveloperLogTraceFlag.instance) {
      DeveloperLogTraceFlag.instance = new DeveloperLogTraceFlag();
    }
    return DeveloperLogTraceFlag.instance;
  }

  public setTraceFlagDebugLevelInfo(
    id: string,
    startDate: string,
    expirationDate: string,
    debugLevelId: string
  ) {
    this.traceflagId = id;
    this.startDate = new Date(startDate);
    this.expirationDate = new Date(expirationDate);
    this.debugLevelId = debugLevelId;
    this.active = true;
  }

  public setDebugLevelId(debugLevelId: string) {
    this.debugLevelId = debugLevelId;
  }

  public setTraceFlagId(id: string) {
    this.traceflagId = id;
  }

  public turnOnLogging() {
    this.active = true;
    showTraceFlagExpiration(this.getExpirationDate());
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
    this.debugLevelId = undefined;
    this.traceflagId = undefined;
    this.active = false;
  }

  public isActive() {
    return this.active;
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
