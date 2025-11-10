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
 * Construct a new Component.
 *
 * @public
 * @class
 * @constructor
 *
 * @param {Object}
 *            config - component configuration
 * @param {Boolean}
 *            [localCreation] - local creation
 * @platform
 * @export
 */
function Component(config, localCreation) {
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
    this.type='';
    this._marker = null;

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

    try {
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
        this.isRootComponent = $A.util.isUndefinedOrNull(this["meta"] && this["meta"]["extends"]) && this.isInstanceOf("aura:rootComponent");

        // join attributes from partial config and config, preferring partial when overlapping
        var configAttributes = { "values": {} };

        if (config["attributes"]) {
            $A.util.apply(configAttributes["values"], config["attributes"]["values"], true);
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

        // instantiates this components model
        this.setupModel(config["model"]);

        // create all value providers for this component m/v/c etc.
        this.setupValueProviders(config["valueProviders"]);

        // initialize attributes
        this.setupAttributes(configAttributes);

        // runs component provider and replaces this component with the provided one
        this.injectComponent(config, localCreation);

        // instantiates this components methods
        this.setupMethods(config);

        // sets up component level events
        this.setupComponentEvents(this, configAttributes);

        // instantiate super component(s)
        this.setupSuper(configAttributes, localCreation);

        // for application type events
        this.setupApplicationEventHandlers();

        // index this component with its value provider (if it has a localid)
        this.doIndex(this);

        // instantiate the renderer for this component

        // starting watching all values for events
        this.setupValueEventHandlers(this);

        // setup flavors
        this.setupFlavors(config, configAttributes);

        // clean up refs to partial config
        this.partialConfig = undefined;

        if (forcedPath && act && this.creationPath) {
            act.releaseCreationPath(this.creationPath);
        }

        if (this.getDef().hasInit()) {
            this.fire("init");
        }
    } catch (e) {
        var auraError = e;
        if (!(e instanceof $A.auraError)) {
            auraError = new $A.auraError("Failed to initialize a component", e);
        }

        if (!auraError["component"]) {
            auraError.setComponent(config && config["componentDef"] && config["componentDef"]["descriptor"]);
        }
        throw auraError;
    }
}

/**
 * Sets this component's containerComponentId, which is the global id of
 * the component that owns the facet attribute for which this
 * component is a value.
 * @private
 */
Component.prototype.setContainerComponentId = function(containerComponentId) {
    this.containerComponentId = containerComponentId;
};

Component.currentComponentId = 0;

Component.prototype.nextGlobalId = function(localCreation) {
    if (!localCreation) {
        var context = $A.getContext();
        var currentAction = context.getCurrentAction();

        var id;
        var suffix;
        if (currentAction) {
            id = currentAction.getNextGlobalId();
            suffix = currentAction.getId();
        } else {
            id = context.getNextGlobalId();
            suffix = "g";
        }

        return suffix ? (id + ":" + suffix) : id;
    } else {
        return (Component.currentComponentId++) + ":c";
    }
};

/**
 * The globally unique id of this component
 */
Component.prototype.setupGlobalId = function(globalId, localCreation) {
    globalId = globalId || this.nextGlobalId(localCreation);

    if ($A.componentService.get(globalId)) {
        $A.log("Component.setupGlobalId: globalId already in use: '" + globalId + "'.");
    }

    this.globalId = globalId;
};


/**
 * Returns the component's code-compatible camelCase name, e.g. 'uiButton'.
 *
 * @export
 * @platform
 */
Component.prototype.getName = function() {
    if(!this.name){
        this.name=$A.util.toCamelCase(this.getType());
    }
    return this.name;
};

/**
 * Returns the component's canonical type, e.g. 'ui:button'.
 *
 * @export
 * @platform
 */
Component.prototype.getType = function() {
    if(!this.type){
        this.type=this.getDef().getDescriptor().getFullName();
    }
    return this.type;
};

/**
 * Gets the ComponentDef Shorthand: <code>get("def")</code>
 *
 * @public
 * @export
 */
Component.prototype.getDef = function() {
    return this.componentDef;
};

/**
 * Indexes the given <code>globalId</code> based on the given
 * <code>localId</code>. Allows <code>cmp.find(localId)</code> to look up
 * the given <code>globalId</code>, look up the component, and return it.
 *
 * @param {String}
 *            localId The id set using the aura:id attribute.
 * @param {String}
 *            globalId The globally unique id which is generated on pageload.
 * @protected
 * @export
 */
Component.prototype.index = function(localId, globalId) {
    var index = this.localIndex;
    var existing = index[localId];
    if (existing) {
        if (!$A.util.isArray(existing)) {
            if(existing!==globalId){
                index[localId] = [ existing, globalId ];
            }else{
                $A.warning("Component.index():'Invalid redundant use of component.index().'");
            }
        } else {
            var found=false;
            for(var i=0;i<existing.length;i++){
                if(existing[i]===globalId){
                    found=true;
                    $A.warning("Component.index():'Invalid redundant use of component.index().'");
                    break;
                }
            }
            if(!found){
                existing.push(globalId);
            }
        }
    } else {
        index[localId] = globalId;
    }
    return null;
};

/**
 * Removes data from the index. If both <code>globalId</code> and
 * <code>localId</code> are provided, only the given pair is removed from the
 * index. If only <code>localId</code> is provided, every mapping for that
 * <code>localId</code> is removed from the index.
 *
 * This might be called after component destroy in some corner cases, be careful
 * to check for destroy before accessing.
 *
 * @param {String}
 *            localId The id set using the aura:id attribute.
 * @param {String}
 *            globalId The globally unique id which is generated on pageload.
 * @protected
 * @export
 */
Component.prototype.deIndex = function(localId, globalId) {
    if (this.localIndex) {
        if (globalId) {
            var index = this.localIndex[localId];
            if (index) {
                if ($A.util.isArray(index)) {
                    for (var i = 0; i < index.length; i++) {
                        if (index[i] === globalId) {
                            index.splice(i--, 1);
                        }
                    }
                    if (index.length === 0) {
                        delete this.localIndex[localId];
                    }
                } else {
                    if (index === globalId) {
                        delete this.localIndex[localId];
                    }
                }
            }
        } else {
            delete this.localIndex[localId];
        }
    }
    return null;
};

/**
 * Locates a component using the localId. Shorthand: <code>get("asdf")</code>,
 * where "asdf" is the <code>aura:id</code> of the component to look for.
 * Returns different types depending on the result.
 * 	If the local ID is unique, find() returns the component.
 *	If there are multiple components with the same local ID, find() returns an array of the components.
 *  If there is no matching local ID, find() returns undefined.
 * Returns instances of a component using the format
 * <code>cmp.find({ instancesOf : "auradocs:sampleComponent" })</code>.
 *
 * @param {String|Object}
 *            name - If name is an object, return instances of it. Otherwise,
 *            finds a component using its index.
 * @public
 * @platform
 * @export
 */
Component.prototype.find = function(name) {
    if ($A.util.isObject(name)) {
        var type = name["instancesOf"];
        var instances = [];
        this.findInstancesOf(type, instances, this);
        return instances;
    } else {
        var index = this.localIndex;
        if (index) {
            var globalId = index[name];
            if (globalId) {
                if ($A.util.isArray(globalId)) {
                    var ret = [];
                    var found;
                    for (var i = 0; i < globalId.length; i++) {
                        found = $A.componentService.get(globalId[i]);
                        if(found !== null && found !== undefined) {
                            ret.push(found);
                        }
                    }
                    return ret;
                }
                return $A.componentService.get(globalId);
            }
        }
    }
};

/**
 * Find instances of a Component type, in this component's hierarchy, and in
 * its body, recursively.
 *
 * @param {Object}
 *            type The object type.
 * @param {Array}
 *            ret The array of instances to add the located Components to.
 * @param {Object}
 *            cmp The component to search for.
 * @private
 */
Component.prototype.findInstancesOf = function(type, ret, cmp) {
    cmp = cmp || this.getSuperest();

    var body = null;
    //JBUCH: TODO: HACK: THIS CHECK IS NECESSARY BECAUSE OF THE CUSTOM EXPRESSION RENDERER. ATTEMPT TO ELIMINATE.
    if(cmp.getDef().getAttributeDefs().getDef("body")){
        body=cmp.get("v.body");
    }else if(cmp.isInstanceOf("aura:expression")){
        var value=cmp.get("v.value");
        if($A.util.isArray(value)){
            body=value;
        }
    }
    if (body) {
        for (var i = 0; i < body.length; i++) {
            cmp = body[i];
            if (cmp.findInstanceOf) {
                var inst = cmp.findInstanceOf(type);
                if (inst) {
                    ret.push(inst);
                } else {
                    cmp.findInstancesOf(type, ret);
                }
            }
        }
    }
};

/**
 * @private
 */
Component.prototype.getSuperest = function() {
    var superComponent = this.getSuper();
    if (superComponent) {
        return superComponent.getSuperest() || superComponent;
    } else {
        return this;
    }
};

/**
 *
 * @private
 */
Component.prototype.findInstanceOf = function(type) {
    if (this.getType() === type) {
        return this;
    } else {
        var superComponent = this.getSuper();
        if (superComponent) {
            return superComponent.findInstanceOf(type);
        } else {
            return null;
        }
    }
};

/**
 * Checks whether the component is an instance of the given component name (or
 * interface name).
 *
 * @param {String}
 *            name - The name of the component (or interface), with a format of
 *            <code>namespace:componentName</code>.
 * @returns {Boolean} true if the component is an instance, or false otherwise.
 * @platform
 * @export
 */
Component.prototype.isInstanceOf = function(name) {
    return this.componentDef.isInstanceOf(name);
};

/**
 * @param {Object}
 *            type Applies the type to its definition.
 * @private
 */
Component.prototype.implementsDirectly = function(type) {
    return this.componentDef.implementsDirectly(type);
};

/**
 * Dynamically adds an event handler for a component or application event.
 *
 * @example
 * // For component event, first param matches name attribute in <aura:registerEvent> tag
 * cmp.addEventHandler("compEvent", cmp.getReference("c.handleEvent"));
 *
 * // For application event, first param is event descriptor, "c:appEvent"
 * cmp.addEventHandler("c:appEvent", cmp.getReference("c.handleAppEvent"));
 *
 * // Anonymous function handler for component event
 * cmp.addEventHandler("compEvent", function(auraEvent) {
 *     // add handler logic here
 *     console.log("Handled the component event in anonymous function");
 * });
 *
 * @param {String} event The name of the event to handle.
 *   For a component event, set this argument to match the name attribute of the <code>aura:registerEvent</code> tag.
 *   For an application event, set this argument to match the event descriptor, <code>namespace:eventName</code>.
 * @param {Function} handler The handler for the event. There are two format options for this argument.
 *   To use a controller action, use the format: <code>cmp.getReference("c.actionName")</code>.
 *   To use an anonymous function, use the format: <code>function(auraEvent) { // handling logic here }</code>
 * @param {String} phase The event bubbling phase for which to add the handler. Optional. If omitted, uses "bubble".
 * @param {Boolean} includeFacets If true, attempt to catch events generated by components transcluded by facets, e.g. v.body.

 * @export
 * @platform
 */
Component.prototype.addEventHandler=function(event,handler,phase,includeFacets){
    // Guards
    if(this.destroyed){
        return;
    }
    if($A.util.isExpression(handler)){
        var reference=handler;
        handler=$A.eventService.expressionHandler.bind($A.eventService,handler);
        handler.reference=reference;
    }
    if(!$A.util.isFunction(handler)){
        throw new Error("Component.addEventHandler: 'handler' must be a valid Function or a reference to a controller action, e.g., 'cmp.getReference(\"c.myAction\");'");
    }
    var def=this.componentDef.getEventDef(event)||$A.eventService.getEventDef(event);
    // if(!def){
    //     throw new Error("Component.addEventHandler: 'event' must be a valid event descriptor. Unknown event '"+event+"'.");
    // }
    if(def&&def.type==="APPLICATION"){
        $A.eventService.addEventHandler(this,def,handler,phase,includeFacets);
        return;
    }
    phase=AuraEventService.validatePhase(phase,AuraEventService.Phase.BUBBLE);

    // Lazy initializations
    var dispatcher = this.getEventDispatcher();
    var handlers = dispatcher[event];
    if (!handlers) {
        handlers = dispatcher[event] = {};
    }
    var phaseHandlers = handlers[phase];
    if(!phaseHandlers) {
        handlers[phase] = phaseHandlers = [];
    }

    // Potentially extend scope of handler
    if(includeFacets){
        handler.includeFacets=true;
    }

    // Discard duplicates
    for(var i=0;i<phaseHandlers.length;i++){
        if(phaseHandlers[i]===handler || (phaseHandlers[i].reference&&phaseHandlers[i].reference===handler.reference)){
            return;
        }
    }

    phaseHandlers.push(handler);
};

/**
 * Adds an event handler. Resolving the handler Action happens at Event-handling
 * time, so the Action reference may be altered at runtime, and that change is
 * reflected in the handler.
 *
 * @param {String}
 *            eventName - The event name
 * @param {Object}
 *            valueProvider - The value provider to use for resolving the
 *            actionExpression.
 * @param {Object}
 *            actionExpression - The expression to use for resolving the handler
 *            Action against the given valueProvider.
 * @param {boolean}
 *            insert - The flag to indicate if we should put the handler at the
 *            beginning instead of the end of handlers array.
 * @param {String}
 *            phase - The target event phase; defaults to "bubble"
 * @param {Boolean}
 *            includeFacets If true, this handler will also be invoked when events
 *            flow from facet values whose value provider hierarchy does not
 *            include this component.
 * @public
 * @export
 * @platform
 * @deprecated use <code>addEventHandler</code> instead.
 */
Component.prototype.addHandler = function(eventName, valueProvider, actionExpression, insert, phase, includeFacets) {
// JBUCH:TODO
//    $A.deprecated("Component.addHandler() is no longer supported.","Please use Component.addEventHandler() instead.");
//     if(!$A.util.isExpression(actionExpression)){
//         actionExpression=valueProvider.getReference(actionExpression);
//     }
//     this.addEventHandler(eventName,actionExpression,phase,includeFacets);
    //
    if(this.destroyed){
        return;
    }
    var dispatcher = this.getEventDispatcher();
    if(!phase) {
        phase = "bubble";
    }

    var handlers = dispatcher[eventName];
    if (!handlers) {
        handlers = dispatcher[eventName] = {};
    }

    var phasedHandlers = handlers[phase];
    if(!phasedHandlers) {
        handlers[phase] = phasedHandlers = [];
    }

    var actionCaller = this.getActionCaller(valueProvider, actionExpression);
    if($A.util.getBooleanValue(includeFacets)) {
        actionCaller.includeFacets = true;
    }
    if (insert === true) {
        phasedHandlers.unshift(actionCaller);
    } else {
        phasedHandlers.push(actionCaller);
    }
};

/**
 * Dynamically removes a component event handler for the specified event.
 *
 * @param {String} event The name of the event to remove, e.g. 'c:myEvent'.
 * @param {Function} handler A reference to the function or action to action to remove, e.g., 'cmp.getReference("c.handleMyEvent");'.
 * @param {String} phase The event bubbling phase for which to remove the handler. Optional. If omitted, uses "default".
 *
 * @export
 * @platform
 */
Component.prototype.removeEventHandler=function(event,handler,phase) {
    // Guards
//    event=DefDescriptor.normalize(event);
    var def=this.componentDef.getEventDef(event)||$A.eventService.getEventDef(event);
    // if(!def){
    //     throw new Error("Component.removeEventHandler: 'event' must be a valid event descriptor. Unknown event '"+event+"'.");
    // }
    if(def&&def.type==="APPLICATION"){
        $A.eventService.removeEventHandler(this,def,handler,phase);
        return;
    }
    phase = AuraEventService.validatePhase(phase,AuraEventService.Phase.BUBBLE);

    var dispatcher=this.getEventDispatcher();
    var handlers=null;
    if (dispatcher !== null) {
        handlers = dispatcher[event];
    }
    if(handlers !== null){
        var phaseHandlers=handlers[phase];
        if(phaseHandlers){
            for(var i=0;i<phaseHandlers.length;i++){
                if(phaseHandlers[i]===handler||phaseHandlers[i].reference===handler){
                    phaseHandlers.splice(i,1);
                    break;
                }
            }
        }
    }
};

/**
 * Adds handlers to Values owned by the Component.
 *
 * @param {Object}
 *            config - Passes in the value, event (e.g. "change"), and action
 *            (e.g. "c.myAction").
 * @public
 * @export
 * @platform
 */
Component.prototype.addValueHandler = function(config) {
    var expression = config["value"];
    if($A.util.isExpression(expression)) {
        expression = expression.getExpression();
    }
    expression=expression+'';
    var component=this.getConcreteComponent();
    if(expression.indexOf("v.")===0){
        var attribute=expression.split('.')[1];
        var defs=AttributeSet.getDef(attribute,this);
        if(!$A.clientService.allowAccess(defs[0], defs[1])){
            var message="Access Check Failed! Component.addValueHandler(): attribute '"+attribute+"' of component '"+component+"' is not visible to '"+$A.clientService.currentAccess+"'.";
            if($A.clientService.enableAccessChecks){
                if($A.clientService.logAccessFailures){
                    $A.error(null,new $A.auraError(message));
                }
                return;
            }else{
                if($A.clientService.logAccessFailures){
                    $A.warning(message);
                }
            }
        }
    }
    if(config["method"]){
        config["method"]=$A.getCallback(config["method"]);
    }
    this.addChangeHandler(config);
};

// PRIVATE
Component.prototype.addChangeHandler = function(config){
    var expression = config["value"];
    var component=this.getConcreteComponent();
    if($A.util.isExpression(expression)) {
        expression = expression.getExpression();
    }

    if(config["action"]&&!config["method"]){
        config["method"]=this.getActionCaller(this, config["action"].getExpression());
    }

    var event = config["event"];
    var handlers = component.handlers[event];
    if (!handlers) {
        handlers = component.handlers[event] = {};
    }

    if (!handlers[expression]) {
        handlers[expression] = [];
    }

    for(var i=0;i<handlers[expression].length;i++){
        if (handlers[expression][i]===config["method"] || (config["id"] && config["key"] && handlers[expression][i]["id"] === config["id"] && handlers[expression][i]["key"] === config["key"])) {
            return;
        }
    }
    handlers[expression].push(config["method"]);
};

/**
 * @export
 */
Component.prototype.removeValueHandler = function(config) {
    var component = this.getConcreteComponent();
    var event = config["event"];
    var handlers = component.handlers[event];
    if (handlers) {
        var expression = config["value"];
        if ($A.util.isExpression(expression)) {
            expression = expression.getExpression();
        }
        if (handlers[expression]) {
            for (var i = 0; i < handlers[expression].length; i++) {
                var method = handlers[expression][i];
                if (method===config["method"] || (config["id"] && config["key"] && method["id"] === config["id"] && method["key"] === config["key"])) {
                    handlers[expression].splice(i--, 1);
                }
            }
        }
    }
};

/**
 * Add a document level event handler that auto-cleans.
 *
 * When called, this will create and return a handler that can be enabled and
 * disabled at will, and will be cleaned up on destroy.
 *
 * @public
 * @param {String}
 *            eventName the event name to attach.
 * @param {Function}
 *            callback the callback (only called when enabled, and component is
 *            valid & rendered)
 * @param {Boolean}
 *            autoEnable (truthy) enable the handler when created.
 * @return {Object} an object with a single visible call of setEnabled(Boolean)
 * @export
 */
Component.prototype.addDocumentLevelHandler = function(eventName, callback, autoEnable) {
    var dlh = new Aura.Utils.DocLevelHandler(eventName, callback, this);
    if (!this.docLevelHandlers) {
        this.docLevelHandlers = {};
    }
    $A.assert(this.docLevelHandlers[eventName] === undefined, "Same doc level event set twice");
    this.docLevelHandlers[eventName] = dlh;
    dlh.setEnabled(autoEnable);
    return dlh;
};

/**
 * Remove a document level handler.
 *
 * You need only call this if the document level handler should be destroyed, it
 * is not generally needed.
 *
 * @public
 * @param {Object}
 *            the object returned by addDocumentHandler.
 * @export
 */
Component.prototype.removeDocumentLevelHandler = function(dlh) {
    if (dlh && dlh.setEnabled) {
        dlh.setEnabled(false);
        this.docLevelHandlers[dlh.eventName] = undefined;
    }
};

/**
 * Destroys the component and cleans up memory.
 * After a component that is declared in markup is no longer in use, the framework automatically destroys it
 * and frees up its memory.
 * If you create a component dynamically in JavaScript and that component isn't added to a facet (v.body or another
 * attribute of type Aura.Component[]), you have to destroy it manually using destroy() to avoid memory leaks.
 *
 * <code>destroy()</code> destroys the component.
 *
 * @platform
 * @export
 */
Component.prototype.destroy = function() {
    if(arguments.length){
        $A.warning("Deprecation warning: Component.destroy() no longer supports asynchronous destruction. Please remove any arguments passed to destroy().");
    }

    // NoOp if we've already been through here, or if we're returning via circular reference; 1, -1
    if(this.destroyed){
        return;
    }

    // Destroy from the most concrete component up the chain
    if(this.concreteComponentId){
        var concrete = this.getConcreteComponent();
        // If the concrete component is not already destroying, exit and re-enter
        // getConcreteComponent() turns into the super after we've destroyed their concretes.
        if (concrete&&concrete!==this&&!concrete.destroyed){
            concrete.destroy();
            return;
        }
    }

    // Mark destroying; This will cause isValid to return false, but still allow .get() and .set()
    this.destroyed=-1;

    // Fire component event for developer cleanup
    this.fire("destroy");

    // Disable and remove document level handlers
    if (this.docLevelHandlers !== undefined) {
        for (var handler in this.docLevelHandlers) {
            if(this.docLevelHandlers.hasOwnProperty(handler)){
                this.docLevelHandlers[handler].setEnabled(false);
            }
        }
        this.docLevelHandlers=undefined;
    }

    // call unrender before setting _destroying
    // so that _destroying could be used for isValid check.
    $A.renderingService.unrender(this);

    if(this._marker) {
        $A.renderingService.removeMarkerReference(this._marker, this.getGlobalId());
        $A.renderingService.removeElement(this._marker, this.getContainer());
        this._marker = null;
    }
    this.elements=undefined;
    this.allElements=undefined;

    // Reset all attributes and clear expressions;
    // Don't do this until the topmost parent, to allow customer code to read attributes in destroy events
    if (this.attributeSet && !this.superComponent) {
        var expressions=this.attributeSet.destroy();
        for(var x in expressions){
            expressions[x].removeChangeHandler(this,"v."+x);
        }
        //break link to AttributeSet instance once it has been destroyed
        this.attributeSet = null;
    }

    var references=this.references;
    for(var key in references){
        if(references[key]){
            for(var access in references[key]){
                references[key][access].destroy();
                delete references[key][access];
            }
        }
        delete references[key];
    }

    // Destroy model
    if (this.model) {
        this.model.destroy();
    }

    // Detach all application event handlers
    $A.eventService.removeHandlersByComponentId(this.globalId);
    // JBUCH: TODO: CONFIRM REDUNDANT TO THE LINE ABOVE:
    var componentDef=this.getDef();
    var handlerDefs = componentDef.getAppHandlerDefs();
    if (handlerDefs) {
        for (var i = 0; i < handlerDefs.length; i++) {
            var handlerDef = handlerDefs[i];
            var handlerConfig = {};
            handlerConfig["globalId"] = this.globalId;
            handlerConfig["event"] = handlerDef["eventDef"].getDescriptor().getQualifiedName();
            $A.eventService.removeHandler(handlerConfig);
        }
    }

    // Detach all event handlers
    var eventDispatcher = this.getEventDispatcher();
    if (eventDispatcher) {
        for(var event in eventDispatcher) {
            var vals = eventDispatcher[event];
            if (vals) {
                for(var phase in vals) {
                    var arr = vals[phase];
                    if(arr) {
                        for (var j = 0; j < arr.length; j++) {
                            delete arr[j];
                        }
                    }
                }

                delete eventDispatcher[event];
            }
        }
        this.eventValueProvider = null;
    }

    // Deindex all child components
    this.doDeIndex();

    // Deindex self
    $A.componentService.deIndex(this.globalId);

    //Lets clean up the components attributeValueProvider too (prevent a memory leak)
    this.attributeValueProvider = null;

    // Destroy immediate parent
    if(this.superComponent){
        this.superComponent.destroy();
    }

    // Destroy valueProviders
    // AttributeSet was leaking becasue it was tied to valueProviders
    var vp = this.valueProviders;
    if(vp) {
        for(var k in vp) {
            var v = vp[k];
            if (v && v !== this) {
                vp[k] = null;
            }
        }
    }

    // Destroy handlers
    // PropertyReferenceValue was leaking becasue it was tied to handlers
    var handlers = this.handlers;
    if(handlers) {
        for(var h in handlers) {
            handlers[h] = null;
        }
        handlers = null;
    }

    // Destroyed. Mark invalid
    this.destroyed=1;
};

/**
 * Execute the super component's render method.
 * @protected
 * @export
 * @platform
 */
Component.prototype.superRender = function() {
    if (this.superComponent) {
        return this.superComponent["render"]();
    }
};

/**
 * Execute the super component's afterRender method.
 * @protected
 * @export
 * @platform
 */
Component.prototype.superAfterRender = function() {
    if (this.superComponent) {
        this.superComponent["afterRender"]();
    }
};

/**
 * Execute the super component's rerender method.
 * @protected
 * @export
 * @platform
 */
Component.prototype.superRerender = function() {
    if (this.superComponent) {
        return this.superComponent["rerender"]();
    }
};

/**
 * Execute the super component's superUnrender method.
 * @protected
 * @export
 * @platform
 */
Component.prototype.superUnrender = function() {
    if (this.superComponent) {
        this.superComponent["unrender"]();
    }
};

/**
 * Returns true if this component has been rendered but not unrendered (does not
 * necessarily mean component is in the dom tree).
 *
 * @protected
 * @platform
 * @export
 */
Component.prototype.isRendered = function() {
    return this.rendered;
};

/**
 * Returns true if this component has been rendered but not unrendered (does not
 * necessarily mean component is in the dom tree).
 *
 * @private
 */
Component.prototype.setUnrendering = function(unrendering) {
    this.inUnrender = unrendering;
};

/**
 * Returns true if this component has been rendered but not unrendered (does not
 * necessarily mean component is in the dom tree).
 *
 * @private
 */
Component.prototype.isUnrendering = function() {
    return this.inUnrender;
};

/**
 * Sets the rendered flag.
 *
 * @param {Boolean}
 *            rendered Set to true if component is rendered, or false otherwise.
 * @protected
 */
Component.prototype.setRendered = function(rendered) {
    this.rendered = rendered;
};

/**
 * Returns the renderer instance for this component.
 *
 * @protected
 * @export
 */
Component.prototype.getRenderer = function() {
    return this["renderer"];
};

/**
 * Returns the renderable instance for this component.
 * @protected
 * @export
 */
Component.prototype.getRenderable = function() {
    return this["renderer"].renderable;
};

/**
 * Gets the globalId. This is the generated globally unique id of the component.
 * It can be used to locate the instance later, but will change across
 * page loads.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.getGlobalId = function() {
    return this.concreteComponentId || this.globalId;
};

/**
 * Gets the id set using the <code>aura:id</code> attribute. Can be passed into
 * <code>find()</code> on the parent to locate this child.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.getLocalId = function() {
    return this.localId;
};

/**
 * If the server provided a rendering of this component, return it.
 *
 * @public
 * @export
 */
Component.prototype.getRendering = function() {
    var concrete = this.getConcreteComponent();

    if (this !== concrete) {
        return concrete.getRendering();
    } else {
        return this.rendering;
    }
};

/**
 * Returns the super component.
 *
 * @platform
 * @export
 */
Component.prototype.getSuper = function() {
    return this.superComponent;
};

/**
 * Associates a rendered element with the component that rendered it for later
 * lookup. Also adds the rendering component's global Id as an attribute to the
 * rendered element. Primarily called by RenderingService.
 *
 * @param {HTMLElement} element - the element to associate with the component
 *
 * @protected
 * @export
 */
Component.prototype.associateElement = function(element) {
    var concrete = this.getConcreteComponent();
    if (concrete !== this) {
        concrete.associateElement(element);
    } else if (this.isConcrete()) {
        // For now, there're two cases which getConcreteComponent() returns
        // the component itself. 1) the component is concrete, 2) the concrete
        // component has been destroyed. We should only associate the element to
        // concrete component.

        if (!this.elements) {
            this.elements = [];
        }

        if (!this.allElements) {
            this.allElements = [];
        }

        this.allElements.push(element);
        // Is it NOT a marker, put it in the customer accessed elements collection.
        if (!element.aura_marker) {
            this.elements.push(element);
            this.associateRenderedBy(this, element);
        }
    }
};

/**
 * Disassociates a rendered element with the component that rendered it for later
 * lookup.
 *
 * @protected
 * @export
 */
Component.prototype.disassociateElements = function() {
    var concrete = this.getConcreteComponent();
    if (concrete !== this) {
        concrete.disassociateElements();
    } else {
        if (this.elements) {
            this.elements.length = 0;
        }
        if (this.allElements) {
            this.allElements.length = 0;
        }
    }
};

/**
 * Returns a map of the elements previously rendered by this component.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.getElements = function() {
    var concrete = this.getConcreteComponent();
    if (concrete !== this) {
        return concrete.getElements();
    } else {
        return (this.elements && this.elements.slice(0)) || [];
    }
};

/**
 * If the component only rendered a single element, return it. Otherwise, you
 * should use <code>getElements()</code>.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.getElement = function() {
    var elements = this.getElements();
    if (elements) {
        for (var i = 0; i<elements.length; i++) {
            if (elements[i]) {
                return elements[i];
            }
        }
    }
    return null;
};
/**
 * Returns a live reference to the value indicated using property syntax.
 * This is useful when you dynamically create a component.
 *
 * @example
 * $A.createComponent(
 *     "ui:button",
 *     {
 *         "aura:id": "findableAuraId",
 *         "label": "Press Me",
 *         "press": cmp.getReference("c.handlePress")
 *     },
 *     function(newButton){
 *         // Do something with the new button
 *     }
 * );
 *
 * @param {String}
 *            key - The data key for which to return a reference.
 * @return {PropertyReferenceValue}
 * @public
 * @platform
 * @export
 */
Component.prototype.getReference = function(key) {
    if(this.destroyed===1){
        return null;
    }
    key = $A.expressionService.normalize(key);
    var access=$A.clientService.currentAccess;
    var accessId=access&&access.getGlobalId();
    if(!this.references.hasOwnProperty(key)) {
        this.references[key] = {};
    }
    if(!this.references[key].hasOwnProperty(accessId)) {
        this.references[key][accessId] = new PropertyReferenceValue(key, this);
    }
    return this.references[key][accessId];
};

/**
 * Clears a live reference for the value indicated using property syntax.
 * For example, if you use aura:set to set a value and later want to reset the value using <code>component.set()</code>,
 * clear the reference before resetting the value.
 *
 * @param {String}
 *            key The data key for which to clear the reference. For example, <code>"v.attributeName"</code>.
 * @public
 * @platform
 * @export
 */
Component.prototype.clearReference = function(key) {
    if(!this.destroyed) {
        key = $A.expressionService.normalize(key);
        $A.assert(key.indexOf('.') > -1, "Unable to clear reference for key '" + key + "'. No value provider was specified. Did you mean 'v." + key + "'?");
        var path = key.split('.');
        var valueProvider = this.getValueProvider(path.shift());
        $A.assert(valueProvider, "Unknown value provider for key '" + key + "'.");
        $A.assert(valueProvider.clearReference, "Value provider does not implement clearReference() method.");
        var subPath = path.join('.');
        var value = valueProvider.clearReference(subPath);
        if ($A.util.isExpression(value)) {
            value.removeChangeHandler(this, key);
        }
    }
};

/**
 * Returns the value referenced using property syntax.
 * For example, <code>cmp.get("v.attr")</code> returns the value of the attr aura:attribute.
 *
 * @param {String}
 *            key - The data key to look up on the Component.
 * @public
 * @platform
 * @export
 */
Component.prototype.get = function(key) {
    if(this.destroyed===1){
        return undefined;
    }

    if(!$A.util.isString(key)) {
        var msg = "The provided key (" + key + ") is not a string and cannot be used to look up values for the current component.";
        throw new $A.auraError(msg);
    }

    key = $A.expressionService.normalize(key);
    var path = key.split('.');
    var root = path.shift();
    var valueProvider = this.getValueProvider(root);
    if (path.length) {
        if(!valueProvider){
            $A.assert(false, "Unable to get value for key '" + key + "'. No value provider was found for '" + root + "'.");
        }

        var value;
        if($A.util.isFunction(valueProvider.get)){
            value = valueProvider.get(path.join('.'),this);
        }else{
            value = $A.expressionService.resolve(path,valueProvider);
        }

        return value;
    } else {
        return valueProvider;
    }
};

/**
 * Returns a shadow value. Used for programmatically adding values after FCVs.
 * THIS IS NOT FOR YOU. DO NOT USE.
 *
 * @param {String}
 *            key The data key to look up on the Component.
 * @private
 */
Component.prototype.getShadowAttribute = function(key) {
    if(key.indexOf('v.')!==0){
        return null;
    }
    return this.attributeSet.getShadowValue(key.substr(2));
};

/**
 * Sets the value referenced using property syntax.
 *
 * @param {String}
 *            key - The data key to set on the Component. E.g.
 *            <code>cmp.set("v.key","value")</code>
 * @param {Object}
 *            value - The value to set
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.set = function(key, value, ignoreChanges) {
    if(this.destroyed!==1) {
        key = $A.expressionService.normalize(key);
        $A.assert(key.indexOf('.') > -1, "Unable to set value for key '" + key + "'. No value provider was specified. Did you mean 'v." + key + "'?");

        var path = key.split('.');
        var root = path.shift();
        var valueProvider = this.getValueProvider(root);

        if (!valueProvider) {
            $A.assert(false, "Unable to set value for key '" + key + "'. No value provider was found for '" + root + "'.");
        }
        if (!valueProvider.set) {
            $A.assert(false, "Unable to set value for key '" + key + "'. Value provider does not implement 'set(key, value)'.");
        }
        var subPath = path.join('.');

        var oldValue = valueProvider.get(subPath, this);

        //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
        // Check if the previous value contains only components
        if ($A.util.isArray(oldValue) && oldValue.length) {
            var containsOnlyComponents = true;
            for (var i = 0; i < oldValue.length && containsOnlyComponents; i++) {
                containsOnlyComponents = $A.util.isComponent(oldValue[i]);
            }

            if (containsOnlyComponents) {
                this.trackComponentReplacement(oldValue, key);
            }
        }
        //#end

        var returnValue = valueProvider.set(subPath, value, this);
        if ($A.util.isExpression(value)) {
            value.addChangeHandler(this, key);
            if (!ignoreChanges) {
                value = value.evaluate();
            }
        }

        var changed = $A.util.isArray(value) || $A.util.isObject(value) || oldValue !== value;
        if (changed && !ignoreChanges) {
            $A.renderingService.addDirtyValue(key, this);
            var index = path.length > 1 ? path[path.length - 1] : undefined;
            this.fireChangeEvent(key, oldValue, value, index);
        }
        return returnValue;
    }
};

//#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
/**
 * Add a warning in the console if a list of components is not rendered by the end
 * of the current event loop. This pattern usually lead to memory leaks.
 *
 * @param {Component[]} prevComp The list of component that has been replaced
 * @param {string} key The attribute key
 */
Component.prototype.trackComponentReplacement = function(prevCmps, key) {
    // Filter valid and not rendered components
    var potentialLeak = [];
    for (var i = 0; i < prevCmps.length; i++) {
        if (prevCmps[i].isValid() && !prevCmps[i].isRendered() && prevCmps[i].autoDestroy()) {
            potentialLeak.push(prevCmps[i]);
        }
    }

    if (potentialLeak.length) {
        var owner = this;
        var handler = function() {
            // Compute again if the some components are still not rendered
            var actualLeak = [];
            for (var j = 0; j < potentialLeak.length; j++) {
                if (potentialLeak[j].isValid() && !potentialLeak[j].isRendered() && potentialLeak[j].autoDestroy()) {
                    actualLeak.push(potentialLeak[j]);
                }
            }

            if (actualLeak.length) {
                $A.warning([
                    '[Performance degradation] ',
                    actualLeak.length + ' component(s) in ' + owner.getType() + ' ["' + owner.getGlobalId() + '"] ',
                    'have been created and removed before being rendered when calling cmp.set("' + key + '").\n',
                    'More info: https://sfdc.co/performance-aura-component-set\n',
                    'Component hierarchy: ' + $A.util.getComponentHierarchy(owner)
                ].join(''));
            }
        };

        // This event is triggered by the renderingService.rerenderDirty method
        $A.eventService.addHandlerOnce({
            'event': 'aura:doneRendering',
            'globalId': 'componentService',
            'handler': handler
        });
    }
};
//#end

/**
 * Sets a shadow attribute. Used for programmatically adding values after FCVs.
 * THIS IS NOT FOR YOU. DO NOT USE.
 *
 * @param {String}
 *            key The data key to set on the Component.
 * @private
 */
Component.prototype.setShadowAttribute = function(key,value) {
    if(key.indexOf('v.')===0) {
        var oldValue = this.get(key);
        var attribute = key.substr(2);
        this.attributeSet.setShadowValue(attribute, value);
        var newValue=this.get(key);
        if(oldValue!==newValue) {
            $A.renderingService.addDirtyValue(key, this);
            this.fireChangeEvent(key, oldValue, newValue);
        }
    }
};


/**
 * @export
 */
Component.prototype.markDirty=function(reason){
    if(!this.destroyed) {
        $A.renderingService.addDirtyValue(reason || "Component.markDirty()", this);
    }
};

/**
 * @export
 */
Component.prototype.markClean=function(value) {
    $A.renderingService.removeDirtyValue(value, this);
};

Component.prototype.fireChangeEvent=function(key,oldValue,newValue,index){
    // JBUCH: HALO: FIXME: CAT 5: WE SEEM TO BE LEAKING VALUE CHANGE EVENTHANDLERS;
    // FIND THE REAL REASON AND REMOVE THE EVENT HANDLER, AS WELL AS THIS SHORTSTOP NPE FIX
    if(!this.destroyed){
        var component=this.concreteComponentId?this.getConcreteComponent():this;
        var handlers = component.handlers && component.handlers["change"];
        var observers=[];
        var keypath = key+".";
        for(var handler in handlers){
            if(handler === key || handler.indexOf(keypath)===0 || key.indexOf(handler+".")===0){
                observers=observers.concat(handlers[handler]);
            }
        }
        if (observers.length) {
            var eventDef = $A.eventService.getEventDef("aura:valueChange");
            var dispatcher = {};
            dispatcher[eventDef.getDescriptor().getQualifiedName()] = {"default": observers};
            var changeEvent = new Aura.Event.Event({
                "eventDef" : eventDef,
                "eventDispatcher" : dispatcher,
                "component" : this
            });

            changeEvent.setParams({
                "expression" : key,
                "value" : newValue,
                "oldValue" : oldValue,
                "index" : index
            });
            changeEvent.fire();
        }
    }
};

/**
 * Sets a flag to tell the rendering service whether or not to destroy this component when it is removed
 * from its rendering facet. Set to false if you plan to keep a reference to a component after it has
 * been unrendered or removed from a parent facet. Default is true: destroy once orphaned.
 * @param {Boolean} destroy - The flag to specify whether or not to destroy this component automatically.
 *   We don't recommend setting the value to false. If you do, be careful to avoid memory leaks.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.autoDestroy = function(destroy) {
    if(!$A.util.isUndefinedOrNull(destroy)) {
        this.shouldAutoDestroy = !!destroy;
    }else{
        return this.shouldAutoDestroy;
    }
};

/**
 * Gets the concrete implementation of a component. If the component is
 * concrete, the method returns the component itself. For example, call this
 * method to get the concrete component of a super component.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.getConcreteComponent = function() {
    // Using && and || vs ? and : so that if the get of the get of the id fails, we still return a component instance.
    // If you destroy the concrete, then the concrete of the super becomes itself.
    return (this.concreteComponentId && $A.componentService.get(this.concreteComponentId)) || this;
};

/**
 * Returns true if the component is concrete, or false otherwise.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.isConcrete = function() {
    return !this.concreteComponentId;
};

/**
 * Returns the value provider.
 *
 * @return {Object} value provider
 * @public
 * @export
 */
Component.prototype.getAttributeValueProvider = function() {
    return this.attributeValueProvider||this;
};

/**
 * @export
 */
Component.prototype.setAttributeValueProvider = function (avp) {
    // Kris: This causes problems, and until people move their finds to the new AVP
    // We can't fix this.
    // var currentAttributeValueProvider = this.getAttributeValueProvider();
    // currentAttributeValueProvider.doDeIndex();

    this.attributeValueProvider = avp;
    if(avp) {
        // JBA: without this, programmatically created components exhibit indeterministic owners
        // with no way for the creator to fix
        this.owner = avp.globalId;

        // Allow finding on the new valueProvider
        avp.index(this.localId, this.globalId);
    }

};

/**
 * Returns the value provider of the component.
 *
 * @return {Object} component or value provider
 * @public
 * @export
 */
Component.prototype.getComponentValueProvider = function() {
    var valueProvider = this.attributeValueProvider||this.facetValueProvider;
    while (!$A.util.isComponent(valueProvider) && $A.util.isFunction(valueProvider.getComponent)) {
        valueProvider = valueProvider.getComponent();
    }
    return valueProvider;
};

/**
 * Returns the owner of the component. This should represent the lexical scope for markup components, and the
 * component calling the create method for dynamically instantiated components, i.e. $A.createComponent().
 *
 * @return {Object} Owning component
 * @public
 * @export
 */
Component.prototype.getOwner = function() {
    if($A.util.isUndefinedOrNull(this.owner)){
        this.owner = this.getAttributeValueProvider().globalId;
    }
    return $A.componentService.get(this.owner);
};

/**
 * Returns the container component of the component.
 * The container is the component that owns the facet attribute for
 * which this component is a value. This may be different than the
 * result from getComponentValueProvider(), particularly if this
 * component was transcluded into its container and not created
 * directly by its container.
 *
 * @return {Object} Containing component
 * @private
 */
Component.prototype.getContainer = function() {
    return $A.getComponent(this.containerComponentId);
};

/**
 * Adds Custom ValueProviders to a component
 * @param {String} key - string by which to identify the valueProvider. Used in expressions in markup, etc.
 * @param {Object} valueProvider - the object to request data from. Must implement .get(expression), can implement .set(key,value).
 * @public
 * @platform
 * @export
 */
Component.prototype.addValueProvider = function(key, valueProvider) {
    if (this.destroyed) {
        return;
    }

    $A.assert($A.util.isString(key), "Component.addValueProvider(): 'key' must be a valid String.");
    $A.assert(",v,m,c,e,this,globalid,def,super,null,version,".indexOf("," + key.toLowerCase() + ",") === -1, "Component.addValueProvider(): '" + key + "' is a reserved valueProvider.");
    $A.assert(!$A.util.isUndefinedOrNull(valueProvider), "Component.addValueProvider(): 'valueProvider' is required.");

    if (this.valueProviders[key] !== undefined) {
        $A.warning("The value provider already existes: " + key);
        return;
    }

    this.valueProviders[key] = valueProvider;
};

/**
 * Removes a custom value provider from a component
 * @param {String} key string by which to identify the valueProvider to remove.
 * @public
 */
Component.prototype.removeValueProvider = function(key) {
    if (this.destroyed) {
        return;
    }

    $A.assert($A.util.isString(key), "Component.removeValueProvider(): 'key' must be a valid String.");
    $A.assert(",v,m,c,e,this,globalid,def,super,null,version,".indexOf("," + key.toLowerCase() + ",") === -1, "Component.removeValueProvider(): '" + key + "' is a reserved valueProvider and can not be removed.");

    if (this.valueProviders.hasOwnProperty(key)) {
        this.valueProviders[key] = undefined;
    }
};

/**
 * Returns the model for this instance, if one exists. Shorthand :
 * <code>get("m")</code>
 *
 * @public
 * @export
 */
Component.prototype.getModel = function() {
    return this.model;
};

/**
 * Returns a new event instance of the named component event.
 * @example
 * // evtName matches the name attribute in aura:registerEvent
 * cmp.getEvent("evtName")
 *
 * @param {String}
 *            name - The name of the Event.
 * @public
 * @platform
 * @export
 */
Component.prototype.getEvent = function(name) {
    var eventDef = this.getDef().getEventDef(name);
    if(!eventDef || this.destroyed===1){
        return null;
    }
    if (!$A.clientService.allowAccess(eventDef,this)) {
        var message="Access Check Failed! Component.getEvent():'" + name + "' of component '" + this + "' is not visible to '" + $A.clientService.currentAccess + "'.";
        if($A.clientService.enableAccessChecks) {
            if($A.clientService.logAccessFailures){
                $A.error(null,new $A.auraError(message));
            }
            return null;
        }else{
            if($A.clientService.logAccessFailures){
                $A.warning(message);
            }
        }
    }
    return new Aura.Event.Event({
        "name" : name,
        "eventDef" : eventDef,
        "component" : this.getConcreteComponent()
    });
};

/**
 * Get an event by descriptor qualified name.
 *
 * This is only used by action for firing of component events. It is a bit of a
 * hack (reversing the map).
 *
 * @param {String}
 *            descriptor a descriptor qualified name.
 * @return {String} null, or the component event.
 * @protected
 */
Component.prototype.getEventByDescriptor = function(descriptor) {
    var name = this.getDef().getEventNameByDescriptor(descriptor);
    if (name === null) {
        return null;
    }
    return this.getEvent(name);
};

/**
 * @private
 */
Component.prototype.fire = function(name) {
    var dispatcher=this.getEventDispatcher();
    if(!dispatcher){
        return;
    }
    var eventDef = this.componentDef.getEventDef(name,true);
    var eventQName = eventDef.getDescriptor().getQualifiedName();
    var handlers = dispatcher[eventQName];
    if(handlers) {
        var event = new Aura.Event.Event({
            "eventDef" : eventDef,
            "eventDispatcher" : dispatcher
        });
        event.setParams({
            value : this
        });
        event.fire();
    }
};

/**
 * Looks up the specified value and checks if it is currently dirty.
 *
 * @returns true if the value is dirty, and false if it is clean or does not
 *          exist.
 * @public
 * @deprecated TEMPORARY WORKAROUND
 * @export
 */
Component.prototype.isDirty = function(expression) {
    if(!expression){
        return $A.renderingService.hasDirtyValue(this);
    }
    return $A.renderingService.isDirtyValue(expression, this);
};

/**
 * Returns true if the component has not been destroyed.
 *
 * @public
 * @platform
 * @export
 */
Component.prototype.isValid = function() {
    return !this.destroyed;
};

/**
 * Returns a string representation of the component for logging.
 *
 * @public
 * @export
 */
Component.prototype.toString = function() {
    if(!this._description){
        this._description=this.getDef() + ' {' + this.globalId + '}' + (this.getLocalId() ? ' {' + this.getLocalId() + '}' : '');
    }
    var attributesOutput = [];
    // Debug Info
    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    var attributeSet = this.attributeSet;
    if(attributeSet){
        for(var key in attributeSet.values) {
            attributesOutput.push(" "+ key + " = \"" + attributeSet.values[key] +"\"");
        }
    }
    //#end
    return this._description + attributesOutput.join(",");
};

/**
 * Returns component serialized as Json string
 *
 * @private
 */
Component.prototype.toJSON = function() {
    return {
        "globalId": this.globalId,
        "isValid": this.isValid()
    };
};

/**
 * Returns an object whose keys are the lower-case names of Aura events for
 * which this component currently has handlers.
 * @export
 */
Component.prototype.getHandledEvents = function() {
    var ret = {};
    var concrete = this.getConcreteComponent();
    var eventDispatcher = concrete.getEventDispatcher();
    if (eventDispatcher) {
        for ( var name in eventDispatcher) {
            if (eventDispatcher.hasOwnProperty(name)) {
                // determine if the event has any handlers registered to any phase
                var eventHandlerConfig = eventDispatcher.hasOwnProperty(name) && eventDispatcher[name];
                for( var phase in eventHandlerConfig) {
                    if( eventHandlerConfig.hasOwnProperty(phase) && eventHandlerConfig[phase].length ) {
                        ret[name.toLowerCase()] = true;
                        break; // no need to check the other phases
                    }
                }
            }
        }
    }

    return ret;
};

/**
 * Check if we have an event handler attached.
 *
 * @param {String}
 *            eventName The event name associated with this component.
 * @export
 */
Component.prototype.hasEventHandler = function(eventName) {
    if (eventName) {
        var handledEvents = this.getHandledEvents();
        return handledEvents[eventName.toLowerCase()];
    }
    return false;
};

/**
 * Returns an array of this component's facets, i.e., attributes of type
 * <code>aura://Aura.Component[]</code>
 * @export
 */
Component.prototype.getFacets = function() {
    if (!this._cachedFacetNames) {
        // grab the names of each of the facets from the ComponentDef
        var facetNames = [];
        var attributeDefs = this.getDef().getAttributeDefs();
        var values = attributeDefs.getValues();

        if(values) {
            var valueNames = attributeDefs.getNames();
            var attributeDef;
            for(var c=0,length=valueNames.length;c<length;c++) {
                attributeDef = values[valueNames[c]];
                if (attributeDef.getTypeDefDescriptor() === "aura://Aura.Component[]") {
                    facetNames.push(attributeDef.getDescriptor().getName());
                }
            }
        }

        // cache the names--they're not going to change
        this._cachedFacetNames = facetNames;
    }

    // then grab each of the facets themselves
    var names = this._cachedFacetNames;
    var facets = [];
    for (var i = 0, len = names.length; i < len; i++) {
        facets.push(this.get("v." + names[i]));
    }

    return facets;
};


/**
 * Returns true if this is a flavorable html element.
 * @export
 */
Component.prototype.isFlavorable = function() {
	return this.flavorable;
};

/**
 * Gets the flavor reference. This is either the flavor explicitly set on the
 * component instance (component def ref) or it is the default flavor of the
 * component, if a default (or app override) exists.
 *
 * @returns {String} The flavor, e.g., "default" or "xyz.flavors.default", etc...
 * @export
 */
Component.prototype.getFlavor = function() {
	return this.flavor || this.getDef().getDefaultFlavor();
};

/**
 * Invoke the render method defined on the component.
 * @export
 */
Component.prototype.render = function() {
    if(this.destroyed){
        return null;
    }
    var render = this["renderer"] && this["renderer"]["render"];
    if(render){
        $A.clientService.setCurrentAccess(this);
        try {
            var secureThis = $A.lockerService.wrapComponent(this);
            var result = render(secureThis, this["helper"]);

            // Locker: anytime framework receive DOM elements from a locked down component
            // it should unwrap them before using them. For regular components, this is
            // a non-opt:
            if (secureThis !== this) {
                result = $A.lockerService.unwrap(this, result);
            }

            return result;
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    } else {
        return this.superRender();
    }
};

/**
 * Invoke the afterRender method defined on the component.
 * @export
 */
Component.prototype.afterRender = function() {
    if(this.destroyed){
        return;
    }
    var afterRender = this["renderer"] && this["renderer"]["afterRender"];
    if(afterRender){
        $A.clientService.setCurrentAccess(this);
        try {
            afterRender($A.lockerService.wrapComponent(this), this["helper"]);
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    } else {
        this.superAfterRender();
    }
};


/**
 * Invoke the rerender method defined on the component.
 * @export
 */
Component.prototype.rerender = function() {
    if(this.destroyed){
        return null;
    }
    var rerender = this["renderer"] && this["renderer"]["rerender"];
    if(rerender){
       $A.clientService.setCurrentAccess(this);
        try {
            var secureThis = $A.lockerService.wrapComponent(this);
            var result = rerender(secureThis, this["helper"]);
            // Locker: anytime framework receive DOM elements from a locked down component
            // it should unwrap them before using them. For regular components, this is
            // a non-opt:
            if (secureThis !== this) {
                result = $A.lockerService.unwrap(this, result);
            }
            return result;
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
     } else {
        return this.superRerender();
   }
};

/**
 * Invoke the unrender method defined on the component.
 * @export
 */
Component.prototype.unrender = function() {
    if(this.destroyed===1){
        return;
    }
    // Clean any dirty values so we don't attempt to rerender.
    $A.renderingService.cleanComponent(this.globalId);

    var unrender = this["renderer"] && this["renderer"]["unrender"];
    if(unrender){
        $A.clientService.setCurrentAccess(this);
        try {
            unrender($A.lockerService.wrapComponent(this), this["helper"]);
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
     } else {
        // If a component extends the root component and doesn't implement it's own
        // unrender function then we need to execute this default unrender. See aura:text.
        if (this.isRootComponent) {
            $A.renderingService.unrenderFacet(this);
        }

        this.superUnrender();
    }
};

/**
 * Get the expected version number of a component based on its caller's requiredVersionDefs
 * Note that for various rendering methods, we cannot rely on access stack.
 * We use creation version instead.
 * @platform
 * @export
 */
Component.prototype.getVersion = function() {
    if (this.destroyed) {
        return null;
    }

    var ret = this.getVersionInternal();
    return ret ? ret : this.get("version");
};

/**
 * Get version from context access stack
 *
 * @private
 */
Component.prototype.getVersionInternal = function() {
    return $A.clientService.getAccessVersion(this.getType().split(':')[0]);
};

/**
 * Get value provider
 * @param {string} key A string by which to identify the valueProvider.
 * @private
 */
Component.prototype.getValueProvider = function(key) {
    if (this.valueProviders.hasOwnProperty(key)) {
        return this.valueProviders[key];
    }

    key = key.toLowerCase();
    if (this.valueProviders.hasOwnProperty(key)) {
        return this.valueProviders[key];
    }
};

/**
 * Create the value providers
 */
Component.prototype.setupValueProviders = function(customValueProviders) {
        // Have to do before setup Attributes.
    // Since it is a value provider, I'm adding it here.
    if(!this.attributeSet) {
        this.attributeSet = this.isConcrete() ? new AttributeSet(this.componentDef.attributeDefs) : this.getConcreteComponent().attributeSet;
    }

    var vp=this.valueProviders;

    vp["v"]=this.attributeSet;
    vp["m"]=this.model;
    vp["c"]=this.createActionValueProvider();
    vp["e"]=this.createEventValueProvider();
    vp["this"]=this;
    vp["globalid"]=this.getGlobalId();
    vp["def"]=this.componentDef;
    vp["style"]=this.createStyleValueProvider();
    vp["super"]=this.superComponent;
    vp["null"]=null;
    vp["version"] = this.version ? this.version : this.getVersionInternal();

    if (customValueProviders) {
        for (var key in customValueProviders) {
            this.addValueProvider(key, customValueProviders[key]);
        }
    }
};

Component.prototype.createActionValueProvider = function() {
    var controllerDef = this.componentDef.getControllerDef();
    if (controllerDef || this['controller']) {
        return new ActionValueProvider(this, controllerDef);
    }
};

Component.prototype.createStyleValueProvider = function() {
    return new StyleValueProvider(this);
};

/**
 * A reference to the ComponentDefinition for this instance
 */
Component.prototype.setupComponentDef = function(config) {
    var componentDef = $A.componentService.getDef(config["componentDef"]);
    $A.assert(componentDef, "componentDef is required");
    this.componentDef = componentDef;

    if (config["original"]) { // We have to replace the abstractdef for the concrete one
        this.replaceComponentClass(componentDef.getDescriptor().getQualifiedName());
    }

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);
};

Component.prototype.createComponentStack = function(facets, valueProvider){
    var facetStack = {};
    for (var i = 0; i < facets.length; i++) {
        var facet = facets[i];
        var facetName = facet["descriptor"];

        var facetConfig = facet["value"];
        if (!$A.util.isArray(facetConfig)) {
            facetConfig = [facetConfig];
        }
        var action = $A.getContext().getCurrentAction();
        if (action) {
            action.pushCreationPath(facetName);
        }
        var components = [];
        for (var index = 0; index < facetConfig.length; index++) {
            var config = facetConfig[index];
            if ($A.util.isComponent(config)) {
                components.push(config);
                config.setContainerComponentId(this.globalId);
            } else if (config && config["componentDef"]) {
                if (action) {
                    action.setCreationPathIndex(index);
                }

                $A.clientService.setCurrentAccess(valueProvider);
                try {
                    var facetConfigAttr = { "values": {} };
                    var facetConfigClone = $A.util.apply({}, config);

                    if (facetConfigClone["attributes"]) {
                        $A.util.apply(facetConfigAttr["values"], config["attributes"]["values"], true);
                    } else {
                        facetConfigClone["attributes"] = {};
                    }

                    facetConfigAttr["valueProvider"] = (config["attributes"] && config["attributes"]["valueProvider"]) || valueProvider;
                    facetConfigClone["attributes"] = facetConfigAttr;
                    facetConfigClone["containerComponentId"] = this.globalId;
                    components.push($A.componentService.createComponentPriv(facetConfigClone));
                } finally {
                    $A.clientService.releaseCurrentAccess();
                }
            } else {
                // KRIS: HALO: This is hit, when you create a newComponentDeprec and use raw values, vs configs on the attribute values.
                throw new $A.auraError("Component.createComponentStack: invalid config. Expected component definition, found '"+config+"'.", null, $A.severity.QUIET);
            }
        }
        if (action) {
            action.popCreationPath(facetName);
        }
        facetStack[facetName]=components;
    }
    return facetStack;
};


Component.prototype.setupSuper = function(configAttributes) {
    var superDef = this.componentDef.getSuperDef();

    if (superDef) {
        var superConfig     = {};
        var superAttributes = {};

        superConfig["componentDef"] = { "descriptor" : superDef.getDescriptor().toString() };
        superConfig["concreteComponentId"] = this.concreteComponentId || this.globalId;

        $A.pushCreationPath("super");
        $A.clientService.setCurrentAccess(this);
        try {
            if (configAttributes) {
                superAttributes["values"] = {};
                var facets = this.componentDef.getFacets();

                if (facets) {
                    for (var i = 0; i < facets.length; i++) {
                        var facetDef = AttributeSet.getDef(facets[i]["descriptor"], this.componentDef);
                        if (!$A.clientService.allowAccess(facetDef[0], facetDef[1])) {
                            var message="Access Check Failed! Component.setupSuper():'" + facets[i]["descriptor"] + "' of component '" + this + "' is not visible to '" + $A.clientService.currentAccess + "'.";
                            if($A.clientService.enableAccessChecks) {
                                if($A.clientService.logAccessFailures){
                                    $A.error(null,new $A.auraError(message));
                                }
                                continue;
                            }else{
                                if($A.clientService.logAccessFailures){
                                    $A.warning(message);
                                }
                            }
                        }
                        superAttributes["values"][facets[i]["descriptor"]] = facets[i]["value"];
                    }
                }

                superAttributes["events"] = configAttributes["events"];
                superAttributes["valueProvider"] = configAttributes["facetValueProvider"];
            }

            superConfig["attributes"] = superAttributes;

            this.setSuperComponent($A.componentService.createComponentPriv(superConfig));
        } finally {
            $A.clientService.releaseCurrentAccess();
            $A.popCreationPath("super");
        }
    }
};

Component.prototype.setSuperComponent = function(component) {
    if(component){
        this.superComponent = component;
    }
};

Component.prototype.isCollectionOfAuraComponentDefs = function (facetValueConfig) {
    if ($A.util.isArray(facetValueConfig)) {
        for (var i = 0; i < facetValueConfig.length; i++) {
            var facetItem = facetValueConfig[i];
            if (!facetItem["componentDef"] || !facetItem["componentDef"]["descriptor"]) {
                return false;
            }
        }
        return true;
    } else {
        return false;
    }
};

Component.prototype.setupAttributes = function(config, localCreation) {
    //JBUCH: HALO: TODO: NOTE TO SELF: I THINK THERE IS SOMETHING STILL WRONG HERE.
    // I THINK THAT THE ORDER OF THE VALUES IS INCORRECT NOW
    // THIS MIGHT ALSO BE WHERE WE NEED TO DEREFERENCE CONFIG COPIES
    // SEE HTMLRENDERER.JS
    var configValues=(config&&config["values"])||{};
    if(!configValues.hasOwnProperty("body")){
        configValues["body"]=[];
    }
    var attributes={};
    var attributeDefs = this.componentDef.attributeDefs;

    var attributeNames=attributeDefs.getNames();
    var setByDefault={};
    var partialAttributes=this.partialConfig&&this.partialConfig["attributes"]&&this.partialConfig["attributes"]["values"];

//JBUCH: HALO: TODO: EXTRACT THIS HACK; NEED TO GENERATE DEFAULT FACETS AS WELL
    if(!this.concreteComponentId) {
        for (var x = 0; x < attributeNames.length; x++) {
            var name = attributeNames[x];
            var defaultDef = attributeDefs.getDef(name);
            var defaultValue = defaultDef.getDefault();
            if (defaultValue!==undefined) {
                if (!configValues.hasOwnProperty(name)||$A.util.equals(configValues[name],defaultValue)) {
                    setByDefault[name]=true;
                    if (defaultDef.getTypeDefDescriptor() === "aura://Aura.Component[]" || defaultDef.getTypeDefDescriptor() === "aura://Aura.ComponentDefRef[]") {
                        defaultValue = $A.util.apply([], defaultValue, true, true);
                        for(var facet=0;facet<defaultValue.length;facet++){
                            if(defaultValue[facet]["attributes"]&&!defaultValue[facet]["attributes"]["valueProvider"]){
                                defaultValue[facet]["attributes"]["valueProvider"]=this;
                            }
                        }
                        configValues[defaultDef.getDescriptor().getName()] = defaultValue;
                    } else {
                        //JBUCH: HALO: FIXME: FIND A BETTER WAY TO HANDLE DEFAULT EXPRESSIONS
                        configValues[defaultDef.getDescriptor().getName()] = valueFactory.create(defaultValue, this);
                    }
                }
            } else if (defaultDef.required && !configValues.hasOwnProperty(name)) {
                $A.warning("While creating component '" + this.type + "' ; missing required attribute '" + name + "'. " + $A.clientService.getAccessStackHierarchy());
            }
            if(!setByDefault[name]&&partialAttributes&&partialAttributes[name]===configValues[name]){
                setByDefault[name]=true;
            }
        }
    }
    for(var attribute in configValues) {
        var value = configValues[attribute];
        var attributeDef = attributeDefs.getDef(attribute);
        if (!attributeDef) {
            //JBUCH: HALO: TODO: DOES THIS MEAN CASE-MISMATCH OR UNKNOWN? ALSO, EVENTS!?!?
            continue;
        }

        // JBUCH: HALO: TODO: WHY DO WE NEED/ALLOW THIS?
        if ($A.componentService.isConfigDescriptor(value)) {
            value = value["value"];
        }

        var attributeType = attributeDef.getTypeDefDescriptor();
        var isFacet = attributeType === "aura://Aura.Component[]" || (attributeType === 'aura://Object' && this.isCollectionOfAuraComponentDefs(value));
        var isDefRef = attributeType === "aura://Aura.ComponentDefRef[]";

        if (!setByDefault[attribute]){
            var def=AttributeSet.getDef(attribute,this.getDef());
            if(!$A.clientService.allowAccess(def[0],def[1])) {
                var message="Access Check Failed! Component.setupAttributes():'" + attribute + "' of component '" + this + "' is not visible to '" + $A.clientService.currentAccess + "'.";
                if($A.clientService.enableAccessChecks){
                    if($A.clientService.logAccessFailures){
                        $A.error(null,new $A.auraError(message));
                    }
                    continue;
                }else{
                    if($A.clientService.logAccessFailures){
                        $A.warning(message);
                    }
                }
            }
        }

        if (isFacet) {
            if($A.util.isUndefinedOrNull(value)) {
                continue;
            }
            // If we don't setup the attributesValueProvider on the config, use the components.
            var attributeValueProvider = (config&&config["valueProvider"])||this.getAttributeValueProvider();

            // JBUCH: HALO: DIEGO: TODO: Revisit to code is a bit ugly
            value = valueFactory.create(value, config["valueProvider"]);
            if($A.util.isExpression(value)){
                value.addChangeHandler(this,"v."+attribute);
                value = value.evaluate();
            }
            if($A.util.isString(value)){
                value=[$A.componentService.createComponentPriv({ "componentDef": { "descriptor" :"markup://aura:text" }, "attributes": {"values": { "value":value } }})];
            }
            var facetStack = this.createComponentStack([{"descriptor": attribute, value: value}], attributeValueProvider, localCreation);

            // JBUCH: HALO: TODO: DEDUPE THIS AGAINST lines 462 - 467 AFTER CONFIRMING IT WORKS
            if (attribute === "body") {
                attributes[attribute]=(this.concreteComponentId&&this.getConcreteComponent().attributeSet.values["body"])||{};
                attributes[attribute][this.globalId] = facetStack["body"] || [];
            } else {
                attributes[attribute] = facetStack[attribute];
            }
        }

        // JBUCH: HALO: TODO: CAN WE CHANGE/FIX/MOVE THIS?
        else if (isDefRef) {
            if ($A.util.isUndefinedOrNull(value)) {
                continue;
            }
            if(!$A.util.isArray(value)){
                // JBUCH: HALO: FIXME, THIS IS UGLY TOO
                // It's not an Array, is it an expression that points to a CDR?
                // Something like body="{!v.attribute}" on a facet should reference v.attribute
                // which could and should be a ComponentDefRef[]
                var reference = valueFactory.create(value, config["valueProvider"]);
                if($A.util.isExpression(reference)) {
                    reference.addChangeHandler(this,"v."+attribute,null,true);
                    value = reference.evaluate();
                }
                // KRIS
                // So I'm not quite sure when or why we would want to go in here.
                // Hopefully I can find the reason the tests try to do this and document that here.
                else {
                    //JBUCH: HALO: TODO: SHOULD ALWAYS BE AN ARRAY BUT THIS FAILS TESTS
                    // FILE STORY TO REMOVE/FAIL LATER
                    value=[value];
                    $A.warning("Component.setupAttributes: CDR[] WAS NOT AN ARRAY");
                }
            }
            var cdrs=[];
            for(var i=0;i<value.length;i++){
                // make a shallow clone of the cdr with the proper value provider set
                var cdrObj = value[i];
                var cdr = {"attributes": { "values": {} } };
                cdr["componentDef"] = cdrObj["componentDef"];
                cdr["localId"] = cdrObj["localId"];
                cdr["flavor"] = cdrObj["flavor"];

                if (cdrObj["attributes"]) {
                    $A.util.apply(cdr["attributes"]["values"], cdrObj["attributes"]["values"]);
                }

                cdr["attributes"]["valueProvider"] = (cdrObj["attributes"] && cdrObj["attributes"]["valueProvider"]) || config["valueProvider"];

//JBUCH: HALO: TODO: SOMETHING LIKE THIS TO FIX DEFERRED COMPDEFREFS?
//                    for(var x in cdr["attributes"]["values"]){
//                        cdr["attributes"]["values"][x] = valueFactory.create(cdr["attributes"]["values"][x], null, config["valueProvider"]);
//                    }
                cdrs.push(cdr);
            }
            if (attribute === "body") {
                attributes[attribute]=(this.concreteComponentId&&this.getConcreteComponent().attributeSet.values["body"])||{};
                attributes[attribute][this.globalId] = cdrs;
            } else {
                attributes[attribute] = cdrs;
            }
        } else {
            attributes[attribute] = valueFactory.create(value, config["valueProvider"] || this);
            if($A.util.isExpression(attributes[attribute])){
                attributes[attribute].addChangeHandler(this,"v."+attribute);
            }
        }
    }

    if(this.concreteComponentId) {
        var concreteComponent=this.getConcreteComponent();
        concreteComponent.attributeSet.merge(attributes,null,this);
        this.attributeSet=concreteComponent.attributeSet;
    }else{
        this.attributeSet.initialize(attributes, this);
    }
};


Component.prototype.validatePartialConfig=function(config, partialConfig){
    var partialConfigO = partialConfig["original"];
    var partialConfigCD;
    var configCD = config["componentDef"]["descriptor"];
    if (!configCD) {
        configCD = config["componentDef"];
    } else if (configCD.getQualifiedName) {
        configCD = configCD.getQualifiedName();
    }
    if (partialConfig["componentDef"]) {
        if (partialConfig["componentDef"]["descriptor"]) {
            partialConfigCD = partialConfig["componentDef"]["descriptor"];
        } else {
            partialConfigCD = partialConfig["componentDef"];
        }
    }
    if (partialConfigO !== undefined && partialConfigCD !== configCD) {
        if (partialConfigO !== configCD) {
            $A.log("Configs at error");
            $A.log(config);
            $A.log(partialConfig);
            throw new $A.auraError("Mismatch at " + this.globalId
                + " client expected " + configCD
                + " but got original " + partialConfigO
                + " providing " + partialConfigCD + " from server "
                + " for creationPath = "+this.creationPath, null, $A.severity.QUIET);
        }
    } else if (partialConfigCD) {
        if (partialConfigCD !== configCD) {
            $A.log("Configs at error");
            $A.log(config);
            $A.log(partialConfig);
            throw new $A.auraError("Mismatch at " + this.globalId
                + " client expected " + configCD + " but got "
                + partialConfigCD + " from server "
                +" for creationPath = "+this.creationPath, null, $A.severity.QUIET);
        }
    }
};

Component.prototype.getMethodHandler = function(methodDef,methodEventDef){
    var component=this;
    var methodName=methodDef.getDescriptor().name;
    var actionTarget=methodDef.action||("c."+methodName);
    return function Component$getMethodHandler(/*param1,param2,paramN*/){
        if(!$A.clientService.allowAccess(methodDef,component)) {
            var message = "Access Check Failed! Component.method():'" + methodDef.getDescriptor().toString() + "' is not visible to '" + $A.clientService.currentAccess + "'.";
            if ($A.clientService.enableAccessChecks) {
                if ($A.clientService.logAccessFailures) {
                    $A.error(null,new $A.auraError(message));
                }
                return undefined;
            } else {
                if ($A.clientService.logAccessFailures) {
                    $A.warning(message);
                }
                //Intentional fallthrough
            }
        }
        var action=component.get(actionTarget);
        if(action){
            var methodEvent = new Aura.Event.Event({
                "eventDef" : methodEventDef
            });
            var params={
                "name" : methodName,
                "arguments": null
            };
            if(methodDef.attributes && methodDef.attributes.getNames().length > 0) {
                params["arguments"]={};
                var counter=0;
                var attributeNames = methodDef.attributes.getNames();
                for (var a=0;a<attributeNames.length;a++) {
                    var attributeName = attributeNames[a];
                    params["arguments"][attributeName]=(arguments[counter] === undefined ? methodDef.attributes.getDef(attributeName).getDefault() : arguments[counter]) ;
                    counter++;
                }
                for(var i=counter;i<arguments.length;i++){
                    params["argument_"+i]=arguments[i];
                }
            }else{
                params["arguments"]=$A.util.toArray(arguments);
            }
            methodEvent.setParams(params);
            methodEvent.fired=true;

            action.runDeprecated(methodEvent);
            return action.returnValue;
        }
        return undefined;
    };
};

Component.prototype.getActionCaller = function(valueProvider, actionExpression) {
    if(!valueProvider&&$A.util.isExpression(actionExpression)){
        valueProvider=actionExpression.valueProvider;
    }

    var actionCaller = function Component$getActionCaller(event) {
        if (valueProvider.destroyed===1 && event.getDef().getDescriptor().getName() !== "valueDestroy") {
            return;
        }

        var clientAction;

        // JBUCH: HALO: HACK: FIXME?
        actionExpression=valueFactory.create(actionExpression, valueProvider);

        if($A.util.isExpression(actionExpression)){
            clientAction=actionExpression.evaluate();
        }else{
            clientAction=valueProvider.get(actionExpression);
        }
        // JBUCH: HALO: HACK: FIXME?
        if(clientAction && $A.util.isString(clientAction)){
            clientAction=valueProvider.getConcreteComponent().get(clientAction);
        }

        if ($A.util.isAction(clientAction)) {
            clientAction.runDeprecated(event);
        } else if($A.util.isEvent(clientAction)){
            clientAction.sourceEvent=event;
            clientAction.fire();
        // } else if(clientAction.runDeprecated){
        //     throw new Error("WHY ARE YOU RUNNING A NOT AN ACTION?");
        //     clientAction.runDeprecated(event);
        } else {
            $A.assert(false, "no client action by name " + actionExpression);
        }
    };

    // Expose the information for inspecting purposes.
    actionCaller["valueProvider"] = valueProvider;
    actionCaller["actionExpression"] = actionExpression;

    return actionCaller;
};

/**
 * Creates the e.* value provider
 */
Component.prototype.createEventValueProvider = function() {
    //only create a new EVP if the compoent is live
    if (!this.eventValueProvider && !this.destroyed) {
        this.eventValueProvider = new EventValueProvider(this);
    }

    return this.eventValueProvider;
};

/**
 * Gets the event dispatcher.
 *
 * @public
 * @export
 */
Component.prototype.getEventDispatcher = function() {
    if (!this.eventValueProvider) {
        //Only fetch a fresh EVP if the component has not been destroyed
        if(!this.destroyed){
            this.createEventValueProvider();
        } else {
            return null;
        }
    }
    return this.eventValueProvider.events;
};

Component.prototype.setupComponentEvents = function(cmp, config) {
    var dispatcher;
    if (!this.concreteComponentId) {
        var events = this.componentDef.getAllEvents();

        var len = events.length;
        if (len > 0) {
            // Ugh... we should not need to check here, but code is spread all over.
            dispatcher = this.getEventDispatcher();
            if (dispatcher !== null) {
                for (var i = 0; i < events.length; i++) {
                    dispatcher[events[i]] = {};
                }
            }
        }

        var def = this.componentDef;
        var keys = def.getAllEvents();

        var values=config["events"]||config["values"];

        if (values) {
            var valueProvider = config["valueProvider"];
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                var eventValue = values[key];
                if (eventValue) {
                    $A.assert(!this.concreteComponentId,
                            "Event handler for " + key
                            + " defined on super component "
                            + this.globalId);
                    cmp.addHandler(key, valueProvider || this, eventValue["value"]||eventValue, false, "bubble");
                }
            }
        }
    }

    var cmpHandlers = this.componentDef.getCmpHandlerDefs();
    if (cmpHandlers) {
        for (var k = 0; k < cmpHandlers.length; k++) {
            var cmpHandler = cmpHandlers[k];
            cmp.addHandler(cmpHandler["name"], cmp, cmpHandler["action"], false, cmpHandler["phase"], cmpHandler["includeFacets"]);
        }
    }
};

Component.prototype.setupApplicationEventHandlers = function() {
    // Handle application-level events
    var handlerDefs = this.componentDef.getAppHandlerDefs();
    if (handlerDefs) {
        for (var i = 0; i < handlerDefs.length; i++) {
            var handlerDef = handlerDefs[i];
            // var config={
            //     "globalId":cmp.globalId,
            //     "handler":$A.expressionService.expressionHandler.bind(this,this.getReference(handlerDef["action"])),
            //     "event":handlerDef["eventDef"].getDescriptor().getQualifiedName(),
            //     "phase":handlerDef["phase"],
            //     "includeFacets":handlerDef["includeFacets"]
            // };
            // $A.eventService.addHandler(handlerConfig);

            $A.eventService.addEventHandler(
                this,
                handlerDef["eventDef"],
                valueFactory.create(handlerDef["action"],this),
                handlerDef["phase"],
                handlerDef["includeFacets"]
            );
        }
    }
};

Component.prototype.setupValueEventHandlers = function(cmp) {
    // Handle value-level events
    var handlerDefs = this.componentDef.getValueHandlerDefs();
    if (handlerDefs) {
        for (var i = 0; i < handlerDefs.length; i++) {
            var handlerDef = handlerDefs[i];
            var action=valueFactory.create(handlerDef["action"],cmp);
            var event=handlerDef["name"];
            var value = valueFactory.create(handlerDef["value"],cmp);
            if ($A.util.isExpression(value)&&value.getExpression()==="this") {
                var eventQName = this.componentDef.getEventDef(event, true).getDescriptor().getQualifiedName();
                this.addHandler(eventQName, this, action, false, "default");
            }else{
                var handlerConfig = {
                    "action":action,
                    "event":event,
                    "value":value
                };
                cmp.addChangeHandler(handlerConfig);
            }
        }
    }
};

Component.prototype.setupMethods = function() {
    var defs = this.componentDef.methodDefs;
    if (defs) {
        var methodEventDef=$A.eventService.getEventDef("aura:methodCall");
        var methodDef;
        for(var i=0;i<defs.length;i++){
            methodDef=new Aura.Method.MethodDef(defs[i]);
            this[methodDef.getDescriptor().name]=this.getMethodHandler(methodDef,methodEventDef);
        }
    }
};

Component.prototype.setupModel = function(config) {
    var def = this.componentDef.getModelDef();
    if (def) {
        if (!config && this.partialConfig) {
            config = this.partialConfig["model"];
        }
        this.model = def.newInstance(config || {});
    }
};

Component.prototype.setupFlavors = function(config, configAttributes) {
    if (config["flavorable"]) {
        this.flavorable = true;
    }

    if (config["flavor"]) {
        this.flavor = valueFactory.create(config["flavor"], configAttributes["valueProvider"]);
    }
};

Component.prototype.doIndex = function(cmp) {
    var localId = this.localId;
    if (!$A.util.isUndefinedOrNull(localId)) {
        // JBUCH: HALO: TODO: MOVE THIS INTO PASSTHROUGHVALUE.
        var valueProvider=cmp.getAttributeValueProvider();
        if(valueProvider instanceof PassthroughValue){
            valueProvider=valueProvider.getComponent();
        }

        if(!valueProvider) {
            throw new Error("No attribute value provider defined for component " + cmp);
        }
        // JBUCH: HACK: TEMPORARY FIX FOR DYNAMICALLY CREATED COMPONENTS
        if(valueProvider===this){
            valueProvider=this.getOwner();
        }
        if(valueProvider instanceof PassthroughValue){
            valueProvider=valueProvider.getComponent();
        }
        if(!valueProvider) {
            throw new Error("No owner specified for component " + cmp);
        }
        valueProvider.index(localId, this.globalId);
    }
};

Component.prototype.doDeIndex = function() {
    var localId = this.localId;
    if (localId) {
        var valueProvider=this.getAttributeValueProvider();
        if(valueProvider instanceof PassthroughValue){
            valueProvider=valueProvider.getComponent();
        }
        // JBUCH: HACK: TEMPORARY FIX FOR DYNAMICALLY CREATED COMPONENTS
        if(valueProvider===this){
            valueProvider=this.getOwner();
        }
        if(valueProvider instanceof PassthroughValue){
            valueProvider=valueProvider.getComponent();
        }
        //Don't do anything if the valueProvider does not exist (likely already removed).
        if(!$A.util.isUndefinedOrNull(valueProvider)) {
            valueProvider.deIndex(localId, this.globalId);
        }
    }
};

Component.prototype.replaceComponentClass = function(descriptor) {
    var classConstructor = $A.componentService.getComponentClass(descriptor);

    if (classConstructor && this["constructor"] !== classConstructor) {
        // Doesn't do a whole lot, but good for debugging.
        this["constructor"]   = classConstructor;

        // Reassign important members. Assign to both external reference, and internal reference
        this["controller"]    = classConstructor.prototype["controller"];
        this["helper"]        = classConstructor.prototype["helper"];
        this["renderer"]      = classConstructor.prototype["renderer"];
        this["provider"]      = classConstructor.prototype["provider"];
    }
};

Component.prototype.injectComponent = function(config, localCreation) {

    if ((this.componentDef.isAbstract() || this["provider"]) && !this.concreteComponentId) {
        var context = $A.getContext();
        var act = context.getCurrentAction();
        if (act) {
            // allow the provider to re-use the path of the current component without complaint
            act.reactivatePath();
        }

        if (this["provider"]) {
            $A.clientService.setCurrentAccess(this);
            try {
                var providedConfig = this.provide(localCreation);
                this.setProvided(providedConfig['componentDef'], providedConfig['attributes']);
            } finally {
                $A.clientService.releaseCurrentAccess();
            }
        } else {
            $A.assert(this.partialConfig,
                    "Abstract component without provider def cannot be instantiated : "
                    + this.componentDef);
            this.setProvided($A.componentService.getDef(this.partialConfig["componentDef"]), null);
        }

        this.setupModel(config["model"]);
        this.valueProviders["m"]=this.model;
        this.valueProviders["c"]=this.createActionValueProvider();
    }
};

/**
 * Runs the provide method and returns the component definition.
 * Throws an error if the provide method is not found.
 * @param {Boolean} localCreation
 */
Component.prototype.provide = function(localCreation) {
    var provideMethod = this["provider"] && this["provider"]["provide"];
    $A.assert(provideMethod, "Provide method not found");

    var providedConfig = provideMethod(this, localCreation);

    // A provider can return a component name
    if (!providedConfig || $A.util.isString(providedConfig)) {
        providedConfig = {
            'componentDef': providedConfig
        };
    }

    // A provider can return a config object
    if (providedConfig['componentDef']) {
        var def = $A.componentService.getDef(providedConfig['componentDef']);
        // set available component def
        providedConfig['componentDef'] = def;
    } else {
        // A provider can return only attributes, there is
        // no component def provided so set to current component
        providedConfig['componentDef'] = this.getDef();
    }
    return providedConfig;
};

Component.prototype.setProvided = function(realComponentDef, attributes) {

    $A.assert(realComponentDef instanceof ComponentDef,
            "No definition for provided component: " +this.componentDef);
    $A.assert(!realComponentDef.isAbstract(),
            "Provided component cannot be abstract: " + realComponentDef);
    $A.assert(!realComponentDef.hasRemoteDependencies() || (realComponentDef.hasRemoteDependencies() && this.partialConfig),
            "Client provided component cannot have server dependencies: " + realComponentDef);

    // Definition did not change (if.cmp for example) so do not do any extra work.
    if(this.componentDef === realComponentDef && !attributes) {
        return;
    }

    // JBUCH: HALO: TODO: FIND BETTER WAY TO RESET THESE AFTER PROVIDER INJECTION
    this.componentDef = realComponentDef;
    this.attributeSet.merge(attributes, realComponentDef.getAttributeDefs(), this);

    // KRIS: IN THE MIDDLE OF THIS FOR PROVIDED COMPONENTS
    this.replaceComponentClass(realComponentDef.getDescriptor().getQualifiedName());
};

Component.prototype.associateRenderedBy = function(cmp, element) {
    // attach a way to get back to the rendering component, the first time
    // we call associate on an element
    if (!$A.util.hasDataAttribute(element, $A.componentService.renderedBy)) {
        $A.util.setDataAttribute(element, $A.componentService.renderedBy, cmp.globalId);
    }
};

/**
 * Resolves a locator that targets targetCmp from within this component
 * @param targetCmp
 * @param includeMetadata
 *
 * @returns The locator object which contains the target & scope IDs and locator context resolved
 */
Component.prototype.getLocator = function(targetCmp, includeMetadata) {
    return $A.expressionService.resolveLocator(this, targetCmp, includeMetadata);
};

Aura.Component.Component = Component;
