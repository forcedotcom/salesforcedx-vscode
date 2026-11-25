#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { cpSync } from 'node:fs';
import { join } from 'node:path';

//Copy src/resources into out/src/
cpSync('src/resources', join('out', 'src', 'resources'), { recursive: true });
