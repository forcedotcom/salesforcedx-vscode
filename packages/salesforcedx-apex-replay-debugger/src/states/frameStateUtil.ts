/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  EVENT_CODE_UNIT_FINISHED,
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_CONSTRUCTOR_EXIT,
  EVENT_VF_APEX_CALL_END,
  EVENT_VF_APEX_CALL_START,
  SFDC_TRIGGER
} from '../constants';

export class FrameStateUtil {
  // Given the log line, already split into fields, return the computed frame name.
  public static computeFrameName(fields: string[]): string {
    const sig = fields[fields.length - 1];
    const invokeMatch = ' invoke\\((.*)\\)';
    let frameName = '';
    switch (fields[1]) {
      case EVENT_CODE_UNIT_STARTED:
      case EVENT_CODE_UNIT_FINISHED:
        if (sig.startsWith(SFDC_TRIGGER)) {
          frameName = sig.substring(SFDC_TRIGGER.length);
        } else {
          frameName = sig;
        }
        break;
      case EVENT_CONSTRUCTOR_ENTRY:
      case EVENT_CONSTRUCTOR_EXIT:
        // The log event line for both events looks like
        // CONSTRUCTOR_ENTRY/EXIT|...|<init>()|MyClass
        // or
        // CONSTRUCTOR_ENTRY/EXIT|...|<init>()|MyNamespace/MyClass
        // or
        // CONSTRUCTOR_ENTRY/EXIT|...|<init>()|MyClass.MyInnerClass
        // or
        // CONSTRUCTOR_ENTRY/EXIT|...|<init>()|MyNamespace/MyClass.MyInnerClass
        // in all cases the end result is going to be everything after the last |
        // with .<ClassName> added to the end where <ClassName> is the last class
        // in the string.
        // First, take care of the case where there's an inner class. With the way this
        // is parsed, namespaces aren't an issue.
        if (sig.lastIndexOf('.') >= 0) {
          // In the case of MyClass.MyInnerClass the frame name would be MyClass.MyInnerClass.MyInnerClass
          // which would match live debugging
          frameName = sig + '.' + sig.substr(sig.lastIndexOf('.') + 1);
          // Second take care of the case where there's no inner class but there is a namespace.
        } else if (sig.lastIndexOf('/') >= 0) {
          // In the case of MyNamespace/MyClass the frame name would be MyNamespace/MyClass.MyClass
          frameName = sig + '.' + sig.substring(sig.lastIndexOf('/') + 1);
        } else {
          // The default case is just a single class in the typeref with no namespace which just
          // becomes MyClass.MyClass
          frameName = sig + '.' + sig;
        }
        break;
      case EVENT_VF_APEX_CALL_START:
      case EVENT_VF_APEX_CALL_END:
        // For the VF_APEX_CALL lines we end up with something that looks like
        // VF_APEX_CALL_START|...|MyController invoke(save)|MyController
        // The actual framename should be MyController.save() which means that the method name
        // needs to be parsed from inside of the invoke(<method>) log line. If worse comes to
        // worse then using the typeRef is going to be a good fallback, like in the case of
        // getters/setters where frames aren't quite correct in the logs due to over logging.
        frameName = sig;
        const methodName = fields[fields.length - 2].match(invokeMatch);
        // The match call can return null and temp[0] will end up being the full string which means that
        // any match that we want is going to end up being in temp[1]
        if (methodName != null && methodName.length >= 2) {
          frameName += '.' + methodName[1];
          if (!methodName[1].endsWith(')')) {
            frameName += '()';
          }
        }
        break;
      default:
        frameName = sig;
    }
    return frameName;
  }

  // When processing the VF_APEX_CALL_START/EXIT messages there is a case where
  // two log lines for START/EXIT events from invoking a getter or setter. Both
  // log lines are completely valid and necessary for diagnostics but these have
  // an unfortunate side effect of causing a second frame to be created during
  // reply debugging.
  // VF_APEX_CALL_START|...|MyController get(message)|MyController
  // VF_APEX_CALL_START|...|MyController invoke(getmessage)|MyController
  // The two messages are due to how properties are get/set and the call that
  // actually gets/sets the property is the invoke. This method doesn't need the
  // entire list of fields (which is just a split of the log on |), just the second
  // to last string. This method is only set to match the extraneous log message
  // that shouldn't get it's own stack frame. Everything else is pretty much as is.
  public static isExtraneousVFGetterOrSetterLogLine(logLine: string): boolean {
    const getMatch = ' get\\((.*)\\)';
    const setMatch = ' set\\((.*)\\)';
    if (logLine.match(getMatch) == null && logLine.match(setMatch) == null) {
      return false;
    }
    return true;
  }
}
