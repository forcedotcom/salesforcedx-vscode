/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as NodeContext from '@effect/platform-node/NodeContext';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import { Effect } from 'effect';
import { withJevServer } from './shared/jevServer.mts';

withJevServer(process.argv[2]).pipe(Effect.scoped, Effect.provide(NodeContext.layer), NodeRuntime.runMain);
