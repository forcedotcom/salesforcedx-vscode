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
 * @class The Aura Rendering Service, accessible using <code>$A.renderingService</code>.
 *        Renders components. The default behaviors can be customized in a
 *        client-side renderer.
 * @constructor
 * @export
 */
function AuraRenderingService() {
    this.visited = undefined;
    this.afterRenderStack = [];
    this.dirtyComponents = {};
    // KRIS: HALO: HACK:
    // IE11 is not returning the Object.keys() for dirtyComponents in the order they were added.
    // So we rerender dirty out of order.
    // This array assures we rerender in the order that we add keys to the array.
    // Ideally, we shouldn't care what order we rerender in, but that's a more difficult bug to track down in 194/patch
    this.dirtyComponentIds = [];
    this.needsCleaning = false;
    this.markerToReferencesMap = {};
    this.rerenderFacetTopVisit = true;

    // For elements that do not have a data-aura-rendered-by attribute, we'll add a unique identifier.
    this.DATA_UID_KEY = "data-rendering-service-uid";
    this.uid = 1;
}

/**
 * Renders a component by calling its renderer.
 *
 * @param {Component} components - A component or a component array to be rendered.
 * @param {HTMLElement} parent - Optional. The element into which rendered elements are inserted.
 *
 * @memberOf AuraRenderingService
 * @public
 * @export
 */
