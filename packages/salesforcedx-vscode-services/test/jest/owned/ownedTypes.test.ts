/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('owned types are import-free', () => {
  const ownedDir = join(__dirname, '..', '..', '..', 'src', 'owned');
  it('no owned/*.ts imports the SF SDK or effect', () => {
    // *Mapper.ts files are the adapter layer (SDR -> owned types) and MAY import the SDK by design;
    // the guard protects only the pure owned TYPE modules.
    for (const f of readdirSync(ownedDir).filter(n => n.endsWith('.ts') && !n.endsWith('Mapper.ts'))) {
      const src = readFileSync(join(ownedDir, f), 'utf8');
      expect(src).not.toMatch(/from ['"]@salesforce\//);
      expect(src).not.toMatch(/from ['"](jsforce|@jsforce\/)/);
      expect(src).not.toMatch(/from ['"]effect/);
    }
  });
});
