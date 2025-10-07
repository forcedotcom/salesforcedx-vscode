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
 * @description Creates a FlavorDefaultDef instance.
 * @param {Object} config
 * @constructor
 * @protected
 */
function FlavorDefaultDef(config) {
    this.map = {};

    if (!$A.util.isUndefinedOrNull(config["removeAll"])) {
        this.removeAll = config["removeAll"];
    } else {
        for (var key in config) {
            if (config.hasOwnProperty(key)) {
                this.map[key] = {
                    flavor: config[key]["flavor"]
                };
            }
        }
    }
}

/**
 * Returns a flavor for the given component descriptor.
 * @param {DefDescriptor} componentDescriptor The component descriptor, e.g., "ui:button".
 * @returns {String} The flavor.
 * @private
 */
FlavorDefaultDef.prototype.getFlavor = function(componentDescriptor) {
    if (!$A.util.isUndefinedOrNull(this.removeAll)) {
        if (this.removeAll === "*" || this.removeAll === componentDescriptor.getNamespace()) {
            return "{!remove}";
        }
    }

    var entry = this.map[componentDescriptor.getQualifiedName()];
    if (entry) {
        return entry.flavor;
    }

    return null;
};


Aura.Flavors.FlavorDefaultDef = FlavorDefaultDef;