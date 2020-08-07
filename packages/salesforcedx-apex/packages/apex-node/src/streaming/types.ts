/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type StreamingEvent = {
  createdDate: string;
  replayId?: number;
  type: string;
};

export type TestResultMessage = {
  event: StreamingEvent;
  sobject: {
    Id: string;
  };
};

export type StreamMessage = {
  channel: string;
  clientId: string;
  successful?: boolean;
  id?: string;
  data?: TestResultMessage;
  error?: string;
};
