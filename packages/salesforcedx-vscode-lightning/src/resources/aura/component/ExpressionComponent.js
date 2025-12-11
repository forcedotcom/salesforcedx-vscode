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
 * Construct a new ExpressionComponent.
 *
 * @public
 * @class
 * @constructor
 *
 * @param {Object}
 *            config - component configuration
 * @param {Boolean}
 *            [localCreation] - local creation
 */
function ExpressionComponent(config, localCreation) {
    var context = $A.getContext();

    // setup some basic things
    this.concreteComponentId = config["concreteComponentId"];
    this.containerComponentId = config["containerComponentId"];
    this.shouldAutoDestroy=true;
    this.rendered = false;
    this.inUnrender = false;
    this.localId = config["localId"];
    this.valueProviders = {};
    this.eventValueProvider = undefined;
    this.docLevelHandlers = undefined;
    this.references={};
    this.handlers = {};
    this.localIndex = {};
    this.destroyed=0;
    this.version = config["version"];
    this.owner = $A.clientService.getCurrentAccessGlobalId();
    this.name='';

    // allows components to skip creation path checks if it's doing something weird
    // such as wrapping server created components in client created one

    var act = config["skipCreationPath"] ? null : context.getCurrentAction();
    var forcedPath = false;

    if (act) {
        var currentPath = act.topPath();
        if (config["creationPath"]) {
            //
            // This is a server side config, so we need to sync ourselves with it.
            // The use case here is that the caller has gotten a returned array of
            // components, and is instantiating them independently. We can warn the
            // user when they do the wrong thing, but we'd actually like it to work
            // for most cases.
            //
            this.creationPath = act.forceCreationPath(config["creationPath"]);
            forcedPath = true;
        } else if (!context.containsComponentConfig(currentPath) && !!localCreation) {
            // skip creation path if the current top path is not in server returned
            // componentConfigs and localCreation

            this.creationPath = "client created";
        } else {
            this.creationPath = act.getCurrentPath();
        }
        //$A.log("l: [" + this.creationPath + "]");
    }

    // create the globally unique id for this component
    this.setupGlobalId(config["globalId"], localCreation);

    var partialConfig;
    if (this.creationPath && this.creationPath !== "client created") {
        partialConfig = context.getComponentConfig(this.creationPath);

        // Done with it in the context, it's now safe to remove so we don't process it again later.
        context.removeComponentConfig(this.creationPath);
    }

    if (partialConfig) {
        this.validatePartialConfig(config,partialConfig);
        this.partialConfig = partialConfig;
    }

    // get server rendering if there was one
    if (config["rendering"]) {
        this.rendering = config["rendering"];
    } else if (partialConfig && partialConfig["rendering"]) {
        this.rendering = this.partialConfig["rendering"];
    }

    // add this component to the global index
    $A.componentService.indexComponent(this);

    // sets this components definition, preferring partialconfig if it exists
    this.setupComponentDef(this.partialConfig || config);

    // Saves a flag to indicate whether the component implements the root marker interface.
    this.isRootComponent = true;

    // join attributes from partial config and config, preferring partial when overlapping
    var configAttributes = { "values": {} };

    if (config["attributes"]) {
        for(var key in config["attributes"]["values"]) {
            configAttributes["values"][key] = config["attributes"]["values"][key];
        }
        configAttributes["valueProvider"] = config["attributes"]["valueProvider"] || config["valueProvider"];
    }

    if (partialConfig && partialConfig["attributes"]) {
        $A.util.apply(configAttributes["values"], partialConfig["attributes"]["values"], true);
        // NOTE: IT USED TO BE SOME LOGIC HERE TO OVERRIDE THE VALUE PROVIDER BECAUSE OF PARTIAL CONFIGS
        // IF WE RUN INTO ISSUES AT SOME POINT AFTER HALO, LOOK HERE FIRST!
    }

    if (!configAttributes["facetValueProvider"]) {
        configAttributes["facetValueProvider"] = this;
    }

    //JBUCH: HALO: FIXME: THIS IS A DIRTY FILTHY HACK AND I HAVE BROUGHT SHAME ON MY FAMILY
    this.attributeValueProvider = configAttributes["valueProvider"];
    this.facetValueProvider = configAttributes["facetValueProvider"];

    // create all value providers for this component m/v/c etc.
    this.setupValueProviders(config["valueProviders"]);

    // initialize attributes
    this.setupAttributes(configAttributes, localCreation);

    // index this component with its value provider (if it has a localid)
    this.doIndex(this);

    // clean up refs to partial config
    this.partialConfig = undefined;

    if (forcedPath && act && this.creationPath) {
        act.releaseCreationPath(this.creationPath);
    }
}

ExpressionComponent.prototype = Object.create(Component.prototype);

/** The SuperRender calls are blank since we will never have a super, no need to ever do any logic to for them. */
ExpressionComponent.prototype.superRender = function(){};
ExpressionComponent.prototype.superAfterRender = function(){};
ExpressionComponent.prototype.superRerender = function(){};
ExpressionComponent.prototype.superUnrender = function(){};

