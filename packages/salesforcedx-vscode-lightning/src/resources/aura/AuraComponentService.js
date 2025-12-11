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
 * @description The Aura Component Service, accessible using <code>$A.componentService</code>.
 * Creates and manages components.
 * @constructor
 * @export
 */
function AuraComponentService() {
    // Def registries
    this.moduleEngine           = Aura["Engine"];
    this.wireService            = Aura["WireService"];

    // remove globals
    delete Aura["Engine"];
    delete Aura["WireService"];

    this.moduleDefRegistry      = {};
    this.moduleRegistry         = {};
    this.componentDefRegistry   = {};
    this.controllerDefRegistry  = {};
    this.actionDefRegistry      = {};
    this.modelDefRegistry       = {};
    this.libraryRegistry        = new Aura.Library.LibraryRegistry();
    this.libraryIncludeRegistry = new Aura.Library.LibraryIncludeRegistry();
    this.componentClassRegistry = new Aura.Component.ComponentClassRegistry();
    this.componentDefLoader     = new Aura.Component.ComponentDefLoader();
    this.componentDefStorage    = new Aura.Component.ComponentDefStorage();
    this.actionStorage          = new Aura.Controller.ActionStorage();
    this.descriptorCasingMap    = {};

    // holds ComponentDef configs to be created
    this.savedComponentConfigs = {};

    // references ControllerDef descriptor to its ComponentDef descriptor
    this.controllerDefRelationship = {};

    // references ActionDef descriptor to its ComponentDef descriptor
    this.actionDefRelationship = {};

    // Global registry for cmp instances
    this.indexes = { globalId : {} };

    this.dynamicNamespaces = []; // TODO: @dval: delete after createComponent refactor

    // Static attr names
    this.flavorable    = "auraFlavorable";
    this.renderedBy    = "auraRenderedBy";
    this["renderedBy"] = this.renderedBy;   // originally exposed using exp()

    // Initialize core modules
    this.initCoreModules();

    // Instrumentation tracking
    this.trackingCreate = false;
}

/**
 * Gets an instance of a component.
 * @param {String} globalId The generated globally unique Id of the component that changes across pageloads.
 *
 * @public
 * @deprecated use getComponent instead
 * @export
 */
AuraComponentService.prototype.get = function(globalId) {
    // $A.deprecated("AuraComponentService.get is no longer supported.","Use '$A.getComponent();'.", "AuraComponentService.get");
    return this.indexes.globalId[globalId];
};

AuraComponentService.prototype.isComponentConstructor = function(Ctor) {
    return typeof Ctor === 'function' && this.moduleEngine["isComponentConstructor"](Ctor);
};

AuraComponentService.prototype.initCoreModules = function () {
    var ProxyObject = window["Proxy"] || {};
    this.addModule("markup://lwc", "lwc", [], null, this.moduleEngine);
    this.addModule("markup://engine", "engine", [], null, this.moduleEngine); // @dval: legacy -> Remove me in 218
    this.addModule("markup://wire-service", "wire-service", [], null, this.wireService);
    this.addModule("markup://assert", "assert", [], null, Aura.ExportsAssert);
    this.addModule("markup://logger", "logger", [], null, Aura.ExportsLogger);
    this.addModule("markup://aura", "aura", [], null, Aura.ExportsModule);
    this.addModule("markup://aura-storage", "aura-storage", [], null, Aura.ExportsStorage);
    this.addModule("markup://aura-instrumentation", "aura-instrumentation", [], null, Aura.ExportsMetricsService);

    // Register proxy-compat helpers
    var proxyPrefix = "proxy-compat/";
    Object.keys(ProxyObject).forEach(function (helper) {
        var moduleName = proxyPrefix + helper;
        this.addModule("markup://" + moduleName, moduleName, [], null, ProxyObject[helper]);
    }.bind(this));
};

/**
 * Adds to the mapping of case mismatched descriptors
 * @export
 */
AuraComponentService.prototype.addDescriptorCaseMapping = function(descriptorFrom, descriptorTo) {
    this.descriptorCasingMap[descriptorFrom] = descriptorTo;
};

/**
 * Gets an instance of a component from either a GlobalId or a DOM element that was created via a Component Render.
 * @param {Object} identifier that is either a globalId or an element.
 *
 * @public
 * @platform
 * @export
 */
AuraComponentService.prototype.getComponent = function(identifier) {
    return this.get(identifier) || this.getRenderingComponentForElement(identifier);
};

/**
 *  Validates as best it can that the config bag you specified is a ComponentDefRef that
 *  we can use to create instances of components from.
 */
AuraComponentService.prototype.isComponentDefRef = function(config) {
    if(!$A.util.isObject(config)) {
        return false;
    }

    var descriptor = config[Json.ApplicationKey.DESCRIPTOR] || config["descriptor"] || (config["componentDef"] && config["componentDef"]["descriptor"]);

    return descriptor !== null && descriptor !== undefined;
};

/**
 * Gets descriptor from the config object (for normalization)
 * @param {Object} Controller descriptor config
 * @returns {String} Descriptor
 * @private
 */
AuraComponentService.prototype.getDescriptorFromConfig = function(descriptorConfig) {
    var descriptor = descriptorConfig;

    // if string value was provided, try to extract from object
    if (descriptorConfig && typeof descriptorConfig !== 'string') {
        if (descriptorConfig.hasOwnProperty(Json.ApplicationKey.DESCRIPTOR)) {
            descriptor = descriptorConfig[Json.ApplicationKey.DESCRIPTOR];
        }
        else {
            // fallback
            descriptor = descriptorConfig["descriptor"];
        }
    }

    $A.assert(descriptor, "Descriptor for Config required for registration");
    if (this.descriptorCasingMap[descriptor]) {
        $A.deprecated("Descriptor case sensitivity mismatch, descriptors are case sensitive.",
            "Please find the reference to: " + descriptor + " and change it to: " + this.descriptorCasingMap[descriptor],
            "getDescriptorFromConfig.descriptorCasingMap");
        return this.descriptorCasingMap[descriptor];
    }

    return descriptor;
};

/**
 * Gets descriptor from the config object (for normalization)
 * @param {Object} Controller descriptor config
 * @returns {String} Descriptor
 * @private
 */
AuraComponentService.prototype.createDescriptorConfig = function(descriptorConfig) {
    var descriptor = descriptorConfig;

    // if string value was provided, try to extract from object
    if (descriptorConfig && typeof descriptorConfig !== 'string') {
        if (descriptorConfig.hasOwnProperty(Json.ApplicationKey.DESCRIPTOR)) {
            descriptor = descriptorConfig[Json.ApplicationKey.DESCRIPTOR];
        }
        else {
            // fallback
            descriptor = descriptorConfig["descriptor"];
        }
    }

    descriptor = descriptor.indexOf("://") < 0 ? "markup://" + descriptor : descriptor;
    return { "descriptor" : descriptor };
};


/**
 * Counts all the components currently created in the application.
 * @example
 * var count = $A.componentService.countComponents();
 *
 * @public
 * @platform
 * @export
 */
AuraComponentService.prototype.countComponents = function() {
    return Object.keys(this.indexes.globalId).length;
};

/**
 * Calculates the locator for a given component and target
 *
 * @returns A fully resolved locator rooted at targetCmp
 * @param {Component} cmp The component that contains a locator targeting targetCmp
 * @param {String} targetCmp The component inside cmp that is targeted by a locator in cmp
 * @public
 * @export
 */
AuraComponentService.prototype.getComponentLocator = function(cmp, targetCmp, includeMetadata) {
    $A.assert(cmp, 'No component provided');
    return cmp.getLocator(targetCmp, includeMetadata);
};

/**
 * Gets the rendering component for the provided element recursively.
 * @param {Object} element The element that is used to find the rendering component
 * @memberOf AuraComponentService
 * @public
 * @export
 */
AuraComponentService.prototype.getRenderingComponentForElement = function(element) {
    var ret;

    if ($A.util.isUndefinedOrNull(element)) {
        return null;
    }

    if ($A.util.hasDataAttribute(element, this.renderedBy)) {
        var id = $A.util.getDataAttribute(element, this.renderedBy);
        ret = this.get(id);

    } else if(element.parentNode) {
        ret = this.getRenderingComponentForElement(element.parentNode);
    }

    return ret;
};

/**
 * Gets the attribute provider for the provided element.
 * @param {Object} element The element whose attribute provider is to be returned
 * @memberOf AuraComponentService
 * @public
 * @export
 */
AuraComponentService.prototype.getAttributeProviderForElement = function(element) {
    return this.getRenderingComponentForElement(element).getAttributeValueProvider();
};

/**
 * Determines if the container contains cmp. The return value is an object
 * with two properties.
 *      - {Boolean} "result" true if container contains cmp; false otherwise
 *      - {Boolean} "isOwner" true if the containment is within the owner hierarchy;
 *          false if the containment is only by transclusion
 * @param {Component} container the container
 * @param {Component} cmp cmp to check
 * @return {Object}
 * @private
 */
AuraComponentService.prototype.containsComponent = (function() {

    function contains(container, cmp, visited, isOwner) {
        if(container === cmp) {
            return {
                result: true,
                isOwner: isOwner
            };
        }

        if(!cmp || !container || visited[cmp.globalId]) {
            return {
                result: false
            };
        }

        visited[cmp.globalId] = true;

        // check super
        var answer = contains(container, cmp.getSuper(), visited, isOwner);

        // check CVP
        if(!answer.result) {
            var next = cmp;
            // loop until we find the next level
            while(next) {
                next = next.getOwner();
                if (next === cmp || !($A.util.isComponent(next))) {
                    // We are at the top-level now, so we are done
                    return {
                        result: false
                    };
                }

                if (next.getGlobalId() !== cmp.getGlobalId()) {
                    // Reached a facet value provider
                    answer = contains(container, next, visited, isOwner);
                    // stop looping, the call above will recurse up the tree
                    break;
                }
                else {
                    // keep going
                    cmp = next;
                }
            }
        }

        // check parent (non-value provider)
        if(!answer.result) {
            answer = contains(container, cmp.getContainer(), visited, false);
        }

        return answer;
    }

    return function(container, cmp) {
        return contains(container, cmp, {}, true);
    };
})();


/**
 * Create a new component array.
 * @private
 */
AuraComponentService.prototype.newComponentArray = function(config, attributeValueProvider, localCreation, doForce){
    var ret = [];
    for (var i = 0; i < config.length; i++) {
        ret.push(this.newComponentDeprecated(config[i], attributeValueProvider, localCreation, doForce));
    }
    return ret;
};

