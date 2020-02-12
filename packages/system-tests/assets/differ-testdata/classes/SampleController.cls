public with sharing class SampleController {
    public SampleController() {
    }

    @auraenabled
    public String WelcomeMessage {
        get { return 'Welcome'; }
    }

    public String username { get; set; }

    public PageReference forgotPassword() {
        Boolean success = Site.forgotPassword(username);
        PageReference pr = ApexPages.currentPage();  // new PageReference('http://www.google.com');
        pr.setRedirect(true);
        // pr.

        HttpRequest request = new HttpRequest();
        request.setEndpoint('http://www.yahoo.com');
        request.setMethod('GET');

        Http remote = new Http();
        remote.send(request);

        return pr;
    }
}