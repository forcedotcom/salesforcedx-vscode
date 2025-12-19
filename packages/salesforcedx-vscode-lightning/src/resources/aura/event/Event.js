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
 * @description Creates an Event with name, source component, event definition, event dispatcher, parameters, and sets the fired flag to false.
 * @constructor
 * @param {Object} config
 * @platform
 * @export
 */
Aura.Event.Event = function(config) {
    // source is only used to calculate the path, not determine access
    this.source = config["component"] || $A.clientService.currentAccess || $A.getRoot();
    this.sourceEvent=null;
    this.eventDef = config["eventDef"];
    this.eventDispatcher = config["eventDispatcher"];
    this.eventName = config["name"];
    this.params = {};
    this.fired = false;
    this.eventStopPropagation = false;
    this.defaultPrevented = false;
    this.paused = false;
    this.componentEvent = false;
    this.phase = undefined;
    this.eventHandlerIterator = null;

    // propagating locker key when possible
    $A.lockerService.trust(this.source, this);
};

/**
 * Gets the source component that fired this event.
 *
 * @returns {Object} The source component
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getSource = function() {
    return this.source;
};

/**
 * Gets the source event that fired this event, if it was fired by an event binding, i.e. {!e.myEvent}.
 *
 * @returns {Object} The source event
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getSourceEvent = function() {
    return this.sourceEvent;
};


/**
 * Gets the Event Definition.
 * Returns an EventDef object.
 * @export
 */
Aura.Event.Event.prototype.getDef = function(){
    return this.eventDef;
};

/**
 * Gets the current phase of this event.
 * Returns undefined if the event has not yet been fired.
 * Possible return values for APPLICATION and COMPONENT events
 * are "capture", "bubble", and "default" once fired.
 * VALUE events return "default" once fired.
 *
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getPhase = function(){
    return this.phase;
};

/**
 * Sets whether the event can bubble or not. This will throw
 * an error if called in the "default" phase.
 * The default is false.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.stopPropagation = function() {
    var eventExecutionType = this.getEventExecutionType();

    // stopPropagation was introduced before this assertion and may be used
    // in non-bubbling component events
    $A.assert(eventExecutionType !== "COMPONENT" ||
        eventExecutionType !== "APPLICATION" ||
        this.getPhase() !== "default", "stopPropagation() is not supported in the 'default' phase");
    this.eventStopPropagation = true;
};

/**
 * Prevents the default phase execution for this event. This will throw
 * an error if called in the "default" phase.
 * The default is true.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.preventDefault = function() {
    $A.assert(this.getPhase() !== "default", "preventDefault() is not supported in the 'default' phase");
    this.defaultPrevented = true;
};

/**
 * Pauses this event such that event handlers will not be processed until
 * Event.resume() is called. The handling process will pause in the current
 * position of the event handler processing sequence. If the event is already
 * paused, calling this does nothing. This will throw an error
 * if called in the "default" phase.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.pause = function() {
    $A.assert(this.getPhase() !== "default", "pause() is not supported in the 'default' phase");
    if(!this.paused) {
        this.paused = true;
    }
    return this;
};

/**
 * Resumes event handling for this event from the same position in the event
 * handler processing sequence from which it was previously paused.
 * If the event is not paused, calling this does nothing. This will throw an error
 * if called in the "default" phase.
 * This API does not define whether or not any remaining event handlers will
 * execute in the current call stack or be deferred and executed in a new call stack,
 * therefore the exact timing behavior is not dependable.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.resume = function() {
    $A.assert(this.getPhase() !== "default", "resume() is not supported in the 'default' phase");
    if(this.paused) {
        this.paused = false;
        // JBA: should this queue a microtask/task or start from this activation frame?
        this.executeHandlers();
    }
};

/**
 * Sets the event as a "componentEvent" (won't bubble)
 * This type of event was used historically as a construct to call an action of a child
 * Since the advent of "methods", this type of event communication is discouraged and a "method" is preferred.
 * NOTE: Calling events on a child is discouraged and will be deprecated
 * @export
 */
Aura.Event.Event.prototype.setComponentEvent = function(){
    this.componentEvent = true;
    return this;
};

/**
 * Gets the name of the Event.
 * @returns {String} The event name
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getName = function(){
    return this.eventName;
};

/**
 * Gets the type of the Event definition, e.g. 'c:myEvent'.
 * @returns {String} The event definition type
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getType = function(){
    return this.eventDef.getDescriptor().getFullName();
};

/**
 * Gets the type of the Event, e.g. 'COMPONENT' or 'APPLICATION'.
 * @returns {String} The event type
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getEventType = function(){
    return this.eventDef.getEventType();
};

/**
 * Sets parameters for the Event. Does not modify an event that has already been fired.
 * Maps key in config to attributeDefs.
 * @param {Object} config - The parameters for the Event.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.setParams = function(config) {
    if (this.fired) {
        $A.assert(false, "Event.setParams(): cannot modify all params in an event that has already been fired.");
    }

    if (config) {
        var attributeDefs = this.eventDef.getAttributeDefs();
        for (var key in config){
            if (config.hasOwnProperty(key)) {
                if (attributeDefs.hasAttribute(key)) {
                    this.params[key] = config[key];
                } else {
                    $A.warning("Event.setParams(): '" + key +"'('" + config[key] + "') is not a valid parameter. Valid parameters are '"+ attributeDefs.getNames().join("', '") + "'");
                }
            }
        }
    }
    return this;
};

/**
 * Sets a parameter for the Event. Does not modify an event that has already been fired.
 * @param {String} key - The name of the parameter.
 * @param {Object} value - The value of the parameter.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.setParam = function(key, value) {
    if (this.fired && this.componentEvent) {
        $A.assert(false, "Event.setParam(): cannot modify a component event that has already been fired.");
    }
    if (this.eventDef.getAttributeDefs().hasAttribute(key)) {
        this.params[key] = value;
    } else {
        $A.warning("Event.setParam(): '"+key+"' is not a valid parameter. Valid parameters are '" + this.eventDef.getAttributeDefs().getNames().join("', '") + "'");
    }
};

/**
 * Gets an Event parameter.
 * @param {String} name The name of the Event. For example, <code>event.getParam("button")</code> returns the value of the pressed mouse button (0, 1, or 2).
 * @returns {Object} The parameter value
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getParam = function(name){
    return this.params[name];
};

/**
 * Gets all the Event parameters.
 * @returns {Object} The collection of parameters
 * @platform
 * @export
 */