/**
 * Create a component from a type and a set of attributes.
 * It accepts the name of a type of component, a map of attributes,
 * and a callback to notify callers.
 *
 * @param {String} type The type of component to create, e.g. "ui:button".
 * @param {Object} attributes A map of attributes to send to the component. These take the same form as on the markup,
 * including events <code>{"press":component.getReference("c.handlePress")}</code>, and id <code>{"aura:id":"myComponentId"}</code>.
 * @param {Function} callback The method to call, to which it returns the newly created component.
 *
 * @example
 * $A.createComponent("aura:text",{value:'Hello World'}, function(auraTextComponent, status, statusMessagesList){
 *      // auraTextComponent is an instance of aura:text containing the value Hello World
 * });
 *
 * @public
 * @platform
 * @export
 */
AuraComponentService.prototype.createComponent = function(type, attributes, callback) {
    $A.assert($A.util.isString(type), "ComponentService.createComponent(): 'type' must be a valid String.");
    $A.assert(!attributes || $A.util.isObject(attributes), "ComponentService.createComponent(): 'attributes' must be a valid Object.");
    $A.assert($A.util.isFunction(callback), "ComponentService.createComponent(): 'callback' must be a Function pointer.");

    if (type.indexOf(':') < 0){
        attributes = {
            "tag":type,
            "HTMLAttributes":attributes
        };
        type = "aura:html";
    }

    var config = {
        "componentDef" : this.createDescriptorConfig(type),
        "attributes"   : { "values" : attributes },
        "localId"      : attributes && attributes["aura:id"],
        "flavor"       : (attributes && attributes["aura:flavor"]),
        "skipCreationPath": true
    };

    this.createComponentPrivAsync(config, callback);
};


/*
 * Creates an internal object config for a component from a public config.
 *
 * This is only used by createComponentFromConfig to separate the internal
 * representation from the external representation.
 * If we change the component format, we could change this method
 * without breaking anyone's code.
 *
 * @function
 */
AuraComponentService.prototype.createInternalConfig = function (config) {
    var descriptor = config["descriptor"];
    $A.assert(descriptor.indexOf("markup://") === 0, "Descriptor needs to be of the format markup://ns:name");

    return {
        "componentDef"     : this.createDescriptorConfig(config["descriptor"]),
        "localId"          : config["localId"] || config["aura:id"],
        "flavor"           : config["flavor"],
        "skipCreationPath" : config["skipCreationPath"],
        "attributes"       : {
            "values"        : config["attributes"],
            "valueProvider" : config["valueProvider"]
        }
    };
};

/**
 * Creates a component from a config.
 *
 * It accepts a config Object generated directly by the framework
 * or a custom manually created config (see notes for details).
 *
 * IMPORTANT NOTES:
 *
 * - It's key that we separate the internal representation of a component
 * from the external one (publicly available), so we can always improve
 * and change the framework implementation without breaking anything.
 *
 * - Passing a user generated config is discouraged (instead createComponent
 * should be used). This method will only work for clientCreatable components
 * and for very simple use cases.
 *
 * @param {Object} config A map with the component tree configuration,
 * the configuration can be external (publicly exposed) or internal.
 *
 * {
        descriptor    : "markup://ns:cmpName",
        localId       : "localId",
        flavor        : "flavor",
        attributes    : { attr1: value1, ... },
        valueProvider : myValueProviderComponent
 * }
 *
 * @public
 * @function
 * @deprecated use <code>createComponent(String type, Object attributes, function callback)</code> instead.
 * @export
 */
AuraComponentService.prototype.createComponentFromConfig = function(config) {
    $A.assert(config, "Config is required to create a component");

    // The assumption is, that if we have a first level "descriptor" property
    // is a user created config, otherwise we assume it is a private one
    // NOTE @dval: I know this is a weak assumption, but we can always enforce something more
    // reliable in the future if we need to.
    if (config["descriptor"]) {
        config = this.createInternalConfig(config);
    }

    if (!config["attributes"] ) {
        config["attributes"] = {};
    }

    return this.createComponentPriv(config);
};

/**
 * Create an array of components from a list of types and attributes.
 * It accepts a list of component names and attribute maps, and a callback
 * to notify callers.
 *
 * @param {Array} components The list of components to create, e.g. <code>["ui:button",{"press":component.getReference("c.handlePress")}]</code>
 * @param {Function} callback The method to call, to which it returns the newly created components.
 *
 * @example $A.createComponents([
 *      ["aura:text",{value:'Hello'}],
 *      ["ui:button",{label:'Button'}],
 *      ["aura:text",{value:'World'}]
 *  ],function(components,status,statusMessagesList){
 *      // Components is an array of 3 components
 *      // 0 - Text Component containing Hello
 *      // 1 - Button Component with label Button
 *      // 2 - Text component containing World
 *  });
 *
 * @public
 * @platform
 * @function
 * @export
 */
AuraComponentService.prototype.createComponents = function(components, callback) {
    $A.assert($A.util.isArray(components), "ComponentService.createComponents(): 'components' must be a valid Array.");
    $A.assert($A.util.isFunction(callback),"ComponentService.createComponents(): 'callback' must be a Function pointer.");

    var created=[];
    var overallStatus="SUCCESS";
    var statusList=[];
    var collected=0;

    function getCollector(index){
        return function(component, status, statusMessage) {
            created[index] = component;
            statusList[index] = {"status":status,"message":statusMessage};
            if(status==="ERROR"||(status==="INCOMPLETE"&&overallStatus!=="ERROR")) {
                overallStatus = status;
            }
            if (++collected === components.length) {
                callback(created,overallStatus,statusList);
            }
        };
    }

    for(var i=0;i<components.length;i++){
        this.createComponent(components[i][0],components[i][1],getCollector(i));
    }
};

/**
 * newComponent() calls newComponentDeprecated().
 * @param {Object} config Use config to pass in your component definition and attributes. Supports lazy or exclusive loading by passing in "load": "LAZY" or "load": "EXCLUSIVE"
 * @param {Object} attributeValueProvider The value provider for the attributes
 *
 * @public
 * @deprecated use createComponent instead
 * @export
 */
AuraComponentService.prototype.newComponent = function(config, attributeValueProvider, localCreation, doForce){
    $A.deprecated("$A.newCmp and $A.componentService.newComponent are no longer supported.",
        "Use '$A.createComponent();'.", "AuraComponentService.newComponent");
    return this.newComponentDeprecated(config, attributeValueProvider, localCreation, doForce);
};


/**
 * Creates a new component on the client or server and initializes it. For example <code>$A.services.component.newComponentDeprecated("ui:inputText")</code>
 * creates a <code>ui:inputText</code> component.
 * @param {Object} config Use config to pass in your component definition and attributes. Supports lazy or exclusive loading by passing in "load": "LAZY" or "load": "EXCLUSIVE"
 * @param {Object} attributeValueProvider The value provider for the attributes
 *
 * @platform
 * @function
 * @deprecated use createComponent instead
 * @export
 */
AuraComponentService.prototype.newComponentDeprecated = function(config, attributeValueProvider, localCreation, doForce){
    $A.deprecated("$A.newCmpDeprecated and $A.componentService.newComponentDeprecated are not supported.",
        "Use '$A.createComponent();'.", "AuraComponentService.newComponentDeprecated");

    $A.assert(config, "config is required in ComponentService.newComponentDeprecated(config)");

    if ($A.util.isArray(config)){
        return this.newComponentArray(config, attributeValueProvider, localCreation, doForce);
    }

    var configObj = this.getComponentConfigs(config, attributeValueProvider);

    var def = configObj["definition"],
        desc = configObj["descriptor"],
        load;

    config = configObj["configuration"];

    if (doForce !== true && !config["creationPath"]) {
        if (def && !def.hasRemoteDependencies()) {
            localCreation = true;
            delete config["load"];
        } else if (!config["load"]) {
            load = "LAZY";
        } else {
            load = config["load"];
        }
    }

    if (desc === "markup://aura:placeholder") {
        load = null;
    }

    if (load === "LAZY" || load === "EXCLUSIVE") {
        localCreation = true;
        var oldConfig = config;
        config = {
            "componentDef": {
                "descriptor": "markup://aura:placeholder"
            },
            "localId": oldConfig["localId"],

            "attributes": {
                "values": {
                    "refDescriptor": desc,
                    "attributes": oldConfig["attributes"] ? oldConfig["attributes"]["values"] : null,
                    "exclusive": (oldConfig["load"] === "EXCLUSIVE")
                },
                "valueProvider":oldConfig["valueProvider"]
            }
        };
    } else {
        // Server should handle the case of an unknown def fetched "lazily"
        if(!$A.clientService.allowAccess(def)) {
            var message="Access Check Failed! AuraComponentService.newComponentDeprecated(): '" +
                (def && def.getDescriptor().getQualifiedName()) + "' is not visible to '" +
                $A.clientService.currentAccess + "'.";
            if($A.clientService.enableAccessChecks) {
                if($A.clientService.logAccessFailures){
                    $A.error(null,new $A.auraError(message));
                }
                return null;
            }else{
                if($A.clientService.logAccessFailures){
                    $A.warning(message);
                }
                // Intentional fallthrough
            }
        }
    }

    return this.createComponentInstance(config, localCreation, def);
};

/**
 * Takes a config for a component, and creates an instance of the component using the component class of that component.
 * @param {Object} config Config is the same object you would pass to the constructor $A.Component to create a component. This method will use that information to further configure the component class that is created.
 * @param {Boolean} localCreation See documentation on Component.js constructor for documentation on the localCreation property.
 */