AuraRenderingService.prototype.render = function(components, parent) {
    //#if {"modes" : ["STATS"]}
    var startTime = Date.now();
    //#end

    components = this.getArray(components);

    var elements = [];
    for (var i=0; i < components.length; i++){
        var cmp = components[i];

        if (!$A.util.isComponent(cmp)) {
            if ($A.componentService.isComponentDefRef(cmp)) {
                // If someone passed a config in, construct it.
                cmp = $A.componentService.createComponentPriv(cmp);
                // And put the constructed component back into the array.
                components[i] = cmp;
            } else {
                $A.warning("AuraRenderingService.render: 'component[" + i + "]' was not a valid component, found '" + cmp + "'.");
                continue;
            }
        }

        if (!cmp.isValid()) {
            continue;
        }

        $A.clientService.setCurrentAccess(cmp);
        try {
            var renderedElements = cmp["render"]();
            renderedElements = this.finishRender(cmp, renderedElements);
            // component's render could return non-array
            Array.prototype.push.apply(elements, this.getArray(renderedElements));
        } catch (e) {
            if (!(e instanceof $A.auraError) || !e["component"]) {
                var auraError = new $A.auraError("render threw an error in '" + cmp.getType() + "'", e);
                $A.lastKnownError = auraError;
                throw auraError;
            }
            throw e;
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    }

    if (parent) {
        $A.util.appendChild(elements, parent);
    }

    //#if {"modes" : ["STATS"]}
    this.statsIndex["render"].push({
        'component' : components,
        'startTime' : startTime,
        'endTime' : Date.now()
    });
    //#end

    return elements;
};

/**
 * The default rerenderer for components affected by an event. Call
 * superRerender() from your customized function to chain the
 * rerendering to the components in the body attribute.
 *
 * @param {Component} components - The component or component array to be rerendered.
 * @returns {Array} An array of rerendered elements.
 *
 * @memberOf AuraRenderingService
 * @public
 * @export
 */
AuraRenderingService.prototype.rerender = function(components) {
    //#if {"modes" : ["STATS"]}
    var startTime = Date.now();
    //#end

    var topVisit = false;
    var visited = this.visited;
    if (!visited) {
        visited = this.visited = {};
        topVisit = true;
    }

    var elements = [];

    components = this.getArray(components);
    for (var i = 0; i < components.length; i++) {
        var cmp = components[i];
        var id = cmp.getGlobalId();
        if (!cmp.isValid()) {
            this.cleanComponent(id);
            continue;
        }

        var rerenderedElements = undefined;
        if (!visited[id]) {
            if (!cmp.isRendered()) {
                throw new $A.auraError("AuraRenderingService.rerender: attempt to rerender component that has not been rendered.", null, $A.severity.QUIET);
            }

            $A.clientService.setCurrentAccess(cmp);
            try {
                rerenderedElements = cmp["rerender"]();
            } catch (e) {
                if (!(e instanceof $A.auraError) || !e["component"]) {
                    var auraError = new $A.auraError("rerender threw an error in '" + cmp.getType() + "'", e);
                    $A.lastKnownError = auraError;
                    throw auraError;
                }
                throw e;
            } finally {
                this.cleanComponent(id);
                visited[id] = true;
                $A.clientService.releaseCurrentAccess();
            }
        }

        // cmp has been visited or component's rerender returns undefined
        if (rerenderedElements === undefined) {
            Array.prototype.push.apply(elements, this.getElements(cmp));
        } else {
            // component's rerender could return single element
            Array.prototype.push.apply(elements, this.getArray(rerenderedElements));
        }

    }
    //#if {"modes" : ["STATS"]}
    this.statsIndex["rerender"].push({
        'component' : components,
        'startTime' : startTime,
        'endTime' : Date.now()
    });
    //#end

    if (topVisit) {
        this.visited = undefined;
        try {
            this.afterRender(this.afterRenderStack);
        } finally {
            this.afterRenderStack.length = 0;
        }
        for (var r = 0; r < components.length; r++) {
            components[r].fire("render");
        }
    }

    return elements;
};

/**
 * The default behavior after a component is rendered.
 *
 * @param {Component|Array} components - The component or component array that has finished rendering
 * @memberOf AuraRenderingService
 * @public
 * @export
 */
AuraRenderingService.prototype.afterRender = function(components) {
    //#if {"modes" : ["STATS"]}
    var startTime = Date.now();
    //#end

    components = this.getArray(components);
    for (var i = 0; i < components.length; i++){
        var cmp = components[i];
        if (!$A.util.isComponent(cmp)) {
            $A.warning("AuraRenderingService.afterRender: 'cmp' must be a valid Component, found '"+cmp+"'.", null, $A.severity.QUIET);
            continue;
        }
        if(cmp.isValid()) {
            $A.clientService.setCurrentAccess(cmp);
            try {
                cmp["afterRender"]();
                cmp.fire("render");
            } catch (e) {
                if (!(e instanceof $A.auraError) || !e["component"]) {
                    var auraError = new $A.auraError("afterRender threw an error in '" + cmp.getType() + "'", e);
                    $A.lastKnownError = auraError;
                    throw auraError;
                }
                throw e;
            } finally {
                $A.clientService.releaseCurrentAccess(cmp);
            }
        }
    }

    //#if {"modes" : ["STATS"]}
    this.statsIndex["afterRender"].push({
        'component' : components,
        'startTime' : startTime,
        'endTime' : Date.now()
    });
    //#end
};

/**
 * The default unrenderer that deletes all the DOM nodes rendered by a
 * component's render() function. Call superUnrender() from your
 * customized function to modify the default behavior.
 *
 * @param {Component|Array} components - The component or component array to be unrendered.
 * @memberOf AuraRenderingService
 * @public
 * @export
 */
AuraRenderingService.prototype.unrender = function(components) {
    if (!components) {
        return;
    }

    //#if {"modes" : ["STATS"]}
    var startTime = Date.now();
    //#end

    var visited = this.visited;
    components = this.getArray(components);

    var cmp;
    var container;
    var beforeUnrenderElements;
    for (var i = 0; i < components.length; i++){
        cmp = components[i];
        if ($A.util.isComponent(cmp) && cmp.destroyed!==1 && cmp.isRendered()) {
            cmp.setUnrendering(true);
            $A.clientService.setCurrentAccess(cmp);

            // Use the container to check if we're in the middle of unrendering a parent component.
            // Sometimes that is not available, so otherwise move to considering the owner.
            container = cmp.getContainer() || cmp.getOwner();

            // If the parent is NOT unrendering, then remove these and unrender it's children.
            // In the unrenderFacets function, those elements won't be removed from the DOM since their parents here
            // are getting removed.
            if (container && !container.getConcreteComponent().isUnrendering()) {
                // This is the top of the unrendering tree.
                // Save the elements we want to remove, so they can be deleted after the unrender is called.
                beforeUnrenderElements = cmp.getElements();
            } else {
                beforeUnrenderElements = null;
            }

            try {
                cmp["unrender"]();
            } catch (e) {
                if (!(e instanceof $A.auraError) || !e["component"]) {
                    var auraError = new $A.auraError("unrender threw an error in '" + cmp.getType() + "'", e);
                    $A.lastKnownError = auraError;
                    throw auraError;
                }
                throw e;
            } finally {
                $A.clientService.releaseCurrentAccess(cmp);

                var oldContainerMarker = this.getMarker(container);
                this.removeElement(this.getMarker(cmp), container);

                var currentContainerMarker = this.getMarker(container);
                // When we remove the marker from container, we only update the references which use the marker element
                // as marker. So, in the container chain, the old marker element may still exist in the component's element
                // collection, if the element is not the marker of the component. Keeping the container chain up to date is
                // required now, because we use the first element to determine the postion when updating container chain during
                // re-rendering facet.
                if (oldContainerMarker !== currentContainerMarker) {
                    this.moveContainerReferencesToMarker(container, oldContainerMarker, currentContainerMarker);
                }

                // If we have beforeUnrenderElements, then we're in a component that should have its
                // elements removed, and those elements are the ones in beforeUnrenderElements.
                if (beforeUnrenderElements && beforeUnrenderElements.length) {
                    // TODO: at the top level of unrendering tree, it's probably needed to remove beforeUnrenderElements
                    // from container chain. Otherwise, the containers may have redundant elements until they get rerendered.

                    for (var c = 0; c < beforeUnrenderElements.length; c++) {
                        $A.util.removeElement(beforeUnrenderElements[c]);
                    }
                }

                if (cmp.destroyed!==1) {
                    cmp.setRendered(false);
                    if (visited) {
                        var id = cmp.getGlobalId();
                        visited[id] = true;
                        this.cleanComponent(id);
                    }
                    cmp.setUnrendering(false);
                }
            }
        }
    }

    //#if {"modes" : ["STATS"]}
    this.statsIndex["unrender"].push({
        'component' : components,
        'startTime' : startTime,
        'endTime' : Date.now()
    });
    //#end
};

/**
 * Store current facet to component.
 * This method does not verify component and facet. Facet MUST be an array.
 *
 * @param {Component} component - The component which owns the facet.
 * @param {Array} facet - A component array to store.
 * @private
 */
AuraRenderingService.prototype.storeFacetInfo = function(component, facet) {
    component._facetInfo = facet.slice(0);
};

/**
 *
 * @param {Component} component - The component which owns the facet.
 * @param {Component|Array} facet - The component or the component array to update.
 * @returns {Object} The updated facet configs
 * @private
 */
AuraRenderingService.prototype.getUpdatedFacetInfo = function(component, facet) {
    if (!$A.util.isComponent(component)) {
        throw new $A.auraError("AuraRenderingService.getUpdatedFacetInfo: 'component' must be a valid Component. Found '" +
                component + "'.", null, $A.severity.QUIET);
    }
    if ($A.util.isComponent(facet)) {
        facet = [facet];
    } else if (!$A.util.isArray(facet)) {
        $A.warning("AuraRenderingService.getUpdatedFacetInfo: 'facet' must be a Component or an Array. Found '" +
                facet + "' in '" + component.getType() + "'.");
        facet = [];
    }

    var updatedFacet = {
        components: [],
        unrenderedComponents: [],
        facetInfo: [],
        useFragment: false,
        fullUnrender: false,
        hasNewMarker: false
    };
    var renderCount = 0;
    if (component._facetInfo) {
        var jmax = -1; // the last matched item index
        for (var i = 0; i < facet.length; i++) {
            var child = facet[i];
            // Guard against non-component facets, as these will cause troubles later.
            if (!$A.util.isComponent(child)) {
                $A.warning("AuraRenderingService.getUpdatedFacetInfo: all values to be rendered in an expression must be components. Found '" +
                        child + "' in '" + component.getType() + "'.");
                continue;
            }

            var found = false;
            for (var j = 0; j < component._facetInfo.length; j++) {
                if (child === component._facetInfo[j]) {
                    updatedFacet.components.push({action:"rerender",component: child, oldIndex: j, newIndex: i});
                    // If the child is in a different position AND the order is different
                    if ((j!==(i-renderCount)) && (j < jmax)) {
                        updatedFacet.useFragment = true;
                    }
                    jmax = j;
                    found = true;
                    component._facetInfo[j] = undefined;
                    break;
                }
            }
            if (!found) {
                updatedFacet.components.push({action:"render",component: child, newIndex: i});
                // the component will have a new marker from the new rendered component
                if (i === 0) {
                    updatedFacet.hasNewMarker = true;
                }
                renderCount++;
            }
            updatedFacet.facetInfo.push(child);
        }

        if (!updatedFacet.components.length) {
            updatedFacet.fullUnrender = true;
        }

        for (var x = 0; x < component._facetInfo.length; x++) {
            // component._facetInfo[x] should always be either a component or a falsy value
            if (component._facetInfo[x]) {
                updatedFacet.unrenderedComponents.unshift({action: "unrender", component: component._facetInfo[x], oldIndex: x});
            }
        }
    }
    return updatedFacet;
};

/**
 * Normailize facet to an array of components.
 * This method instantiates ComponentDefRef on facet to Component.
 * It also updates the container of all components on facet to the facet owner.
 *
 * @param {Component} component - The component whose facet is being rendered.
 * @param {Component|Array} facet - A component or a component array to be rendered.
 * @returns {Array} An array of components.
 *
 * @private
 */
AuraRenderingService.prototype.getFacetInfo = function(component, facet) {
    if (!$A.util.isComponent(component)) {
        throw new $A.auraError("AuraRenderingService.getFacetInfo: 'component' must be a valid Component. Found '" +
                component + "'.", null, $A.severity.QUIET);
    }

    var facetInfo = [];
    var containerId = component.globalId;

    facet = this.getArray(facet);
    for (var i = 0; i < facet.length; i++) {
        var cmp = facet[i];
        if (!$A.util.isComponent(cmp)) {
            if ($A.componentService.isComponentDefRef(cmp)) {
                // If someone passed a config in, construct it.
                cmp = $A.componentService.createComponentPriv(cmp);
                facet[i] = cmp;
            } else {
                $A.warning("AuraRenderingService.getFacetInfo: 'component[" + i + "]' was not a valid component, found '" + cmp + "'.");
                continue;
            }
        }

        facetInfo.push(cmp);
        // Dynamically created component uses its creator as its container when it gets created.
        // The container needs to be updated when the component gets rendered.
        cmp.setContainerComponentId(containerId);
    }

    return facetInfo;
};

/**
 * @public
 * @param {Component} component - The component whose facet is being rendered.
 * @param {Component|Array} facet - The facet to be rendered.
 * @param {HTMLElement} parent - Optional. The element into which rendered elements are inserted.
 * @export
 */
AuraRenderingService.prototype.renderFacet = function(component, facet, parent) {
    var facetInfo = this.getFacetInfo(component, facet);
    this.storeFacetInfo(component, facetInfo);

    var renderedElements = this.render(facetInfo, parent);

    if (parent) {
        this.setMarker(component, parent);
    } else {
        if (renderedElements.length === 0) {
            renderedElements[0] = this.createMarker(null, "render facet: " + component.getGlobalId());
        }
        this.setMarker(component, renderedElements[0]);
    }

    return renderedElements;
};

/**
 * @public
 * @param {Component} component - The component whose facet is being rerendered.
 * @param {Component} facet - The facet to be rerendered.
 * @param {HTMLElement} referenceNode - The element into which rerendered elements are inserted.
 * @export
 */
AuraRenderingService.prototype.rerenderFacet = function(component, facet, referenceNode) {

    var updatedFacet = this.getUpdatedFacetInfo(component, facet);
    var ret = [];
    var marker = this.getMarker(component);
    var target = referenceNode || marker.parentNode;
    var calculatedPosition = 0;
    var nextSibling = null;
    var componentType = component.getType();

    var topVisit = this.rerenderFacetTopVisit;
    var beforeRerenderElements = null;

    // for the top visit, it needs to figure out the updated elements for the dirty component
    // to update the component's container chain
    if (topVisit) {
        this.rerenderFacetTopVisit = false;
        beforeRerenderElements = this.getAllElementsCopy(component);
    }

    // If the parent is NOT my marker then look inside to find it's position.
    if (marker !== target) {
        calculatedPosition += this.getInsertPosition(component, target);
    }

    var unrenderedComponents = updatedFacet.unrenderedComponents;
    // start unrendering from the last component on facet
    for (var n = 0; n < unrenderedComponents.length; n++) {
        var unrenderInfo = unrenderedComponents[n];
        var unrenderedComponent = unrenderInfo.component;

        // Skip, if the component has been destroyed
        if (!unrenderedComponent.isValid()) {
            continue;
        }

        // If the unrendered component used to be the first component on facet, we need to move marker.
        // For html component, it should always has its own element as marker.
        if (unrenderInfo.oldIndex === 0 && component.getType() !== "aura:html") {
            marker = this.getMarker(component);
            var allElements = this.getAllElements(unrenderedComponent);

            if (marker === allElements[0]) {
                var newMarker;
                // If there will be a new marker from new rendered component, we should not move the marker to next sibling
                // when unrendering the first component on facet. It needs the comment marker to insert the new rendered component.
                if (updatedFacet.hasNewMarker || !marker.nextSibling || updatedFacet.fullUnrender) {
                    newMarker = this.createMarker(marker, "unrender facet: " + component.getGlobalId());
                    // for the new comment marker
                    calculatedPosition += 1;
                } else {
                    // We can't just assume the nextSibling, it could belong to what we're unrendering.
                    // Find the next element that this unrendering component does not own.
                    var count = allElements.length - 1;
                    nextSibling = marker.nextSibling;
                    while (count && nextSibling.nextSibling) {
                        nextSibling = nextSibling.nextSibling;
                        count--;
                    }
                    newMarker = nextSibling;
                }

                this.setMarker(component, newMarker);
                this.moveContainerReferencesToMarker(component, marker, newMarker);
            }

        }

        if (unrenderedComponent.autoDestroy()) {
            this.cleanComponent(unrenderedComponent.getGlobalId());
            unrenderedComponent.destroy();
        } else {
            this.unrender(unrenderedComponent);
            unrenderedComponent.disassociateElements();
            this.cleanComponent(unrenderedComponent.getGlobalId());
        }
    }

    var components = updatedFacet.components;
    for (var i = 0; i < components.length; i++) {
        var info = components[i];
        var facetComponent = info.component;

        if (!facetComponent.isValid()) {
            continue;
        }

        var renderedElements = null;
        switch (info.action) {
            case "render":
                // Dynamically created component uses its creator as its container when it gets created.
                // The container needs to be updated when the component gets rendered.
                facetComponent.setContainerComponentId(component.globalId);

                renderedElements = this.render(facetComponent);
                if (updatedFacet.useFragment) {
                    Array.prototype.push.apply(ret, renderedElements);
                    calculatedPosition += renderedElements.length;
                } else if (renderedElements.length) {
                    Array.prototype.push.apply(ret, renderedElements);
                    if (!target) {
                        $A.warning("Rendering Error: The element for the following component was removed from the DOM outside of the Aura lifecycle. " +
                                "We cannot render any further updates to it or its children.\nComponent: " + $A.clientService.getAccessStackHierarchy() +
                                " {" + component.getGlobalId() + "}");
                    } else {
                        nextSibling = target.childNodes[calculatedPosition];
                        this.insertElements(renderedElements, nextSibling||target, nextSibling, nextSibling);
                        calculatedPosition += renderedElements.length;
                    }
                }
                this.afterRenderStack.push(facetComponent);
                break;
            case "rerender":
                if (this.hasDirtyValue(facetComponent)) {
                    renderedElements = this.rerender(facetComponent);
                } else {
                    // We need a copy of the array.
                    renderedElements = this.getAllElementsCopy(facetComponent);
                }
                facetComponent.disassociateElements();
                this.associateElements(facetComponent, renderedElements);
                Array.prototype.push.apply(ret, renderedElements);
                calculatedPosition += renderedElements.length;
                break;
        }
    }
    this.storeFacetInfo(component, updatedFacet.facetInfo);
    if (updatedFacet.useFragment) {
        nextSibling = target.childNodes[calculatedPosition];
        this.insertElements(ret, nextSibling || target, nextSibling, nextSibling);
    }

    // JBUCH: HALO: FIXME: THIS IS SUB-OPTIMAL, BUT WE NEVER WANT TO REASSOCIATE HTML COMPONENTS
    if (componentType !== "aura:html") {
        marker = this.getMarker(component);
        // there's new marker from render or rerender
        if (ret.length > 0 && marker !== ret[0]) {
            this.setMarker(component, ret[0]);
            this.moveContainerReferencesToMarker(component, marker, ret[0]);

            // clean up the old marker if it is not needed anymore
            if (this.isCommentMarker(marker) && ret.indexOf(marker) < 0) {
                this.removeElement(marker);
            }
        } else if (ret.length === 0 && marker) {
            // the marker should only be comment marker
            ret.push(marker);
        }

        component.disassociateElements();
        this.associateElements(component, ret);

        if (topVisit) {
            this.updateElementsOnContainers(component, beforeRerenderElements);
        }
    }

    if (topVisit) {
        this.rerenderFacetTopVisit = true;
    }

    return ret;
};

/**
 * Get the insert postion where the elements from component will be inserted on targetNode.
 *
 * Counting the dom elements, so that if an unknown element gets in the collection we won't blow up.
 * But this means we need to count everything for the off chance this condition happens.
 *
 * @param {Component} component - the component whose elements will be inserted
 * @param {HTMLElement} targetNode - the target node which the elements from component will be inserted into
 *
 * @private
 */
AuraRenderingService.prototype.getInsertPosition = function(component, targetNode) {
    var marker = this.getMarker(component);
    var elements = this.getAllElements(component);
    var length = elements.length;
    // current is the last element in DOM, or the marker.
    var current = marker;

    // the number of previous siblings of marker
    var totalPreSiblings = 0;
    // Count from the marker to the firstChild so we know what index we are at in the childNodes collection.
    while (current != null && current.previousSibling) {
        totalPreSiblings++;

        // Move to the previous element and try again.
        current = current.previousSibling;
    }

    if (!targetNode) {
        // Some existing components intendedly remove elements from DOM.
        // This could cause rendering issue if the element if a shared marker.
        current = elements[length-1];
    } else {
        // The elements order may be different between component elements collection and DOM,
        // so we need to find the real last child in the DOM.
        current = this.getLastSharedElementInCollection(elements, targetNode.childNodes);
    }

    // the actual number of elements in DOM
    var totalElements = 0;
    // Count all the elements in the DOM vs what we know.
    while (current != null) {
        // How many nodes between the last element this component owns
        // and the firstNode of the childNodes collection.
        totalElements++;

        // If we hit the marker, track the index of that component from the bottom.
        // The marker is part of the component, so count it as an element.
        if (current === marker) {
            break;
        }

        // Move to the previous element and try again.
        current = current.previousSibling;
    }

    // The position offset by the amount of untraced nodes.
    return totalPreSiblings + totalElements - length;
};

/**
 * Find the element which is the last element in the DOM from component elements collection.
 * @private
 */
AuraRenderingService.prototype.getLastSharedElementInCollection = function(cmpElements, domElements) {
    if (!cmpElements || !domElements) {
        return null;
    }

    var lastElement = null;
    var largestIndex = -1;
    for (var i = 0; i < cmpElements.length; i++) {
        var element = cmpElements[i];
        var index = Array.prototype.indexOf.call(domElements, element);
        if (index > largestIndex) {
            largestIndex = index;
            lastElement = element;
        }
    }

    return lastElement;
};

/**
 * Update elements through container chain.
 * When a dirty component gets rerendered, all containers of the component need to update their elements set accordingly.
 *
 * @param {Component} component - the component whose elements are used for updating containers
 * @param {Array} oldElements - the elements on the component before rerendering facet
 *
 * @private
 */
AuraRenderingService.prototype.updateElementsOnContainers = function(component, oldElements) {

    var container = component.getConcreteComponent().getContainer();
    if (!container) {
        return;
    }

    var updatedElements = this.getAllElements(component);

    // check if there's any elements update during rerender
    var foundUpdate = updatedElements.length !== oldElements.length;
    if (foundUpdate === false) {
        for (var i = 0; i < oldElements.length; i++) {
            if (oldElements[i] !== updatedElements[i]) {
                foundUpdate = true;
                break;
            }
        }
    }
    // no elements change
    if (foundUpdate === false) {
        return;
    }

    // concrete component global Ids
    var visited = {};
    // Currently, we set container id when setting attribute,
    // so it is possible to set a container component to child's component's attribute.
    // TODO: Figure out why do we need to set container id for setting attribute and remove this.
    visited[component.getGlobalId()] = true;

    // Marker on container chain should be always up to date
    var marker = this.getMarker(component);

    while (container) {
        var concrete = container.getConcreteComponent();
        var globalId = concrete.getGlobalId();

        // Stop updating elements for container chain if it is a HtmlComponent. This needs to match the render logic.
        if (concrete.getType() === "aura:html" || concrete.isRendered() === false || visited[globalId] === true) {
            break;
        }

        var containerElements = this.getAllElementsCopy(concrete);
        var index = containerElements.indexOf(marker);
        if (index < 0) {
            $A.log("Rendering Warning: Container is missing children's marker element. Container: " +
                    concrete.getType() + ", Marker: " + marker);
        } else {
            // Replace old elements with updated elements
            Array.prototype.splice.apply(containerElements, [index, oldElements.length].concat(updatedElements));

            concrete.disassociateElements();
            this.associateElements(concrete, containerElements);
        }

        visited[globalId] = true;
        container = concrete.getContainer();
    }
};

/**
 * @public
 * @param {Component} cmp the component for which we are unrendering the facet.
 * @param {Component} facet the facet to unrender.
 * @export
 */
AuraRenderingService.prototype.unrenderFacet = function(cmp,facet) {
    if (cmp._facetInfo) {
        var facetInfo = [];
        // If in the process of destroying
        if(cmp.destroyed === -1 && cmp.getType()!=="aura:expression") {
            var existing = cmp._facetInfo;
            for(var i=0;i<existing.length;i++) {
                if(existing[i].autoDestroy()) {
                    existing[i].destroy();
                } else {
                    facetInfo.push(existing[i]);
                }
            }
        } else {
            facetInfo = cmp._facetInfo;
        }
        this.unrender(facetInfo);
        cmp._facetInfo = null;
    }

    if (facet) {
        this.unrender(facet);
    }

    var elements = this.getAllElements(cmp);
    if (elements) {
        var element;
        var globalId = cmp.getGlobalId();
        for (var c = elements.length-1; c >= 0; c--) {
            element = elements[c];
            this.removeMarkerReference(element, globalId);
            this.removeElement(element, cmp);
        }
    }

    cmp.disassociateElements();
};

/**
 * Get a marker for a component.
 *
 * @public
 * @param {Component} cmp the component for which we want a marker.
 * @return the marker.
 * @export
 */
AuraRenderingService.prototype.getMarker = function(cmp){
    if(!cmp||cmp.destroyed===1) { return null; }

    return cmp.getConcreteComponent()._marker;
};

AuraRenderingService.prototype.setMarker = function(cmp, newMarker) {
    if (!cmp) {
        return;
    }

    var concrete = cmp.getConcreteComponent();
    var oldMarker = this.getMarker(concrete);

    // Shouldn't hit this. I can't hit it anymore.
    if (oldMarker === newMarker) {
        return;
    }

    // Html and Text Markers are special parts of the framework.
    // They always have a 1 to 1 mapping from component to element|textnode, and will never
    // use a comment marker. So no need to add overhead of tracking markers just for these component types.
    var globalId = concrete.getGlobalId();
    if (cmp.getType() !== "aura:html") {
        $A.renderingService.addMarkerReference(newMarker, globalId);
    }
    if (oldMarker) {
        $A.renderingService.removeMarkerReference(oldMarker, globalId);
    }

    // Clear it out!
    if (!newMarker) {
        concrete._marker = null;
    } else {
        concrete._marker = newMarker;
    }
};

/**
 * @protected
 * @param expression the expression to mark as dirty.
 * @param cmp the owning component.
 */
AuraRenderingService.prototype.addDirtyValue = function(expression, cmp) {
    this.needsCleaning = true;
    if (cmp && cmp.isValid() && cmp.isRendered()) {
        var id = cmp.getGlobalId();
        var list = this.dirtyComponents[id];
        if (!list) {
            list = this.dirtyComponents[id] = {};
            this.dirtyComponentIds.push(id);
        }
        while(expression.indexOf('.')>-1){
            list[expression]=true;
            expression=expression.substring(0,expression.lastIndexOf('.'));
        }
    }
};

/**
 * Check if a component has any dirty value in dirty component set.
 * It's used in an exported method, Component.isDirty().
 * TODO: this method should be private.
 *
 * @protected
 * @param {Component} cmp - The component to check.
 */
AuraRenderingService.prototype.hasDirtyValue = function(cmp){
   return this.dirtyComponents.hasOwnProperty(cmp.getGlobalId());
};

/**
 * Check if an expression on a component is dirty.
 * It's used in an exported method, Component.isDirty().
 * TODO: this method should be private.
 *
 * @protected
 */
AuraRenderingService.prototype.isDirtyValue = function(expression, cmp) {
    if (cmp && cmp.isValid()) {
        var id = cmp.getGlobalId();
        var list = this.dirtyComponents[id];
        if (list && list[expression]){
            return true;
        }
    }
    return false;
};

/**
 * Rerender all dirty components.
 *
 * Called from ClientService when we reach the top of stack.
 *
 * @protected
 * @export
 */
AuraRenderingService.prototype.rerenderDirty = function(stackName) {
    if (this.needsCleaning) {
        var maxiterations = 1000;

        // #if {"modes" : ["PTEST","STATS"]}
        var allRerendered = [];
        var startTime;
        var cmpsWithWhy = {
            "stackName" : stackName,
            "components" : {}
        };
        // #end

        //KRIS: HALO:
        // If any components were marked dirty during a component rerender than
        // this.needsCleaning will be true.
        // maxiterations to prevent run away rerenderings from crashing the browser.
        while(this.needsCleaning && maxiterations) {
            var dirty = [];
            this.needsCleaning = false;
            maxiterations--;

            while(this.dirtyComponentIds.length) {
                var id = this.dirtyComponentIds.shift();
                var cmp = $A.componentService.get(id);

                // uncomment this to see what's dirty and why. (please don't delete me again. it burns.)
                // $A.log(cmp.toString(), this.dirtyComponents[id]);

                if (cmp && cmp.isValid() && cmp.isRendered()) {
                    // We assert that we are not unrendering, as we should never be doing that, but we then check again, as in production we want to
                    // avoid the bug.
                    // JBUCH: HALO: TODO: INVESTIGATE THIS, IT SEEMS BROKEN
                    // For the moment, don't fail miserably here. This really is bad policy to allow things to occur on unrender that cause a re-render,
                    // but putting in the assert breaks code, so leave it out for the moment.

                    // aura.assert(!cmp.isUnrendering(), "Rerendering a component during unrender");
                    if (!cmp.isUnrendering()) {
                        dirty.push(cmp);

                        // KRIS: HALO:
                        // Since we never go through the renderFacet here, we don't seem
                        // to be calling afterRender
                        // But I could just be wrong, its complicated.
                        // Leaving this commented out for now till I can talk it over with JBUCH
                        //this.afterRenderStack.push(cmp);

                        // #if {"modes" : ["PTEST","STATS"]}
                        allRerendered.push(cmp);

                        cmpsWithWhy["components"][id] = {
                            "id" : id,
                            "descr" : cmp.getDef().getDescriptor().toString(),
                            "why" : this.dirtyComponents[id]
                        };
                        // #end
                    }
                } else {
                    this.cleanComponent(id);
                }
            }

            // #if {"modes" : ["STATS"]}
            startTime = startTime || Date.now();
            // #end

            if (dirty.length) {
                this.rerender(dirty);
            }
        }

        //KRIS: HALO:
        // Somehow we did over 1000 rerenderings. Not just 1000 components, but one
        // component caused a rerender that caused a rerender, and on and on for 1000 times.
        $A.assert(maxiterations, "Max Callstack Exceeded: Rerendering loop resulted in to many rerenderings.");

        // #if {"modes" : ["PTEST","STATS"]}
        if (allRerendered.length) {
            cmpsWithWhy["renderingTime"] = Date.now() - startTime;
            this.statsIndex["rerenderDirty"].push(cmpsWithWhy);
        }
        // #end
        $A.eventService.getNewEvent("markup://aura:doneRendering").fire();
    }
};

/**
 * This method is not used by framework anymore, but it's exposed via Component.markClean().
 * TODO: Clean up the references and remove the both methods.
 *
 * @deprecated
 * @protected
 */
AuraRenderingService.prototype.removeDirtyValue = function(value, cmp) {
    if (cmp && cmp.isValid()) {
        var id = cmp.getGlobalId();
        var dirtyAttributes = this.dirtyComponents[id];
        if (dirtyAttributes) {
            if (dirtyAttributes[value]) {
                delete dirtyAttributes[value];
            }

            if ($A.util.isEmpty(dirtyAttributes)) {
                delete this.dirtyComponents[id];
                for (var i = 0; i < this.dirtyComponentIds.length; i++) {
                    if (this.dirtyComponentIds[i] === id) {
                        return this.dirtyComponentIds.splice(i, 1);
                    }
                }
            }
        }
    }
};

//#if {"modes" : ["PTEST","STATS"]}
AuraRenderingService.prototype.statsIndex = {
    "afterRender": [],
    "render": [],
    "rerender": [],
    "rerenderDirty": [],
    "unrender": []
};
//#end

/**
 * Remove component's concrete global id from dirty components set
 * @private
 */
AuraRenderingService.prototype.cleanComponent = function(id) {
    delete this.dirtyComponents[id];
};

/**
 * This method ensures to get an array.
 * If input is a falsy, it returns an empty array.
 * If input is an array, it returns the original array.
 * Otherwise, it returns an array which contains the input value.
 * @private
 */
AuraRenderingService.prototype.getArray = function(things) {
    return $A.util.isArray(things) ? things : (things ? [things] : []);
};

/**
 * If a renderer returned a string, create html elements from that string.
 *
 * Returns an elements array, either the original one passed in or a new one
 * if "elements" passed in was a string, not an array.
 *
 * @private
 */
AuraRenderingService.prototype.evalStrings = function(elements) {
    if ($A.util.isString(elements)) {
        elements=$A.util.createElementsFromMarkup(elements);
    }
    return elements || [];
};

AuraRenderingService.prototype.finishRender = function(cmp, elements) {
    elements = this.evalStrings(elements);

    this.associateElements(cmp, elements);

    cmp.setRendered(true);

    this.cleanComponent(cmp.getGlobalId());

    return elements;
};

/**
 * Insert elements to the DOM, relative to a reference node,
 * by default as its last child.
 *
 * @private
 */
AuraRenderingService.prototype.insertElements = function(elements, refNode, asSibling, asFirst) {
    if (refNode) {
        if (asSibling) {
            if (asFirst) {
                $A.util.insertBefore(elements, refNode);
            } else {
                $A.util.insertAfter(elements, refNode);
            }
        } else {
            if (asFirst) {
                $A.util.insertFirst(elements, refNode);
            } else {
                $A.util.appendChild(elements, refNode); // Default
            }
        }
    }
};

/**
 * Calculates the flavor css class name for a component instance and element.
 * @private
 */
AuraRenderingService.prototype.getFlavorClass = function(cmp) {
    var flavor = null; // keep in mind here, flavor may get set to "" if it was given a value of {!remove}
    var staticFlavorable = cmp.isFlavorable(); // aura:flavorable="true" on html elements
    var dynamicFlavorable = cmp.getDef().isDynamicallyFlavorable(); // dynamicallyFlavorable="true" on cmp def
    var valueProvider = dynamicFlavorable ? cmp : cmp.getComponentValueProvider();

    if (valueProvider && (staticFlavorable || dynamicFlavorable)) {
        if (valueProvider.getConcreteComponent()) { // check if flavor of an extensible cmp was set on child cmp instance
            flavor = valueProvider.getConcreteComponent().getFlavor();
        }

        if ($A.util.isUndefinedOrNull(flavor)) {
            flavor = valueProvider.getFlavor();
        }

        if (!$A.util.isUndefinedOrNull(flavor) && $A.util.isExpression(flavor)) { // deal with expressions
            flavor = flavor.evaluate();
        }

        if (staticFlavorable && !$A.util.isUndefinedOrNull(flavor)) {
            return $A.util.buildFlavorClass(valueProvider, flavor);
        } else if (dynamicFlavorable) {
            var flavorClasses = [];
            var dynamicallyFlavorableDefs = cmp.getDef().getDynamicallyFlavorable();
            for (var i = 0, len = dynamicallyFlavorableDefs.length; i < len; i++) {
                var def = dynamicallyFlavorableDefs[i];
                var defFlavor = !$A.util.isUndefinedOrNull(flavor) ? flavor : def.getDefaultFlavor();
                if (!$A.util.isUndefinedOrNull(defFlavor)) {
                    flavorClasses.push($A.util.buildFlavorClass(def, defFlavor));
                }
            }

            return flavorClasses.join(" ");
        }
    }

    return null;
};

AuraRenderingService.prototype.addAuraClass = function(cmp, element){
    var concrete = cmp.getConcreteComponent();
    var className = concrete.getDef().getStyleClassName(); // the generic class name applied to all instances of this component
    var flavorClassName;

    if (className) {
        flavorClassName = this.getFlavorClass(concrete);
        if (flavorClassName) {
            className = className + flavorClassName;
        }

        $A.util.addClass(element, className);
        if (element["tagName"]) {
            element.setAttribute("data-aura-class",$A.util.buildClass(element.getAttribute("data-aura-class"),className));
        }
    } else if (concrete.isInstanceOf("aura:html")) { // only check html cmps (presuming this is faster) TODONM find a better way to short-circuit here
        // this is for nested flavorable elements (not at top level of cmp).
        flavorClassName = this.getFlavorClass(concrete, element);
        if (flavorClassName) {
            $A.util.addClass(element, flavorClassName);
            if (element["tagName"]) {
                element.setAttribute("data-aura-class",$A.util.buildClass(element.getAttribute("data-aura-class"),flavorClassName));
            }
        }
    }
};

/**
 * Associate all of the elements with the component, and return a list of
 * pure elements - with no association objects wrapped around them.
 *
 * @private
 */
AuraRenderingService.prototype.associateElements = function(cmp, elements) {
    elements = this.getArray(elements);

    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];

        if (!this.isCommentMarker(element)) {
            this.addAuraClass(cmp, element);
        }

        cmp.associateElement(element);
    }
};

