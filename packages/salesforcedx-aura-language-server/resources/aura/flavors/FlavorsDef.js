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
 * @description Creates a FlavorsDef instance with a collection of flavor overrides for specific component descriptors.
 * @param {Object} config
 * @constructor
 * @protected
 */
function FlavorsDef(config) {
    this.flavors = []; // ordered by reverse so that last declared wins
    this.cache = {};

    var flavorDefaultDefs = config["flavorDefaultDefs"];
    for(var i = flavorDefaultDefs.length - 1; i >= 0; i--) { // reverse ordering so last one wins
        this.flavors.push(new FlavorDefaultDef(flavorDefaultDefs[i]));
    }
}

/**
 * Returns a flavor for the given component descriptor.
 * @param {DefDescriptor} componentDescriptor The component descriptor.
 */
FlavorsDef.prototype.getFlavor = function(componentDescriptor) {
    var qn = componentDescriptor.getQualifiedName();

    if ($A.util.isUndefined(this.cache[qn])) {
        var found;

        for (var i = 0, len = this.flavors.length; i < len && !found; i++) {
            found = this.flavors[i].getFlavor(componentDescriptor);
        }

        this.cache[qn] = found || null;
    }

    return this.cache[qn];
};

Aura.Flavors.FlavorsDef = FlavorsDef;