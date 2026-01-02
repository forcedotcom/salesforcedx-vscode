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
 * Construct a new TextComponent.
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
function TextComponent(config, localCreation) {
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
    this.destroyed=false;
    this.version = config["version"];
    this.owner = $A.clientService.getCurrentAccessGlobalId();
    this.name='';
    this.isRootComponent = true;

    // create the globally unique id for this component
    this.setupGlobalId(config["globalId"], localCreation);

    // get server rendering if there was one
    if (config["rendering"]) {
        this.rendering = config["rendering"];
    }

    // add this component to the global index
    $A.componentService.indexComponent(this);

    // sets this components definition, preferring partialconfig if it exists
    this.setupComponentDef(config);

    // join attributes from partial config and config, preferring partial when overlapping
    var configAttributes = { "values": {} };

    if (config["attributes"]) {
        //$A.util.apply(configAttributes["values"], config["attributes"]["values"], true);
        for(var key in config["attributes"]["values"]) {
            configAttributes["values"][key] = config["attributes"]["values"][key];
        }
        configAttributes["valueProvider"] = config["attributes"]["valueProvider"] || config["valueProvider"];
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

    // index this component with its value provider (if it has a localid)
    this.doIndex(this);
}

TextComponent.prototype = Object.create(Component.prototype);

/** The SuperRender calls are blank since we will never have a super, no need to ever do any logic to for them. */
TextComponent.prototype.superRender = function(){};
TextComponent.prototype.superAfterRender = function(){};
TextComponent.prototype.superRerender = function(){};
TextComponent.prototype.superUnrender = function(){};

/** No Super, so just return undefined */
TextComponent.prototype.getSuper = function(){};

/** Will always be Superest, so no need to check for a super */
TextComponent.prototype.getSuperest = function(){ return this; };

TextComponent.prototype.setupValueProviders = function(customValueProviders) {
    var vp=this.valueProviders;

    vp["v"]=this.attributeSet = new AttributeSet(this.componentDef.attributeDefs);
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
 * Component.js has logic that is specific to HtmlComponent. Great! So we can move that into here and out of Component.js
 * That logic is the LockerService part to assign trust to the owner.
 */
TextComponent.prototype.setupComponentDef = function() {
    // HtmlComponent optimization, go straight to an internal API for the component def
    this.componentDef = $A.componentService.getComponentDef({"descriptor":"markup://aura:text"});

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);
};

/**
 * Simple type checking. All simple components implement aura:rootComponent and cannot be extended, 
 * so the simple condition here is sufficient unless any of the individual components change.
 */
TextComponent.prototype.isInstanceOf = function(type) {
    return type === "aura:text" || type === "aura:rootComponent";
};

TextComponent.prototype["renderer"] = {
    "render": function(component){
        var value = component.attributeSet.getValue("value");
        var trunc = component.attributeSet.getValue("truncate");
        
        if(trunc){
            var truncateByWord = $A.util.getBooleanValue(component.attributeSet.getValue("truncateByWord"));
            var ellipsis = $A.util.getBooleanValue(component.attributeSet.getValue("ellipsis"));

            trunc = 1 * trunc;
            value = $A.util.truncate(value, trunc, ellipsis, truncateByWord);
        }
        
        var textNode = document.createTextNode($A.util.isUndefinedOrNull(value) ? '' : value);
        
        // aura:text is syntactic sugar for document.createTextNode() and the resulting nodes need to be directly visible to the container
        // otherwise no code would be able to manipulate them
        var owner = component.getOwner();
        var ownerName = owner.getType();
        // TODO: Manually checking for aura:iteration or aura:if is a hack. Ideally, getOwner() or another API would
        //       always return the element we need to key against.
        while (ownerName === "aura:iteration" || ownerName === "aura:if") {
            owner = owner.getOwner();
            ownerName = owner.getType();
        }
        $A.lockerService.trust(owner, textNode);
        
        $A.renderingService.setMarker(component, textNode);
        
        return textNode;
    },
    
    "rerender":function(component){
        var element=component.getElement();
        // Check for unowned node so IE doesn't crash
        if (element && element.parentNode) {
            var textValue = component.attributeSet.getValue("value");
            textValue = $A.util.isUndefinedOrNull(textValue) ? '' : textValue;
            
            if (element.nodeValue !== textValue) {
                element.nodeValue = textValue;
            }
        }
    }
};


Aura.Component.TextComponent = TextComponent;
