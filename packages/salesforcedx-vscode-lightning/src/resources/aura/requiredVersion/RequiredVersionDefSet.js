/*
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
 * Creates a new RequiredVersionDefSet instance.
 * @param {Object} configs For each configs object provided, a new RequiredVersionDef instance is added
 * @constructor
 * @protected
 */
function RequiredVersionDefSet(configs) {
    if (configs) {
        this.values = {};
        for (var i = 0; i < configs.length; i++) {
            var requiredVersionDef = new RequiredVersionDef(configs[i]);
            var ns = requiredVersionDef.getDescriptor().getName();
            this.values[ns] = requiredVersionDef;
        }
    }
}

/**
 * Returns the RequiredVersionDef object.
 * @param {String} name The name of the RequiredVersionDef instance, which matches the qualified name of the requiredVersionDef descriptor.
 * @returns {RequiredVersionDef} An RequiredVersionDef object is stored in a parent definition, such as a ComponentDef object.
 */
RequiredVersionDefSet.prototype.getDef = function(name) {
    var values = this.values;
    if (values) {
        return values[name];
    }
    return null;
};