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
 * @description The Aura Event Service, accessible using <code>$A.eventService</code>. Creates and manages events.
 * @constructor AuraEventService
 * @export
 */
function AuraEventService () {
    this.eventDispatcher   = {};
    this.eventDefRegistry  = {};
    this.savedEventConfigs = {};
    this.componentHandlers = {};
}

AuraEventService.Phase = {
    CAPTURE: "capture",
    BUBBLE: "bubble",
    DEFAULT: "default"
};

AuraEventService.validatePhase=function(phase, defaultPhase){
    if(phase){
        if(phase!==AuraEventService.Phase.BUBBLE&&phase!==AuraEventService.Phase.CAPTURE&&phase!==AuraEventService.Phase.DEFAULT){
            throw new Error("AuraEventService.validatePhase(): 'phase' must be omitted, or one of '"+AuraEventService.Phase.BUBBLE+"', '"+AuraEventService.Phase.CAPTURE+"', or '"+AuraEventService.Phase.DEFAULT+"'. Found '"+phase+"'.");
        }
    }else{
        phase=defaultPhase||AuraEventService.Phase.DEFAULT;
    }
    return phase;
};

/**
 * Creates a new application event. Set the event parameters using <code>event.setParams()</code> and fire
 * it using <code>event.fire()</code>. For example, <code>$A.eventService.newEvent("app:navError")</code>
 * fires the <code>app:navError</code> event. Set parameters on the new event
 * by using <code>event.setParams()</code>.
 *
 * @param {String} eventDef The event object in the format namespace:component
 * @param {String=} eventName The event name if the event is a "COMPONENT" type event
 * @param {sourceCmp=} eventName The component source if the event is a "COMPONENT" type event
 * @return {Event} new Event
 * @memberOf AuraEventService
 * @public
 * @export
 */
AuraEventService.prototype.newEvent = function(eventDef, eventName, sourceCmp) {
    $A.assert(eventDef, "EventDef is required");
    eventDef = this.getDef(eventDef);

    return this.getNewEvent(eventDef, eventName, sourceCmp);
};

/**
 * Get a new Event instance, but do not do an access check on the event definition. This method is private to
 * aura and should only be used within trusted portions of the framework.
 *
 * @param {String} eventDef The event object in the format namespace:component
 * @param {String=} eventName The event name if the event is a "COMPONENT" type event
 * @param {sourceCmp=} eventName The component source if the event is a "COMPONENT" type event
 * @return {Event} new Event
 */
AuraEventService.prototype.getNewEvent = function(eventDefinition, eventName, sourceCmp) {
    var eventDef = eventDefinition;
    if(typeof eventDefinition === "string") {
        eventDef = this.getEventDef(eventDefinition);
    }

    if (eventDef) {
        var config = {};
        config["eventDef"] = eventDef;
        if (eventDef.getEventType() === 'COMPONENT') {
            config["name"]      = eventName;
            config["component"] = sourceCmp && sourceCmp.getConcreteComponent();
        } else {
            config["eventDispatcher"] = this.eventDispatcher;
        }
        return new Aura.Event.Event(config);
    }
};

/**
 * Accumulates the ordered list of components from cmp to the root through
 * which an event should bubble. This includes all paths through both owners
 * and containerComponents.
 * @param {Component} cmp
 * @param {Array} queue ordered list of nodes in the path
 * @param {Object} visited map of components that have been visited already
 * @param {Boolean} isOwner indicates if this path is the value provider path
 *      of the cmp from the original call in the stack
 * @return {Array} queue of ordered list of nodes in the path; each element
 *      includes a "cmp" property and a "isOwner" property
 * @private
 */
AuraEventService.prototype.collectBubblePath = function(cmp, queue, visited, isOwner) {
    if(!cmp || cmp.destroyed===1) {
        // we reached a dead end
        return queue;
    }
    if(visited[cmp.globalId]) {
        // we reached a previously visited component
        if(!isOwner) {
            // we need markers in non-value provider queues to track where
            // containerComponent trees intersect with the main owner queue
            queue.push({
                cmp: cmp,
                isMarker: true
            });
        }
        return queue;
    }

    queue.push({
        cmp: cmp,
        isOwner: isOwner
    });
    visited[cmp.globalId] = true;

    var superCmp = cmp.getSuper();
    if(superCmp) {
        // collect the super chain before handling the containerComponent to mark the visited map
        this.collectBubblePath(superCmp, queue, visited, isOwner && true);
    }

    var next = cmp;
    var queueIndex = queue.length;
    // loop until we find the next level
    while(next) {
        next = next.getOwner();
        if (next === cmp || !($A.util.isComponent(next))) {
            // We are at the top-level now, so we are done
            break;
        }

        if (next.getGlobalId() !== cmp.getGlobalId()) {
            // Reached a facet value provider
            // collect the owner chain before handling the containerComponent to mark the visited map
            this.collectBubblePath(next, queue, visited, isOwner && true);

            // stop looping, the call above will recurse up the tree
            break;
        }
        else {
            // keep going
            cmp = next;
        }
    }

    if(cmp.isConcrete()) {
        // After collecting the owner chain, check if this level's concrete component's containing component
        // is from a different level itself. This occurs when cmp is passed as the facet value
        // to its containing component (transcluded) by the containing component's value provider.
        // e.g. <container><cur/></container>
        var concreteCmpContainerComponent = cmp.getContainer();
        if(concreteCmpContainerComponent) {
            // this containerComponent may be from a different component inheritance level
            // so collect its bubble path and insert it into the queue at queueIndex
            // before the chain of owner components that were just added above
            var containerComponentQueue = this.collectBubblePath(concreteCmpContainerComponent, [], visited, false);

            var intersectionPoint = null;
            // walk through the containerComponent queue, finding each marker and inserting
            // the segments between them into the queue at the correct positions
            for(var pStopIdx = 0; pStopIdx < containerComponentQueue.length; pStopIdx++) {
                if(containerComponentQueue[pStopIdx].isMarker) {
                    // found a marker
                    intersectionPoint = containerComponentQueue[pStopIdx].cmp;
                    break;
                }
            }

            var intersectionIndex = queueIndex;
            if(intersectionPoint) {
                for(var j = 0; j < queue.length; j++) {
                    if(queue[j].cmp === intersectionPoint) {
                        intersectionIndex = j;
                        break;
                    }
                }
            }

            // insert containerComponentQueue slice into queue at intersectionIndex position
            queue.splice.apply(queue, [intersectionIndex, 0].concat(containerComponentQueue.slice(0, pStopIdx)));
        }
    }

    return queue;
};


