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
 * @class ComponentDef
 *
 * Constructs a new ComponentDef object, which is a component definition.
 * A ComponentDef instance is created as part of Aura initialization.
 *
 * @constructor
 * @protected
 * @export
 */
function ComponentDef(config) {
    var descriptor = new DefDescriptor(config[Json.ApplicationKey.DESCRIPTOR]);
    this.descriptor = descriptor;
    this.hasRemoteDeps = descriptor.toString().indexOf("layout://") !== 0 && (config[Json.ApplicationKey.HASSERVERDEPENDENCIES] || false);
    this.access = config[Json.ApplicationKey.ACCESS];

    this.styleDef = config[Json.ApplicationKey.STYLEDEF] ? new StyleDef(config[Json.ApplicationKey.STYLEDEF]) : undefined;
    this.flavoredStyleDef = config[Json.ApplicationKey.FLAVOREDSTYLEDEF] ? new StyleDef(config[Json.ApplicationKey.FLAVOREDSTYLEDEF]) : undefined;

    this.controllerDef = config[Json.ApplicationKey.CONTROLLERDEF] ? $A.componentService.createControllerDef(config[Json.ApplicationKey.CONTROLLERDEF]) : undefined;
    this.modelDef = config[Json.ApplicationKey.MODELDEF] ? $A.componentService.createModelDef(config[Json.ApplicationKey.MODELDEF]) : undefined;
    this.methodDefs = config[Json.ApplicationKey.METHODDEFS] ? config[Json.ApplicationKey.METHODDEFS]: undefined;
    this.tokens = config[Json.ApplicationKey.TOKENS] ? config[Json.ApplicationKey.TOKENS] : undefined;
    this.minVersion = config[Json.ApplicationKey.MINVERSION] ? config[Json.ApplicationKey.MINVERSION] : undefined;

    this.interfaces = {};
    var intfConfig = config[Json.ApplicationKey.INTERFACES];
    if (intfConfig) {
        for (var m = 0; m < intfConfig.length; m++) {
            var intf = new DefDescriptor(intfConfig[m]);
            var intfName = intf.getFullName();
            this.interfaces[intfName] = true;
        }
    }

    // Initialize superDef, defaulting to an aura:component unless dealing with an aura:rootComponent
    var superDef = config[Json.ApplicationKey.SUPERDEF];
    if (superDef === undefined && !this.interfaces["aura:rootComponent"]) {
        superDef = "markup://aura:component";
    }

    this.superDef = this.initSuperDef(superDef);
    // Initialize the concrete component class if provided
    if (config.hasOwnProperty(Json.ApplicationKey.COMPONENTCLASS)) {
        try {
            var componentClass = $A.clientService.evalExporter(config[Json.ApplicationKey.COMPONENTCLASS], descriptor.toString());
            componentClass();
        } catch (e) {
            var auraError = new $A.auraError("ComponentDef initialization error", e);
            auraError.setComponent(descriptor.getQualifiedName());
            throw auraError;
        }
    }

    var appHandlerDefs;
    var cmpHandlerDefs;
    var valueHandlerDefs;

    this.facets = config[Json.ApplicationKey.FACETS];
    this.isAbs = !!config[Json.ApplicationKey.ABSTRACT];

    if (config[Json.ApplicationKey.LOCATIONCHANGEEVENTDEF]) {
        this.locationChangeEventDef = $A.eventService.createEventDef(config[Json.ApplicationKey.LOCATIONCHANGEEVENTDEF]);
    } else {
        this.locationChangeEventDef = null;
    }

    var registerEventDefs = {};
    this.registerEventDefs = registerEventDefs;
    var allEvents = [];
    this.allEvents = allEvents;
    var cred = config[Json.ApplicationKey.REGISTEREVENTDEFS];
    if (cred) {
        for (var i = 0; i < cred.length; i++) {
            var regConfig = cred[i];
            var name = regConfig[Json.ApplicationKey.NAME];
            allEvents.push(name);
            var eventDef = {};
            eventDef[Json.ApplicationKey.DESCRIPTOR] = regConfig[Json.ApplicationKey.EVENTDEF];
            registerEventDefs[name] = $A.eventService.createEventDef(eventDef);
        }
    }

    var handlerDefConfigs = config[Json.ApplicationKey.HANDLERDEFS];
    if (handlerDefConfigs) {
        for (var j = 0; j < handlerDefConfigs.length; j++) {
            var handlerConfig = handlerDefConfigs[j];
            if (handlerConfig[Json.ApplicationKey.EVENTDEF]) {
                // We cannot modify handlerConfig directly, as it is sometimes stored in localStorage.
                // and the json serialize-deserialize loses the object prototype.
                if (handlerConfig[Json.ApplicationKey.NAME]) {
                    if (!cmpHandlerDefs) {
                        cmpHandlerDefs = [];
                    }
                    cmpHandlerDefs.push({
                        "name"          : handlerConfig[Json.ApplicationKey.NAME],
                        "action"        : handlerConfig[Json.ApplicationKey.ACTION],
                        "phase"         : handlerConfig[Json.ApplicationKey.PHASE],
                        "includeFacets" : handlerConfig[Json.ApplicationKey.INCLUDEFACETS],
                        "eventDef"      : $A.eventService.createEventDef(handlerConfig[Json.ApplicationKey.EVENTDEF])
                    });
                } else {
                    if (!appHandlerDefs) {
                        appHandlerDefs = [];
                    }
                    appHandlerDefs.push({
                        "action"        : handlerConfig[Json.ApplicationKey.ACTION],
                        "phase"         : handlerConfig[Json.ApplicationKey.PHASE],
                        "includeFacets" : handlerConfig[Json.ApplicationKey.INCLUDEFACETS],
                        "eventDef"      : $A.eventService.createEventDef(handlerConfig[Json.ApplicationKey.EVENTDEF])
                    });
                }

            } else if (handlerConfig[Json.ApplicationKey.VALUE]) {
                if (!valueHandlerDefs) {
                    valueHandlerDefs = [];
                }
                valueHandlerDefs.push({
                    "name"          : handlerConfig[Json.ApplicationKey.NAME],
                    "action"        : handlerConfig[Json.ApplicationKey.ACTION],
                    "value"         : handlerConfig[Json.ApplicationKey.VALUE]
                });
            } else {
                if (!cmpHandlerDefs) {
                    cmpHandlerDefs = [];
                }
                cmpHandlerDefs.push({
                    "name"          : handlerConfig[Json.ApplicationKey.NAME],
                    "action"        : handlerConfig[Json.ApplicationKey.ACTION]
                });
            }

        }
    }
    var subDefs = config[Json.ApplicationKey.SUBDEFS];
    if (subDefs) {
        for (var k = 0; k < subDefs.length; k++) {
            $A.componentService.getDef(subDefs[k]);
        }
    }

    this.appHandlerDefs = appHandlerDefs || null;
    this.cmpHandlerDefs = cmpHandlerDefs || null;
    this.valueHandlerDefs = valueHandlerDefs || null;
    this.isCSSPreloaded = config[Json.ApplicationKey.CSSPRELOADED] || false;

    if (config[Json.ApplicationKey.DEFAULTFLAVOR]) {
        this.defaultFlavor = config[Json.ApplicationKey.DEFAULTFLAVOR];
    }
    if (config[Json.ApplicationKey.FLAVORABLECHILD]) {
        this.flavorableChild = true;
    }
    if (config[Json.ApplicationKey.DYNAMICALLYFLAVORABLE]) {
        // TODONM remove
        this.dynamicallyFlavorable = config[Json.ApplicationKey.DYNAMICALLYFLAVORABLE];
    }

    if (config[Json.ApplicationKey.FLAVOROVERRIDES]) { // for applications
        this.flavorOverrides = new FlavorsDef(config[Json.ApplicationKey.FLAVOROVERRIDES]);
    }

    if (config[Json.ApplicationKey.LOCATORDEFS]) {
        this.locatorDefs = config[Json.ApplicationKey.LOCATORDEFS];
    }

    this.attributeDefs = new AttributeDefSet(config[Json.ApplicationKey.ATTRIBUTEDEFS],this.descriptor.getNamespace());
    this.requiredVersionDefs = new RequiredVersionDefSet(config[Json.ApplicationKey.REQUIREDVERSIONDEFS]);
    this.initStyleDefs();
    this.hasInitHandler;
}