AuraComponentService.prototype.createComponentInstance = function(config, localCreation, def) {
    if (!config["skipCreationPath"]) {
        var context = $A.getContext();
        var creationPath;
        var action;
        // allows components to skip creation path checks if it's doing something weird
        // such as wrapping server created components in client created one
        action = context.getCurrentAction();
        if (action) {
            var newConfig;
            var currentPath = action.topPath();

            if (config["creationPath"]) {
                //
                // This is a server side config, so we need to sync ourselves with it.
                // The use case here is that the caller has gotten a returned array of
                // components, and is instantiating them independently. We can warn the
                // user when they do the wrong thing, but we'd actually like it to work
                // for most cases.
                //
                creationPath = action.forceCreationPath(config["creationPath"]);
                action.releaseCreationPath(creationPath);
            } else if (!context.containsComponentConfig(currentPath) && !!localCreation) {
                // skip creation path if the current top path is not in server returned
                // componentConfigs and localCreation
                // KRIS: Not necessary to set this to anything, since if it's null we don't use it.
                //creationPath = "client created";
            } else {
                creationPath = action.getCurrentPath();
            }

            if (creationPath) {
                newConfig = context.getComponentConfig(creationPath);
                if(newConfig) {
                    config["componentDef"] = newConfig["componentDef"];
                }
            }
        }
    }

    // See if there is a component specific class
    var componentDef = config["componentDef"];
    var desc = componentDef[Json.ApplicationKey.DESCRIPTOR] || componentDef;
    // Not sure why you would pass in the ComponentDef as the descriptor, but it's being done.
    if(desc.getDescriptor) {
        desc = desc.getDescriptor().getQualifiedName();
    } else if (desc.getQualifiedName) {
        desc = desc.getQualifiedName();
    } else if (desc.indexOf("://") === -1) {
        desc = "markup://" + desc;
    }

    // KRIS:
    // config["componentClass"] - Result of a getComponent() action
    // config["componentDef"]["componentClass"] - Result of sending component defs back from the server.
    // Always comes back as a function to execute, which defines the component classes.
    var componentClassDef = config["componentClass"] || config["componentDef"][Json.ApplicationKey.COMPONENTCLASS];
    if(componentClassDef && !this.hasComponentClass(desc)) {
        try {
            componentClassDef = $A.util.globalEval(componentClassDef, $A.clientService.getSourceMapsUrl(desc));
        } catch (e) {
            var e1 = new $A.auraError("error in eval of componentClass definition", e);
            e1.setComponent(desc);
            throw e1;
        }
        componentClassDef();
    }

    // create ComponentDef from saved component config if component class has not yet been processed
    if (!this.hasComponentClass(desc)) {
        this.createFromSavedComponentConfigs(desc);
    }

    var classConstructor;
    try {
        classConstructor = this.getComponentClass(desc, def);
    } catch (e) {
        var e2 = new $A.auraError("failure when getting component class definition", e);
        e2.setComponent(desc);
        throw e2;
    }
    if (!classConstructor) {
        throw new $A.auraError("Component class not found: " + desc, null, $A.severity.QUIET);
    }

    return new classConstructor(config, localCreation);
};

/**
 * Use the specified constructor as the definition of the class descriptor.
 * We store them for execution later so we do not load definitions into memory unless they are utilized in getComponentClass.
 * @param {String} descriptor Uses the pattern of namespace:componentName.
 * @param {Function} exporter A function that when executed will return the component object litteral.
 * @export
 */
AuraComponentService.prototype.addComponentClass = function(descriptor, exporter){
    return this.componentClassRegistry.addComponentClass(descriptor, exporter);
};

/**
 * Initialize modules
 * @param {String} descriptor Uses the pattern of namespace:componentName.
 * @param {Function} exporter A function that when executed will return the component object litteral.
 * @export
 */
AuraComponentService.prototype.initModuleDefs = function(modules) {
    var moduleDefRegistry = this.moduleDefRegistry;

    var code = Json.ApplicationKey.CODE;
    var minVersion = Json.ApplicationKey.MINVERSION;
    var access = Json.ApplicationKey.ACCESS;
    var requireLocker = Json.ApplicationKey.REQUIRELOCKER;
    var attributeDefs = Json.ApplicationKey.ATTRIBUTEDEFS;
    var customElement = Json.ApplicationKey.CUSTOMELEMENT;
    var descriptor = Json.ApplicationKey.DESCRIPTOR;
    var lockerReferenceInfo = Json.ApplicationKey.LOCKER_REFERENCE_INFO;

    modules.forEach(function (module) {
        // don't override existing entries
        if (!moduleDefRegistry[module[Json.ApplicationKey.DESCRIPTOR]]) {
            var exporter = { "exporter": module[code] };
            exporter[minVersion] = module[minVersion];
            exporter[access] = module[access];
            exporter[requireLocker] = module[requireLocker];
            exporter[attributeDefs] = module[attributeDefs];
            exporter[customElement] = module[customElement];
            exporter[lockerReferenceInfo] = module[lockerReferenceInfo];
            exporter[descriptor] = module[descriptor];
            moduleDefRegistry[module[descriptor]] = moduleDefRegistry[module[Json.ApplicationKey.NAME]] = exporter;
        }
    });
};

/**
 * Use the specified constructor as the definition of the Module descriptor.
 * @param {String} descriptor Uses the pattern of namespace:componentName.
 * @param {String} name module custom element name
 * @param {Array} list of dependencies
 * @param {Function} exporter A function that when executed will return the component object literal
 * @export
 */
AuraComponentService.prototype.addModule = function(descriptor, name, dependencies, exporterClass, nsexports) {
    if (exporterClass === undefined) {
        // amd define does not include dependencies param if no dependencies.
        return this.addModule(descriptor, name, [], dependencies);
    }

    // set both descriptor and module name entries into registry
    var entry = this.moduleDefRegistry[descriptor] || (this.moduleDefRegistry[descriptor] = this.moduleDefRegistry[name] = {});
    entry.dependencies = dependencies;
    entry.definition = exporterClass;
    entry.descriptor = descriptor;
    entry.moduleName = name;
    entry.ns = nsexports;
};

AuraComponentService.prototype.evaluateModuleDef = function (descriptor) {
    var entry = this.moduleDefRegistry[descriptor] || this.getLibraryAsModule(descriptor);
    var factory;
    var exportns;
    var url;
    var REQUIRELOCKER = Json.ApplicationKey.REQUIRELOCKER;
    var createLockerDescriptor = $A.lockerService.createDescriptor;
    var lockerWrap = $A.lockerService.wrap;

    $A.assert(entry, "Failed to find definition for dependency: " + descriptor);    

    // If we have resolved already the exports (libraries case), return them
    if (entry.ns) {
        return entry.ns;
    }

    if (!entry.dependencies) {
        url = $A.clientService.getSourceMapsUrl(descriptor);
        factory = $A.util.globalEval(entry["exporter"], url);
        factory();
    }

    var namespaceAliases = $A.getContext().moduleNamespaceAliases;

    var deps = entry.dependencies.map(function (name) {
        if (name === 'exports') {
            exportns = {};
            return exportns;
        }

        var desc;
        var depEntry;
        var isScopedImport = name[0] === '@';

        if (isScopedImport) {
            var moduleScope = name.substr(1).split('/')[0];
            return $A.clientService.resolveScopedModuleImport(moduleScope, name);
        } else if (name.indexOf(":") !== -1) {
            // If it only contains a colon, we assume is an aura library (legacy)
            desc = "markup://" + name;
        } else {
            // module dependency
            desc = name;
            // process aliased ns
            var names = name.split('/');
            var ns = names[0];
            var descName = names[1];
            var aliased = namespaceAliases[ns];
            if (aliased) {
                // module name with aliased namespace
                var aliasedDesc = "markup://" + aliased + ":" + descName;
                var aliasedDep = this.moduleDefRegistry[aliasedDesc];
                if (aliasedDep) {
                    // set references to aliased module if it exists
                    depEntry = aliasedDep;
                    desc = aliasedDesc;
                }
            }
        }

        if (!depEntry) {
            depEntry = this.moduleDefRegistry[desc];
        }

        if (depEntry && depEntry.dependencies) {
            var dep = this.moduleDefRegistry[desc];            
            
            if (dep.ns) {
                if (entry[REQUIRELOCKER] || depEntry[REQUIRELOCKER]) {
                    return lockerWrap(dep.ns, createLockerDescriptor(dep), createLockerDescriptor(entry));
                }
                return dep.ns;
            } else {
                // recursive/circular references
                var tmp = function tmp() {
                    if (entry[REQUIRELOCKER] || depEntry[REQUIRELOCKER]) {
                        return lockerWrap(dep.ns, createLockerDescriptor(dep), createLockerDescriptor(entry));
                    }
                    return dep.ns;
                };
                tmp["__circular__"] = true;
                return tmp;
            }
        }

        var resolved = this.evaluateModuleDef(desc);        
        if (entry[REQUIRELOCKER]) {           
            return lockerWrap(resolved, createLockerDescriptor(depEntry), createLockerDescriptor(entry));
        }
        return resolved;
    }, this);

    var Ctor;    
    if (entry.definition && $A.util.isFunction(entry.definition)) {
        if (entry[REQUIRELOCKER]) {
            entry.definition = $A.lockerService.createForModule(entry.definition.toString(), createLockerDescriptor(entry));
        }
        Ctor = entry.definition.apply(undefined, deps);
    }

    Ctor = Ctor || exportns;
    entry.ns = Ctor;

    // Propagate the key from definition to Ctor, will be used to used by locker's piercing hook to look up keys on component instances
    $A.lockerService.trust(entry.definition, Ctor);
    return Ctor;
};

AuraComponentService.prototype.createInteropComponentDef = function (descriptor) {
    var Ctor = this.evaluateModuleDef(descriptor);
    var module = this.moduleDefRegistry[descriptor];
    var interOpCmpDef = new Aura.Component.InteropComponentDef({
        dependencies : module.dependencies,
        definition   : module.definition,
        descriptor   : module.descriptor,
        moduleName   : module.moduleName,
        elementName  : module[Json.ApplicationKey.CUSTOMELEMENT],
        access       : module[Json.ApplicationKey.ACCESS],
        minVersion   : module[Json.ApplicationKey.MINVERSION],
        attributeDefs: module[Json.ApplicationKey.ATTRIBUTEDEFS],
        interopClass : Ctor
    });

    this.componentDefRegistry[descriptor] = interOpCmpDef;

    return interOpCmpDef;
};

/**
 * Get the class constructor for the specified component.
 * @param {String} descriptor use either the fqn markup://prefix:name or just prefix:name of the component to get a constructor for.
 * @returns Either the class that defines the component you are requesting, or undefined if not found.
 * @export
 */
AuraComponentService.prototype.getComponentClass = function(descriptor, def) {
    return this.componentClassRegistry.getComponentClass(descriptor, def);
};

/**
 * Initializes event configs
 * @export
 */
AuraComponentService.prototype.initEventDefs = function(evtConfigs) {
    for (var i = 0; i < evtConfigs.length; i++) {
        $A.eventService.saveEventConfig(evtConfigs[i]);
    }
};

/**
 * Initializes library configs
 * @export
 */
AuraComponentService.prototype.initLibraryDefs = function(libraryConfigs) {
    for (var i = 0; i < libraryConfigs.length; i++) {
        $A.componentService.saveLibraryConfig(libraryConfigs[i]);
    }
};

/**
 * Init controller configs
 * @export
 */
AuraComponentService.prototype.initControllerDefs = function(controllerConfigs) {
    for (var i = 0; i < controllerConfigs.length; i++) {
        $A.componentService.createControllerDef(controllerConfigs[i]);
    }
};