/**
 * Returns an iterator over the sequence of components for a given event
 * through the "capture" phase then the "bubble" phase.
 * @return {Object} An object with the form { cmp: Component, isOwner: Boolean, phase: String }
 * @private
 * @function
 */
AuraEventService.prototype.getEventPhaseCmpIterator = (function() {

    function EventPhaseCmpIterator(cmp, eventService) {

        // This is not lazy b/c calculating the next element in "capture"
        // would require iterating from the source to the last return value
        // on each iteration. Can revisit if the need arises.

        // Build the queue for the entire bubble path
        // JBA: If the containerComponent chain is completely separated from the owner chain at any point,
        // this will result in an odd flow.
        var queue = eventService.collectBubblePath(cmp, [], {}, true);

        // Now mirror the queue in reverse direction to run capture -> bubble
        queue = queue.slice().reverse().concat(queue);

        var queueIndex = 0;
        var phaseSwitchIndex = queue.length / 2;
        var phase = AuraEventService.Phase.CAPTURE;
        var currentValue;
        var done = false;

        this.next = function() {
            while(!done) {

                if(queueIndex < queue.length) {
                    if(queueIndex === phaseSwitchIndex) {
                        // reached the middle, switch phases
                        phase = AuraEventService.Phase.BUBBLE;
                    }
                    var qval = queue[queueIndex++];
                    currentValue = {
                        cmp: qval.cmp,
                        isOwner: qval.isOwner,
                        phase: phase
                    };
                    break;
                }
                else {
                    done = true;
                    currentValue = undefined;
                }
            }

            return {
                value: currentValue,
                done: done
            };
        };

        this.return = function(value) {
            if(!done) {
                done = true;
                currentValue = value;
            }
            return {
                value: currentValue,
                done: done
            };
        };

        this.throw = function(e) {
            if(!done) {
                done = true;
                currentValue = undefined;
            }

            throw e;
        };
    }

    return function(cmp) {
        return new EventPhaseCmpIterator(cmp, this);
    };
})();

/**
 * Function that supplies an array of handlers for a given cmp, evt, and phase.
 * @callback handlerSupplier
 * @param {Component} cmp
 * @param {Event} evt
 * @param {String} phase
 * @return {Function[]} array of handler functions whose only parameter is the event
 */

/**
 * A result from a handler iterator
 * @typedef {Object} HandlerIteratorResult
 * @property {Component} cmp - The component with the registered handler
 * @property {String} phase - The phase at which the handler is bound
 * @property {Function} handler - The event handler function
 */

/**
 * Returns an iterator over event handlers for a given event that
 * supports "capture" and "bubble" phases. The HandlerIteratorResult
 * object are returned in the correct order for those two respective phases.
 * If stopPropagation() is called on the event before this iterator
 * completes, it will terminate, returning a result with done=true and
 * whose value is the last HandlerIteratorResult that it previously returned
 * but with an undefined handler property. This facilitates consumers
 * determining which component is responsible for stopping the event's
 * propagation.
 *
 * @param {Event} evt The event
 * @param {handlerSupplier} The handler supplier function
 * @return {HandlerIteratorResult} A HandlerIteratorResult
 * @private
 * @function
 */
AuraEventService.prototype.getPhasedEventHandlerIterator = (function() {

    function PhasedEventHandlerIterator(evt, eventPhaseCmpIterator, handlerSupplierFn) {

        var done = false;
        var currentValue;
        var currentLocation = null;
        var currentHandlers = null;
        var currentHandlersIndex = 0;

        // moves the cursor to the next component and retrieves the tuple
        // of handlers on that component for the given event
        function moveCmpCursor() {
            currentHandlersIndex = 0;
            var res = eventPhaseCmpIterator.next();
            if(res.done) {
                currentHandlers = currentLocation = null;
            }
            else {
                currentLocation = res.value;
                currentHandlers = handlerSupplierFn(evt, currentLocation.cmp, currentLocation.phase, currentLocation.isOwner); // an array
                currentHandlersIndex = 0;
            }
        }

        // move to the first location
        moveCmpCursor();

        this.next = function() {
            while(!done) {
                if(!currentLocation) {
                    // no more components to walk
                    done = true;
                    currentValue = undefined;
                }
                else if(currentHandlersIndex < currentHandlers.length) {
                    // flatten the tuple into a single value for each handler
                    // the current level contains more handlers
                    currentValue = {
                        cmp: currentLocation.cmp,
                        phase: currentLocation.phase,
                        handler: currentHandlers[currentHandlersIndex++]
                    };
                    break;
                }
                else {
                    // done with the current level, move the cursor if event
                    // propagation has not been stopped
                    if(evt.eventStopPropagation) {
                        // when stopPropagation() is called, the iterator's return value
                        // is a special object that includes the last cmp and last phase
                        // but no handler
                        return this.return({
                            cmp: currentValue.cmp,
                            phase: currentValue.phase
                        });
                    }
                    else {
                        // get the next component from the iterator
                        moveCmpCursor();
                    }
                }
            }

            return {
                value: currentValue,
                done: done
            };
        };

        this.return = function(value) {
            if(!done) {
                done = true;
                currentValue = value;
            }
            return {
                value: currentValue,
                done: done
            };
        };

        this.throw = function(e) {
            if(!done) {
                done = true;
                currentValue = undefined;
            }

            throw e;
        };
    }

    return function(evt, handlerSupplierFn) {
        return new PhasedEventHandlerIterator(evt, this.getEventPhaseCmpIterator(evt.getSource()), handlerSupplierFn);
    };
})();


