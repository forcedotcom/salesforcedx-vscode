/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

export type TelemetryReporter = {
  sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void;

  sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void;

  dispose(): Promise<any>;
};
