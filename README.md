Meteor Agora Web SDK
===================

This is a Meteor wrapper for the Agora.io video JS web SDK. The package is designed particularly for Meteor 1.2.1 and exposes all public AgoraRtcAgentSDK version 1.5.0 methods to the Meteor client. Additionally, dynamic key generation for added security is accessible natively on the Meteor server, in accordance with the Agora SDK documentation.

----------


Documentation
-------------
#### Installation

> - meteor add agora

#### Client

All AgoraRtcAgentSDK methods are accessible via the AgoraRTC object which is exported globally to the Meteor client-side application. Generally, the complete documentation is available at [http://www.agora.io/blog/docs/javascript-voice-video-chat-sdk/](http://www.agora.io/blog/docs/javascript-voice-video-chat-sdk/).

> **Examples:**
>
    AgoraRTC.createRtcClient() -> Creates a client object.
    AgoraRTC.createStream(spec) -> Creates a stream object, given a valid spec object parameter.

#### Server

Only one Meteor method is used in order to generate dynamic keys for user authorization. The function returns the generated key. **Note**: This key is pseudo-random.

>**Setup:**
>
    **In <path-to-agora>/agora/server/methods.js
    **Add your valid Vendor and Sign keys.
    var VENDOR_KEY = "YOUR VENDOR_KEY";
	var SIGN_KEY = "YOUR SIGN_KEY";

> **Examples:**
>
    var callback = (err, res) => {
	    if (err) {
		    console.log(err);
	    }
	    else {
		    console.log(res);
		    // do something with the key
	    }
    };
    Meteor.call('agora.generateDynamicKey', 'enter a valid channel name', callback);

**Questions?** Contact Zach Mikaya at zmikaya@gmail.com.

----------