/**
 * Returns an iterator over component event handlers for a given event.
 * @param {Event} evt The event
 * @return {HandlerIteratorResult} A HandlerIteratorResult
 * @private
 * @function
 */
AuraEventService.prototype.getComponentEventHandlerIterator = (function() {
    return function(evt) {
        return this.getPhasedEventHandlerIterator(evt, this.getComponentEventHandlers.bind(this));
    };
})();

/**
 * A faux handler that may be inserted into an iteration
 * to stop propagation of an event.
 * @private
 */
AuraEventService.prototype.eventStopPropagationHandler = function(evt) {
    evt.stopPropagation();
};

/**
 * A handlerSupplier implementation for phased COMPONENT event handlers
 * that go through capture and bubble phases.
 * @private
 */
AuraEventService.prototype.getComponentEventHandlers = function(evt, cmp, phase, isOwner) {
    var handlers;
    var eventName = evt.getName();
    // just get event handlers for this cmp, not its super(s)
    var dispatcher = cmp.destroyed!==1 && cmp.getEventDispatcher();
    if (dispatcher) {

        // Complex component event handling lives here... be wary
        // Some of this is actually kind of wrong, but removing it breaks mess b/c
        // devs have inadvertently counted on it
        var dispatcherHandlers = dispatcher[eventName];
        if(dispatcherHandlers) {
            var phasedHandlers = dispatcherHandlers[phase];
            if(phasedHandlers && phasedHandlers.length) {
                handlers = [];
                var cmpHandlerDefs = cmp.getDef().getCmpHandlerDefs();

                var includedHandlers = false;

                if (cmpHandlerDefs) {
                    // Each handler definition
                    for (var i = 0; i < cmpHandlerDefs.length && !includedHandlers; i++) {
                        // Check for inheritance event def structure
                        for (var evtDef = evt.getDef(); evtDef; evtDef = evtDef.getSuperDef()) {
                            var hDef = cmpHandlerDefs[i]["eventDef"];

                            // If we have the def we guard against it. If we just have name, only check the name
                            // TODO @dval: Refactor this, once we remove all self-events + move parent->child event into methods
                            if (cmpHandlerDefs[i]["name"] === eventName && (!hDef || hDef === evtDef)) {
                                for(var j = 0; j < phasedHandlers.length; j++) {
                                    // if cmp is a parent but is not in the value provider hierarchy,
                                    // only include handlers that were registered with includeFacets=true
                                    if(isOwner || phasedHandlers[j].includeFacets) {
                                        handlers.push(phasedHandlers[j]);
                                    }
                                }
                                includedHandlers = true;
                                break;
                            }

                            // And if we dont have a def, we are firing an event against ourselves
                            // TODO: Refactor this, once we remove all self-events + move parent->child event into methods

                            // This is from older code but may not be correct. It's forcing a stopPropagation if the first cmpHandlerDef
                            // in the array doesn't define the event type. It may have nothing to do with *THIS* event, but we're
                            // stopping this one anyway. However, this is guarding against an infinite loop in some components with event
                            // handlers that fire an event on a child that bubbles right back to the same handler handler...!
                            if(!hDef && isOwner) {
                                // insert a stopPropagation() call at this point in the iteration
                                handlers.push(this.eventStopPropagationHandler);
                            }
                        }
                    }
                }

                // If we need to dispatch here, is a direct parent-children event (no def handler)
                // So we can stopPropagation
                if(!includedHandlers && cmp.getDef().getEventDef(eventName)&& isOwner) {
                    // insert a stopPropagation() call at this point in the iteration
                    handlers.push(this.eventStopPropagationHandler);
                    handlers.push.apply(handlers, phasedHandlers);
                }
            }
        }
    }
    return handlers || [];
};


/**
 * A handlerSupplier implementation for COMPONENT event handlers to
 * use for COMPONENT events that do NOT go through capture or bubble
 * phases.
 * @private
 */
AuraEventService.prototype.getNonBubblingComponentEventHandlers = function(cmp, evt, phase/*, isOwner*/) {
    var handlers;
    // just get event handlers for this cmp, not its super(s)
    if(cmp.destroyed!==1 && cmp.getDef().getEventDef(evt.getName())) {
        var dispatcher = cmp.getEventDispatcher();
        if (dispatcher) {
            var handlersObj = dispatcher[evt.getName()];
            handlers = handlersObj && handlersObj[phase];
        }
    }
    return handlers || [];
};

/**
 * Returns an iterator over event handler tuples for a COMPONENT event that
 * does not support "capture" or "bubble" phases. The iterator returns HandlerIteratorResult with
 * handlers to invoke in the correct order for those two respective phases.
 * @param {Event} evt The event
 * @param {handlerSupplier} The handler supplier function
 * @return {HandlerIteratorResult} A HandlerIteratorResult
 * @private
 * @function
 */
