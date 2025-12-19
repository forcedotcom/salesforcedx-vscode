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
 * Construct a new BaseComponent.
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
function BaseComponent(config, localCreation) {
    //Aura.Component.Component.call(this, config, localCreation);
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
    this.isRootComponent = true;

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

    // join attributes from partial config and config, preferring partial when overlapping
    var configAttributes = { "values": {} };

    if (config["attributes"]) {
        //$A.util.apply(configAttributes["values"], config["attributes"]["values"], true);
        for(var key in config["attributes"]["values"]) {
            configAttributes["values"][key] = config["attributes"]["values"][key];
        }
        configAttributes["valueProvider"] = config["attributes"]["valueProvider"] || config["valueProvider"];
    }

    if (partialConfig && partialConfig["attributes"]) {
        $A.util.apply(configAttributes["values"], partialConfig["attributes"]["values"], true);
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
    this.setupAttributes(configAttributes);

    // clean up refs to partial config
    this.partialConfig = undefined;

    if (forcedPath && act && this.creationPath) {
        act.releaseCreationPath(this.creationPath);
    }

}

BaseComponent.prototype = Object.create(Component.prototype);

// Not returning anything in these since empty functions will not be called by the JS engine as an
BaseComponent.prototype.superRender = function(){};
BaseComponent.prototype.superAfterRender = function(){};
BaseComponent.prototype.superRerender = function(){};
BaseComponent.prototype.superUnrender = function(){};
BaseComponent.prototype.getSuper = function(){};
BaseComponent.prototype.getSuperest = function(){ return this; };

BaseComponent.prototype.setupValueProviders = function(customValueProviders) {
    var vp=this.valueProviders;

    vp["v"]=this.attributeSet=$A.componentService.get(this.concreteComponentId).attributeSet;
    vp["m"]=this.model;
    vp["this"]=this;
    vp["globalid"]=this.concreteComponentId;
    vp["def"]=this.componentDef;
    vp["super"]=this.superComponent;
    vp["null"]=null;
    vp["version"] = this.version ? this.version : this.getVersionInternal();

    if(customValueProviders) {
        for (var key in customValueProviders) {
            this.addValueProvider(key,customValueProviders[key]);
        }
    }
};

BaseComponent.prototype.setupComponentDef = function() {
    // TextComponent optimization, go straight to an internal API for the component def
    this.componentDef = $A.componentService.getComponentDef({"descriptor":"markup://aura:component"});

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);
};

BaseComponent.prototype["renderer"] = {
    "render": function(component){
        var rendering = component.getRendering();
        return rendering||$A.renderingService.renderFacet(component,component.attributeSet.getBody(component.globalId));
    },

    "afterRender": function(component){
        $A.afterRender(component.attributeSet.getBody(component.globalId));
    },

    "rerender": function(component){
        return $A.renderingService.rerenderFacet(component,component.attributeSet.getBody(component.globalId));
    },

    "unrender" : function(component){
        $A.renderingService.unrenderFacet(component,component.attributeSet.getBody(component.globalId));
    }
};

Aura.Component.BaseComponent = BaseComponent;
