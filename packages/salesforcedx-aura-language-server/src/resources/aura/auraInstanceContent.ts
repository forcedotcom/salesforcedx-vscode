/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is a simplified version of AuraInstance.js content for tern server
// The full content is available in the resources/aura/AuraInstance.js file
export const auraInstanceContent = `/*
 * Copyright (C) 2013 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @class Aura
 * @classdesc The Aura framework. Default global instance name is $A.
 * @constructor
 * @platform
 * @namespace
 * @alias $A
 */
function AuraInstance () {
    this.globalValueProviders = {};
    this.deprecationUsages    = {};
    this.displayErrors        = true;
    this.initializers         = {};

    this.logger               = new Aura.Utils.Logger();
    this.util                 = new Aura.Utils.Util();
    this["util"]              = this.util;

    this.auraError            = Aura.Errors.AuraError;
    this.auraFriendlyError    = Aura.Errors.AuraFriendlyError;

    // Add other essential properties and methods here
    // This is a simplified version for tern server functionality
}`;