AuraEventService.prototype.getNonBubblingComponentEventHandlerIterator = (function() {

    // Component event handlers with no phase are coerced to the "bubble" phase for
    // backwards compatibility. Events for this kind of iterator always execute in
    // the "bubble" phase.
    var PHASE = AuraEventService.Phase.BUBBLE;

    function NonBubblingComponentHandlerIterator(evt, componentEventHandlersSupplierFn) {
        var done = false;
        var currentValue;
        var cmp = evt.getSource();
        var currentCmp = cmp;
        var handlerIndex = 0;

        function getHandlers() {
            while(cmp) {
                currentCmp = cmp;
                var evtHandlers = componentEventHandlersSupplierFn(currentCmp, evt, PHASE);
                cmp = cmp.getSuper();
                if (evtHandlers) {
                     // reset handlerIndex
                    handlerIndex = 0;
                    return evtHandlers;
                }
            }
        }

        var handlers = getHandlers();

        this.next = function() {
            while(!done) {
                if(!handlers) {
                    // handlers is undefined completely, we're all done
                    done = true;
                    currentValue = undefined;
                }
                else if(handlerIndex < handlers.length) {
                    // have more handlers to iterate
                    currentValue = {
                        cmp: currentCmp,
                        phase: PHASE,
                        handler: handlers[handlerIndex++]
                    };
                    break;
                }
                else {
                    // get the next set of handlers
                    handlers = getHandlers();
                }
            }

            return {
                value: currentValue,
                done: done
            };
        };

        this.return = function(value) {
            if(!done) {
                done = true;
                currentValue = value;
            }
            return {
                value: currentValue,
                done: done
            };
        };

        this.throw = function(e) {
            if(!done) {
                done = true;
                currentValue = undefined;
            }

            throw e;
        };
    }

    return function(evt) {
        return new NonBubblingComponentHandlerIterator(evt, this.getNonBubblingComponentEventHandlers);
    };
})();

/**
 * Returns an iterator over all event handlers for a VALUE event or method call event.
 * The iterator emits the next handler function to invoke for the event.
 * @param {Event} evt The event
 * @return {HandlerIteratorResult} A HandlerIteratorResult
 * @private
 * @function
 */
AuraEventService.prototype.getValueHandlerIterator = (function() {
    var PHASE = AuraEventService.Phase.DEFAULT; // these events always execute in "default" phase

    function ValueHandlerIterator(evt) {
        var done = false;
        var currentValue;
        var queue = [];
        var queueIndex = 0;
        var cmp = evt.getSource();

        var evtDef = evt.eventDef;
        var eventDispatcher = evt.eventDispatcher;
        while (evtDef) {
            var qname = evtDef.getDescriptor().getQualifiedName();
            var handlers = eventDispatcher[qname] && eventDispatcher[qname][PHASE];

            if (handlers) {
                // This should always be true for value events and method call events
                if ($A.util.isArray(handlers)) {
                    // Value handlers on components and methods use arrays, not objects
                    for (var i = 0; i < handlers.length; i++) {
                        queue.push({
                            cmp: cmp,
                            phase: PHASE,
                            handler: handlers[i]
                        });
                    }
                }
            }
            evtDef = evtDef.getSuperDef();
        }


        this.next = function() {
            while(!done) {
                if(queueIndex < queue.length) {
                    // have more handlers to iterate
                    currentValue = queue[queueIndex++];
                    break;
                }
                else {
                    // we're all done
                    done = true;
                    currentValue = undefined;
                }
            }

            return {
                value: currentValue,
                done: done
            };
        };

        this.return = function(value) {
            if(!done) {
                done = true;
                currentValue = value;
            }
            return {
                value: currentValue,
                done: done
            };
        };

        this.throw = function(e) {
            if(!done) {
                done = true;
                currentValue = undefined;
            }

            throw e;
        };
    }

    return function(evt) {
        return new ValueHandlerIterator(evt);
    };
})();

/**
 * A handlerSupplier implementation for APPLICATION event handlers
 * @private
 */
AuraEventService.prototype.getPhasedApplicationEventHandlers = function(evt, cmp, phase, isOwner) {
    var evtDef = evt.eventDef;
    var eventDispatcher = evt.eventDispatcher;
    var globalId = cmp.globalId;
    var phasedEvtHandlers = [];

    if(cmp.destroyed!==1) {
        // collect handlers for the entire event definition hierarchy
        while (evtDef) {
            var qname = evtDef.getDescriptor().getQualifiedName();
            var handlers = eventDispatcher[qname];
            var cmpPhasedHandlers = handlers && handlers[phase] && handlers[phase][globalId];
            if (cmpPhasedHandlers) {
                for(var i = 0; i < cmpPhasedHandlers.length; i++) {
                    if(isOwner || cmpPhasedHandlers[i].includeFacets) {
                        phasedEvtHandlers.push(cmpPhasedHandlers[i]);
                    }
                }
            }
            evtDef = evtDef.getSuperDef();
        }
    }

    return phasedEvtHandlers;
};


/**
 * Convenience function that indicates if an event has any handlers registered
 * in the bubble or capture phases at all.
 * @return {Boolean} True if the event has any handlers in bubble or capture
 *      phases
 * @private
 */
AuraEventService.prototype.applicationEventHasPhasedHandlers = (function() {

    function hasHandlers(phasedHandlerMap) {
        for(var globalId in phasedHandlerMap) {
            if(phasedHandlerMap.hasOwnProperty(globalId) && phasedHandlerMap[globalId] && phasedHandlerMap[globalId].length) {
                return true;
            }
        }
        return false;
    }

    return function(evt) {
        var evtDef = evt.eventDef;
        var eventDispatcher = evt.eventDispatcher;

        // look for handlers in the entire event definition hierarchy
        while (evtDef) {
            var qname = evtDef.getDescriptor().getQualifiedName();
            var handlers = eventDispatcher[qname];
            if(handlers && (hasHandlers(handlers[AuraEventService.Phase.BUBBLE]) || hasHandlers(handlers[AuraEventService.Phase.CAPTURE]))) {
                return true;
            }
            evtDef = evtDef.getSuperDef();
        }

        return false;
    };
})();