/**
 * Detects of the component class has been already defined without actually defining it.
 * hasComponentClass is more performant that running getComponentClass() since if the class
 * hasn't been built yet, we don't want it to be forcably built if not requested.
 *
 * @param {String} descriptor The qualified name of the component to check in the form prefix:componentname or protocol://prefix:componentname
 */
AuraComponentService.prototype.hasComponentClass = function(descriptor) {
    return this.componentClassRegistry.hasComponentClass(descriptor);
};

/**
 * Asynchronous version of newComponent(). Creates a new component and
 * calls your provided callback with the completed component regardless of any server-side dependencies.
 *
 * @param {Object} callbackScope The "this" context for the callback (null for global)
 * @param {Function} callback The callback to use once the component is successfully created
 * @param {Object} config The componentDef descriptor and attributes for the new component
 * @param {Object} attributeValueProvider The value provider for the attributes
 * @param {Boolean} [localCreation] Whether created client side (passed to Component)
 * @param {Boolean} [doForce] Whether to force client side creation
 * @param {Boolean} [forceServer] Whether to force server side creation
 *
 * @deprecated Use <code>$A.createComponent(String type, Object attributes, function callback)</code> instead.
 * @platform
 * @export
 */
AuraComponentService.prototype.newComponentAsync = function(callbackScope, callback, config, attributeValueProvider, localCreation, doForce, forceServer) {
    $A.deprecated("$A.newCmpAsync and $A.componentService.newComponentAsync are not supported.",
        "Use '$A.createComponent()'");

    $A.assert(config, "ComponentService.newComponentAsync(): 'config' must be a valid Object.");
    $A.assert($A.util.isFunction(callback),"ComponentService.newComponentAsync(): 'callback' must be a Function pointer.");

    var isSingle=!$A.util.isArray(config);
    if(isSingle){
        config=[config];
    }
    var components = [];
    var overallStatus="SUCCESS";
    var statusList=[];
    var collected=0;

    function collectComponent(newComponent,status,statusMessage,index){
        components[index]=newComponent;
        statusList[index] = status;
        if(status==="ERROR"||(status==="INCOMPLETE"&&overallStatus!=="ERROR")) {
            overallStatus = status;
        }
        if(++collected===config.length){
            callback.call(callbackScope, isSingle?components[0]:components, overallStatus, statusList);
        }
    }

    if ($A.getContext().uriAddressableDefsEnabled) {
        var descriptorMap = {};

        for (var idx=0;idx<config.length;idx++) {
            if (config[idx]) {
                var cfg = this.getComponentConfigs(config[idx], attributeValueProvider);
                var descriptor = cfg["descriptor"]["descriptor"] || cfg["descriptor"];
                if (!cfg["definition"] && descriptor.indexOf("layout://") === -1) {
                    descriptorMap[descriptor] = undefined;
                }
            }
        }

        if (Object.keys(descriptorMap).length > 0) {
            this.loadComponentDefs(descriptorMap, $A.getCallback(function newComponentAsyncDefsLoaded(){
                $A.componentService.newComponentAsync(callbackScope, callback, isSingle?config[0]:config, attributeValueProvider, localCreation, doForce, forceServer);
            }));
            return;
        }
    }

    for(var i=0;i<config.length;i++){
        var configItem=config[i];
        if(configItem){
            var configObj = this.getComponentConfigs(configItem, attributeValueProvider);
            var def = configObj["definition"],
                desc = configObj["descriptor"]["descriptor"] || configObj["descriptor"];
            var forceClient = false;

            configItem = configObj["configuration"];

            //
            // Short circuit our check for remote dependencies, since we've
            // been handed a partial config. This feels distinctly like a hack
            // and will hopefully disappear with ComponentCreationContexts.
            //
            if (configItem["creationPath"] && !forceServer) {
                forceClient = true;
            }

            configItem["componentDef"] = {
                "descriptor": desc
            };

            if (!def && desc.indexOf("layout://") === 0) {
                // clear dynamic namespaces so that the server can send it back.
                $A.componentService.dynamicNamespaces = [];
                // throw error instead of trying to requestComponent from server which is prohibited
                throw new $A.auraError("Missing definition: " + desc, null, $A.severity.QUIET);
            }

            if ( !forceClient && (!def || (def && def.hasRemoteDependencies()) || forceServer )) {
                var action=this.requestComponent(collectComponent, configItem, attributeValueProvider, i);
                $A.enqueueAction(action);
            } else {
                if($A.clientService.allowAccess(def)) {
                    collectComponent(this["newComponentDeprecated"](configItem, attributeValueProvider, localCreation, doForce),"SUCCESS","",i);
                }else{
                    var message="Access Check Failed! AuraComponentService.newComponentAsync(): '" + def.getDescriptor().getQualifiedName() + "' is not visible to '" + $A.clientService.currentAccess + "'.";
                    if($A.clientService.enableAccessChecks) {
                        if($A.clientService.logAccessFailures){
                            $A.error(null,new $A.auraError(message));
                        }
                        collectComponent(null, "ERROR", "Unknown component '" + desc + "'.", i);
                    }else{
                        if($A.clientService.logAccessFailures){
                            $A.warning(message);
                        }
                        collectComponent(this["newComponentDeprecated"](configItem, attributeValueProvider, localCreation, doForce),"SUCCESS","",i);
                    }
                }
            }
        }
    }
};

AuraComponentService.prototype.getDefinitionOfAnyType = function (descriptor) {
    // this ensures we've checked any case insensitivity found
    descriptor = this.getDescriptorFromConfig(descriptor);
    // using getDef instead of getComponentDef to invoke Access Checks
    // similarly for eventService getDef, for Access Checks
    // Libraries don't have access checks?
    return this.getDef(descriptor) || this.getLibrary(descriptor) || $A.eventService.getDef(descriptor);
};

AuraComponentService.prototype.hasCacheableDefinitionOfAnyType = function(descriptor) {
    var desc = this.getDescriptorFromConfig(descriptor);
    return  !!this.hasModuleDefinition(desc) ||
        !!this.componentDefRegistry[desc] ||
        (this.savedComponentConfigs[desc] &&
            (Object.keys(this.savedComponentConfigs[desc]).length > 1) || $A.util.isFunction(this.savedComponentConfigs[desc])) ||
        !!this.hasLibrary(desc) ||
        !!$A.eventService.getEventDef(desc);
};

AuraComponentService.prototype.loadComponentDefs = function(descriptorMap, callback) {
    var missingDescriptorMap = {};
    for (var descriptor in descriptorMap) {
        // if the descriptor is missing the protocol, assume it's supposed to be markup://
        if (descriptor.indexOf("://") === -1) {
            descriptor = "markup://" + descriptor;
        }
        try {
            if (!this.hasCacheableDefinitionOfAnyType(descriptor)) {
                missingDescriptorMap[descriptor] = descriptorMap[descriptor];
            } else {
                if (this.componentDefLoader.requestedDescriptors[descriptor]) {
                    // the descriptor exists and we previously requested it
                    // clean up the map tracking the requested ones
                    delete this.componentDefLoader.requestedDescriptors[descriptor];
                }
            }
        } catch (e) {
            // ignore any exception raised
        }
    }

    if (!$A.util.isObject(missingDescriptorMap) || Object.keys(missingDescriptorMap).length === 0) {
        callback();
        return;
    }

    this.componentDefLoader.loadComponentDefs(missingDescriptorMap, callback);
};

/**
 * Request component from server.
 *
 * @param config
 * @param callback
 * @private
 */
AuraComponentService.prototype.requestComponent = function(callback, config, avp, index, returnNullOnError) {
    var action = $A.get("c.aura://ComponentController.getComponent");

    // JBUCH: HALO: TODO: WHERE IS THIS COMING FROM IN MIXED FORM? WHY DO WE ALLOW THIS?
    var attributes = config["attributes"] ?
        (config["attributes"]["values"] ? config["attributes"]["values"] : config["attributes"])
        : null;

    var atts = {};

    //
    // Note to self, these attributes are _not_ Aura Values. They are instead either
    // a literal string or a (generic object) map.
    //
    for (var key in attributes) {
        var value = attributes[key];
        if (value && value.hasOwnProperty("value")) {
            value = value["value"];
        }
        // if we have an avp, use it here
        var auraValue = valueFactory.create(value, avp);
        atts[key] = this.computeValue(auraValue, avp);
    }

    action.setCallback(this, function(a){
        // because this is an async callback, we need to make sure value provider is still valid
        if (avp && avp.isValid && !avp.isValid()) {
            return;
        }

        // We won't be able to do an access check if the access is invalid, so
        // just skip trying to do anything.
        if($A.clientService.currentAccess && !$A.clientService.currentAccess.isValid()) {
            return;
        }

        var newComp = null;
        var status= a.getState();
        var statusMessage='';
        if(status === "SUCCESS"){
            var returnedConfig = a.getReturnValue();
            if (!returnedConfig["attributes"]) {
                returnedConfig["attributes"] = {};
            }
            returnedConfig["attributes"]["valueProvider"] = avp;

            var merging = returnedConfig["attributes"];
            if (merging.hasOwnProperty("values")) {
                merging = merging["values"];
            }
            for (var mkey in attributes) {
                merging[mkey] = attributes[mkey];
            }
            returnedConfig["localId"] = config["localId"];
            returnedConfig["flavor"] = config["flavor"];

            var error;
            try {
                newComp = this.createComponentPriv(returnedConfig);
            } catch(e) {
                status = "ERROR";
                statusMessage = e.message;
                error = e;
            }
            if ( $A.util.isFunction(callback) ) {
                callback(newComp, status, statusMessage, index, error);
            }
        }else{
            var errors = a.getError();
            statusMessage=errors?errors[0].message:"Unknown Error.";
            if (statusMessage !== "Event fired") {
                if(!returnNullOnError) {
                    newComp = this.createComponentPriv({
                        "componentDef": { "descriptor": "markup://aura:text" },
                        "attributes": { "values": { "value" : statusMessage } }
                    });
                }
                if ( $A.util.isFunction(callback) ) {
                    callback(newComp, status, statusMessage, index);
                }
            }
        }
    });
    action.setParams({
        "name" : config["componentDef"]["descriptor"],
        "attributes" : atts
    });
    return action;
};

/**
 * Evaluates value object into their literal values. Typically used to pass configs to server.
 *
 * @param {Object} valueObj Value Object
 * @param {Object} valueProvider value provider
 *
 * @returns {*}
 * @export
 */
