/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const capitalize = (str: string) => (str.length > 0 ? `${str[0].toUpperCase()}${str.slice(1)}` : str);