/**
 * Create a new Comment marker optinally before the specified target and for the specified reason.
 * Often the reason is something relating to what was unrendered or rendered such as a globalId.
 *
 * @param {HTMLElement} target - the target element where the created marker is placed before
 * @param {string} reason - the text content of the marker, to help understand when or why this marker get created
 *
 * @private
 */
AuraRenderingService.prototype.createMarker = function(target, reason) {
    var node = document.createComment(reason);
    node.aura_marker = true;
    if (target) {
        $A.util.insertBefore(node, target);
    }
    return node;
};

/**
 * Basically was this node created by the createMarker() function above.
 * Since we use comment markers as placement in the dom for non-rendered components and expressions
 * We often branch logic on wether the element is a comment marker or not.
 * @private
 */
AuraRenderingService.prototype.isCommentMarker = function(node){
    return node&&node.aura_marker;
};

/**
 * If you use component.getElements() it will normalize the array, but also slice it to give you a copy.
 * When in trusted code that is aware of this situation, we can avoid the cost of slicing the array.
 *
 * @private
 */
AuraRenderingService.prototype.getElements = function(component) {
    // avoid a slice of the elements collection
    return component.getConcreteComponent().elements || [];
};

/**
 * Includes all the DOM elements the component output as part of its rendering cycle.
 * This method also returns the comment markers output as part of the component rendering cycle.
 * If you do not want the comment nodes returned to you (your known set of dom nodes), use cmp.getElements() or renderingService.getElements(component)
 */
