public with sharing class HandlerCostCenter implements BotHandler {
    // This is a local change.    
    public BotResponse handle(String utterance, String[] params, Map<String, String> session, String fileName, String fileContent) {
        return new BotResponse(new BotMessage('Bot', 'Your cost center is 21852'));
    }
}