AuraComponentService.prototype.computeValue = function(value, valueProvider) {
    // Resolve the expression first, so we can do further processing on the return value.
    if($A.util.isExpression(value)) {
        value = value.evaluate(valueProvider);
    }

    // Don't serialize
    if($A.util.isComponent(value)) {
        return null;
    }

    if($A.util.isArray(value)) {
        var newValue = [];
        for(var c=0,length = value.length;c<length;c++) {
            if(!$A.util.isComponent(value[c])) {
                newValue.push(value[c]);
            }
        }
        value = newValue;
    }

    return value;
};

/**
 * Provides processed component config, definition, and descriptor.
 *
 * @param {Object} config
 * @param {Object} attributeValueProvider
 * @return {Object} {{configuration: {}, definition: ComponentDef, descriptor: String}}
 */
AuraComponentService.prototype.getComponentConfigs = function(config, attributeValueProvider) {
    var configuration, configAttributes, def, desc, configKey, attributeKey;

    // Given a string input, expand the config to be an object.
    if (config && $A.util.isString(config)) {
        config = { "componentDef" : config };
    }

    // When a valueProvider is specified, perform a shallow
    // clone of the config to preserve the original attributes.
    if (attributeValueProvider) {
        configuration = {};

        // Copy top-level keys to new config.
        for (configKey in config) {
            if (config.hasOwnProperty(configKey)) {
                configuration[configKey] = config[configKey];
            }
        }

        // Prepare new 'attributes' object.
        configAttributes = config['attributes'];
        configuration['attributes'] = {};

        // Copy attributes to prevent 'valueProvider' from mutating the original config.
        if (configAttributes) {
            for (attributeKey in configAttributes) {
                if (configAttributes.hasOwnProperty(attributeKey)) {
                    configuration['attributes'][attributeKey] = configAttributes[attributeKey];
                }
            }
        }

        // Safe to attach valueProvider reference onto new object.
        configuration['attributes']['valueProvider'] = attributeValueProvider;
    } else {
        configuration = config;
    }

    // Resolve the definition and descriptor.
    var componentDef = configuration["componentDef"];
    def = this.getDef(componentDef);

    if (!def && componentDef[Json.ApplicationKey.ATTRIBUTEDEFS]) {
        // create definition if it doesn't current exist and component definition config provided
        def = this.createComponentDef(componentDef);
    }

    if (def) {
        desc = def.getDescriptor().toString();
    } else {
        desc = componentDef[Json.ApplicationKey.DESCRIPTOR] ? componentDef[Json.ApplicationKey.DESCRIPTOR] : componentDef;
    }

    return {
        "configuration" : configuration,
        "definition"    : def,
        "descriptor"    : desc
    };
};

/**
 * Indexes the component using its global Id, which is uniquely generated across pageloads.
 * @public
 */
AuraComponentService.prototype.indexComponent = function(component){
    this.indexes.globalId[component.globalId] = component;
};

/**
 * Checks to see if the definition for the component currently reside on the client and the context has access to it.
 * Could still exist on the server, we won't know that till we use a getDefinition call to try to retrieve it.
 *
 * This method is private, to use it, use $A.hasDefinition("prefix:name");
 *
 * @private
 * @param  {String}  descriptor Component descriptor in the pattern prefix:name or markup://prefix:name.
 * @return {Boolean}            True if the definition is present on the client.
 */
AuraComponentService.prototype.hasDefinition = function(descriptor) {
    return !!this.getDef(descriptor);
};


/**
 * Return the definition of the components that were not used yet (we have the def config but we haven't build the def instance)
 * @export
 */
AuraComponentService.prototype.getUnusedDefinitions = function () {
    return Object.keys(this.savedComponentConfigs);
};

/**
 * Get the component definition. If it is not available will go to the server to retrieve it.
 *
 * This method is private, to utilize it, you should use $A.getDefinition("prefix:markup");
 *
 * @private
 *
 * @param  {String}   descriptor Component descriptor in the pattern prefix:name or markup://prefix:name.
 * @param  {Function} callback   Function that is passed the definition. The definition may be NULL if either the definition does not exist, or you do not have access to it.
 * @return undefined             Always use the callback to access the returned definition.
 */
AuraComponentService.prototype.getDefinition = function(descriptor, callback) {
    var def = this.getComponentDef(this.createDescriptorConfig(descriptor));

    if (def) {
        if(!$A.clientService.allowAccess(def)) {
            var message="Access Check Failed! ComponentService.getDef():'" + def.getDescriptor().toString() + "' is not visible to '" + $A.clientService.currentAccess + "'.";
            if($A.clientService.enableAccessChecks) {
                if($A.clientService.logAccessFailures){
                    $A.error(null,new $A.auraError(message));
                }
                callback(null);
                return;
            }else{
                if($A.clientService.logAccessFailures){
                    $A.warning(message);
                }
                //Intentional fallthrough
            }
        }
        callback(def);
        return;
    }

    var action = $A.get("c.aura://ComponentController.getComponentDef");
    action.setParams({ "name": descriptor });

    action.setCallback(this, function (actionResponse) {
        if(actionResponse.getState() === 'SUCCESS') {
            // We use getDef at the moment so we do the access check.
            callback(this.getDef(descriptor));
        } else if (actionResponse.getState() === 'ERROR') {
            actionResponse.getError().forEach(function(e) {
                $A.warning(e.message);
            });
            callback(null);
        } else {
            callback(null);
        }

    });

    $A.enqueueAction(action);
};

/**
 * Gets the component definition from the registry for internal use, without access checks.
 *
 * @param {Object} descriptor The descriptor object.
 * @returns {ComponentDef} The metadata of the component
 *
 * @private
 */
AuraComponentService.prototype.getComponentDef = function(config) {
    var descriptor = this.getDescriptorFromConfig(config);
    var definition = this.componentDefRegistry[descriptor];

    if (!definition && this.savedComponentConfigs[descriptor]) {
        return this.createFromSavedComponentConfigs(config);
    } else if (!definition && this.moduleDefRegistry[descriptor]) {
        return this.createInteropComponentDef(descriptor);
    }

    return definition;
};

AuraComponentService.prototype.hasDefinition = function(descriptor) {
    return !!this.getDef(descriptor);
};

/**
 * Whether module definition exist in registry
 *
 * moduleName may be in module format ie custom-web-component or
 * Aura descriptor format ie markup://custom:webComponent
 *
 * @param moduleName name in module format or Aura descriptor
 * @returns {boolean} whether module definition exists
 * @private
 */
AuraComponentService.prototype.hasModuleDefinition = function(moduleName) {
    return !!this.moduleDefRegistry[moduleName];
};

/**
 * Gets the component definition from the registry.
 * Does not go to the server if the definition is not available.
 *
 * @param {String|Object} descriptor The descriptor (<code>markup://ui:scroller</code>) or other component attributes that are provided during its initialization.
 * @returns {ComponentDef} The metadata of the component
 *
 * @public
 * @export
 * @deprecated use getDefinition(descriptor, callback) instead, it will go to the server if the definition is not present on the client.
 */
AuraComponentService.prototype.getDef = function(descriptor) {
    $A.assert(descriptor, "No ComponentDef descriptor specified");
    var def = this.getComponentDef(this.createDescriptorConfig(descriptor));

    if (def && !$A.clientService.allowAccess(def)) {
        var message="Access Check Failed! ComponentService.getDef():'" + def.getDescriptor().toString() + "' is not visible to '" + $A.clientService.currentAccess + "'.";
        if($A.clientService.enableAccessChecks){
            if($A.clientService.logAccessFailures){
                $A.error(null,new $A.auraError(message));
            }
            return undefined;
        }else{
            if($A.clientService.logAccessFailures){
                $A.warning(message);
            }
            // Intentional fallthrough
        }
    }
    return def;
};

/**
 * Add a component to the registry
 * We store them for execution later so we do not load definitions into memory unless they are utilized in getComponent.
 * @param {String} descriptor Uses the pattern of namespace:componentName.
 * @param {Function} exporter A function that when executed will return the component object litteral.
 * @export
 */
AuraComponentService.prototype.addComponent = function(descriptor, exporter) {
    this.savedComponentConfigs[descriptor] = exporter;
};


AuraComponentService.prototype.hydrateComponent = function(descriptor, exporter) {

    var script = $A.clientService.uncommentExporter(exporter);
    exporter = $A.clientService.evalExporter(script, descriptor);

    if(!exporter) {
        var defDescriptor = new Aura.System.DefDescriptor(descriptor);
        var includeComponentSource = defDescriptor.getPrefix() === "layout" || $A.clientService.isInternalNamespace(defDescriptor.getNamespace());
        var errorMessage = (!includeComponentSource) ?
            "Hydrating the component" + descriptor + " failed." :
            "Hydrating the component" + descriptor + " failed.\n Exporter code: " + script;
        var auraError = new $A.auraError(errorMessage, null, $A.severity.QUIET);
        auraError.setComponent(descriptor);
        throw auraError;
    }

    return exporter();
};

/**
 * Checks for saved component config, creates if available, and deletes the config
 *
 * @param {String} descriptor component descriptor to check and create
 * @return {ComponentDef} component definition if config available
 * @private
 */
AuraComponentService.prototype.createFromSavedComponentConfigs = function(config) {
    var descriptor = this.getDescriptorFromConfig(config);
    var cmpConfig = this.savedComponentConfigs[descriptor];
    var definition = typeof cmpConfig === 'function' ? this.hydrateComponent(descriptor, cmpConfig) : cmpConfig;
    // should only allow new ComponentDef when we are sure exporter or component class exists
    var alreadyHasConstructor = this.componentClassRegistry.classConstructors[descriptor] || this.componentClassRegistry.classExporter[descriptor];

    // Definitions that come back from the server in the context have their component class on the definition.
    var hasBuiltInConstructor = cmpConfig && cmpConfig.hasOwnProperty(Json.ApplicationKey.COMPONENTCLASS);
    if (alreadyHasConstructor || hasBuiltInConstructor) {
        var def = new ComponentDef(definition);
        this.componentDefRegistry[descriptor] = def;
        delete this.savedComponentConfigs[descriptor];
        return def;
    }

    return null;
};

/**
 * Creates ComponentDef from provided config
 * @param {Object} config component definition config
 * @return {ComponentDef}
 * @private
 */
AuraComponentService.prototype.createComponentDef = function(config) {
    var descriptor = this.getDescriptorFromConfig(config);
    var definition = this.componentDefRegistry[descriptor];

    if (!definition) {
        if (this.savedComponentConfigs[descriptor]) {
            definition = this.createFromSavedComponentConfigs(config);
        } else {
            // should only allow new ComponentDef when we are sure exporter or component class exists
            if (!!this.componentClassRegistry.classConstructors[descriptor] ||
                !!this.componentClassRegistry.classExporter[descriptor]) {
                definition = new ComponentDef(config);
                this.componentDefRegistry[descriptor] = definition;
            }
        }
    }

    return definition;
};