AuraRenderingService.prototype.getAllElements = function(component) {
    return component.getConcreteComponent().allElements || [];
};

/**
 * Similar to getAllElements, but this method will copy the allElements collection and return it. This allows you to modify the collection for processing
 * during the renderingService without worring about mutating the component elements collection.
 */
AuraRenderingService.prototype.getAllElementsCopy = function(component) {
    return component.getConcreteComponent().allElements.slice(0) || [];
};

/**
 * Get a uniqueID to identify different HTML elements by.
 * This method tries to use the data-rendered-by attribute first if possible.
 * If not (such as comment nodes) then we'll just append our own data attribute.
 * We need this so we can maintain a map of references to a component without a reference to the component.
 *
 * @private
 */
AuraRenderingService.prototype.getUid = function(element) {
    if(element.nodeType === 1) {
        // Try to use the rendered-by attribute which should be on almost everything
        // The times it won't will probably be elements generated in the renderer by the component developer
        var id = $A.util.getDataAttribute(element, $A.componentService.renderedBy);
        if(id !== null) {
            return id;
        }

        // Try to use data attributes for our unique ID of our own creation to the element as the fallback.
        id = $A.util.getDataAttribute(element, this.DATA_UID_KEY);
        if(id!==null) {
            return id;
        }
    }
    return element[this.DATA_UID_KEY];
};