ComponentDef.prototype.hasInit = function() {
    if (this.hasInitHandler === undefined) {
        if (!this.valueHandlerDefs) {
            this.hasInitHandler = false;
        } else {
            for(var c=0;c<this.valueHandlerDefs.length;c++) {
                if(this.valueHandlerDefs[c].name === "init") {
                    this.hasInitHandler = true;
                    return this.hasInitHandler;
                }
            }
        }
        this.hasInitHandler = false;
    }
    return this.hasInitHandler;
};

/**
 * Returns a DefDescriptor object.
 *
 * @returns {DefDescriptor} A DefDescriptor object contains a prefix, namespace,
 *          and name.
 * @export
 */
ComponentDef.prototype.getDescriptor = function() {
    return this.descriptor;
};

/**
 * Checks whether the Component is abstract. Returns true if the component is
 * abstract.
 *
 * @returns {Boolean} True if component is abstract, or false otherwise.
 * @export
 */
ComponentDef.prototype.isAbstract = function() {
    return this.isAbs;
};

/**
 * Returns the component definition for the immediate super type or null if none
 * exists (should only be null for aura:component).
 *
 * @return {ComponentDef} The ComponentDef for the immediate super type
 * @export
 */
ComponentDef.prototype.getSuperDef = function() {
    return this.superDef;
};

