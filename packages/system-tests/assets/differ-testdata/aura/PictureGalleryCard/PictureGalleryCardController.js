({
    doInit : function(component) {
    	// Hardcoding images in this demo component
    	component.set("v.slides", [
            'https://s3-us-west-1.amazonaws.com/sfdc-demo/houses/living_room.jpg',
            'https://s3-us-west-1.amazonaws.com/sfdc-demo/houses/eatinkitchen.jpg',
			'https://s3-us-west-1.amazonaws.com/sfdc-demo/houses/kitchen.jpg'
        ]);
    },

	fullScreen : function(component) {
        component.set("v.fullScreen", true);
	},

	closeDialog : function(component) {
        component.set("v.fullScreen", false);
	}

})