/**
 * Assign a new unique id to the specified element.
 * The unique ID is just an incrementing number on the service.
 *
 * @private
 */
AuraRenderingService.prototype.newUid = function(element) {
    var nextUid = this.uid++;
    var success = null;

    if(element.nodeType === 1) {
        success = $A.util.setDataAttribute(element, this.DATA_UID_KEY, nextUid);
    }

    // Couldn't set the data attribute, happens for some HTML elements.
    if(success === null) {
        element[this.DATA_UID_KEY] = nextUid;
    }

    return nextUid;
};

/**
 * Get the unique id for an element. If it does not have one, generate one and return that.
 * Uses a combination of getUid() and newUid().
 *
 * @private
 */
AuraRenderingService.prototype.resolveUid = function(element) {
    var uid = this.getUid(element);
    if(uid === null || uid === undefined) {
        return this.newUid(element);
    }
    return uid;
};

/**
 * The marker can be any dom node. This method tracks that that dom node is being
 * referenced by the component with the specified globalid
 *
 * @private
 */
AuraRenderingService.prototype.addMarkerReference = function(marker, globalId) {
    if (!marker || !globalId) {
        return;
    }
    var uid = this.resolveUid(marker);
    var existing = this.markerToReferencesMap[uid];
    if(!existing) {
        this.markerToReferencesMap[uid] = existing = new this.ReferenceCollection();
    }
    existing.add(globalId);
};