/**
 * Gets the component's controller definition from the registry.
 * @param {String} descriptor controller descriptor
 * @returns {ControllerDef} ControllerDef from registry
 * @private
 */
AuraComponentService.prototype.getControllerDef = function(descriptor) {
    return this.controllerDefRegistry[descriptor];
};

/**
 * Creates and returns ControllerDef
 * @param {Object} config Configuration for ControllerDef
 * @returns {ControllerDef} ControllerDef from registry
 * @private
 */
AuraComponentService.prototype.createControllerDef = function(config) {
    var descriptor = this.getDescriptorFromConfig(config);
    var def = this.controllerDefRegistry[descriptor];
    if (!def) {
        def = new ControllerDef(config);
        delete this.controllerDefRelationship[descriptor];
        this.controllerDefRegistry[descriptor] = def;
    }
    return def;
};

/**
 * Gets the action definition from the registry.
 * @param {String} descriptor actionDef descriptor
 * @returns {ActionDef} ActionDef from registry
 * @private
 */
AuraComponentService.prototype.getActionDef = function(descriptor) {
    return this.actionDefRegistry[descriptor];
};

/**
 * Creates and returns ActionDef
 * @param {Object} config Configuration for ActionDef
 * @returns {ActionDef} ControllerDef from registry
 * @private
 */
AuraComponentService.prototype.createActionDef = function(config) {
    var descriptor = this.getDescriptorFromConfig(config);
    var def = this.actionDefRegistry[descriptor];
    if (!def) {
        def = new ActionDef(config);
        delete this.actionDefRelationship[descriptor];
        this.actionDefRegistry[descriptor] = def;
    }

    return def;
};

/**
 * Gets the model definition from the registry.
 * @param {String} descriptor ModelDef descriptor
 * @returns {ModelDef} ModelDef from registry
 * @private
 */
AuraComponentService.prototype.getModelDef = function(descriptor) {
    return this.modelDefRegistry[descriptor];
};

/**
 * Creates and returns ModelDef
 * @param {Object} config Configuration for ModelDef
 * @returns {ModelDef} ModelDef from registry
 * @private
 */
AuraComponentService.prototype.createModelDef = function(config) {
    var descriptor = this.getDescriptorFromConfig(config);
    var def = this.modelDefRegistry[descriptor];
    if (!def) {
        def = new ModelDef(config);
        this.modelDefRegistry[descriptor] = def;
    }

    return def;
};

/**
 * Detects if the library exists without actually defining it.
 * @param {String} descriptor The qualified name of the library in the form markup://namespace:library
 */
AuraComponentService.prototype.hasLibrary = function(descriptor) {
    return this.libraryRegistry.hasLibrary(descriptor);
};

/**
 * Stores a library definition.
 * @param {Object} config component definition config
 * @export
 */
AuraComponentService.prototype.saveLibraryConfig = function(config) {
    this.libraryRegistry.addLibrary(config["descriptor"], config["includes"]);

    // Initialize the concrete include classes if provided
    if (config.hasOwnProperty("includeClasses")) {
        var includeClasses = $A.util.globalEval(config["includeClasses"], $A.clientService.getSourceMapsUrl(config["descriptor"], 'lib'));
        includeClasses();
    }
};

/**
 * Store a library exporter.
 * @param {String} descriptor name of the include.
 * @param {Function} exporter A function that when executed will return the include object.
 * @export
 */
AuraComponentService.prototype.addLibraryExporter = function(descriptor, exporter) {
    this.libraryIncludeRegistry.addLibraryExporter(descriptor, exporter);
};

/**
 * Get a library from the registry.
 * @param {String} descriptor library descriptor.
 * @returns {Object} library from registry.
 * @private
 */
AuraComponentService.prototype.getLibrary = function(descriptor) {
    return this.libraryRegistry.getLibrary(descriptor);
};

/**
 * Get a library as a module from the registry.
 * @param {String} descriptor library descriptor.
 * @returns {Object} library from registry.
 * @private
 */
AuraComponentService.prototype.getLibraryAsModule = function(descriptor) {
    return this.libraryRegistry.getLibrary(descriptor) && this.moduleDefRegistry[descriptor];
};

/**
 * Store a library include.
 * @param {String} descriptor name of the include.
 * @param {Array} dependencies The list of dependencies (other includes).
 * @param {Function} exporter A function that when executed will return the include object.
 * @export
 */
AuraComponentService.prototype.addLibraryInclude = function(descriptor, dependencies, exporter) {
    this.libraryIncludeRegistry.addLibraryInclude(descriptor, dependencies, exporter);
};

/**
 * Get a library include from the registry.
 * @param {String} descriptor in the form markup://namespace:include.
 * @returns Either the instance of the include you are requesting, or undefined if not found.
 * @private
 */
AuraComponentService.prototype.getLibraryInclude = function(descriptor) {
    return this.libraryIncludeRegistry.getLibraryInclude(descriptor);
};

/**
 * Destroys the components.
 * @private
 */
AuraComponentService.prototype.destroy = function(components){
    if (!$A.util.isArray(components)) {
        components = [components];
    }

    for (var i = 0; i < components.length; i++) {
        var cmp = components[i];
        if (cmp && cmp.destroy) {
            cmp.destroy();
        }
    }
};

/**
 * Removes the index of the component.
 * @private
 */
AuraComponentService.prototype.deIndex = function(globalId){
    delete this.indexes.globalId[globalId];
};

/**
 * Returns the descriptors of all components known to the registry.
 * @memberOf AuraComponentService
 * @public
 * @export
 */
AuraComponentService.prototype.getRegisteredComponentDescriptors = function(){
    var ret = [];
    var name;

    var componentDefs = this.componentDefRegistry;
    for (name in componentDefs) {
        ret.push(name);
    }

    return ret;
};

/**
 * Get the dynamic namespaces defined by 'layout://name'
 */
AuraComponentService.prototype.getDynamicNamespaces = function(){
    return this.dynamicNamespaces;
};

/**
 * @memberOf AuraComponentService
 * @export
 */
AuraComponentService.prototype.getIndex = function(){
    var ret = "";
    var index = this.indexes.globalId;
    for (var globalId in index) {
        if(globalId.indexOf(":1") > -1){
            var cmp = index[globalId];
            var par = "";
            var vp = cmp.getComponentValueProvider();
            if (vp) {
                par = vp.getGlobalId() + " : " + vp.getDef().toString();
            }
            ret = ret + globalId + " : ";
            ret = ret + cmp.getDef().toString();
            ret = ret + " [ " + par + " ] ";
            ret = ret + "\n";
        }
    }
    return ret;
};

/**
 * @memberOf AuraComponentService
 * @private
 */
AuraComponentService.prototype.isConfigDescriptor = function(config) {
    /*
     * This check is to distinguish between a AttributeDefRef that came
     * from server which has a descriptor and value, and just a thing
     * that somebody on the client passed in. This totally breaks when
     * somebody pass a map that has a key in it called "descriptor",
     * like DefModel.java in the IDE TODO: better way to distinguish
     * real AttDefRefs from random junk
     */
    return config && config["descriptor"];
};

/**
 * Saves component config so it can be use later when component def is actually used.
 * Allows Aura to only create ComponentDef when needed
 *
 * Also save reference to componentDef for its ControllerDef and ActionDefs in cases
 * where direct access to the defs are needed
 *
 * @param {Object} config component definition config
 */
AuraComponentService.prototype.saveComponentConfig = function(config) {
    var componentDescriptor = this.getDescriptorFromConfig(config);
    if (componentDescriptor in this.savedComponentConfigs || componentDescriptor in this.componentDefRegistry) {
        return;
    }

    this.savedComponentConfigs[componentDescriptor] = config;

    var controllerDef = config[Json.ApplicationKey.CONTROLLERDEF];
    if (controllerDef) {
        if (controllerDef[Json.ApplicationKey.DESCRIPTOR]) {
            // save reference to component descriptor for ControllerDef
            this.controllerDefRelationship[controllerDef[Json.ApplicationKey.DESCRIPTOR]] = componentDescriptor;
        }

        if (controllerDef[Json.ApplicationKey.ACTIONDEFS]) {
            var actionDefs = controllerDef[Json.ApplicationKey.ACTIONDEFS],
                len = actionDefs.length,
                i;

            for (i = 0; i < len; i++) {
                // loop and save reference to ComponentDef descriptor for each ActionDef
                var actionDef = actionDefs[i];
                if (actionDef[Json.ApplicationKey.DESCRIPTOR]) {
                    this.actionDefRelationship[actionDef[Json.ApplicationKey.DESCRIPTOR]] = componentDescriptor;
                }
            }
        }
    }
};

/**
 * Asynchronously retrieves all definitions from storage and adds to saved component config or library registry.
 * @return {Promise} a promise that resolves when definitions are restored.
 */
AuraComponentService.prototype.restoreDefsFromStorage = function (context) {
    var defStorage = this.componentDefStorage.getStorage();
    if (!defStorage || !defStorage.isPersistent()) {
        // If the def storage is not persistent, that means that actions are not secure.
        // Which means that we might have partial pieces that we can use (layouts://), so
        // restore but do not block waiting since we are not dependent on them for start the app.

        this.componentDefStorage.restoreAll(context);
        return Promise["resolve"]();
    }

    return this.componentDefStorage.restoreAll(context);
};

/**
 * Clears persisted definitions and all dependent stores and context.
 * @param {Object} [metricsPayload] optional payload to send to metrics service.
 * @return {Promise} Promise when storage is cleared
 */
AuraComponentService.prototype.clearDefsFromStorage = function (metricsPayload) {
    return this.componentDefStorage.clear(metricsPayload)["then"](function(){
        return this.actionStorage.clear();
    }.bind(this));
};

/**
 * Returns name of ComponentDefStorage
 * @returns {String} name of ComponentDefStorage
 */
AuraComponentService.prototype.getComponentDefStorageName = function() {
    return this.componentDefStorage.STORAGE_NAME;
};

/**
 * Saves component and library defs to persistent storage.
 * @param {Object} config the config bag from which defs are to be stored.
 * @param {Object} context the context (already merged)
 * @return {Promise} promise which resolves when storing is complete. If errors occur during
 *  the process error recovery occurs. If error recovery fails then the promise rejects.
 */
