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
 * @description Creates a new ControllerDef, including the descriptor and action definitions.
 * A ControllerDef instance is created as part of the ComponentDef initialization.
 * @constructor
 * @param {Object} config
 * @export
 */
function ControllerDef(config){
    this.descriptor = config[Json.ApplicationKey.DESCRIPTOR];
    this.access = config[Json.ApplicationKey.ACCESS];
    this.actionDefs = {};
    var actionDefs = config[Json.ApplicationKey.ACTIONDEFS];

    for(var i=0;i<actionDefs.length;i++){
        var actionDefConfig = actionDefs[i];
        var actionDef = $A.componentService.createActionDef(actionDefConfig);
        this.actionDefs[actionDef.getName()] = actionDef;
    }
}

/**
 * Gets the Controller Descriptor with the format <code>markup://aura:component</code>.
 * @returns {String} ControllerDef descriptor
 */
ControllerDef.prototype.getDescriptor = function(){
    return this.descriptor;
};

/**
 * Check if an action def exists.
 */
ControllerDef.prototype.hasActionDef = function(key){
    return this.actionDefs.hasOwnProperty(key);
};

/**
 * Gets the Action Definition.
 * @param {String} key - A action name which is defined on the controller.
 * @returns {ActionDef} an action definition, undefined if the definition does not exist.
 */
ControllerDef.prototype.getActionDef = function(key) {
    var action = this.actionDefs[key];
    return action;
};

/**
 * Gets a new Action instance based on the given key.
 * @param {String} key - A action name which is defined on the controller.
 * @returns {Action} A new Action instance
 */
ControllerDef.prototype.get = function(key) {
    if (this.access === 'I') {
        var currentAccess = $A.clientService.currentAccess;
        if (currentAccess) {
            var namespace = currentAccess.getDef().getDescriptor().getNamespace();
            if (!$A.clientService.isInternalNamespace(namespace)) {
                if ($A.clientService.logAccessFailures) {
                    throw new Error(currentAccess.type + " cannot execute " + this.descriptor);
                }
                return null;
            }
        }
    }
    return this.getActionDef(key).newInstance();
};

Aura.Controller.ControllerDef = ControllerDef;