Aura.Event.Event.prototype.getParams = function(){
    return this.params;
};


/**
 * Convenience function to determine which kind of event execution should be used
 * for this event. This is NOT PUBLIC! It's NOT an API and can change at any point.
 * @return {String} One of: "VALUE", "COMPONENT", "LEGACY_COMPONENT", "APPLICATION"
 * @private
 */
Aura.Event.Event.prototype.getEventExecutionType = function () {
    if(this.eventDef.getDescriptor().getQualifiedName() === "markup://aura:methodCall") {
        return "VALUE";
    }
    else if(this.eventName) {
        return this.componentEvent ?
            "LEGACY_COMPONENT" :
            "COMPONENT";
    }
    else {
        var def = this.eventDef;
        while (def) {
            var qname = def.getDescriptor().getQualifiedName();
            var handlers = this.eventDispatcher[qname];

            if (handlers) {
                return def.getEventType() === "VALUE" ?
                    "VALUE" :
                    "APPLICATION";
            }
            def = def.getSuperDef();
        }

        // we didn't find any handlers to begin with; just assume "APPLICATION"
        return "APPLICATION";
    }
};

/**
 * Executes the event handlers for this event.
 * @private
 */
Aura.Event.Event.prototype.executeHandlers = function() {
    if(!this.eventHandlerIterator) {
        this.eventHandlerIterator = this.getHandlerIterator();
    }
    this.executeHandlerIterator(this.eventHandlerIterator);
};

/**
 * Executes the handlers returned by handlerIterator.
 * @param {Iterator} handlerIterator
 * @private
 */
Aura.Event.Event.prototype.executeHandlerIterator = function(handlerIterator) {
    var res = {};
    var value;

    var type = this.getType();
    var isSystemError = type === "aura:systemError";
    var isCustomerError = type === "aura:customerError";
    var isComponentEventType = this.getEventExecutionType() === "COMPONENT";

    while(!this.paused && !res.done) {
        res = handlerIterator.next();
        value = res.value;
        if(value && value.handler) {

            // LEGACY BEHAVIOR
            // COMPONENT events automatically stopPropagation if something is destroyed during BUBBLING
            // or CAPTURING
            if(isComponentEventType && !value.cmp.isValid() && this.phase !== "default") {
                this.stopPropagation();
            }

            // update our phase
            this.phase = value.phase;

            if(isSystemError || isCustomerError) {
                // Special case... only wrap in try-catch for this type of event
                try {
                    value.handler(this);
                } catch (e) {
                    // if a systemError event handler failed, we don't want it to repeatedly fail
                    // because the event is fired in error handling framework.

                    // TODO: unregister this particular event handler here!
                    // cmpHandlers[j] = null;
                    $A.warning("aura:systemError | aura:customerError event handler failed", e);
                    $A.logger.reportError(e);
                }
            }
            else {
                $A.clientService.setCurrentAccess(value.cmp);
                try {
                    value.handler(this);
                } finally {
                    $A.clientService.releaseCurrentAccess();
                }
            }
        }
    }
};

/**
 * Returns an iterator over the handlers for this event.
 * @private
 */
Aura.Event.Event.prototype.getHandlerIterator = function() {
    var eventExecutionType = this.getEventExecutionType();

    switch(eventExecutionType) {
        case "VALUE":
            return $A.eventService.getValueHandlerIterator(this);
        case "LEGACY_COMPONENT":
            return $A.eventService.getNonBubblingComponentEventHandlerIterator(this);
        case "COMPONENT":
            return $A.eventService.getComponentEventHandlerIterator(this);
        case "APPLICATION":
            return $A.eventService.getAppEventHandlerIterator(this);
        default:
            throw new Aura.Errors.AuraError("Invalid event type");
    }
};

/**
 * Fires the Event. Checks if the Event has already been fired before firing.
 * Maps the component handlers to the event dispatcher.
 * @param {Object} params - Optional. A set of parameters for the Event. Any previous parameters of the same name will be overwritten.
 * @platform
 * @export
 */
Aura.Event.Event.prototype.fire = function(params) {
    var self = this;

    if (this.fired) {
        $A.assert(false, "Event.fire(): Unable to fire event. Event has already been fired.");
    }

    if (params) {
        this.setParams(params);
    }

    $A.run(function() {
        self.fired = true;
        self.executeHandlers();
    }, this.eventDef.getDescriptor().getQualifiedName()/*name for the stack*/);
};