/**
 * Returns an iterator over all event handlers for a given APPLICATION event.
 * The iterator emits the next handler function to invoke for the event.
 * @param {Event} evt The event
 * @return {HandlerIteratorResult} A HandlerIteratorResult
 * @private
 * @function
 */
AuraEventService.prototype.getAppEventHandlerIterator = (function() {

    // Iterator over all event handlers in the "default" phase
    function AppEventDefaultPhaseHandlerIterator(evt, rootId) {
        var done = false;

        var queue = null;
        var queueIndex = 0;
        var currentValue;
        var rootCmp = rootId && $A.getComponent(rootId);

        // this is lazy in that it's called on the first "next()" call
        // but once called it builds a queue of the entire result set
        // since there's no reason to be completely lazy for default
        // event handlers
        function fillQueue() {
            queue = [];
            var evtDef = evt.eventDef;
            var eventDispatcher = evt.eventDispatcher;
            while(evtDef) {
                var qname = evtDef.getDescriptor().getQualifiedName();
                var handlers = eventDispatcher[qname];
                var defaultHandlersMap = handlers && handlers[AuraEventService.Phase.DEFAULT];
                var cmpHandlers;

                if (defaultHandlersMap) {
                    for(var globalId in defaultHandlersMap) {
                        if(defaultHandlersMap.hasOwnProperty(globalId)) {
                            var cmp = $A.getComponent(globalId);
                            // Some handlers may be added programmatically with a globalId that is
                            // not a valid component id. If the handler is associated with a component,
                            // make sure the component is still valid.
                            if(cmp && cmp.destroyed===1) {
                                delete defaultHandlersMap[globalId];
                                continue;
                            }
                            if(rootCmp) {
                                // check if the cmp is contained within the rootCmp
                                var containsResult = $A.componentService.containsComponent(rootCmp, cmp);
                                if(!containsResult.result) {
                                    // the component hierarchy for the cmp does not include the rootCmp
                                    // so don't include these handlers in the result set for the iterator
                                    continue;
                                }

                                // JBA: Should we use containsResult.isOwner to distinguish between
                                // containment by owner and containment by transclusion?
                            }

                            // push an entry for each handler into the queue
                            cmpHandlers = defaultHandlersMap[globalId];
                            for(var i = 0; i < cmpHandlers.length; i++) {
                                // HandlerIteratorResult
                                queue.push({
                                    cmp: cmp,
                                    phase: AuraEventService.Phase.DEFAULT,
                                    handler: cmpHandlers[i]
                                });
                            }
                        }
                    }
                }
                // move up the event definition hierarchy to look for handlers of super types of the event
                evtDef = evtDef.getSuperDef();
            }
        }

        this.next = function() {
            while(!done) {

                if(!queue) {
                    fillQueue();
                }

                if(queueIndex < queue.length) {
                    currentValue = queue[queueIndex++];
                    break;
                }
                else {
                    done = true;
                    currentValue = null;
                }
            }

            return {
                value: currentValue,
                done: done
            };
        };

        this.return = function(value) {
            if(!done) {
                done = true;
                currentValue = value;
            }
            return {
                value: currentValue,
                done: done
            };
        };

        this.throw = function(e) {
            if(!done) {
                done = true;
                currentValue = undefined;
            }

            throw e;
        };
    }

    // Iterator over all event handlers in "capture", "bubble", and "default" phase
    function AppEventHandlerIterator(evt, eventService) {

        var defaultEventHandlerIterator = null;
        var currentPhase = AuraEventService.Phase.CAPTURE;
        var currentValue = null; // HandlerIteratorResult
        var done = false;
        var phasedEventHandlerIterator;

        if(!eventService.applicationEventHasPhasedHandlers(evt)) {
            // there are no "bubble" or "capture" handlers at all
            // optimize by moving straight to the "default" phase
            currentPhase = AuraEventService.Phase.DEFAULT;
            defaultEventHandlerIterator = new AppEventDefaultPhaseHandlerIterator(evt);
        }
        else {
            phasedEventHandlerIterator = eventService.getPhasedEventHandlerIterator(evt, eventService.getPhasedApplicationEventHandlers);
        }

        this.next = function() {
            while(!done) {

                if(currentPhase === AuraEventService.Phase.CAPTURE || currentPhase === AuraEventService.Phase.BUBBLE) {
                    var phaseRes = phasedEventHandlerIterator.next(); // { value: HandlerIteratorResult, done: Boolean }
                    if(!phaseRes.done) {
                        // When the PhasedEventHandlerIterator is NOT done, then eventStopPropagation has not been invoked
                        currentValue = phaseRes.value;
                        currentPhase = currentValue.phase;
                        break;
                    }
                    else if(evt.defaultPrevented) {
                        // if preventDefault() was called in a previous phase, we're done
                        currentValue = undefined;
                        currentPhase = AuraEventService.Phase.DEFAULT;
                        done = true;
                    }
                    else {
                        // Move directly to the "default" phase
                        // stopPropagation() may have been invoked, so let's check the phaseRes.value
                        // for a defined value which would indicate if the iterator was stopped preemptively.
                        // PhasedEventHandlerIterator will terminate with a defined value if stopPropagation()
                        // was called.
                        currentPhase = AuraEventService.Phase.DEFAULT;
                        var bcastRootId = null;
                        if(evt.eventStopPropagation && phaseRes.value) {
                            // stopPropagation() was called, so we need to establish the broadcast root
                            // to scope the default event handlers
                            bcastRootId = phaseRes.value.cmp.globalId;
                        }

                        defaultEventHandlerIterator = new AppEventDefaultPhaseHandlerIterator(evt, bcastRootId);
                    }
                }
                else {
                    var defaultRes = defaultEventHandlerIterator.next();

                    if(!defaultRes.done) {
                        currentValue = defaultRes.value;
                        break;
                    }

                    currentValue = undefined;
                    done = true;
                }
            }

            return {
                value: currentValue,
                done: done
            };
        };

        this.return = function(value) {
            if(!done) {
                done = true;
                currentValue = value;
            }
            return {
                value: currentValue,
                done: done
            };
        };

        this.throw = function(e) {
            if(!done) {
                done = true;
                currentValue = undefined;
            }

            throw e;
        };
    }

    return function(evt) {
        return new AppEventHandlerIterator(evt, this);
    };
})();


