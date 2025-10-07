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
 * Construct a new IfComponent.
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
function IfComponent(config, localCreation) {
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
    this.setupAttributes(configAttributes);

    // runs component provider and replaces this component with the provided one
    this.injectComponent(config, localCreation);

    // index this component with its value provider (if it has a localid)
    this.doIndex(this);

    // starting watching all values for events
    // Used in iteration
    this.setupValueEventHandlers(this);

    // clean up refs to partial config
    this.partialConfig = undefined;

    if (forcedPath && act && this.creationPath) {
        act.releaseCreationPath(this.creationPath);
    }

    this._destroying = false;

    // No need to go through the full event cycle.
    this.fire("init");
}

IfComponent.prototype = Object.create(Component.prototype);

// Not returning anything in these since empty functions will not be called by the JS engine as an
IfComponent.prototype.setupModel = function(){};
IfComponent.prototype.superRender = function(){};
IfComponent.prototype.superAfterRender = function(){};
IfComponent.prototype.superRerender = function(){};
IfComponent.prototype.superUnrender = function(){};
IfComponent.prototype.getSuper = function(){};
IfComponent.prototype.getModel = function(){};
IfComponent.prototype.getSuperest = function(){ return this; };

IfComponent.prototype.setupComponentDef = function() {
    // HtmlComponent optimization, go straight to an internal API for the component def
    this.componentDef = $A.componentService.getComponentDef({"descriptor":"markup://aura:if"});

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);
};

IfComponent.prototype.setupValueProviders = function(customValueProviders) {
    var vp=this.valueProviders;

    vp["v"]=this.attributeSet = new AttributeSet(this.componentDef.attributeDefs);
    vp["c"]=this.createActionValueProvider();
    vp["this"] = this;
    vp["globalid"]=this.globalid;
    
    if(customValueProviders) {
        for (var key in customValueProviders) {
            this.addValueProvider(key,customValueProviders[key]);
        }
    }
};

/**
 * Simple type checking. All simple components implement aura:rootComponent and cannot be extended, 
 * so the simple condition here is sufficient unless any of the individual components change.
 */
IfComponent.prototype.isInstanceOf = function(type) {
    return type === "aura:if" || type === "aura:rootComponent";
};

IfComponent.prototype["controller"] = {
    "init": function(cmp, evt, helper) {
        var bodyTemplate  = cmp.attributeSet.getBody(cmp.globalId);
        var isTrue        = $A.util.getBooleanValue(cmp.attributeSet.getValue("isTrue"));
        var template      = cmp.attributeSet.getValue("template");

        if (bodyTemplate.length && !template.length) {
            cmp.set("v.template", bodyTemplate, true);
            cmp.set("v.body", [], true);
        }

        var body = helper.createBody(cmp, isTrue);
        cmp.set("v.body", body, true);
        cmp._truth = isTrue;
    },
    "handleTheTruth": function(cmp, evt, helper) {
        var isTrue = $A.util.getBooleanValue(cmp.attributeSet.getValue("isTrue"));
        if (cmp._truth !== isTrue) {
            helper.clearUnrenderedBody(cmp);

            cmp.set("v.body", helper.createBody(cmp, isTrue, true));
            cmp._truth = isTrue;
        }
    }
};


IfComponent.prototype["helper"] = {
    createBody: function(cmp, isTrue) {
        var body  = [];
        var facet = isTrue ? cmp.attributeSet.getValue("template") : cmp.attributeSet.getValue("else");
        
        $A.pushCreationPath("body");
        
        for (var i = 0, length = facet.length; i < length; i++) {
            $A.setCreationPathIndex(i);
            var cdr = facet[i];

            if (!cdr["attributes"]["valueProvider"]) {
                cdr["attributes"]["valueProvider"] = cmp.getAttributeValueProvider();
            }

            if (!cdr["containerComponentId"]) {
                cdr["containerComponentId"] = cmp.getGlobalId();
            }

            body.push($A.componentService.createComponentFromConfig(cdr));
        }
        
        $A.popCreationPath("body");

        return body;
    },

    clearUnrenderedBody: function(cmp) {
        var hasUnrenderBody = false;
        var currentBody = cmp.attributeSet.getBody(cmp.globalId);

        for (var i = 0 ; i < currentBody.length; i++) {
            var child = currentBody[i];
            if (!child.isRendered()) {
                hasUnrenderBody = true;
                child.destroy();
            }
        }
        

        //#if {"excludeModes" : ["PRODUCTION"]}
        if (hasUnrenderBody) {
            var owner = cmp.getOwner();
            $A.warning([
                '[Performance degradation] ',
                'markup://aura:if ["' + cmp.getGlobalId() + '"] in ',
                owner.getType() + ' ["' + owner.getGlobalId() + '"] ',
                'needed to clear unrendered body.\n',
                'More info: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/perf_warnings_if.htm\n',
                'Component hierarchy: ' + $A.util.getComponentHierarchy(owner)
            ].join(''));
        }
        //#end
    }
};


IfComponent.prototype["provider"] = {
    "provide" : function(component) {
        return component;
    }
};

// Shares the renderer
IfComponent.prototype["renderer"] = Aura.Component.BaseComponent.prototype["renderer"];

Aura.Component.IfComponent = IfComponent;