/**
 * Gets the Helper instance. This method is for backward compatibility,
 * the helper is now an integral part of the component class.
 *
 * @returns {Helper}
 * @export
 */
ComponentDef.prototype.getHelper = function() {
    var name = this.descriptor.getQualifiedName();
    var componentClass = $A.componentService.getComponentClass(name);
    return componentClass ? componentClass.prototype["helper"] : undefined;
};

/**
 * Returns RequiredVersionDef objects.
 *
 * @returns {RequiredVersionDefs}
 */
ComponentDef.prototype.getRequiredVersionDefs = function() {
    return this.requiredVersionDefs;
};

/**
 * Checks whether the component has remote dependencies. Returns true if remote
 * dependencies are found.
 *
 * @returns {Boolean} True if remote dependencies exist, or false otherwise.
 */
ComponentDef.prototype.hasRemoteDependencies = function() {
    return this.hasRemoteDeps;
};

/**
 * Gets all the StyleDef objects, including inherited ones, for this
 * ComponentDef.
 *
 * @returns {StyleDef}
 */
ComponentDef.prototype.getAllStyleDefs = function() {
    return this.allStyleDefs;
};

/**
 * Gets all the FlavoredStyleDef objects, including inherited ones, for this
 * ComponentDef.
 *
 * @returns {StyleDef}
 */
ComponentDef.prototype.getAllFlavoredStyleDefs = function() {
    return this.allFlavoredStyleDefs;
};

/**
 * Gets the CSS class name to use for Components of this type. Includes the
 * class names from all StyleDefs, including inherited ones, associated with
 * this ComponentDef. If multiple class names are found, the return value is a
 * space-separated list of class names. This string can be applied directly to
 * DOM elements rendered by Components of this type.
 *
 * @returns {String} The style class name
 * @export
 */
