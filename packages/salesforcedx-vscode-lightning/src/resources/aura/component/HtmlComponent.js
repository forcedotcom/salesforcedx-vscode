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
 * Construct a new HtmlComponent.
 *
 * @public
 * @class
 * @constructor
 *
 * @param {Object}
 *            config - component configuration
 * @param {Boolean}
 *            [localCreation] - local creation
 * @export
 */
function HtmlComponent(config, localCreation) {
    var context = $A.getContext();

    // setup some basic things
    this.concreteComponentId = config["concreteComponentId"];
    this.containerComponentId = config["containerComponentId"];
    this.shouldAutoDestroy=true;
    this.rendered = false;
    this.inUnrender = false;
    this.localId = config["localId"];
    this.valueProviders = {};
    //this.eventValueProvider = undefined;
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

    // index this component with its value provider (if it has a localid)
    this.doIndex(this);

    // setup flavors
    this.setupFlavors(config, configAttributes);

    // clean up refs to partial config
    this.partialConfig = undefined;

    if (forcedPath && act && this.creationPath) {
        act.releaseCreationPath(this.creationPath);
    }

    var tag = this.attributeSet.getValue("tag");
    if (!$A.util.isUndefinedOrNull(tag)) {
        this.componentDef.getHelper().validateTagName(tag);
    }
    if (tag === "script" && $A.root) {
        throw new Error(HtmlComponent.SCRIPT_ERROR_MESSAGE);
    }
}

HtmlComponent.SCRIPT_ERROR_MESSAGE = "The HTML tag 'script' is not allowed outside of an application or template markup.";

HtmlComponent.prototype = Object.create(Component.prototype);

// Not returning anything in these since empty functions will not be called by the JS engine as an

/** The SuperRender calls are blank since we will never have a super, no need to ever do any logic to for them. */
HtmlComponent.prototype.superRender = function(){};
HtmlComponent.prototype.superAfterRender = function(){};
HtmlComponent.prototype.superRerender = function(){};
HtmlComponent.prototype.superUnrender = function(){};

/** No Super, so just return undefined */
HtmlComponent.prototype.getSuper = function(){};

/** Will always be Superest, so no need to check for a super */
HtmlComponent.prototype.getSuperest = function(){ return this; };

/** 
 * Component.js has logic that is specific to HtmlComponent. Great! So we can move that into here and out of Component.js
 * That logic is the LockerService part to assign trust to the owner.
 */
HtmlComponent.prototype.setupComponentDef = function() {
    // HtmlComponent optimization, go straight to an internal API for the component def
    this.componentDef = $A.componentService.getComponentDef({"descriptor":"markup://aura:html"});

    // propagating locker key when possible
    $A.lockerService.trust(this.componentDef, this);

    // aura:html is syntactic sugar for document.createElement() and the resulting elements need to be directly visible to the container
    // otherwise no code would be able to manipulate them
    var owner = this.getOwner();
    var ownerName = owner.getType();
    while (ownerName === "aura:iteration" || ownerName === "aura:if") {
        owner = owner.getOwner();
        ownerName = owner.getType();
    }
    $A.lockerService.trust(owner, this);
};

/**
 * Not all the value providers are necessary for HTML. We don't need the component events (e.) or controller (c.)
 */