/**
 * Returns the new event.
 * @param {String} name The event object in the format namespace:component
 * @param {Function} [callback] The function that gets executed when the get has succeeded. Since this could download the event def if it is not present you need the callback to get the definition.
 * @memberOf AuraEventService
 */
AuraEventService.prototype.get = function(name, callback) {
    var newEvent = this.newEvent(name);
    if(callback) {
        if(newEvent) {
            return callback(newEvent);
        }
        return this.getDefinition(name, callback);
    }
    return newEvent;
};

/* Evaluates an action expression and runs it
* @private
* */
AuraEventService.prototype.expressionHandler=function(expression,event){
    if(expression){
        var expressionValue=expression;
        var target=null;
        if($A.util.isExpression(expressionValue)){
            target=expressionValue.valueProvider;
            expressionValue=expressionValue.evaluate();
        }
        if($A.util.isAction(expressionValue)) {
            expressionValue.run(event);
        }
        if($A.util.isFunction(expressionValue)){
            expressionValue(target,event);
        }
    }
};

/**
 * Dynamically adds an application event handler for the specified event.
 *
 * @param {String} event The name of the event to handle, e.g. 'aura:applicationEvent'.
 * @param {Function} handler A reference to the function or action to invoke when the event is fired, e.g., 'cmp.getReference("c.myAction")'.
 * @param {String} phase The event bubbling phase for which to add the handler. Optional. If omitted, uses "default".
 * @param {Boolean} includeFacets If true, attempt to catch events generated by components transcluded by facets, e.g. v.body.
 *
  * @private
 */
AuraEventService.prototype.addEventHandler=function(component,eventDef,handler,phase,includeFacets){
    // Guards
    if(!$A.util.isComponent(component)){
        throw new Error("AuraEventService.addEventHandler: 'component' must be a valid Component.");
    }
    if(!(eventDef instanceof EventDef)){
        throw new Error("AuraEventService.addEventHandler: 'eventDef' must be a valid Event definition.");
    }
    if($A.util.isExpression(handler)){
        var reference=handler;
        handler=this.expressionHandler.bind(this,handler);
        handler.reference=reference;
    }
    if(!$A.util.isFunction(handler)){
        throw new Error("AuraEventService.addEventHandler: 'handler' must be a valid Function or a reference to a controller action, e.g., 'cmp.getReference(\"c.myAction\");'");
    }
    phase=AuraEventService.validatePhase(phase);

    // Lazy initializations
    var event=eventDef.descriptor.qualifiedName;
    var handlers = this.eventDispatcher[event];
    if (!handlers) {
        this.eventDispatcher[event] = handlers = {};
    }

    var phaseHandlers = handlers[phase];
    if(!phaseHandlers) {
        handlers[phase] = phaseHandlers = {};
    }

    var globalId=component.globalId;
    var cmpHandlers = phaseHandlers[globalId];
    if (!cmpHandlers) {
        phaseHandlers[globalId] = cmpHandlers = [];
    }
    // Leak control map
    if(!this.componentHandlers[globalId]) {
        this.componentHandlers[globalId] = [];
    }

    // Potentially extend scope of handler
    if(includeFacets){
        handler.includeFacets=true;
    }

    // Discard duplicates
    for(var i=0;i<cmpHandlers.length;i++){
        if(cmpHandlers[i]===handler || (cmpHandlers[i].reference&&cmpHandlers[i].reference===handler.reference)){
            return;
        }
    }

    // Register handler and leak control
    cmpHandlers.push(handler);
    this.componentHandlers[globalId].push({ "event": event, "phase": phase });
};

/**
 * Adds an event handler.
 * @param {Object} config The data for the event handler
 * @memberOf AuraEventService
 * @public
 * @export
 * @deprecated use <code>addEventHandler</code> instead.
 */
AuraEventService.prototype.addHandler = function(config) {
    //$A.deprecated("$A.eventService.addHandler(config) is no longer supported.","Please use Component#addEventHandler(event,handler,phase,includeFacets) instead.");
    var includeFacets=config["includeFacets"];
    includeFacets=includeFacets !== undefined && includeFacets !== null && includeFacets !== false && includeFacets !== 0 && includeFacets !== "false" && includeFacets !== "" && includeFacets !== "f";
    var component=$A.getComponent(config["globalId"]);
    if(!component){
        //JBUCH: HACK: remap unknown target to application root
        component=Object.create(Aura.Component.Component.prototype,{globalId:{value:"1:0"}});
        $A.warning("$A.eventService.addHandler: Unknown component with globalId '"+config["globalId"]+"'. Does this component exist?");
    }
    var eventDef=this.getEventDef(config["event"]);
    if(!eventDef){
        //JBUCH: HACK: allow unknown events to application root
        eventDef=Object.create(Aura.Event.EventDef.prototype,{descriptor:{value:{qualifiedName:config["event"]}}});
        $A.warning("$A.eventService.addHandler: Unknown event with name '"+config["event"]+"'. Do you have a missing dependency?");
    }
    this.addEventHandler(component,eventDef,config["handler"],config["phase"],includeFacets);
};

/**
 * Dynamically removes an application event handler for the specified event.
 *
 * @param {String} event The name of the event to remove, e.g. 'aura:applicationEvent'.
 * @param {Function} handler A reference to the function or action to action to remove, e.g., 'cmp.getReference("c.handleApplicationEvent");'.
 * @param {String} phase The event bubbling phase for which to remove the handler. Optional. If omitted, uses "default".
 *
 * @export
 * @private
 */