ComponentDef.prototype.getStyleClassName = function() {
    var className = this.styleClassName;
    if (!className) {
        className = "";
        var styleDefs = this.getAllStyleDefs();
        if (styleDefs) {
            var styleDefLen = styleDefs.length;
            for (var t = 0; t < styleDefLen; t++) {
                var styleDef = styleDefs[t];
                className = className + styleDef.getClassName() + " ";
                // Preloaded CSS should already be included in app.css
                if (!this.isCSSPreloaded) {
                    styleDef.apply();
                }
            }

        }
        this.styleClassName = className;

        // also load flavored styles if necessary
        if (!this.isCSSPreloaded) {
            var flavoredStyleDefs = this.getAllFlavoredStyleDefs();
            if (flavoredStyleDefs) {
                for (var i = 0, len = flavoredStyleDefs.length; i < len; i++) {
                    flavoredStyleDefs[i].apply();
                }
            }
        }
    }
    return className;
};

/**
 * Gets the style definition. Returns a StyleDef object.
 *
 * @returns {StyleDef}
 * @export
 */
ComponentDef.prototype.getStyleDef = function() {
    return this.styleDef;
};

/**
 * Gets the default flavor name, either from app-specified overrides or the
 * default specified on the component def.
 *
 * @returns {String} The flavor, e.g., "default" or "xyz.flavors.default", etc...
 * @export
 */
ComponentDef.prototype.getDefaultFlavor = function() {
    if ($A.util.isUndefined(this.flavorOverride)) {
        var override = null;

        var appDesc = $A.getContext().getApp();
        if (appDesc) {
            var appDef = $A.componentService.getDef(appDesc, true);
            if (appDef) { // might be null if there's a problem loading the app
                var defaults = appDef.getFlavorOverrides();
                if (defaults) {
                    override = defaults.getFlavor(this.descriptor);
                    if (override === "{!remove}") {
                        override = "";
                    }
                }
            }
        }

        this.flavorOverride = $A.util.isUndefinedOrNull(override) ? null : override;
    }

    return !$A.util.isUndefinedOrNull(this.flavorOverride) ? this.flavorOverride : this.getExplicitDefaultFlavor();
};

/**
 * Gets the default flavor explicitly set on the component def (or one of its supers).
 *
 * @returns {String}
 */
ComponentDef.prototype.getExplicitDefaultFlavor = function() {
    if (!$A.util.isUndefinedOrNull(this.defaultFlavor)) {
        return this.defaultFlavor;
    }
    if (this.superDef) {
        return this.superDef.getExplicitDefaultFlavor();
    }
    return null;
};

/**
 * Gets whether this def has at least one flavorable child element.
 *
 * @returns {Boolean}
 * @export
 */
ComponentDef.prototype.hasFlavorableChild = function() {
    return !!this.flavorableChild;
};

/**
 * Gets the set of default flavor overrides.
 *
 * @returns {FlavorsDef}
 * @export
 */
ComponentDef.prototype.getFlavorOverrides = function() {
    return this.flavorOverrides;
};

/**
 * Returns true if this or a super component is dynamically flavorable.
 * Performs a faster check than #getDynamicallyFlavorable.
 * @returns {Boolean}
 * @private
 */
ComponentDef.prototype.isDynamicallyFlavorable = function() {
    return this.dynamicallyFlavorable || (this.superDef && this.superDef.isDynamicallyFlavorable());
};

/**
 * Returns a list of component defs from the inheritance hierarchy that are
 * marked dynamically flavorable, including this one if applicable.
 *
 * To simply perform a boolean check, use #isDynamicallyFlavorable instead.
 * @returns {Array}
 * @private
 */
ComponentDef.prototype.getDynamicallyFlavorable = function() {
    var ret = [];
    if (this.dynamicallyFlavorable) {
        ret.push(this);
    }
    if (this.superDef) {
        ret = ret.concat(this.superDef.getDynamicallyFlavorable());
    }
    return ret;
};

/**
 * Gets all the attribute definitions. Returns an AttributeDef object.
 *
 * @returns {AttributeDefSet}
 * @export
 */
ComponentDef.prototype.getAttributeDefs = function() {
    return this.attributeDefs;
};