HtmlComponent.prototype.setupValueProviders = function(customValueProviders) {
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
 * Simple type checking. All simple components implement aura:rootComponent and cannot be extended, 
 * so the simple condition here is sufficient unless any of the individual components change.
 */
HtmlComponent.prototype.isInstanceOf = function(type) {
    return type === "aura:html" || type === "aura:rootComponent";
};

/**
 * Copied from htmlRenderer.js
 * Now has access to internal APIs and advanced mode compilation.
 */
HtmlComponent.prototype["renderer"] = {
    "render" : function(component, helper) {
        var tag = component.attributeSet.getValue("tag");
        if ($A.util.isUndefinedOrNull(tag)) {
            throw new Error("Undefined tag attribute for " + component.getGlobalId());
        }
        helper.validateTagName(tag);
        if (tag === "script" && $A.root) {
            throw new Error(HtmlComponent.SCRIPT_ERROR_MESSAGE);
        }

        var HTMLAttributes = component.attributeSet.getValue("HTMLAttributes");

        var element = document.createElement(tag);

        if ($A.util.isIE && HTMLAttributes && HTMLAttributes["type"]) {
            // IE needs to have the 'type' set first for radio / checkbox inputs
            // otherwise any values set on them are wiped after the type is set
            helper.createHtmlAttribute(component, element, "type", HTMLAttributes["type"]);
        }

        for ( var attribute in HTMLAttributes) {
            if (!$A.util.isIE || attribute !== "type") {
                helper.createHtmlAttribute(component, element, attribute, HTMLAttributes[attribute]);
            }

        }
        
        $A.util.setDataAttribute(element, $A.componentService.renderedBy, component.globalId);

        helper.processJavascriptHref(element);

        if (helper.canHaveBody(component)) {
            var body=component.attributeSet.getBody(component.globalId);
            $A.renderingService.renderFacet(component,body,element);
        }

        // aura:html is syntactic sugar for document.createElement() and the resulting elements need to be directly visible to the container
        // otherwise no code would be able to manipulate them
        var owner = component.getOwner();
        var ownerName = owner.getType();
        // TODO: Manually checking for aura:iteration or aura:if is a hack. Ideally, getOwner() or another API would
        //       always return the element we need to key against.
        while (ownerName === "aura:iteration" || ownerName === "aura:if") {
            owner = owner.getOwner();
            ownerName = owner.getType();
        }
        $A.lockerService.trust(owner, element);

        return element;
    },

    "rerender" : function(component, helper) {
        var element = component.getElement();

        if (!element) {
            return;
        }

        var skipMap = {
            "height" : true,
            "width" : true,
            "class" : true
        };

        var HTMLAttributes = component.attributeSet.getValue("HTMLAttributes");
        if (HTMLAttributes) {
            for (var name in HTMLAttributes) {
                var lowerName = name.toLowerCase();
                if (skipMap[lowerName] || lowerName.indexOf("on") === 0) {
                    continue;
                }

                var value = HTMLAttributes[name];
                if ($A.util.isExpression(value)) {
                    value = value.evaluate();
                }

                if (helper.SPECIAL_BOOLEANS.hasOwnProperty(lowerName)) {
                    value = $A.util.getBooleanValue(value);
                }

                var oldValue = element[helper.caseAttribute(lowerName)];
                if (value !== oldValue) {
                    helper.createHtmlAttribute(component, element, lowerName, value);
                    if($A.util.isExpression(oldValue)){
                        oldValue.removeChangeHandler(component,"HTMLAttributes."+name);
                    }
                }
            }

            var className = HTMLAttributes["class"];
            if ($A.util.isExpression(className)) {
                 className = className.evaluate();
             }

            if($A.util.isUndefinedOrNull(className)){
                className='';
            }

            if (!$A.util.isUndefinedOrNull(element.getAttribute("data-aura-class"))) {
                className += (" " + element.getAttribute("data-aura-class"));
            }

            if (element["className"] !== className) {
                element["className"] = className;
            }
        }

        helper.processJavascriptHref(element);

        if (helper.canHaveBody(component)) {
            $A.renderingService.rerenderFacet(component,component.attributeSet.getBody(component.globalId),element);
        }
    },

    "afterRender" : function(component, helper) {
        if (helper.canHaveBody(component)) {
            $A.afterRender(component.attributeSet.getBody(component.globalId));
        }
    },

    "unrender" : function(component, helper) {
        var HTMLAttributes = component.attributeSet.getValue("HTMLAttributes");
        for ( var attribute in HTMLAttributes) {
            helper.destroyHtmlAttribute(component, attribute, HTMLAttributes[attribute]);
        }
        // Even if we don't have body we need to deattach the elements from the component itself
        $A.renderingService.unrenderFacet(component, component.attributeSet.getBody(component.globalId));
    }
};


/** Copied unchanged from htmlHelper.js */
HtmlComponent.prototype["helper"] = {
    SPECIAL_BOOLEANS: {
        "checked": true,
        "selected": true,
        "disabled": true,
        "readonly": true,
        "multiple": true,
        "ismap": true,
        "defer": true,
        "declare": true,
        "noresize": true,
        "nowrap": true,
        "noshade": true,
        "compact": true,
        "autocomplete": true,
        "required": true
    },

    SPECIAL_CASINGS: {
        "readonly": "readOnly",
        "colspan": "colSpan",
        "rowspan": "rowSpan",
        "bgcolor": "bgColor",
        "tabindex": "tabIndex",
        "usemap": "useMap",
        "accesskey": "accessKey",
        "maxlength": "maxLength",
        "for": "htmlFor",
        "class": "className",
        "frameborder": "frameBorder"
    },

    // "void elements" as per http://dev.w3.org/html5/markup/syntax.html#syntax-elements
    BODYLESS_TAGS: {
        "area": true,
        "base": true,
        "br": true,
        "col": true,
        "command": true,
        "embed": true,
        "hr": true,
        "img": true,
        "input": true,
        "keygen": true,
        "link": true,
        "meta": true,
        "param": true,
        "source": true,
        "track": true,
        "wbr": true
    },

    // List must be kept in sync with org.auraframework.def.HtmlTag enum
    ALLOWED_TAGS:{
        "a":true,
        "abbr":true,
        "acronym":true,
        "address":true,
        "area":true,
        "article":true,
        "aside":true,
        "audio":true,
        "b":true,
        "bdi":true,
        "bdo":true,
        "big":true,
        "blockquote":true,
        "body":true,
        "br":true,
        "button":true,
        "caption":true,
        "canvas":true,
        "center":true,
        "cite":true,
        "code":true,
        "col":true,
        "colgroup":true,
        "command":true,
        "datalist":true,
        "dd":true,
        "del":true,
        "details":true,
        "dfn":true,
        "dir":true,
        "div":true,
        "dl":true,
        "dt":true,
        "em":true,
        "fieldset":true,
        "figure":true,
        "figcaption":true,
        "footer":true,
        "form":true,
        "h1":true,
        "h2":true,
        "h3":true,
        "h4":true,
        "h5":true,
        "h6":true,
        "head":true,
        "header":true,
        "hgroup":true,
        "hr":true,
        "html":true,
        "i":true,
        "iframe":true,
        "img":true,
        "input":true,
        "ins":true,
        "keygen":true,
        "kbd":true,
        "label":true,
        "legend":true,
        "li":true,
        "link":true,
        "map":true,
        "mark":true,
        "menu":true,
        "meta":true,
        "meter":true,
        "nav":true,
        "ol":true,
        "optgroup":true,
        "option":true,
        "output":true,
        "p":true,
        "pre":true,
        "progress":true,
        "q":true,
        "rp":true,
        "rt":true,
        "ruby":true,
        "s":true,
        "samp":true,
        "script":true,
        "section":true,
        "select":true,
        "small":true,
        "source":true,
        "span":true,
        "strike":true,
        "strong":true,
        "style":true,
        "sub":true,
        "summary":true,
        "sup":true,
        "table":true,
        "tbody":true,
        "td":true,
        "textarea":true,
        "tfoot":true,
        "th":true,
        "thead":true,
        "time":true,
        "title":true,
        "tr":true,
        "track":true,
        "tt":true,
        "u":true,
        "ul":true,
        "var":true,
        "video":true,
        "wbr":true
    },

    // string constants used to save and remove click handlers
    NAMES: {
        "domHandler": "fcDomHandler",
        "hashHandler": "fcHashHandler"
    },

    validateTagName: function(tagName) {
        if (!this.ALLOWED_TAGS.hasOwnProperty(tagName) && !this.ALLOWED_TAGS.hasOwnProperty(tagName.toLowerCase())){
            throw new Error("The HTML tag '" + tagName + "' is not allowed.");
        }
    },
    
    caseAttribute: function (attribute) {
        return this.SPECIAL_CASINGS[attribute] || attribute;
    },

    /**
     * Adds or replaces existing "onclick" handler for the given handlerName.
     *
     * Is used to add independent handlers eg. dom level and hash navigation handling on <a href/>
     */
    addNamedClickHandler: function (element, handler, handlerName) {
        var previousHandler = element[handlerName];
        if ($A.util.isFunction(previousHandler)) {
            $A.util.removeOn(element, "click", previousHandler);
        }

        $A.util.on(element, "click", handler);

        element[handlerName] = handler;
        return previousHandler;
    },

    domEventHandler: function (event) {
        var eventName = "on" + event.type,
            element = event.currentTarget,
            ownerComponent = $A.componentService.getRenderingComponentForElement(element);

        // cmp might be destroyed, just ignore this event.
        if (!ownerComponent) {
            return;
        }

        var htmlAttributes = ownerComponent.get("v.HTMLAttributes"),
            valueExpression = htmlAttributes[eventName],
            onclickExpression;

        if (eventName === 'ontouchend' || eventName === 'onpointerup' || eventName === 'onMSPointerUp') {
            // Validate that either onclick or ontouchend is wired up to an action never both simultaneously
            onclickExpression = htmlAttributes["onclick"];
            if (!$A.util.isEmpty(onclickExpression)) {
                if ($A.util.isEmpty(valueExpression)) {
                    // Map from touch event to onclick
                    valueExpression = onclickExpression;
                }
            }
        }

        if ($A.util.isExpression(valueExpression)) {
            var action = valueExpression.evaluate();
            // This can resolve to null if you have an expression pointing to an attribute which could be an Action
            if(action) {
                this.dispatchAction(action, event, ownerComponent);
            }
        }
    },

    // NOTE: Do not remove attributes from this method
    // Used by MetricsService plugin to collect information
    dispatchAction: function (action, event) {
        $A.run(function() {
            action.runDeprecated(event);
        });
    },

    canHaveBody: function (component) {
        var tag = component.attributeSet.getValue("tag");
        if ($A.util.isUndefinedOrNull(tag)) {
            throw new Error("Undefined tag attribute for " + component.getGlobalId());
        }
        return !this.BODYLESS_TAGS[tag.toLowerCase()];
    },

    createHtmlAttribute: function (component, element, name, attribute) {
        var value;
        var lowerName = name.toLowerCase();

        // special handling if the attribute is an inline event handler
        if (lowerName.indexOf("on") === 0) {
            var eventName = lowerName.substring(2);
            if (eventName === "click") {
                this.addNamedClickHandler(element, $A.getCallback(this.domEventHandler.bind(this)), this.NAMES.domHandler);
            } else {
                $A.util.on(element, eventName, $A.getCallback(this.domEventHandler.bind(this)));
            }
        } else {
            var isSpecialBoolean = this.SPECIAL_BOOLEANS.hasOwnProperty(lowerName);
            if ($A.util.isExpression(attribute)) {
                attribute.addChangeHandler(component, "HTMLAttributes." + name);
                value = attribute.evaluate();
            } else {
                value = attribute;
            }

            if (isSpecialBoolean) {
                value = $A.util.getBooleanValue(value);
            }

            var isString = $A.util.isString(value);
            if (isString && value.indexOf("/auraFW") === 0) {
                // prepend any Aura resource urls with servlet context path
                value = $A.getContext().getContextPath() + value;
            }

            if (lowerName === "href" && element.tagName === "A" && value && $A.util.supportsTouchEvents()) {
                var HTMLAttributes = component.attributeSet.getValue("HTMLAttributes");
                var target = HTMLAttributes["target"];

                if ($A.util.isExpression(target)) {
                    target = target.evaluate();
                }

                this.addNamedClickHandler(element, function () {
                    if (isString && value.indexOf("#") === 0) {
                        $A.run(function () {
                            $A.historyService.set(value.substring(1));
                        });
                    }
                }, this.NAMES.hashHandler);
                if(target){
                    element.setAttribute("target", target);
                }
                element.setAttribute("href", value);
            } else if (!$A.util.isUndefinedOrNull(value) && (lowerName === "role" || lowerName.lastIndexOf("aria-", 0) === 0)) {
                // use setAttribute to render accessibility attributes to markup
                // do not set the property on the HTMLElement if value is null or undefined to avoid accessibility confusion.
                element.setAttribute(name, value);
            } else if (isSpecialBoolean) {
                // handle the boolean attributes for whom presence implies truth
                var casedName = this.caseAttribute(lowerName);
                if (value === false) {
                    element.removeAttribute(casedName);

                    // Support for IE's weird handling of checked (unchecking case):
                    if (casedName === "checked") {
                        element.removeAttribute("defaultChecked");
                    }
                } else {
                    element.setAttribute(casedName, name);

                    // Support for IE's weird handling of checked (checking case):
                    if (casedName === "checked") {
                        element.setAttribute("defaultChecked", true);
                    }
                }

                // We still need to make sure that the property is set on the HTMLElement, because it is used for
                // change detection:
                if($A.util.isUndefinedOrNull(value)){
                    value='';
                }
                element[casedName] = value;
            } else {

                // KRIS: HALO:
                // If in older IE's you set the type attribute to a value that the browser doesn't support
                // you'll get an exception.
                // Also, you can't change the type after the element has been added to the DOM.
                // Honestly, I can't see how this wasn't blowing up Pre-halo
                if ($A.util.isIE && element.tagName === "INPUT" && lowerName === "type") {
                    try {
                        element.setAttribute("type", value);
                    } catch (e) {
                        return undefined;
                    }
                }
                // as long as we have a valid value at this point, set
                // it as an attribute on the DOM node
                // IE renders null value as string "null" for input (text)
                // element, we have to work around that.
                else if (!$A.util.isUndefined(value) && !($A.util.isIE && element.tagName === "INPUT" && lowerName === "value" && value === null)) {
                    var casedAttribute = this.caseAttribute(lowerName);
                    lowerName = name.toLowerCase();
                    if (lowerName === "style" && $A.util.isIE) {
                        element.style.cssText = value;
                    } else if (lowerName === "type" || lowerName === "href" || lowerName === "style" || lowerName.indexOf("data-") === 0) {
                        // special case we have to use "setAttribute"
                        element.setAttribute(casedAttribute, value);
                    } else if (lowerName === "srcdoc" && element.tagName === "IFRAME" && !$A.util.isUndefinedOrNull(value)) {
                        var message;
                        // Check if srcdoc is allowed.  This may change as new defs are sent down.
                        if (!$A.get("$Global")["srcdoc"]) {
                            message = "The '" + name + "' attribute is not supported, and will not be set for " + element + " in " + component;
                            $A.warning(message);
                        } else {
                            message = "The '" + name + "' attribute has been set for " + element + " in " + component;
                            element[casedAttribute] = value;
                        }
                        // Track any usages for eventual deprecation
                        $A.logger.reportError(new $A.auraError(message), null, "WARNING");
                    }
                    // prevent 'import' anywhere inside 'rel' attribute since some browsers still import referenced content even if the value isn't exact match.
                    else if (element.tagName === "LINK" && lowerName === "rel" && value && value.toLowerCase && $A.util.isString(value) && value.toLowerCase().indexOf("import") !== -1) {
                        $A.warning("The '" + name + "' attribute is not supported, and will not be set for " + element + " in " + component);
                    } else {
                        if ($A.util.isUndefinedOrNull(value)) {
                            value = '';
                        }
                        element[casedAttribute] = value;
                    }
                }
                // W-2872594, IE11 input text set('v.value', null) would not clear up the field.
                else if ($A.util.isIE && element.tagName === "INPUT" && lowerName === "value" && value === null) {
                    element.value = '';
                }
            }
        }
    },

    destroyHtmlAttribute: function (component, name, attribute) {
        if ($A.util.isExpression(attribute)) {
            attribute.removeChangeHandler(component, "HTMLAttributes." + name);
        }
    },

    processJavascriptHref: function (element) {
        if (element.tagName === "A") {
            var href = element.getAttribute("href");

            if (!href) {
                /*eslint-disable no-script-url*/
                element.setAttribute("href", "javascript:void(0);");
            }

            element.addEventListener("click", this.inlineJavasciptCSPViolationPreventer);
      }
    },

    inlineJavasciptCSPViolationPreventer: function(event) {
        // Check for javascript: inline javascript

        /*eslint-disable no-script-url*/
        var hrefTarget = this.href;
        if (hrefTarget && /^\s*javascript:\s*void\((\s*|0|null|'.*')\)/.test(hrefTarget.toLowerCase())) {
            event.preventDefault();
        }
    }
};

Aura.Component.HtmlComponent = HtmlComponent;