/**
 * The specified dom node (marker) is no longer being used by the component with the specified global id.
 *
 * @private
 */
AuraRenderingService.prototype.removeMarkerReference = function(marker, globalId) {
    if(!marker||!globalId) { return; }

    var resolvedMarker = this.resolveUid(marker);
    var references = this.markerToReferencesMap[resolvedMarker];

    if (!$A.util.isUndefinedOrNull(references)) {
        references.delete(globalId, function(refs) {
            this.removeMarkerFromReferenceMap(resolvedMarker, refs);
        }.bind(this));
    }
};

/**
 * Remove the reference marker from the markerToReferencesMap object.
 *
 * @private
 */
AuraRenderingService.prototype.removeMarkerFromReferenceMap = function(resolvedMarker, refs) {
    if(!resolvedMarker) { return; }

    if($A.util.isUndefinedOrNull(refs) || $A.util.isEmpty(refs)) {
        this.markerToReferencesMap[resolvedMarker] = null;
        delete this.markerToReferencesMap[resolvedMarker];
    }
};

/**
 * Get a collection of IDs who are using the specified element as a marker.
 * If the element is being removed, we'll want to move those references to another element or a comment marker.
 *
 * @private
 */
AuraRenderingService.prototype.getMarkerReferences = function(marker) {
    if(!marker) {
        return null;
    }
    return this.markerToReferencesMap[this.resolveUid(marker)];
};