/**
 * Gets the component facets. A facet is any attribute of type Aura.Component[].
 *
 * @returns {Object}
 * @export
 */
ComponentDef.prototype.getFacets = function() {
    return this.facets;
};


/**
 * Gets Facet by facet descriptor
 * @param  {String} facetName The name of the facet. If the attribute name was param1, then facetName would be "param1". Does not handle v., so v.param1 would not work.
 * @return {Object}           The facet descriptor. Is current an object with two properties, descriptor which is the facetName you specified, and value which is the contents of the facet.
 */
ComponentDef.prototype.getFacet = function(facetName) {
    if(!this.facetMap) {
        var facetMap = {};
        if(this.facets) {
            var facets = this.facets;
            for(var c=0,length=facets.length;c<length;c++){
                facetMap[facets[c]["descriptor"]] = facets[c];
            }
        }
        this.facetMap = facetMap;
    }

    // hasOwnProperty to prevent us returning a function when someone names their facet "toString"
    return this.facetMap.hasOwnProperty(facetName) ? this.facetMap[facetName] : undefined;
};

/**
 * Gets the controller definition. Returns a ControllerDef object.
 *
 * @returns {ControllerDef}
 * @export
 */
ComponentDef.prototype.getControllerDef = function() {
    return this.controllerDef;
};

/**
 * Gets the model definition. Returns a ModelDef object.
 *
 * @returns {ModelDef}
 * @export
 */
ComponentDef.prototype.getModelDef = function() {
    return this.modelDef;
};

/**
 * Value Event Enum
 *
 * @returns {ModelDef}
 */
ComponentDef.valueEvents = {
    "change" : "aura:valueChange",
    "destroy": "aura:valueDestroy",
    "init"   : "aura:valueInit",
    "render" : "aura:valueRender"
};

/**
 * Returns the event definitions.
 *
 * @param {String}
 *            The name of the event definition.
 * @param {Boolean}
 *            includeValueEvents Set to true to include the value events.
 * @returns{Object}
 * @export
 */
ComponentDef.prototype.getEventDef = function(name, includeValueEvents) {
    var ret = this.registerEventDefs[name];
    if (!ret && includeValueEvents) {
        if (ComponentDef.valueEvents.hasOwnProperty(name)) {
            name = ComponentDef.valueEvents[name];
        }
        ret=$A.get("e").getDef(name);
    }
    return ret;
};

/**
 * Get an event name by descriptor qualified name.
 *
 * This is only used in the case of an action firing a component event. It is a
 * bit of a hack, but will give back the name of the event that corresponds to
 * the descriptor.
 *
 * @param {String}
 *            descriptor a descriptor qualified name.
 * @return {String} null, or the component fired event name.
 * @protected
 */
ComponentDef.prototype.getEventNameByDescriptor = function(descriptor) {
    for (var name in this.registerEventDefs) {
        if (this.registerEventDefs[name] && this.registerEventDefs[name].descriptor && this.registerEventDefs[name].descriptor.qualifiedName === descriptor) {
            return name;
        }
    }
    return null;
};

/**
 * Gets all events associated with the Component.
 *
 * @returns {Object}
 * @export
 */
ComponentDef.prototype.getAllEvents = function() {
    return this.allEvents;
};

/**
 * Gets the application handler definitions.
 *
 * @returns {Object}
 * @export
 */
ComponentDef.prototype.getAppHandlerDefs = function() {
    return this.appHandlerDefs;
};

/**
 * Gets the component handler definitions.
 *
 * @returns {Object}
 * @export
 */
ComponentDef.prototype.getCmpHandlerDefs = function() {
    return this.cmpHandlerDefs;
};

/**
 * Gets the value of the handler definitions.
 *
 * @returns {Object}
 */
ComponentDef.prototype.getValueHandlerDefs = function() {
    return this.valueHandlerDefs;
};

/**
 * Converts a ComponentDef object to type String.
 *
 * @returns {String}
 * @export
 */
