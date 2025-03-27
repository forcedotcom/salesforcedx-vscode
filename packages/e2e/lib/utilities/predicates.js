"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardPredicates = void 0;
exports.createPredicateWithTimeout = createPredicateWithTimeout;
const workbench_1 = require("./workbench");
exports.standardPredicates = {
    alwaysTrue: async () => true,
    waitForElement: async (selector) => {
        return await (0, workbench_1.getBrowser)().findElement(selector).isDisplayed();
    },
    waitForCondition: async (condition) => {
        while (!condition()) {
            await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust polling interval as needed
        }
        return true;
    }
};
function createPredicateWithTimeout(predicate, maxWaitTime) {
    return {
        predicate,
        maxWaitTime
    };
}
//# sourceMappingURL=predicates.js.map