background:

1. apexExt/LanguageClientManager/getLineBreakpointInfo is returning them with typeRef like ns/classname
2. replayExt/checkpointService/createCheckpoints calls that, then sets them as state in breakpointUtil.createMappingsFromLineBreakpointInfo

places to correct them

1. when they come in from getLineBreakpointInfo (could have more downstream effects, not sure if they'd be good or bad)
2. when uploading the checkpoints to the org `checkpointService.executeCreateApexExecutionOverlayActionCommand` (the least invasive option)
