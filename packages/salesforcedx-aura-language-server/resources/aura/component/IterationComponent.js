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
 * Construct a new IterationComponent.
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
function IterationComponent(config, localCreation) {
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

    // sets up component level events
    // Used in iteration
    this.setupComponentEvents(this, configAttributes);

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

IterationComponent.prototype = Object.create(Component.prototype);

// Not returning anything in these since empty functions will not be called by the JS engine as an
IterationComponent.prototype.setupModel = function(){};
IterationComponent.prototype.superRender = function(){};
IterationComponent.prototype.superAfterRender = function(){};
IterationComponent.prototype.superRerender = function(){};
IterationComponent.prototype.superUnrender = function(){};
IterationComponent.prototype.getSuper = function(){};
IterationComponent.prototype.getSuperest = function(){ return this; };

IterationComponent.prototype.setupComponentDef = function() {
    // TextComponent optimization, go straight to an internal API for the component def
    this.componentDef = $A.componentService.getComponentDef({"descriptor":"markup://aura:iteration"});

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);
};

IterationComponent.prototype.setupValueProviders = function(customValueProviders) {
    var vp=this.valueProviders;

    vp["v"]=this.attributeSet = new AttributeSet(this.componentDef.attributeDefs);
    vp["c"]=this.createActionValueProvider();
    vp["e"]=this.createEventValueProvider();
    vp["this"]=this;
    vp["globalid"]=this.globalId;
    vp["def"]=this.componentDef;
    vp["null"]=null;
    vp["version"] = this.version ? this.version : this.getVersionInternal();

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
IterationComponent.prototype.isInstanceOf = function(type) {
    return type === "aura:iteration" || type === "aura:rootComponent";
};

// IterationComponent.ItemValueProvider=function(component){
//     this.get=function(path){
//         throw new Error("DIGGING IN THE RIGHT PLACE");
//     }
// };

IterationComponent.prototype["controller"] = {
    "rangeChange": function(component, evt, helper) {
        helper.updateBody(component);
    },

    "itemsChange": function(component, evt, helper) {
        helper.updateBody(component);
    },

    "templateChange":function(component, evt, helper){
        helper.createBody(component,false);
    },

    "init": function(component, evt, helper) {
//        component.addValueProvider(component.get("v.var"),new IterationComponent.ItemValueProvider(component));
        var bodyTemplate = component.attributeSet.getBody(component.globalId);
        var template = component.attributeSet.getValue("template");

        if (bodyTemplate.length && !template.length) {
            component.set("v.body", [], true);
            component.set("v.template", bodyTemplate, true);
        }
        helper.createBody(component,true);
    }
};

IterationComponent.prototype["helper"] = {
    createBody: function (component, localCreation) {
        component.set("v.loaded", false);
        component._itemInfo = [];
        var helper=this;
        this.buildBody(component,
            function createBodyItem(cmp, template, item, index, itemVar, indexVar, templateValueProvider, forceServer, callback) {
                this.buildTemplate(cmp, template, item, index, itemVar, indexVar, templateValueProvider, localCreation, forceServer, callback);
            },
            function createBodyComplete(cmp, components){
                cmp.set("v.body", components, true);
                cmp.set("v.loaded",true);
                cmp.get("e.iterationComplete").fire({"operation":"Initialize"});
                var queued=cmp._queueUpdate;
                cmp._queueUpdate=false;
                if(queued){
                    helper.updateBody(cmp);
                }
            }
        );
    },
    clearUnrenderedBody: function (component) {
        var currentBody = component.attributeSet.getBody(component.globalId);
        var cleanedCmps = 0;
        if (currentBody.length) {
            for (var i = 0; i < currentBody.length; i++) {
                if (currentBody[i].isValid() && !currentBody[i].isRendered()) {
                    currentBody[i].destroy();
                    component._itemInfo.splice(i - cleanedCmps, 1);
                    cleanedCmps++;
                }
            }
            
            //#if {"excludeModes" : ["PRODUCTION"]}
            if (cleanedCmps) {
                var owner = component.getOwner();
                $A.warning([
                    '[Performance degradation] ',
                    'markup://aura:iteration [id:' + component.getGlobalId() + '] ',
                    'in ', owner.getType() + ' ["' + owner.getGlobalId() + '"] ',
                    'had multiple items set in the same Aura cycle.\n',
                    'More info: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/perf_warnings_iteration.htm\n',
                    'Component hierarchy: ' + $A.util.getComponentHierarchy(owner)
                ].join(''));
            }
            //#end
        }
    },
    updateBody: function (component) {
        if (component.attributeSet.getValue("loaded") === false) {
            component._queueUpdate = true;
            return component._queueUpdate;
        }

        this.clearUnrenderedBody(component);

        component.set("v.loaded",false);
        var itemInfo = component._itemInfo.slice();
        var helper = this;
        component._itemInfo.length = 0;

        this.buildBody(component,
            function updateBodyItem(cmp, template, item, index, itemVar, indexVar, templateValueProvider, forceServer, callback) {
                var found = false;
                var components = null;
                for (var i = 0; i < itemInfo.length; i++) {
                    if (itemInfo[i].item === item) {
                        components = itemInfo[i].components;
                        if (itemInfo[i].index !== index) {
                            for (var j = 0; j < components.length; j++) {
                                var avp = components[j].getAttributeValueProvider();
                                if (avp) {
                                    //JBUCH: HALO: FIXME: THIS IS TO DEAL WITH THE CHANGE TO PTVs BELOW:
                                    avp.set(indexVar, index);
                                    avp.set(itemVar, cmp.getReference("v.items[" + index + "]"), true);
                                }
                            }
                        }
                        found = true;
                        itemInfo.splice(i, 1);
                        this.trackItem(cmp, item, index, components);
                        callback(components);
                        break;
                    }
                }
                if (!found) {
                    this.buildTemplate(cmp, template, item, index, itemVar, indexVar, templateValueProvider, false, forceServer, callback);
                }
            },
            function updateBodyComplete(cmp, components){
            //  if (itemInfo.length) {
            //      We have deletes. Do we even care? RenderingService and Garbage Collection should handle that.
            //      If we do care, it will be to detach PRVs from firing.
            //  }
                cmp.set("v.body", components);
                cmp.set("v.loaded",true);
                cmp.get("e.iterationComplete").fire({"operation":"Update"});
                var queued=cmp._queueUpdate;
                cmp._queueUpdate=false;
                if(queued){
                    helper.updateBody(cmp);
                }
            }
        );
    },

    buildBody: function (component, itemHandler, completeHandler) {
        var items = component.attributeSet.getValue("items");
        var template = component.attributeSet.getValue("template");
        var startIndex = this.getStart(component);
        var endIndex = this.getEnd(component);
        var expectedCalls=endIndex-startIndex;

        var collector=[];
        var currentCall=0;

        function getCollector(index){
            return function iteration$getCollector(itemComponents){
                collector[index]=itemComponents;
                if(++currentCall===expectedCalls){
                    var components=[];
                    for(var j=0; j<collector.length; j++){
                        components=components.concat(collector[j]);
                    }
                    completeHandler(component,components);
                }
            };
        }

        if (items && items.length && template && template.length && expectedCalls > 0) {
            var itemVar = component.attributeSet.getValue("var");
            var indexVar = component.attributeSet.getValue("indexVar");
            var forceServer = component.attributeSet.getValue("forceServer");
            var templateValueProvider = component.getComponentValueProvider();


            $A.pushCreationPath("body");
            for (var i = startIndex; i < endIndex; i++) {
                $A.setCreationPathIndex(i);
                itemHandler.bind(this)(component, template, items[i], i, itemVar, indexVar, templateValueProvider, forceServer, getCollector(i-startIndex));
            }
            $A.popCreationPath("body");
        }else{
            completeHandler(component,[]);
        }
    },

    buildTemplate: function (component, template, item, index, itemVar, indexVar, templateValueProvider, localCreation, forceServer, callback) {
        $A.pushCreationPath("body");
        var helper = this;
        var componentDefRef = template[0];
        var iterationValueProvider = null;

        function collector(templateComponents){
            helper.trackItem(component, item, index, templateComponents);
            callback(templateComponents);
        }

        if (componentDefRef) {
            $A.setCreationPathIndex(0); // TODO: Creation path... needs to die soon...
            var itemValueProviders = {};
            itemValueProviders[itemVar] = component.getReference("v.items[" + index + "]");
            itemValueProviders[indexVar] = index;
            iterationValueProvider = $A.expressionService.createPassthroughValue(itemValueProviders, componentDefRef["attributes"]["valueProvider"] || templateValueProvider);

            if (localCreation) {
                var components = [];
                for (var i = 0; i < template.length; i++) {
                    template[i]["attributes"]["valueProvider"] = iterationValueProvider;
                    components.push($A.createComponentFromConfig(template[i]));
                }
                collector(components);

            } else {
                // TODO: @dval: remove all ocurrences of this deprecated method
                $A.componentService.newComponentAsync(this, collector, template, iterationValueProvider, localCreation, false, forceServer);
            }
        }

        $A.popCreationPath("body");
    },

    getStart: function (cmp) {
        return Math.max(0, parseInt(cmp.attributeSet.getValue("start") || 0, 10));
    },

    getEnd: function (cmp) {
        var items = cmp.attributeSet.getValue("items");
        if(items&&items.length){
            var end=parseInt(cmp.attributeSet.getValue("end"), 10);
            return isNaN(end)?items.length:Math.min(items.length, end);
        }
        return 0;
    },

    trackItem: function (component, item, index, components) {
        component._itemInfo.push({
            item: item,
            index: index,
            components: components //,
//          hash : $A.util.json.encode(itemval)
        });
    }
};

IterationComponent.prototype["provider"] = {
    "provide" : function(component) {
        return component;
    }
};

IterationComponent.prototype["renderer"] = {
    "render": function(component){
        var rendering = component.getRendering();
        return rendering||$A.renderingService.renderFacet(component,component.get("v.body"));
    },

    "afterRender": function(component){
        var body = component.get("v.body");
        $A.afterRender(body);
    },

    "rerender": function(component){
        var body = component.get("v.body");
        return $A.renderingService.rerenderFacet(component,body);
    },

    "unrender" : function(component){
        var body = component.get("v.body");
        $A.renderingService.unrenderFacet(component,body);
    }
};

Aura.Component.IterationComponent = IterationComponent;