AuraComponentService.prototype.saveDefsToStorage = function (config, context) {
    var cmpConfigs = config["componentDefs"] || [];
    var libConfigs = config["libraryDefs"] || [];
    var evtConfigs = config["eventDefs"] || [];
    var moduleConfigs = config["moduleDefs"] || [];

    if (cmpConfigs.length === 0 && libConfigs.length === 0 && evtConfigs.length === 0 && moduleConfigs.length === 0) {
        return Promise["resolve"]();
    }

    var defStorage = this.componentDefStorage.getStorage();
    if (!defStorage) {
        return Promise["resolve"]();
    }

    var self = this;
    var defSizeKb = $A.util.estimateSize(cmpConfigs) / 1024;
    var libSizeKb = $A.util.estimateSize(libConfigs) / 1024;
    var evtSizeKb = $A.util.estimateSize(evtConfigs) / 1024;
    var moduleSizeKb = $A.util.estimateSize(moduleConfigs) / 1024;

    // def AuraStorage mutual exclusion is not required to
    return self.pruneDefsFromStorage(defSizeKb + libSizeKb + evtSizeKb + moduleSizeKb)
        ["then"](
            function(cleared) {
                if (!cleared) {
                    // nothing was cleared from storage, we should be safe to store
                    return self.componentDefStorage.storeDefs(cmpConfigs, libConfigs, evtConfigs, moduleConfigs, context);
                    // } else {
                    // storage was cleared. We can't be certain if the defs that were being requested to save contain all their required dependencies
                    // so... we just won't store them to avoid an inconsistent storage.
                }
            }
        )
        ["then"](
            undefined, // noop
            function(e) {
                // there was an error during analysis, pruning, or saving defs. the persistent components and actions
                // may now be in an inconsistent state: dependencies may not be available. therefore clear the actions
                // and cmp def storages.
                var metricsPayload = {
                    "cause": "saveDefsToStorage",
                    "defsRequiredSize" : defSizeKb + libSizeKb + evtSizeKb,
                    "error" : e
                };
                return self.clearDefsFromStorage(metricsPayload);
            }
        );
};


AuraComponentService.prototype.createComponentPrivAsync = function (config, callback, infiniteLoopProtection) {
    var descriptor = this.getDescriptorFromConfig(config["componentDef"]);
    var def = this.getComponentDef({ "descriptor" : descriptor });
    $A.assert(callback && typeof callback === 'function' , 'Callback');

    // If we have the definition already, go ahead
    // If we don't have the def and uri-addressable defs is enabled and should use the action.
    // Otherwise use component def loader to bypass the action call
    if (def || !$A.getContext().uriAddressableDefsEnabled) {
        if (def && !def.hasRemoteDependencies()) {
            this.createComponentPriv(config, callback);
            return;
        } else {
            //TODO: TW: remove this code path (including requestComponent) once URI addressable defs is done
            var action;
            action = this.requestComponent(callback, config, null, null, true);
            action.setAbortable();
            $A.enqueueAction(action);
        }
    } else {
        var self = this;
        this.componentDefLoader.loadComponentDef(descriptor, null, $A.getCallback(function(err) {
            if (infiniteLoopProtection) {
                err = "infinite loop error on fetching component definition for: " + descriptor;
                $A.deprecated(err,
                    "New definition needs to be created on the server",
                    "infiniteLoopProtection:" + descriptor);
            }
            if (err) {
                var errMsg = err.message?err.message:err;
                var errState = "ERROR";
                if ($A.util.isString(errMsg) && errMsg.indexOf(Aura.Component.ComponentDefLoader.UNKNOWN_ERROR_MESSAGE_PREFIX) === 0) {
                    errState = "INCOMPLETE";
                }
                callback(null, errState, errMsg);
            } else {
                // need to call recursively into this method just in case the new definition needs to be created on the server
                try {
                    self.createComponentPrivAsync(config, callback, true);
                } catch (e) {
                    callback(null, "ERROR", e);
                }
            }
        }));
    }
};

AuraComponentService.prototype.createComponentPriv = function (config, callback) {
    var descriptor = this.getDescriptorFromConfig(config["componentDef"]);
    var def = this.getComponentDef({ "descriptor" : descriptor });
    var cmp = null;
    var createMark;
    var currentAccessCmp = $A.clientService.currentAccess;
    var currentAccessCmpDef = currentAccessCmp && currentAccessCmp.getDef();

    if (!this.trackingCreate && descriptor.indexOf("markup://aura") < 0) {
        createMark = $A.metricsService.mark("component", "create", {"name" : descriptor});
        this.trackingCreate = true;
    }

    try {
        if($A.clientService.allowAccess(def)) {
            // minVersion validation to check if calling component's API version is not less than minVersion requirement of component being created
            var minVersion = def.getMinVersion();
            var currAccessCmpApiVer = currentAccessCmpDef && currentAccessCmpDef.getApiVersion();
            if (minVersion && currAccessCmpApiVer && (parseInt(minVersion) > parseInt(currAccessCmpApiVer))) {
                var mveMessage = $A.util.format("Component API version is too old: '{0}' must be set to API version '{1}' or later to use component '{2}'",
                    currentAccessCmpDef.getDescriptor().getQualifiedName(),
                    minVersion,
                    descriptor);
                var minVersionValidationError = new $A.auraError(mveMessage);
                minVersionValidationError.setComponent(currentAccessCmpDef.getDescriptor().getQualifiedName());
                throw minVersionValidationError;
            }

            var classConstructor = this.getComponentClass(descriptor, def);

            if (!classConstructor) {
                var errorMessage = $A.util.format("Component class not found: {0}\n hasClassConstructor: {1}\n hasClassExporter: {2}\n hasSavedComponentConfigs: {3}\n hasComponentDefCreated: {4}",
                    descriptor,
                    !!$A.componentService.componentClassRegistry.classConstructors[descriptor],
                    !!$A.componentService.componentClassRegistry.classExporter[descriptor],
                    !!$A.componentService.savedComponentConfigs[descriptor],
                    !!$A.componentService.componentDefRegistry[descriptor]);
                var auraError = new $A.auraError(errorMessage, null, $A.severity.QUIET);
                auraError.setComponent(descriptor);
                throw auraError;
            }

            cmp = new classConstructor(config);
        } else if (def) {
            var message="Access Check Failed! AuraComponentService.createComponentFromConfig(): '" + descriptor + "' is not visible to '" + currentAccessCmp + "'.";
            if($A.clientService.enableAccessChecks) {
                if($A.clientService.logAccessFailures){
                    $A.error(null,new $A.auraError(message));
                }
                if (!callback || !$A.util.isFunction(callback)) {
                    throw new Error(message);
                }
            }else{
                if($A.clientService.logAccessFailures){
                    $A.warning(message);
                }
                cmp = new (this.getComponentClass(descriptor, def))(config);
            }
        }
        if (callback && $A.util.isFunction(callback)) {
            if (cmp !== null) {
                callback(cmp, "SUCCESS");
            } else {
                callback(null, "ERROR", "Unknown component '" + descriptor + "'.");
            }
            return undefined;
        } else if (cmp !== null) {
            return cmp;
        }
        // We are potentially in an inconsistent state. This occurs when a dependency definition is no longer in cache,
        // yet the original parent definition does exist.
        // clearing indexeddb
        // component def storage clear will also clear actions
        this.componentDefStorage.clear();
        throw new Error('Definition does not exist on the client for descriptor:' + descriptor +
            '. Client side caches have been cleared. Please reload the page.');
    } finally {
        if (createMark) {
            this.trackingCreate = false;
            createMark["duration"] = $A.metricsService.time() - createMark["ts"];
        }
    }
};

/*
 * ====================================================================
 * PERSISTENT CACHE EVICTION LOGIC
 * ====================================================================
 */

/**
 * Find dependencies of a component def or action.
 * @param {String} key the component def or action id.
 * @param {Object} defConfig
 * @param {Array} storedDeps
 * @return {Array} the list of dependencies
 */
AuraComponentService.prototype.findDependencies = function (key, defConfig, storedDeps) {
    var dependencies = [];
    var i;

    if ($A.util.isArray(defConfig)) {
        for (i = 0; i < defConfig.length; i++) {
            dependencies.push.apply(dependencies, this.findDependencies(key, defConfig[i], storedDeps));
        }
    } else if ($A.util.isObject(defConfig)) {
        for (var attr in defConfig) {
            var value = defConfig[attr];
            if (attr === "descriptor") {
                if (value !== key && storedDeps.indexOf(value) !== -1) {
                    dependencies.push(value);
                }
            } else {
                dependencies.push.apply(dependencies, this.findDependencies(key, value, storedDeps));
            }
        }
    }

    return dependencies;
};

/**
 * Builds the dependency graph for for all persisted component definitions and stored actions (persistent or not).
 *
 * A component definition depends on components in its superDef chain and its facets.
 * A stored action depends on components specified in its return value.
 * This definition is recursive.
 *
 * For example:
 * - Three components: plant, tree, leaf.
 * - Tree's superDef is plant.
 * - Tree has leaf in its facet.
 * - An action was used to retrieve an instance of tree.
 *
 * Tree's graph node looks like this:
 * { action: false, id: "markup://ns:tree", dependencies: ["markup://ns:plant", "markup://ns:leaf"] }
 *
 * The action's graph node looks like this:
 * { action: true, id: "java://.../ACTION$getTree:{}", dependencies: ["markup://ns:tree", "markup://ns:plant", "markup://ns:leaf"] }
 *
 * @return {Promise} promise that resolves to an object (keyed on descriptor) of dependency objects. A dependency object has these keys:
 * - action: true if this is an action, false if a component definition.
 * - id: the action or def descriptor.
 * - dependencies: array of action/def descriptors this item depends on.
 */
AuraComponentService.prototype.buildDependencyGraph = function() {
    // NOTE: this is really, really important to get right. if we ever evict
    // data required by aura framework, especially data for it to boot, then regardless
    // of what userland actions you have, the framework won't boot. so never evict these!
    //
    // NOTE: AuraClientService.js' "$AuraClientService.token$" goes directly to the adapter, bypassing
    // the isolation key, so will never be returned by storage.getAll().
    var actionsBlockList = ["globalValueProviders",                                 /* GlobalValueProviders.js */
        "aura://ComponentController/ACTION$getApplication"];    /* AuraClientService.js */

    var promises = [];
    var actionStorage = $A.clientService.getActionStorage();
    promises.push(actionStorage.getAll());
    promises.push(this.componentDefStorage.getAll());

    // promise will reject if either getAll rejects
    return Promise["all"](promises)["then"](function (results) {
        var actionEntries = results[0];
        var defEntries    = results[1];
        var defKeys       = Object.keys(defEntries);
        var nodes         = {};

        function createNode(isAction, values, key) {
            var dependencies = this.findDependencies(key, values[key], defKeys);
            nodes[key] = { "id": key, "dependencies": dependencies, "action": isAction };
        }

        var actionKeys = Object.keys(actionEntries).filter(function (a) {
            for (var i = 0; i < actionsBlockList.length; i++) {
                if (a.key.indexOf(actionsBlockList[i]) === 0) {
                    return false;
                }
            }
            return true;
        });

        actionKeys.forEach(createNode.bind(this, true, actionEntries));
        defKeys.forEach(createNode.bind(this, false, defEntries));

        return nodes;
    }.bind(this));
};