/** No Super, so just return undefined */
ExpressionComponent.prototype.getSuper = function(){};

/** Will always be Superest, so no need to check for a super */
ExpressionComponent.prototype.getSuperest = function(){ return this; };

ExpressionComponent.prototype.setContainerComponentId = function(containerComponentId) {
    this.containerComponentId = containerComponentId;

    // Specific to Expressions only.
    if(this.isValid()) {
        // set the containerComponentId for expression values to the expression component itself
        var enableAccessChecks = $A.clientService.enableAccessChecks;
        try {
            // JBA: turn off access checks so we can evaluate this expression
            // safely just for this statement
            $A.clientService.enableAccessChecks = false;
            var facetValue = this.get("v.value");
            if($A.util.isArray(facetValue)){
                for(var fidx = 0; fidx < facetValue.length; fidx++) {
                    if($A.util.isComponent(facetValue[fidx])) {
                        while (facetValue instanceof PassthroughValue) {
                            facetValue = facetValue.getComponent();
                        }
                        facetValue[fidx].setContainerComponentId(this.globalId);
                    }
                }
            }
            else if($A.util.isComponent(facetValue)) {
                facetValue.setContainerComponentId(this.globalId);
            }
        }
        finally {
            // flip access checks back to their initial value
            $A.clientService.enableAccessChecks = enableAccessChecks;
        }
    }
};

ExpressionComponent.prototype.setupValueProviders = function(customValueProviders) {
    var vp=this.valueProviders;

    vp["v"]=this.attributeSet = new AttributeSet(this.componentDef.attributeDefs);

    if(customValueProviders) {
        for (var key in customValueProviders) {
            this.addValueProvider(key,customValueProviders[key]);
        }
    }
};

/**
 * Component.js has logic that is specific to HtmlComponent. Great! So we can move that into here and out of Component.js
 * That logic is the LockerService part to assign trust to the owner.
 */
ExpressionComponent.prototype.setupComponentDef = function() {
    // HtmlComponent optimization, go straight to an internal API for the component def
    this.componentDef = $A.componentService.getComponentDef({"descriptor":"markup://aura:expression"});

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);
};

/**
 * Simple type checking. All simple components implement aura:rootComponent and cannot be extended,
 * so the simple condition here is sufficient unless any of the individual components change.
 */
ExpressionComponent.prototype.isInstanceOf = function(type) {
    return type === "aura:expression" || type === "aura:rootComponent";
};


ExpressionComponent.prototype["renderer"] = {
    "render" : function(component) {
        var value = component.attributeSet.getValue("value");
        if ($A.util.isUndefinedOrNull(value)) {
            value = "";
        }

        if (!$A.util.isComponent(value) && !$A.util.isArray(value)) {
            // JBUCH: HALO: TODO: MIGHT BE ABLE TO RETURN THIS TO SIMPLE TEXTNODE MANAGEMENT
            var owner = component.getOwner();
            $A.clientService.setCurrentAccess(owner);
            try {
                value = component._lastRenderedTextNode = $A.createComponentFromConfig({
                    "descriptor": "markup://aura:text",
                    "attributes":{ "value": value }
                });
                value.setContainerComponentId(component.globalId);
            } finally {
                $A.clientService.releaseCurrentAccess();
            }

            $A.lockerService.trust(owner, value);
        }

        return $A.renderingService.renderFacet(component,value);
    },

    "rerender" : function(component) {
        var ret=[];
        if (component.isRendered()) {
            var value = component.attributeSet.getValue("value");
            if (!($A.util.isComponent(value)||$A.util.isArray(value))) {
                if ($A.util.isUndefinedOrNull(value)) {
                    value = "";
                }
                if (component._lastRenderedTextNode && component._lastRenderedTextNode.isValid()) {
                    // JBUCH: HALO: TODO: MIGHT BE ABLE TO RETURN THIS TO SIMPLE TEXTNODE MANAGEMENT
                    component._lastRenderedTextNode.set("v.value",value,true);
                    value = component._lastRenderedTextNode;
                    return $A.rerender(value);
                } else {
                    value = component._lastRenderedTextNode = $A.createComponentFromConfig({
                        "descriptor": 'markup://aura:text',
                        "attributes": { "value": value }
                    });
                    value.setContainerComponentId(component.globalId);
                }
            } else if (component._lastRenderedTextNode) {
                component._lastRenderedTextNode.destroy();
                delete component._lastRenderedTextNode;
            }
            ret = $A.renderingService.rerenderFacet(component, value);
        }
        return ret;
    },

    "unrender" : function(component) {
        $A.renderingService.unrenderFacet(component);
        if (component._lastRenderedTextNode) {
            component._lastRenderedTextNode.destroy();
            delete component._lastRenderedTextNode;
        }
    },

    "afterRender" : function(component) {
        var value = component.attributeSet.getValue("value");
        if ($A.util.isComponent(value)||$A.util.isArray(value)) {
            $A.afterRender(value);
        }
    }
};




Aura.Component.ExpressionComponent = ExpressionComponent;