/**
 * Carefully remove the marker from the container.
 * If we're trying to remove a shared comment marker, we do nothing since others are using it.
 * If the parent isn't unrendering or is being destroyed, we won't do anything either since the container will have its dom node removed and that will remove all its children from the dom.
 *
 * @private
 */
AuraRenderingService.prototype.removeElement = function(marker, container) {
    //var container = component.getConcreteComponent().getContainer();
    //if(!container || !container.getConcreteComponent().isUnrendering()) {
    var concrete = container && container.getConcreteComponent();
    if (!concrete || !concrete.isUnrendering()) {
        if (this.isSharedMarker(marker)) {
            // No point in moving everything to another comment marker.
            if (this.isCommentMarker(marker)) { return; }

            // Move all the past references to a comment!
            this.moveReferencesToMarker(marker);
        } else if (concrete && concrete.destroyed === -1 && !this.isCommentMarker(marker)) {
            // this element is going away anyway since the container is being destroyed.
            return;
        }

        $A.util.removeElement(marker);
    }
};

/**
 * This function is used in rerenderFacet() when unrendering component on facet.
 * It is for tracking the change of the shared marker on component's container chain due to unrendering component
 * on facet.
 *
 * @private
 */
AuraRenderingService.prototype.moveContainerReferencesToMarker = function(component, oldMarker, newMarker) {

    var container = component.getConcreteComponent().getContainer();
    while (container) {
        var concrete = container.getConcreteComponent();
        if (concrete.getType() === "aura:html" || concrete.isRendered() === false) {
            break;
        }

        // if the container shares marker with component
        if (this.getMarker(concrete) === oldMarker) {
            this.setMarker(concrete, newMarker);
        }

        this.replaceMarkerElement(concrete, oldMarker, newMarker);

        container = concrete.getContainer();
    }

};

