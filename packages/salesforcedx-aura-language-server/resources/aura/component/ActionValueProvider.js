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
function ActionValueProvider(component, controllerDef) {
    this.actions;
    this.component = component;
    this.controllerDef = controllerDef;
}

ActionValueProvider.prototype.get = function(key) {
    // Delay creation of the object for memory purposes.
    if(!this.actions) {
        this.actions = {};
    }
    var actionDef = this.actions[key];
    if (!actionDef) {
        actionDef = this.component['controller'] && this.component['controller'][key];
        if (actionDef) {
            var clientDef = {};
            clientDef[Json.ApplicationKey.DESCRIPTOR] = this.component.getType() + "$controller$" + key;
            clientDef[Json.ApplicationKey.NAME] = key;
            clientDef[Json.ApplicationKey.ACTIONTYPE] = "CLIENT";
            clientDef[Json.ApplicationKey.CODE] = actionDef;

            actionDef = new ActionDef(clientDef);

            //#if {"excludeModes" : ["PRODUCTION"]}
            if (this.controllerDef && this.controllerDef.hasActionDef(key)) {
                var message = "Component '" + this.component.getType() + "' has server and client action name conflicts: " + key;
                $A.warning(message);
            }
            //#end
        } else {
            actionDef = this.controllerDef && this.controllerDef.getActionDef(key);
        }

        if (!actionDef) {
            var cmpType = this.component.getType();
            var auraError = new $A.auraError("Unable to find action '" + key + "' on the controller of " + cmpType);
            auraError.setComponent(cmpType);
            auraError["componentStack"] = $A.util.getComponentHierarchy(this.component);
            throw auraError;
        }

        this.actions[key] = actionDef;
    }
    return actionDef.newInstance(this.component);
};


Aura.Component.ActionValueProvider = ActionValueProvider;
