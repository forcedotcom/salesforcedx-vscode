/*
 * Copyright (C) 2016 salesforce.com, inc.
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

"use strict";

var util = require('../lib/util.js');
var objectAssign = require('object-assign');

// This structure follows the same schema of the whitelisting mechanism from SES
// for ecma intrinsics, more details on ../lib/3rdparty/ses/whiteslit.js
var SecureDocumentAPI = {
    document: {
        toString: true,

        // HTMLDocument
        location: '*',
        fgColor: '*',
        linkColor: '*',
        vlinkColor: '*',
        alinkColor: '*',
        bgColor: '*',
        clear: true,
        captureEvents: true,
        releaseEvents: true,

        // Document
        URL:                              '*',
        activeElement:                    '*',
        adoptNode:                        true,
        anchors:                          '*',
        applets:                          '*',
        body:                             '*',
        caretRangeFromPoint:              true,
        characterSet:                     '*',
        charset:                          '*',
        childElementCount:                '*',
        children:                         '*',
        close:                            true,
        compatMode:                       '*',
        contentType:                      '*',
        cookie:                           '*',
        createAttribute:                  true,
        createAttributeNS:                true,
        createCDATASection:               true,
        createComment:                    true,
        createDocumentFragment:           true,
        createElement:                    true,
        createElementNS:                  true,
        createEvent:                      true,
        createExpression:                 true,
        createNSResolver:                 true,
        createNodeIterator:               true,
        createProcessingInstruction:      true,
        createRange:                      true,
        createTextNode:                   true,
        createTreeWalker:                 true,
        defaultView:                      '*',
        designMode:                       '*',
        dir:                              '*',
        doctype:                          '*',
        documentElement:                  '*',
        documentURI:                      '*',
        domain:                           '*',
        elementFromPoint:                 true,
        elementsFromPoint:                true,
        embeds:                           '*',
        evaluate:                         true,
        execCommand:                      true,
        exitPointerLock:                  true,
        firstElementChild:                '*',
        fonts:                            '*',
        forms:                            '*',
        getElementById:                   true,
        getElementsByClassName:           true,
        getElementsByName:                true,
        getElementsByTagName:             true,
        getElementsByTagNameNS:           true,
        getSelection:                     true,
        hasFocus:                         true,
        head:                             '*',
        hidden:                           '*',
        images:                           '*',
        implementation:                   '*',
        importNode:                       true,
        inputEncoding:                    '*',
        lastElementChild:                 '*',
        lastModified:                     '*',
        links:                            '*',
        onabort:                          true,
        onautocomplete:                   true,
        onautocompleteerror:              true,
        onbeforecopy:                     true,
        onbeforecut:                      true,
        onbeforepaste:                    true,
        onblur:                           true,
        oncancel:                         true,
        oncanplay:                        true,
        oncanplaythrough:                 true,
        onchange:                         true,
        onclick:                          true,
        onclose:                          true,
        oncontextmenu:                    true,
        oncopy:                           true,
        oncuechange:                      true,
        oncut:                            true,
        ondblclick:                       true,
        ondrag:                           true,
        ondragend:                        true,
        ondragenter:                      true,
        ondragleave:                      true,
        ondragover:                       true,
        ondragstart:                      true,
        ondrop:                           true,
        ondurationchange:                 true,
        onemptied:                        true,
        onended:                          true,
        onerror:                          true,
        onfocus:                          true,
        oninput:                          true,
        oninvalid:                        true,
        onkeydown:                        true,
        onkeypress:                       true,
        onkeyup:                          true,
        onload:                           true,
        onloadeddata:                     true,
        onloadedmetadata:                 true,
        onloadstart:                      true,
        onmousedown:                      true,
        onmouseenter:                     true,
        onmouseleave:                     true,
        onmousemove:                      true,
        onmouseout:                       true,
        onmouseover:                      true,
        onmouseup:                        true,
        onmousewheel:                     true,
        onpaste:                          true,
        onpause:                          true,
        onplay:                           true,
        onplaying:                        true,
        onpointerlockchange:              true,
        onpointerlockerror:               true,
        onprogress:                       true,
        onratechange:                     true,
        onreadystatechange:               true,
        onreset:                          true,
        onresize:                         true,
        onscroll:                         true,
        onsearch:                         true,
        onseeked:                         true,
        onseeking:                        true,
        onselect:                         true,
        onselectionchange:                true,
        onselectstart:                    true,
        onshow:                           true,
        onstalled:                        true,
        onsubmit:                         true,
        onsuspend:                        true,
        ontimeupdate:                     true,
        ontoggle:                         true,
        ontouchcancel:                    true,
        ontouchend:                       true,
        ontouchmove:                      true,
        ontouchstart:                     true,
        onvolumechange:                   true,
        onwaiting:                        true,
        onwebkitfullscreenchange:         true,
        onwebkitfullscreenerror:          true,
        onwheel:                          true,
        open:                             true,
        origin:                           '*',
        plugins:                          '*',
        pointerLockElement:               '*',
        preferredStylesheetSet:           '*',
        queryCommandEnabled:              true,
        queryCommandIndeterm:             true,
        queryCommandState:                true,
        queryCommandSupported:            true,
        queryCommandValue:                true,
        querySelector:                    true,
        querySelectorAll:                 true,
        readyState:                       '*',
        referrer:                         '*',
        registerElement:                  true,
        rootElement:                      '*',
        scripts:                          '*',
        scrollingElement:                 '*',
        selectedStylesheetSet:            '*',
        styleSheets:                      '*',
        title:                            '*',
        visibilityState:                  '*',
        webkitCancelFullScreen:           true,
        webkitCurrentFullScreenElement:   '*',
        webkitExitFullscreen:             true,
        webkitFullscreenElement:          '*',
        webkitFullscreenEnabled:          '*',
        webkitHidden:                     '*',
        webkitIsFullScreen:               '*',
        webkitVisibilityState:            '*',
        write:                            true,
        writeln:                          true,
        xmlEncoding:                      '*',
        xmlStandalone:                    '*',
        xmlVersion:                       '*'
    }
};

objectAssign(SecureDocumentAPI.document, require('../lib/dom/element.js'));
objectAssign(SecureDocumentAPI.document, require('../lib/dom/global-event-handlers.js'));
objectAssign(SecureDocumentAPI.document, require('../lib/dom/event-target-methods.js'));
objectAssign(SecureDocumentAPI.document, require('../lib/dom/node.js'));

module.exports = function(context) {
    var globalScope;

    return {

        "Program" : function() {
            globalScope = context.getScope();
        },

        MemberExpression: function(node) {
            if (node.parent.type === "MemberExpression") {
                // ignoring intermediate member expressions
                return;
            }
            var currentScope = context.getScope();
            var ns = util.buildMemberExpressionNamespace(currentScope, globalScope, node);
            if (ns.length > 0) {
                var rootIdentifier = ns[0];
                if (rootIdentifier.type !== "Identifier" || rootIdentifier.name !== "document" || util.isShadowed(currentScope, globalScope, rootIdentifier)) {
                    return;
                }
                var api = SecureDocumentAPI;
                for (var i = 0; i < ns.length; i++) {
                    var identifier = ns[i];
                    if (identifier.type !== 'Identifier') {
                        context.report(node, "Invalid SecureDocument API, use dot notation instead");
                        return;
                    }
                    var token = identifier.name;
                    var nextIdentifier = ns[i + 1];
                    if (typeof api !== "object") {
                        context.report(node, "Invalid SecureDocument API");
                        return;
                    }
                    if (!api.hasOwnProperty(token)) {
                        context.report(node, "Invalid SecureDocument API");
                        return;
                    }
                    if (api[token] === '*') {
                        // anything from this point on is good
                        return;
                    }
                    if (typeof (api[token]) === 'object' && Object.keys(api[token]).length === 0) {
                        // nothing else to inspect
                        return;
                    }
                    if (api[token] === true && !nextIdentifier) {
                        // function call
                        return;
                    }
                    if (api[token] === true && nextIdentifier && nextIdentifier.type === 'Identifier' && (nextIdentifier.name === 'apply' || nextIdentifier.name === 'call')) {
                        // function call with .apply() or .call() are still valid
                        return;
                    }
                    if (api[token] === false && nextIdentifier === undefined) {
                        return;
                    }
                    api = api[token];
                }
            }
        }
    };

};

module.exports.schema = [];