/**
 * All the components who are using the specified dom node as a marker need to now be moved to a comment marker.
 * This method doesn't check if you're moving from one comment node to another. That would be a waste of time, so
 * be aware you should verify that first.
 *
 * @private
 */
AuraRenderingService.prototype.moveReferencesToMarker = function(marker, newMarker) {
    var references = this.getMarkerReferences(marker);
    var isSwap = !!newMarker;
    newMarker = newMarker || this.createMarker(null, "unrender marker: " + marker.nodeValue);

    if (references) {
        var collection = references.get();
        for(var c = collection.length - 1; c >= 0; c--) {
            var cmp = $A.getComponent(collection[c]);
            if (!cmp || cmp.destroyed) {
                continue;
            }

            this.setMarker(cmp, newMarker);
            this.replaceMarkerElement(cmp, marker, newMarker);
        }
    }

    // If this is a swap by interop, interop would take care of DOM node replacement so no need for insertBefore
    // If the marker is actually being used by others, then go ahead and put it in the dom.
    if(!isSwap && this.isSharedMarker(newMarker)) {
        $A.util.insertBefore(newMarker, marker);
    }
};

AuraRenderingService.prototype.replaceMarkerElement = function(component, oldMarker, newMarker) {
    var concrete = component.getConcreteComponent();
    var allElements = concrete.allElements;

    if (!allElements) {
        concrete.allElements = [newMarker];
        concrete.elements = [];
        if (!this.isCommentMarker(newMarker)) {
            concrete.elements.push(newMarker);
        }
        return;
    }

    if (allElements.indexOf(newMarker) > -1) {
        return;
    }

    var position = allElements.indexOf(oldMarker);
    if (position === -1) {
        // This seems like a problem, lets try to see if it happens
        $A.warning("AuraRenderingService.replaceMarkerElement(): Missing marker on component " + component);
        // insert the new marker to behind if something is wrong
        position = allElements.length;
    }
    allElements[position] = newMarker;

    var filteredElements = [];
    for (var i = 0; i < allElements.length; i++) {
        if (!this.isCommentMarker(allElements[i])) {
            filteredElements.push(allElements[i]);
        }
    }
    concrete.elements = filteredElements;
};

/**
 * Are multiple components using this as a marker?
 * Shared markers need to have their other references moved before being able to remove the marker node from the dom.
 *
 * TODO: this method is confusing.
 * We probably should add another param of globalId to check if there's shared marker with the global Id.
 * @private
 */
AuraRenderingService.prototype.isSharedMarker = function(marker) {
    var references = this.getMarkerReferences(marker);

    return references? references.size() > 0 : false;
};

/**
 * The ReferenceCollection is a data structure for tracking references from components to dom nodes.
 * Since it is a many (components() to one element mapping, this is necessary to track whos using what.
 * The collection will optimize to not create an array at first. Only after you've added more than one reference
 * will the array be created.
 *
 * Lastly, this collecton acts just like a Set(). You cannot add the same value twice, which helps with our reference counting logic.
 *
 * @private
 */
AuraRenderingService.prototype.ReferenceCollection = function() {
    // this.references = "" || [];
};

AuraRenderingService.prototype.ReferenceCollection.prototype.isCollection = false;

AuraRenderingService.prototype.ReferenceCollection.prototype.add = function(value){
    // Only track references
    if(typeof value !== "string") { return; }

    if(this.has(value)) {
        // Either we act like a set, or we make sure it doesn't dupe in consumption.
        // Latter is better for perf, maybe throw and track if its an issue?
        return;
    }

    if(!this.references) {
        this.references = value;
    } else if(!this.isCollection) {
        if(this.references !== value) {
            this.references = [this.references, value];
            this.isCollection = true;
        }
    } else {
        this.references.push(value);
    }
};

AuraRenderingService.prototype.ReferenceCollection.prototype.delete = function(value, callback){
    if(typeof value !== "string") {
        return;
    }
    if(this.isCollection) {
        var index = this.references.indexOf(value);
        if(index > -1) {
            this.references.splice(index, 1);
        }
    }
    if(this.references === value) {
        this.references = null;
    }
    callback(this.references);
};

AuraRenderingService.prototype.ReferenceCollection.prototype.has = function(value){
    if(!this.isCollection) {
        return this.references === value;
    }
    if(this.references) {
        return this.references.indexOf(value) !== -1;
    }
    return false;
};

AuraRenderingService.prototype.ReferenceCollection.prototype.size = function(){
    if(this.references) {
        if(typeof this.references === "string") {
            return 1;
        } else {
            return this.references.length;
        }
    }
    return 0;
};

AuraRenderingService.prototype.ReferenceCollection.prototype.get = function(index) {
    if(index === undefined) {
        if(this.isCollection) {
            return this.references;
        } else {
            return [this.references];
        }
    }
    return this.references[index];
};

Aura.Services.AuraRenderingService = AuraRenderingService;
