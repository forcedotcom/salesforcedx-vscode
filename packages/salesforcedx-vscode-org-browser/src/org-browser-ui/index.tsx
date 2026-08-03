/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles.css';

const root = document.querySelector('#main');
if (!root) throw new Error('Org Browser root element is missing');

createRoot(root).render(<App />);
