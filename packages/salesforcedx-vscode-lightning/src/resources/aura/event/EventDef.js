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
 * @description The Event Definition including the descriptor, type, and attributes.
 * An EventDef instance is created as part of Aura initialization.
 * @constructor
 * @export
 */
function EventDef(config) {
    // In cases where app.js hasn't loaded such as ClientOutOFSync. We only get
    // a string descriptor and not a config bag.
    if (typeof config === "string") {
        this.descriptor = new DefDescriptor(config);
        return;
    }

    this.descriptor = new DefDescriptor(config[Json.ApplicationKey.DESCRIPTOR]);
    // Infer the event super def based on type, ignoring the root event defs
    var superDef = config[Json.ApplicationKey.SUPERDEF];
    if (!superDef && EventDef.KNOWN_SUPER_DEFS.hasOwnProperty(config[Json.ApplicationKey.TYPE])
                  && EventDef.KNOWN_SUPER_DEFS[config[Json.ApplicationKey.TYPE]] !== config[Json.ApplicationKey.DESCRIPTOR]) {
        superDef = EventDef.KNOWN_SUPER_DEFS[config[Json.ApplicationKey.TYPE]];
    }
    this.superDef = this.initSuperDef(superDef);
    this.attributeDefsConfigs = config[Json.ApplicationKey.ATTRIBUTES];
    this.attributeDefs = undefined; // Lazy loaded on getAttributeDefs() access
    this.type = config[Json.ApplicationKey.TYPE];
    this.access=config[Json.ApplicationKey.ACCESS];
}

/**
 * Gets the event descriptor. (e.g. markup://foo:bar)
 * @returns {Object}
 * @export
 */
EventDef.prototype.getDescriptor = function(){
    return this.descriptor;
};

/**
 * Gets the event type.
 * @returns {Object}
 * @export
 */
EventDef.prototype.getEventType = function() {
    return this.type;
};

/**
 * Gets the attribute definitions.
 * @returns {AttributeDef}
 * @export
 */
EventDef.prototype.getAttributeDefs = function() {
    if(this.attributeDefs === undefined) {
        var definitions = [];
        for(var key in this.attributeDefsConfigs) {
            definitions.push(this.attributeDefsConfigs[key]);
        }
        this.attributeDefs = new AttributeDefSet(definitions, this.getDescriptor().getNamespace());
    }
    return this.attributeDefs;
};

/**
 * Gets the event definition for the immediate super type.
 * @returns {EventDef} The EventDef for the immediate super type, or null if none exists (should only be null for aura:event)
 * @export
 */
EventDef.prototype.getSuperDef = function() {
    return this.superDef;
};

/**
 * Initializes the event definition for the immediate super type.
 * @param {Object} superDef The super definition, or null if none exists.
 * @private
 */
EventDef.prototype.initSuperDef = function(superDef) {
    if (superDef) {
        return $A.eventService.createEventDef(superDef);
    } else {
        return null;
    }
};

EventDef.KNOWN_SUPER_DEFS = { "APPLICATION": "markup://aura:applicationEvent",
                              "COMPONENT": "markup://aura:componentEvent",
                              "VALUE": "markup://aura:valueEvent" };

Aura.Event.EventDef = EventDef;