ComponentDef.prototype.toString = function() {
    return this.descriptor.getQualifiedName();
};

/**
 * Checks whether the Component is an instance of the given component name (or
 * interface name).
 *
 * @param {String}
 *            name The name of the component (or interface), with a format of
 *            <code>namespace:componentName</code> (e.g.,
 *            <code>ui:button</code>).
 * @returns {Boolean} True if the Component is an instance, or false otherwise.
 * @export
 */
ComponentDef.prototype.isInstanceOf = function(name) {
    var thisName = this.descriptor.getFullName();
    if (thisName === name || this.implementsDirectly(name)) {
        return true;
    }
    if (this.superDef) {
        return this.superDef.isInstanceOf(name);
    }
    return false;
};

/**
 * Primarily used by isInstanceOf().
 *
 * @private
 */
ComponentDef.prototype.implementsDirectly = function(type) {
    return !$A.util.isUndefined(this.interfaces[type]);
};

/**
 * Gets the location change event. Returns the qualified name of the event in
 * the format <code>markup://aura:locationChange</code>.
 * @export
 */
ComponentDef.prototype.getLocationChangeEvent = function() {
    var evt = this.locationChangeEventDef;
    if (evt) {
        return evt.getDescriptor().getQualifiedName();
    }
    return "markup://aura:locationChange";
};

/**
 * @export
 */
ComponentDef.prototype.getLayouts = function() {
    return this.layouts;
};

/**
 * Returns the component locator definition
 *
 * @returns {Object} LocatorDef Object
 * @export
 */
ComponentDef.prototype.getLocatorDefs = function() {
    return this.locatorDefs;
};

/**
 * @private
 */
ComponentDef.prototype.initSuperDef = function(config) {
    if (!config) {
        return null;
    }

    var superDef = $A.componentService.createComponentDef(config);
    if (!superDef) {
        var failingCmp = this.descriptor.getFullName();
        var superCmp = config["descriptor"]? config["descriptor"] : config;
        var auraError = new $A.auraError("Super component's def (" + superCmp + ") is missing for " + failingCmp);
        auraError.setComponent(failingCmp);
        throw auraError;
    }

    return superDef;
};

/**
 * Setup the style defs details.
 *
 * Note that the style defs are in reverse order so that they get applied in
 * forward order.
 *
 * @private
 */
ComponentDef.prototype.initStyleDefs = function() {
    this.allStyleDefs = [];
    this.allFlavoredStyleDefs = [];

    var s = this.superDef;
    if (s) {
        var superStyles = s.getAllStyleDefs();
        if (superStyles) {
            this.allStyleDefs = this.allStyleDefs.concat(superStyles);
        }
        var superFlavoredStyles = s.getAllFlavoredStyleDefs();
        if (superFlavoredStyles) {
            this.allFlavoredStyleDefs = this.allFlavoredStyleDefs.concat(superFlavoredStyles);
        }
    }
    if (this.styleDef) {
        this.allStyleDefs.push(this.styleDef);
    }
    if (this.flavoredStyleDef) {
        this.allFlavoredStyleDefs.push(this.flavoredStyleDef);
    }
};

/**
 * Returns the minimum API version that a component should be at to use this component
 * @returns {undefined | String}
 * @private
 */
ComponentDef.prototype.getMinVersion = function() {
    return this.minVersion;
};

/**
 * Returns the API Version of the ComponentDef
 *
 * @private
 * @return {String | undefined} The API version string.
 */
ComponentDef.prototype.getApiVersion = function() {
    // Hacky way of getting bundle API version for component def bundles on platform
    if (!$A.clientService.isInternalNamespace(this.descriptor.getNamespace())) {
        var requiredVersionDef = this.getRequiredVersionDefs().getDef("aura");
        return requiredVersionDef ? requiredVersionDef.getVersion() : null;
    }
};

Aura.Component.ComponentDef = ComponentDef;
