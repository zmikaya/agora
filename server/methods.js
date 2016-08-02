/* global AgoraSignGenerator */

// Fill the vendorkey and sign key given by Agora.io
var VENDOR_KEY = "YOUR VENDOR_KEY";
var SIGN_KEY = "YOUR SIGN_KEY";

/**
 * Generates and returns a dynamic key.
 * 
 * @method agora.generateDynamicKey
 * @param {String} channelName An AgoraRTC channel.
 * @return {String} A dynamic key.
 */
Meteor.methods({
  'agora.generateDynamicKey': function(channelName) {
    check(channelName, String);
    // TODO: An auth validation should be performed for security reasons.
    var ts = Math.round(new Date().getTime() / 1000);
    var rnd =Math.round(Math.random()*100000000);
    var key = AgoraSignGenerator.generateDynamicKey(VENDOR_KEY, SIGN_KEY, channelName, ts, rnd);
    return key;
  }
});