AuraEventService.prototype.removeEventHandler=function(component,eventDef,handler,phase) {
    // Guards
    if(!$A.util.isComponent(component)){
        throw new Error("AuraEventService.removeEventHandler: 'component' must be a valid Component.");
    }
    if(!(eventDef instanceof EventDef)){
        throw new Error("AuraEventService.removeEventHandler: 'eventDef' must be a valid Event definition.");
    }

    phase = AuraEventService.validatePhase(phase);

    var event=eventDef.descriptor.qualifiedName;
    var handlers=this.eventDispatcher[event];
    if(handlers){
        var phaseHandlers=handlers[phase];
        if(phaseHandlers){
            var globalId=component.globalId;
            if(!globalId&&$A.finishedInit){
                throw new Error("$A.removeEventHandler: Unable to find current component target. Are you running in Aura scope?");
            }
            var cmpHandlers=phaseHandlers[globalId];
            if(cmpHandlers){
                for(var i=0;i<cmpHandlers.length;i++){
                    if(cmpHandlers[i]===handler||cmpHandlers[i].reference===handler){
                        delete cmpHandlers[i].reference;
                        cmpHandlers.splice(i,1);
                        break;
                    }
                }
            }
        }
   }
};

/**
 * Removes an event handler.
 * @param {Object} config The data for the event
 * @memberOf AuraEventService
 * @public
 * @export
 */
AuraEventService.prototype.removeHandler = function(config) {
    //$A.deprecated("$A.eventService.removeHandler(config) is no longer supported.","Please use $A.removeEventHandler(event,handler,phase) instead.");

//    config["event"] = DefDescriptor.normalize(config["event"]);

    var globalId=config["globalId"];
    var component=$A.getComponent(globalId);
    if(!component){
        //JBUCH: HACK: remap unknown target to application root
        globalId="1:0";
        //$A.warning("$A.eventService.removeHandler: Unknown component with globalId '"+config["globalId"]+"'.");
    }
    var def=this.getEventDef(config["event"]);

    var handlers = this.eventDispatcher[def.descriptor.qualifiedName];
    if (handlers) {
        var phase = config["phase"] || "default";
        var phaseHandlers = handlers[phase];
        if(phaseHandlers) {
            delete phaseHandlers[globalId];
        }
    }
};

/**
 * Removes all handlers in all the phases for a component. Used by component.destroy()
 * @param {String} globalId the id of the component.
 */
AuraEventService.prototype.removeHandlersByComponentId = function(globalId) {
    var references = this.componentHandlers[globalId];
    if(references) {
        var dispatcher = this.eventDispatcher;
        for(var c=0,reference;c<references.length;c++) {
            reference = references[c];
            if(dispatcher[reference["event"]] && dispatcher[reference["event"]][reference["phase"]] && dispatcher[reference["event"]][reference["phase"]][globalId] ) {
                delete dispatcher[reference["event"]][reference["phase"]][globalId];
            }
        }
        delete this.componentHandlers[globalId];
    }
};

/**
 * Adds an event handler that will trigger only once, and inmediately will be removed.
 * @param {Object} config The data for the event handler
 * @memberOf AuraEventService
 * @public
 * @export
 * @deprecated
 */
AuraEventService.prototype.addHandlerOnce = function(config) {
    var handler = config["handler"];
    var component=$A.getComponent(config["globalId"]);
    if(!component){
        //JBUCH: HACK: remap unknown target to application root
        component=Object.create($A.Component.prototype,{globalId:{value:"1:0"}});
        //$A.warning("$A.eventService.addHandlerOnce: Unknown component with globalId '"+config["globalId"]+"'.");
    }
    var def=this.getEventDef(config["event"]);
    config["handler"] = $A.getCallback(function () {
        this.removeEventHandler(component,def,config["handler"],config["phase"]);
        handler();
    }.bind(this));
    this.addEventHandler(component,def,config["handler"],config["phase"],config["includeFacets"]);
};

/**
 * Returns the event definition.
 * Internal method to the framework. To get an event def from the API, use $A.get("e.prefix:name", function(def){});
 *
 * @param {String} descriptor name of EventDef
 * @return {EventDef} The event definition.
 * @memberOf AuraEventService
 * @private
 */
AuraEventService.prototype.getEventDef = function(config) {
    var descConfig = this.createDescriptorConfig(config);
    var descriptor = this.getDescriptorFromConfig(descConfig);
    var definition = this.eventDefRegistry[descriptor];

    if (!definition && this.savedEventConfigs[descriptor]) {
        definition = this.createFromSavedConfigs(descConfig);
    }

    return definition;
};

/**
 * Get the event definition.
 * Does access checks.
 * You cannot fire this though, use newEvent() for that.
 *
 * @param  {String}  descriptor Event descriptor in the pattern prefix:name or markup://prefix:name.
 */
AuraEventService.prototype.getDef = function(descriptor) {
    $A.assert(descriptor, "No EventDefinition was descriptor specified.");
    var definition = this.getEventDef(descriptor);

    if(definition && !$A.clientService.allowAccess(definition)) {
        var message="Access Check Failed! EventService.getEventDef():'" + definition.getDescriptor().toString() + "' is not visible to '" + $A.clientService.currentAccess + "'.";
        if($A.clientService.enableAccessChecks) {
            if($A.clientService.logAccessFailures){
                $A.error(null,new $A.auraError(message));
           }
            return undefined;
        } else {
            if($A.clientService.logAccessFailures){
                $A.warning(message);
            }
            // Intentional fallthrough
        }
    }

    return definition;
};