/**
 * Sorts the dependency graph by topological order.
 * @param {Object} graph a graph of nodes. See #buildDependencyGraph().
 * @return {Array} a topologically sorted array of node ids.
 */
AuraComponentService.prototype.sortDependencyGraph = function(graph) {
    var sorted  = [];
    var visited = {};

    Object.keys(graph).forEach(function visit(idstr, ancestors) {
        var node = graph[idstr];
        var id   = node["id"];

        if (visited[idstr]) { return; }
        if (!Array.isArray(ancestors)) {
            ancestors = [];
        }

        ancestors.push(id);
        visited[idstr] = true;
        node["dependencies"].forEach(function(afterId) {
            if (ancestors.indexOf(afterId) >= 0) { // if already in ancestors, a closed chain exists.
                throw new $A.auraError("AuraComponentService.sortDependencyGraph: Found a cycle in the graph: " + afterId + " is in " + id, null, $A.severity.QUIET);
            }
            visit(afterId.toString(), ancestors.map(function(v) { return v; }));
        });

        sorted.unshift(id);
    });
    return sorted;
};


/**
 * Gets the "upstream" dependencies for a node in the graph. In other words, gets the nodes from the
 * graph that are dependent, directly or indirectly, on a given node.
 *
 * This provides the list of component definitions and actions which must be removed if a given
 * component definition is removed.
 *
 * For example:
 * - Three components: plant, tree, leaf.
 * - Tree's superDef is plant.
 * - Tree has leaf in its facet.
 * - An action was used to retrieve an instance of tree.
 *
 * If node is leaf then the upstream dependencies are:
 * - tree because it has leaf in a facet
 * - action because it depends on tree
 *
 * Notably plant is not an upstream dependency. It does not depend on leaf, tree or action.
 *
 * @param {String} rootKey key of the graph node whose upstream dependencies are desired.
 * @param {Object} graph a graph of nodes. See #buildDependencyGraph().
 * @param {Object} upstream map to populate with upstream dependencies. Key is the graph key; value is always true.
 */
AuraComponentService.prototype.getUpstreamDependencies = function(rootKey, graph, upstream) {
    upstream = upstream || {};
    for (var key in graph) {
        if (key !== rootKey) {
            var nodeDependencies = graph[key]["dependencies"];
            if (nodeDependencies.indexOf(rootKey) !== -1) {
                upstream[key] = true;
                this.getUpstreamDependencies(key, graph, upstream);
            }
        }
    }
    upstream[rootKey] = true;
    return upstream;
};

/**
 * Separates the keys into actions and defs, pruning those that appear in exclude.
 * @param {Object} graph a graph of nodes. See #buildDependencyGraph().
 * @param {Object} keys a map whose keys are graph keys.
 * @param {Array} exclude the list of keys to exclude.
 * @param {Array} actions the array to populate with action keys.
 * @param {Array} defs the array to populate with component def keys.
 */
AuraComponentService.prototype.splitComponentsAndActions = function(graph, keys, exclude, actions, defs) {
    for (var key in keys) {
        if (exclude.indexOf(key) === -1) {
            if (graph[key]["action"]) {
                actions.push(key);
            } else {
                defs.push(key);
            }
        }
    }
};

/**
 * Evicts component definitions and dependent actions from storage until the
 * component def storage is under a size threshold.
 *
 * @param {Array} sortedKeys the ordered list of graph keys to remove under the size threshold is met.
 * @param {Object} graph a graph of nodes. See #buildDependencyGraph().
 * @param {Number} requiredSpaceKb space required to store incoming defs.
 * @return {Promise} a promise that resolves with the list of evicted actions and component defs.
 */
AuraComponentService.prototype.evictDefsFromStorage = function(sortedKeys, graph, requiredSpaceKb) {
    var defStorage    = this.componentDefStorage.getStorage();
    var actionStorage = $A.clientService.getActionStorage();
    var self          = this;

    return defStorage.getSize()["then"](function(startingSize) {
        var maxSize = defStorage.getMaxSize();
        // target is the lesser of
        // a) a percent of max size, and
        // b) size required to leave some headroom after the subsequent puts
        var targetSize = Math.min(
            maxSize * self.componentDefStorage.EVICTION_TARGET_LOAD,
            maxSize - maxSize * self.componentDefStorage.EVICTION_HEADROOM - requiredSpaceKb
        );
        var evicted = [];

        // short circuit
        if (startingSize <= targetSize) {
            $A.log("AuraComponentService.evictDefsFromStorage: short-circuiting because current size (" + startingSize.toFixed(0) + "KB) < target size (" + targetSize.toFixed(0) + "KB)");
            return Promise["resolve"]([]);
        }

        return new Promise(function (resolve, reject) {
            /**
             * Removes actions from the actions store
             * @param {Array} actions the actions to remove
             * @return {Promise} a promise that resolves when the actions are removed.
             */
            function removeActions(actions) {
                if (!actionStorage.isStorageEnabled() || !actions.length) {
                    $A.assert(actions.length === 0 || actionStorage.isStorageEnabled(), "Actions store doesn't exist but requested removal of " + actions.length + " actions");
                    return Promise["resolve"]();
                }

                var promises = [];
                for (var i = 0; i < actions.length; i++) {
                    promises.push(actionStorage.remove(actions[i], true));
                }

                return Promise["all"](promises)["then"](
                    function () {
                        $A.log("AuraComponentService.evictDefsFromStorage.removeActions(): removed " + promises.length + " actions");
                    }
                );
            }

            /**
             * Recursively evicts until component def storage is reduced to the target size
             * or all component defs are evicted.
             */
            function evictRecursively(keysToEvict, currentSize) {
                var key = keysToEvict.pop();

                // exit if all defs evicted or under target size
                if (!key || currentSize <= targetSize) {
                    resolve(evicted);
                    return;
                }
                var upstreamKeys = self.getUpstreamDependencies(key, graph);
                var actions = [];
                var defs = [];
                self.splitComponentsAndActions(graph, upstreamKeys, evicted, actions, defs);

                // short-circuit if nothing to evict in this round
                if (actions.length === 0 && defs.length === 0) {
                    evictRecursively(keysToEvict, currentSize);
                    return;
                }

                removeActions(actions)
                    ["then"](function() {
                        // track removed actions for future filtering
                        evicted.push.apply(evicted, actions);
                    })
                    ["then"](function() {
                        return self.componentDefStorage.removeDefs(defs);
                    })
                    ["then"](function() {
                        // track removed defs for future filtering
                        evicted.push.apply(evicted, defs);

                        // get the new size
                        return defStorage.getSize();
                    })["then"](
                    function(newSize) {
                        // and recurse!
                        evictRecursively(keysToEvict, newSize);
                    },
                    function(e) {
                        $A.log("AuraComponentService.evictDefsFromStorage(): error during component def or action removal", e);
                        // exit recursion
                        reject(e);
                    }
                );
            }

            $A.log("AuraComponentService.evictDefsFromStorage: evicting because current size (" + startingSize.toFixed(0) + "KB) > target size (" + targetSize.toFixed(0) + "KB)");
            evictRecursively(sortedKeys, startingSize);
        });
    });
};

/**
 * Prunes component definitions and dependent actions from persistent storage.
 *
 * This is the entry point for dependency graph generation, analysis, and
 * eviction. Eviction proceeds until the component def storage is under a threshold
 * size or all component defs are evicted from storage.
 *
 * @param {Number} requiredSpaceKb space (in KB) required by new configs to be stored.
 * @return {Promise} a promise that resolves when pruning is complete.
 */
AuraComponentService.prototype.pruneDefsFromStorage = function(requiredSpaceKb) {
    var self          = this;
    var defStorage    = this.componentDefStorage.getStorage();

    // no storage means no pruning required
    if (!defStorage) {
        return Promise["resolve"]();
    }

    var currentSize = 0;
    var newSize = 0;

    // check space to determine if eviction is required. this is an approximate check meant to
    // avoid storage.getAll() and graph analysis which are expensive operations.
    return defStorage.getSize()
        ["then"](
            function(size) {
                currentSize = size;
                var maxSize = defStorage.getMaxSize();
                newSize = currentSize + requiredSpaceKb + maxSize * self.componentDefStorage.EVICTION_HEADROOM;
                if (newSize < maxSize) {
                    return false;
                }

                // If we arrive here, some eviction is required...

                /*
                * NOTE @dval: disabling this algorithm because it is currently incorrect:
                * the server does not return all the necessary dependencies to the client.
                * Missing dependencies that we know of:
                *   - The ones declared on markup via <aura:dependency/>
                *   - The ones spidered from JS (helpers, controllers, etc)
                *
                * For now (202), if we need to evict, we just clear everything.
                * TODO W-3037639 - fix def serialization + persistence
                */

                var metricsPayload = {
                    "cause": "sizeAboveThreshold",
                    "defsRequiredSize" : requiredSpaceKb,
                    "storageCurrentSize" : currentSize,
                    "storageRequiredSize" : newSize
                };

                return self.clearDefsFromStorage(metricsPayload)["then"](function(){return true;});


                /*
                // Original eviction Algorithm. Uncomment when the problem above has been fixed
                //
                // note: buildDependencyGraph() loads all actions and defs from storage. this forces
                // scanning all rows in the respective stores. this results in the stores returning an
                // accurate value to getSize().
                //
                // as items are evicted from the store it's important that getSize() continues returning
                // a value that is close to accurate.
                //
                // TODO - if this is re-enabled must do self.componentDefStorage.enqueue() to acquire
                // def AuraStorage mutex

                return self.buildDependencyGraph()
                    ["then"](function(graph) {
                        var keysToEvict = self.sortDependencyGraph(graph);
                            return self.evictDefsFromStorage(keysToEvict, graph, requiredSpaceKb);
                    })
                   ["then"](
                        function(evicted) {
                            $A.log("AuraComponentService.pruneDefsFromStorage: evicted " + evicted.length + " component defs and actions");
                        }
                    );
                */
            }
        );
};

/**
 * Returns the number of batches fetching components from the server
 *
 * @return {Number} Number of component batch loads in progress
 * @export
 */
AuraComponentService.prototype.inFlightComponents = function() {
    return this.componentDefLoader.loading;
};

Aura.Services.AuraComponentService = AuraComponentService;