/**
 * Checks to see if the definition for the event currently reside on the client.
 * Could still exist on the server, we won't know that till we use a getDefinitiion call to try to retrieve it.
 * This method is private, to use it, use $A.hasDefinition("e.prefix:name");
 * @private
 * @param  {String}  descriptor Event descriptor in the pattern prefix:name or markup://prefix:name.
 * @return {Boolean}            True if the definition is present on the client.
 */
AuraEventService.prototype.hasDefinition = function(descriptor) {
    var definition = this.getEventDef(descriptor);
    if(definition && !$A.clientService.allowAccess(definition)) {
        var message="Access Check Failed! EventService.hasDefinition():'" + definition.getDescriptor().toString() + "' is not visible to '" + $A.clientService.currentAccess + "'.";
        if($A.clientService.enableAccessChecks) {
            if($A.clientService.logAccessFailures){
                $A.error(null,new $A.auraError(message));
            }
            return false;
        }else{
            if($A.clientService.logAccessFailures){
                $A.warning(message);
            }
            //Intentional fallthrough
        }
    }
    return !!definition;
};

/**
 * Gets descriptor from the config object (for normalization)
 * @param {Object} Controller descriptor config
 * @returns {String} Descriptor
 * @private
 */
AuraEventService.prototype.createDescriptorConfig = function(descriptor) {
    descriptor = typeof descriptor === 'string' ? descriptor : descriptor[Json.ApplicationKey.DESCRIPTOR].toString();
    descriptor = descriptor.indexOf("://") < 0 ? "markup://" + descriptor : descriptor;
    return { "descriptor" : descriptor };
};


/**
 * Get the event definition. If it is not available, contact the server to download it.
 *
 * This method is private, to utilize it's functionality you can use $A.getDefinition("e.prefix:name");
 *
 * @private
 *
 * @param  {String}  descriptor Event descriptor in the pattern prefix:name or markup://prefix:name.
 * @param  {Function} callback  The function callback that gets executed with the definition. May go to the server first.
 * @return undefined            Always use the callback to access the definition.
 */
AuraEventService.prototype.getDefinition = function(descriptor, callback) {
    var descriptorName = descriptor.replace('e.', '');
    var def = this.getDef(descriptorName);

    // if def failed the access check, or the event was returned.
    if (def === null || def) {
        callback(def);
        return;
    }

    var action = $A.get("c.aura://ComponentController.getEventDef");
    action.setParams({
        "name": descriptorName
    });
    action.setCallback(this, function (actionReponse) {
        var definition = null;
        var state = actionReponse.getState();
        if(state === "SUCCESS") {
            definition = this.getDef(descriptorName);
        }
        callback(definition);
    });

    $A.enqueueAction(action);
};


/**
 * Gets descriptor from the config object (for normalization)
 * @param {Object} Controller descriptor config
 * @returns {String} Descriptor
 * @private
 */
AuraEventService.prototype.getDescriptorFromConfig = function(descriptorConfig) {
    var descriptor = descriptorConfig && descriptorConfig[Json.ApplicationKey.DESCRIPTOR];
    $A.assert(descriptor, "Event Descriptor for Config required for registration");
    return descriptor;
};


/**
 * Creates and saves EventDef into registry
 * @param {Object} config config for EventDef
 * @returns {EventDef} instance from registry
 */
AuraEventService.prototype.createFromSavedConfigs = function(config) {
    var descriptor = config[Json.ApplicationKey.DESCRIPTOR];
    if (!descriptor && config["getDescriptor"]) {
        descriptor = config.getDescriptor();
    }

    var def = new EventDef(this.savedEventConfigs[descriptor]);
    this.eventDefRegistry[descriptor] = def;
    delete this.savedEventConfigs[descriptor];
    return def;
};



/**
 * Creates and returns EventDef from config
 * @param {Object} config The parameters for the event
 * @return {EventDef} The event definition.
 * @memberOf AuraEventService
 * @private
 */
AuraEventService.prototype.createEventDef = function(config) {
    var descConfig = this.createDescriptorConfig(config);
    var descriptor = this.getDescriptorFromConfig(descConfig);
    var definition = this.eventDefRegistry[descriptor];

    if (!definition) {
        if (this.savedEventConfigs[descriptor]) {
            definition = this.createFromSavedConfigs(descConfig);
        } else {
            definition = new EventDef(config);
            this.eventDefRegistry[descriptor] = definition;
        }
    }

    return definition;
};

/**
 * Saves EventDef config so it can be used later when EventDef is actually used.
 * Allows Aura to only create EventDef when needed
 *
 * @param {Object} config event definition config
 */
AuraEventService.prototype.saveEventConfig = function(config) {
    $A.assert(config && config[Json.ApplicationKey.DESCRIPTOR], "Event config required for registration");
    this.savedEventConfigs[config[Json.ApplicationKey.DESCRIPTOR]] = config;
};

/**
 * Returns true if the event has handlers.
 * @param {String} name The event name
 * @memberOf AuraEventService
 * @public
 * @export
 */
AuraEventService.prototype.hasHandlers = function(name) {
    var qualifiedName = DefDescriptor.normalize(name);
    var phases = this.eventDispatcher[qualifiedName];
    if(phases) {
        // If we added a handler, then removed it. The dispatcher will still have an entry for that event
        // but we need to dig into the phases to see if there are any components
        for(var phase in phases) {
            if(!$A.util.isEmpty(phases[phase])) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Returns the qualified name of all events known to the registry.
 * @export
 */
AuraEventService.prototype.getRegisteredEvents = function() {
    return Object.keys(this.eventDefRegistry);
};

//#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
/**
 * Whether there are pending events
 * Available in DEV mode only.
 * @export
 */
AuraEventService.prototype.hasPendingEvents = function() {
    return $A.clientService.inAuraLoop();
};
//#end

Aura.Services.AuraEventService = AuraEventService;
