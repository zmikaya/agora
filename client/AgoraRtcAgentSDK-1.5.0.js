/* global AgoraRTC */

function AgoraRender() {
  var gl = undefined;
  var program = undefined;
  var positionLocation = undefined;
  var texCoordLocation = undefined;
  var yTexture = undefined;
  var uTexture = undefined;
  var vTexture = undefined;
  var texCoordBuffer = undefined;
  var surfaceBuffer = undefined;
  var that = {
    view: undefined
    , mirrorView: false
    , container: undefined
    , canvas: undefined
    , renderImageCount: 0
    , initWidth: 0
    , initHeight: 0
    , initRotation: 0
    , canvasUpdated: false
    , clientWidth: 0
    , clientHeight: 0
  };

  that.start = function (view, mirror, onFailure) {
    initCanvas(view, mirror, view.clientWidth, view.clientHeight, that.initRotation, onFailure);
  };

  that.stop = function () {
    gl = undefined;
    program = undefined;
    positionLocation = undefined;
    texCoordLocation = undefined;

    deleteTexture(yTexture);
    deleteTexture(uTexture);
    deleteTexture(vTexture);
    yTexture = undefined;
    uTexture = undefined;
    vTexture = undefined;

    deleteBuffer(texCoordBuffer);
    deleteBuffer(surfaceBuffer);
    texCoordBuffer = undefined;
    surfaceBuffer = undefined;

    if (that.container) {
      that.container.removeChild(that.canvas);
    }

    if (that.view) {
      that.view.removeChild(that.container);
    }

    that.canvas = undefined;
    that.container = undefined;
    that.view = undefined;
    that.mirrorView = false;
  }

  that.renderImage = function (image) {
    // rotation, width, height, left, top, right, bottom, yplane, uplane, vplane
    if (!gl) {
      return ;
    }

    if (image.width != that.initWidth || image.height != that.initHeight || image.rotation != that.initRotation) {
      var view = that.view;
      var mirror = that.mirrorView;
      that.stop();
      console.log('init canvas ' + image.width + "*" + image.height + " rotation " + image.rotation);
      initCanvas(view, mirror, image.width, image.height, image.rotation, function (e) {
        console.error('init canvas ' + image.width + "*" + image.height + " rotation " + image.rotation + " failed. " + e);
      });
    }

    // console.log(width, "*", height, "planes "
    //   , " y ", yplane[0], yplane[yplane.length - 1]
    //   , " u ", uplane[0], uplane[uplane.length - 1]
    //   , " v ", vplane[0], vplane[vplane.length - 1]
    // );

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    var xWidth = image.width + image.left + image.right;
    var xHeight = image.height + image.top + image.bottom;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        image.left/xWidth,  image.bottom/xHeight,
        1 - image.right/xWidth,  image.bottom/xHeight,
        image.left/xWidth,  1 - image.top/xHeight,
        image.left/xWidth,  1 - image.top/xHeight,
        1 - image.right/xWidth,  image.bottom/xHeight,
        1 - image.right/xWidth, 1 - image.top/xHeight
      ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    uploadYuv(xWidth, xHeight, image.yplane, image.uplane, image.vplane);

    updateCanvas(image.rotation, image.width, image.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    that.renderImageCount += 1;
  };

    function uploadYuv(width, height, yplane, uplane, vplane) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, yTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, yplane);
      var e = gl.getError();
      if (e != gl.NO_ERROR) {
        console.log('upload y plane ', width, height, yplane.byteLength, ' error', e);
      }

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, uTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width/2, height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uplane);
      var e = gl.getError();
      if (e != gl.NO_ERROR) {
        console.log('upload u plane ', width, height, uplane.byteLength, '  error', e);
      }

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, vTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width/2, height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, vplane);
      var e = gl.getError();
      if (e != gl.NO_ERROR) {
        console.log('upload v plane ', width, height, vplane.byteLength, '  error', e);
      }
    }

    function deleteBuffer(buffer) {
      if (buffer && that.gl) {
        that.gl.deleteBuffer(buffer);
      }
    }

    function deleteTexture(texture) {
      if (texture && that.gl) {
        that.gl.deleteTexture(texture);
      }
    }

    function initCanvas(view, mirror, width, height, rotation, onFailure) {
      that.clientWidth = view.clientWidth;
      that.clientHeight = view.clientHeight;

      that.view = view;
      that.mirrorView = mirror;
      that.canvasUpdated = false;

      that.container = document.createElement('div');
      that.container.style.width = '100%';
      that.container.style.height = '100%';
      that.container.style.display = 'flex';
      that.container.style.justifyContent = 'center';
      that.container.style.alignItems = 'center';
      that.view.appendChild(that.container);

      that.canvas = document.createElement('canvas');
      if (rotation == 0 || rotation == 180) {
        that.canvas.width = width;
        that.canvas.height = height;
      } else {
        that.canvas.width = height;
        that.canvas.height = width;
      }
      that.initWidth = width;
      that.initHeight = height;
      that.initRotation = rotation;
      if (that.mirrorView) {
        that.canvas.style.transform = 'rotateY(180deg)';
      }
      that.container.appendChild(that.canvas);
      try {
        // Try to grab the standard context. If it fails, fallback to experimental.
        gl = that.canvas.getContext("webgl") || that.canvas.getContext("experimental-webgl");
      } catch(e) {
        console.log(e);
      }

      if (!gl) {
        gl = undefined;
        onFailure({error: 'Browser not support! No WebGL detected.'})
        return ;
      }

      // Set clear color to black, fully opaque
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      // Enable depth testing
      gl.enable(gl.DEPTH_TEST);
      // Near things obscure far things
      gl.depthFunc(gl.LEQUAL);
      // Clear the color as well as the depth buffer.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // setup GLSL program
      program = createProgramFromSources(gl, [AgoraRTC.vertexShaderSource, AgoraRTC.yuvShaderSource]);
      gl.useProgram(program);

      initTextures();
    }

    function initTextures() {
      positionLocation = gl.getAttribLocation(program, "a_position");
      texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

      surfaceBuffer = gl.createBuffer();
      texCoordBuffer = gl.createBuffer();

      // Create a texture.
      gl.activeTexture(gl.TEXTURE0);
      yTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, yTexture);
      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      gl.activeTexture(gl.TEXTURE1);
      uTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, uTexture);
      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      gl.activeTexture(gl.TEXTURE2);
      vTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, vTexture);
      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      var y = gl.getUniformLocation(program, "Ytex");
      gl.uniform1i(y, 0); /* Bind Ytex to texture unit 0 */

      var u = gl.getUniformLocation(program, "Utex");
      gl.uniform1i(u, 1); /* Bind Utex to texture unit 1 */

      var v = gl.getUniformLocation(program, "Vtex");
      gl.uniform1i(v, 2); /* Bind Vtex to texture unit 2 */
    }

    function updateCanvas(rotation, width, height) {
      if (that.canvasUpdated) {
        return ;
      }
      that.canvas.style.width = '100%';
      that.canvas.style.height = '100%';

      try {
        if (rotation === 0 || rotation === 180) {
          if (that.clientWidth/that.clientHeight > width/height ) {
            that.canvas.style.width = that.clientHeight * width/height + 'px';
          } else if (that.clientWidth/that.clientHeight < width/height ) {
            that.canvas.style.height = that.clientWidth * height/width + 'px';
          }
        } else { // 90, 270
          if (that.clientHeight/that.clientWidth > width/height ) {
            that.canvas.style.height = that.clientWidth * width/height + 'px';
          } else if (that.clientHeight/that.clientWidth < width/height ) {
            that.canvas.style.width = that.clientHeight * height/width + 'px';
          }
        }
      } catch (e) {
        console.log('updateCanvas 00001 gone ' + that.canvas);
        console.log(that);
        console.error(e);
        return ;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, surfaceBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // console.log('image rotation from ', that.imageRotation, ' to ', rotation);
      // 4 vertex, 1(x1,y1), 2(x2,y1), 3(x2,y2), 4(x1,y2)
      //  0: 1,2,4/4,2,3
      // 90: 2,3,1/1,3,4
      //180: 3,4,2/2,4,1
      //270: 4,1,3/3,1,2
      var p1 = {x: 0, y: 0};
      var p2 = {x: width, y: 0};
      var p3 = {x: width, y: height};
      var p4 = {x: 0, y: height};
      var pp1 = p1, pp2 = p2, pp3 = p3, pp4 = p4;

      switch (rotation) {
        case 0:
          break;
        case 90:
          pp1 = p2;
          pp2 = p3;
          pp3 = p4;
          pp4 = p1;
          break;
        case 180:
          pp1 = p3;
          pp2 = p4;
          pp3 = p1;
          pp4 = p2;
          break;
        case 270:
          pp1 = p4;
          pp2 = p1;
          pp3 = p2;
          pp4 = p3;
          break;
        default:
      }
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
         pp1.x, pp1.y,
         pp2.x, pp2.y,
         pp4.x, pp4.y,
         pp4.x, pp4.y,
         pp2.x, pp2.y,
         pp3.x, pp3.y
       ]), gl.STATIC_DRAW);

      var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      gl.uniform2f(resolutionLocation, width, height);
      that.canvasUpdated = true;
    }

  return that;
}

AgoraRTC = (function() {
  "use strict";

  var AgoraRTC = {};

  Object.defineProperties(AgoraRTC, {
    version: {
      get: function() { return '<%= pkg.version %>'; }
    },
    name: {
      get: function() { return '<%= pkg.title %>'; }
    }
  });

  return AgoraRTC;
}());

AgoraRTC.url = "wss://localhost.agora.io:8921/";
AgoraRTC.macAgentInstallUrl = "http://download.agora.io/AgoraWebAgent-1.3.0.pkg";
AgoraRTC.winAgentInstallUrl = "http://download.agora.io/AgoraWebAgentSetup-1.3.0.exe";
AgoraRTC.enAgentInstallGuideUrl = "http://download.agora.io/install-guide-en.html";
AgoraRTC.cnAgentInstallGuideUrl = "http://download.agora.io/install-guide-cn.html";

AgoraRTC.vertexShaderSource = "attribute vec2 a_position;"
 + "attribute vec2 a_texCoord;"
 + "uniform vec2 u_resolution;"
 + "varying vec2 v_texCoord;"
 + "void main() {"
 + "vec2 zeroToOne = a_position / u_resolution;"
 + "   vec2 zeroToTwo = zeroToOne * 2.0;"
 + "   vec2 clipSpace = zeroToTwo - 1.0;"
 + "   gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);"
 + "v_texCoord = a_texCoord;"
 + "}";
AgoraRTC.yuvShaderSource = "precision mediump float;"
  + "uniform sampler2D Ytex;"
  + "uniform sampler2D Utex,Vtex;"
  + "varying vec2 v_texCoord;"
  + "void main(void) {"
  + "  float nx,ny,r,g,b,y,u,v;"
  + "  mediump vec4 txl,ux,vx;"
  + "  nx=v_texCoord[0];"
  + "  ny=v_texCoord[1];"
  + "  y=texture2D(Ytex,vec2(nx,ny)).r;"
  + "  u=texture2D(Utex,vec2(nx,ny)).r;"
  + "  v=texture2D(Vtex,vec2(nx,ny)).r;"
  + "  y=1.1643*(y-0.0625);"
  + "  u=u-0.5;"
  + "  v=v-0.5;"
  + "  r=y+1.5958*v;"
  + "  g=y-0.39173*u-0.81290*v;"
  + "  b=y+2.017*u;"
  + "  gl_FragColor=vec4(r,g,b,1.0);"
  + "}";

/**
 * compact VideoStream.js into a sigle string with this tool, http://jscompress.com/
 */
AgoraRTC.videoStreamSource = 'function onSuccess(){postMessage({type:"init",result:!0})}function onFailure(t){postMessage(t)}function sendMessage(t){"videoStat"!=t.command&&console.log(JSON.stringify(t)),that.stream&&that.stream.readyState==WebSocket.OPEN&&that.stream.send(JSON.stringify(t))}var that={};that.stream=void 0,that.init=function(t){return that.stream&&that.stream.readyState===WebSocket.OPEN?(console.warn("stream "+that.getId()+" has been initialized already"),void onSuccess()):(that.local=t.local,that.profile=t.videoProfile,that.stream=new WebSocket(t.url),that.stream.onopen=function(t){console.log((that.local?"local":"remote")+" Stream "),console.log(t),that.profile&&sendMessage({command:"setVideoProfile",profile:that.profile}),that.stream.binaryType="arraybuffer",onSuccess()},that.stream.onclose=function(t){console.log(that.local?"local":"remote"," Stream ",t),that.stream=void 0,onFailure({type:t.type,code:t.code,reason:t.reason})},that.stream.onerror=function(t){console.log(that.local?"local":"remote"," Stream ",t),onFailure({type:t.type,code:t.code,reason:t.reason})},void(that.stream.onmessage=function(t){"string"==typeof t.data?console.log(that.local?"local":"remote"," message from agent ",t.data):t.data instanceof ArrayBuffer?postMessage({type:"message",data:t.data}):t.data instanceof Blob&&console.warn("Blob image data is not supported")}))},that.close=function(){that.stream&&(that.stream.onmessage=void 0,that.stream.close()),that.stream=void 0},that.setVideoProfile=function(t){return"string"==typeof t?(that.stream?sendMessage({command:"setVideoProfile",profile:t}):that.profile=t,!0):!1},self.addEventListener("message",function(t){var e=t.data;switch(e.type){case"init":that.init(e);break;case"send":sendMessage(e.message);break;case"close":that.close()}},!1);';

var AgoraCall = function (callback, parameters) {
  if (callback) {
    callback(parameters);
  }
}

var L = {
  VideoProfiles: {
    Profile120P: '120P'
    , Profile120P_2: '120P_2'
    , Profile120P_3: '120P_3'

    , Profile180P: '180P'
    , Profile180P_2: '180P_2'
    , Profile180P_3: '180P_3'

    , Profile240P: '240P'
    , Profile240P_2: '240P_2'
    , Profile240P_3: '240P_3'

    , Profile360P: '360P'
    , Profile360P_2: '360P_2'
    , Profile360P_3: '360P_3'
    , Profile360P_4: '360P_4'
    , Profile360P_5: '360P_5'
    , Profile360P_6: '360P_6'

    , Profile480P: '480P'
    , Profile480P_2: '480P_2'
    , Profile480P_3: '480P_3'
    , Profile480P_4: '480P_4'
    , Profile480P_5: '480P_5'
    , Profile480P_6: '480P_6'
    , Profile480P_7: '480P_7'

    , Profile720P: '720P'
    , Profile720P_2: '720P_2'
    , Profile720P_3: '720P_3'
    , Profile720P_4: '720P_4'
  },

  ErrorCode: {
    NO_ERROR: 0
    , INVALID_VENDOR_KEY: 101
    , FAILED: 1
    , INVALID_ARGUMENT: 2
    , NOT_READY: 3
    , NOT_SUPPORTED: 4
    , REFUSED: 5
    , BUFFER_TOO_SMALL: 6
    , NOT_INITIALIZED: 7
    , INVALID_VIEW: 8
    , NO_PERMISSION: 9
    , TIMEDOUT: 10
    , CANCELED: 11
    , TOO_OFTEN: 12
    , BIND_SOCKET: 13
    , NET_DOWN: 14
    , NET_NOBUFS: 15
    , INIT_VIDEO: 16
    , JOIN_CHANNEL_REJECTED: 17
    , LEAVE_CHANNEL_REJECTED: 18
    , ALREADY_IN_USE: 19
    , INVALID_VENDOR_KEY: 101
    , INVALID_CHANNEL_NAME: 102
    , DYNAMIC_KEY_TIMEOUT: 109
    , INVALID_DYNAMIC_KEY: 110
    , CONNECTION_INTERRUPTED: 111
    , CONNECTION_LOST: 112
    //1001~2000
    , LOAD_MEDIA_ENGINE: 1001
    , START_CALL: 1002
    , START_CAMERA: 1003
    , START_VIDEO_RENDER: 1004
    , ADM_GENERAL_ERROR: 1005
    , ADM_JAVA_RESOURCE: 1006
    , ADM_SAMPLE_RATE: 1007
    , ADM_INIT_PLAYOUT: 1008
    , ADM_START_PLAYOUT: 1009
    , ADM_STOP_PLAYOUT: 1010
    , ADM_INIT_RECORDING: 1011
    , ADM_START_RECORDING: 1012
    , ADM_STOP_RECORDING: 1013
    , ADM_RUNTIME_PLAYOUT_ERROR: 1015
    , ADM_RUNTIME_RECORDING_ERROR: 1017
    , ADM_RECORD_AUDIO_FAILED: 1018
    , ADM_INIT_LOOPBACK: 1022
    , ADM_START_LOOPBACK: 1023
    // 1025, as warning for interruption of adm on ios
    // 1026, as warning for route change of adm on ios

    // VDM error code starts from 1500
    , VDM_CAMERA_NOT_AUTHORIZED: 1501
  }
};

/*
 * Class EventDispatcher provides event handling to sub-classes.
 * It is inherited from Publisher, Room, etc.
 */
AgoraRTC.EventDispatcher = function (spec) {
    "use strict";
    var that = {};
    // Private vars
    spec.dispatcher = {};
    spec.dispatcher.eventListeners = {};

    // Public functions

    // It adds an event listener attached to an event type.
    that.addEventListener = function (eventType, listener) {
        spec.dispatcher.eventListeners[eventType] = listener;
        if (! spec.dispatcher.eventListeners[eventType]) {
          delete spec.dispatcher.eventListeners[eventType];
        }
    };

    that.on = that.addEventListener;

    // It dispatch a new event to the event listeners, based on the type
    // of event. All events are intended to be LicodeEvents.
    that.dispatchEvent = function (event) {
        if (spec.dispatcher.eventListeners.hasOwnProperty(event.type)) {
            spec.dispatcher.eventListeners[event.type](event);
        }
    };

    return that;
};

// **** EVENTS ****

/*
 * Class LicodeEvent represents a generic Event in the library.
 * It handles the type of event, that is important when adding
 * event listeners to EventDispatchers and dispatching new events.
 * A LicodeEvent can be initialized this way:
 * var event = LicodeEvent({type: "room-connected"});
 */
AgoraRTC.BasicEvent = function (spec) {
    "use strict";
    var that = {};

    // Event type. Examples are: 'room-connected', 'stream-added', etc.
    that.type = spec.type;

    return that;
};

/*
 * Class StreamEvent represents an event related to a stream. It is a LicodeEvent.
 * It is usually initialized this way:
 * var streamEvent = StreamEvent({type:"stream-added", stream:stream1});
 * Event types:
 * 'stream-added' - indicates that there is a new stream available in the room.
 * 'stream-removed' - shows that a previous available stream has been removed from the room.
 */
AgoraRTC.StreamEvent = function (spec) {
    "use strict";
    var that = AgoraRTC.BasicEvent(spec);

    // The stream related to this event.
    that.stream = spec.stream;

    that.msg = spec.msg;

    return that;
};

/*
 * Class ClientEvent represents an event related to a client. It is a LicodeEvent.
 * It is usually initialized this way:
 * var clientEvent = ClientEvent({type:"client-left", uid: user, attr: attributes});
 * Event types:
 * 'client-connected' - points out that the user has been successfully connected.
 * 'client-disconnected' - shows that the user has been already disconnected.
 * 'client-joined' - indicates that there is a new client joined.
 * 'client-left' - indicates that a client has left.
 *
 * NOTE: 'client-connected' event shall always trigger 'client-joined' event,
 * while 'client-disconnected' event shall always trigger 'client-left' event;
 */
AgoraRTC.ClientEvent = function (spec) {
  "use strict";
  var that = AgoraRTC.BasicEvent(spec);
  that.uid = spec.uid;
  that.attr = spec.attr;
  that.streams = spec.streams;
  return that;
};

/*
 * Class MediaEvent represents an event related to a getUserMedia(). It is a LicodeEvent.
 * It usually initializes as:
 * var mediaEvent = MediaEvent({})
 * Event types:
 * 'access-accepted' - indicates that the user has accepted to share his camera and microphone
 * 'warning' - details are included in the event message (msg)
 * 'error' - details are included in the event message (msg)
 */
AgoraRTC.MediaEvent = function (spec) {
    "use strict";
    var that = AgoraRTC.BasicEvent(spec);
    that.msg = spec.msg;
    return that;
};

AgoraRTC.Signal = function (spec) {
  var that = AgoraRTC.EventDispatcher(spec);

  that.connection = new WebSocket(spec.url);  // FIXME handle timeout

  that.sendMessage = function (obj, onError) {
    if (that.connection.readyState == WebSocket.OPEN) {
      that.connection.send(JSON.stringify(obj));
    } else {
      console.log('connection to agent lost.');
      onError({error: 'not connected'});
    }
  };

  that.close = function () {
    that.connection.onopen = undefined;
    that.connection.onclose = undefined;
    that.connection.onerror = undefined;
    that.connection.onmessage = undefined;

    that.connection.close();
  };

  that.connection.onopen = function (e) {
    console.log(e);
    that.dispatchEvent(AgoraRTC.MediaEvent({type: 'onopen', event: e}));
  };

  that.connection.onclose = function (e) {
    console.log(e);
    AgoraCall(spec.onFailure, e);
  };

  that.connection.onerror = function (e) {
    console.log(e);
    AgoraCall(spec.onFailure, e);
  };

  that.connection.onmessage = function (e) {
    console.log(e);
    var m = JSON.parse(e.data);
    that.dispatchEvent(AgoraRTC.MediaEvent({type: m.command, msg: m}));
  };

  return that;
};

AgoraRTC.Stream = function (spec) {
  var that = AgoraRTC.EventDispatcher(spec);
  that.stream = undefined;
  that.render = undefined;
  that.interval = undefined;
  that.lastRenderCount = 0;
  that.profile = undefined;
  that.latency = 0;
  var header = undefined;
  var yplane = undefined;
  var uplane = undefined;
  var vplane = undefined;

  that.init = function (onSuccess, onFailure) {
    if (that.stream) {
      console.warn('stream ' + that.getId() + ' has been initialized already');
      onSuccess();
      return ;
    }
    // create web worker in debug mode
    // var videoStreamElement = document.getElementById('videoStreamWorker');
    // that.stream = new Worker(videoStreamElement.src);
    var videoStreamFileBlob = new Blob([AgoraRTC.videoStreamSource], {type: 'application/javascript'});
    that.stream = new Worker(URL.createObjectURL(videoStreamFileBlob));
    that.oninit = function (e) {
      console.log((spec.local ? "local" : "remote") + " Stream ");
      console.log(e);
      if (e.result === true) {
        onSuccess();
      } else {
        onFailure();
      }
    };

    that.onclose = function (e) {
      window.clearInterval(that.interval);
      console.log(spec.local ? "local" : "remote", " Stream ", e);
      that.stream = undefined;
    };

    that.onerror = function (e) {
      window.clearInterval(that.interval);
      console.log(spec.local ? "local" : "remote", " Stream ", e);
      onFailure(e);
    };

    that.onmessage = function (e) {
      if (typeof e === "string") {
        console.log(spec.local ? "local" : "remote", " message from agent ", e);
      } else if (e instanceof ArrayBuffer) {
        if (that.render) {
          that.drawImage(e);
        }
      } else if (e instanceof Blob) {
        console.warn("Blob image data is not supported");
      }
    };


    that.stream.addEventListener('message', onWorkerMessage, false);
    that.stream.postMessage({type: 'init', local: spec.local, url: AgoraRTC.url, videoProfile: that.profile});
  }

  that.close = function () {
    window.clearInterval(that.interval);

    if (that.stream) {
      that.stream.removeEventListener('message', onWorkerMessage);
      that.stream.postMessage({type:'close'});
    }
    that.stream = undefined;

    that.stop();
  };

  that.play = function (div, onFailure) {
    var view = document.getElementById(div);

    that.stop();

    var mirror = spec.local;
    that.render = AgoraRender();
    that.render.start(view, mirror, onFailure);

    if (spec.local) {
      that.stream.postMessage({type: 'send', message: {
        command: 'preview'
        , uid: spec.streamID
      }});
    } else {
      that.stream.postMessage({type: 'send', message: {
        command: 'subscribe'
        , uid: spec.streamID
      }});
    }

    if (that.interval) {
      window.clearInterval(that.interval);
    }

    that.interval = window.setInterval(function () {
      if (that.render) {
        var fps = (that.render.renderImageCount - that.lastRenderCount);
        that.stream.postMessage({type: 'send', message: {
          command: 'videoStat'
          , uid: spec.streamID
          , fps: fps
          , frameCount: that.lastRenderCount
          , latency: that.latency
        }});
        // console.log((spec.local ? "local" : "remote") + 'render fps ' + fps + ' latency ' + that.latency);
        that.lastRenderCount = that.render.renderImageCount;
        that.latency = 0;
      }
    }, 1000);
  }

  that.stop = function () {
    if (that.render) {
      that.render.stop();
    }
    that.render = undefined;
    that.lastRenderCount = 0;
  }

  that.bindClient = function (client) {
    that.client = client;
  }

  that.enableAudio = function (callback) {
    return that.client.enableAudio(that, callback);
  };

  that.disableAudio = function (callback) {
    return that.client.disableAudio(that, callback);
  };

  that.enableVideo = function (callback) {
    return that.client.enableVideo(that, callback);
  };

  that.disableVideo = function (callback) {
    return that.client.disableVideo(that, callback);
  };

  that.getId = function () {
    return spec.streamID;
  };

  that.drawImage = function (data) {
    if (! header) {
      header = data;
      if (header.byteLength != 20) {  //
        console.error('invalid image header ' + data.byteLength);
        resetImageData()
      }
      return ;
    }

    if (! yplane) {
      yplane = data;
      if (yplane.byteLength === 20) {
        console.error('invalid image header ' + data.byteLength + ' ' + yplane.byteLength);
        resetImageData();
      }
      return ;
    }

    if (! uplane) {
      uplane = data;
      if (uplane.byteLength === 20) {
        console.error('invalid image header ' + data.byteLength + ' ' + yplane.byteLength + ' ' + uplane.byteLength);
        resetImageData();
      }
      return ;
    }

    if (! vplane) {
      vplane = data;
      if (yplane.byteLength != uplane.byteLength * 4
        || uplane.byteLength != vplane.byteLength
      ) {
        console.error('invalid image header ' + data.byteLength + ' ' + yplane.byteLength + ' ' + uplane.byteLength + ' ' + vplane.byteLength);
        resetImageData();
        return ;
      }

      var headerLength = 20;
      var dv = new DataView(header);
      var format = dv.getUint16(0);
      var width = dv.getUint16(2);
      var height = dv.getUint16(4);
      var left = dv.getUint16(6);
      var top = dv.getUint16(8);
      var right = dv.getUint16(10);
      var bottom = dv.getUint16(12);
      var rotation = dv.getUint16(14);
      var ts = dv.getUint32(16);

      var xWidth = width + left + right;
      var xHeight = height + top + bottom;
      var yLength = xWidth * xHeight;
      var yBegin = headerLength;
      var yEnd = yBegin + yLength;

      var uLength = yLength/4;
      var uBegin = yEnd;
      var uEnd = uBegin + uLength;

      var vLength = yLength/4;
      var vBegin = uEnd;
      var vEnd = vBegin + vLength;

      that.render.renderImage(
        {
          width: width
          , height: height
          , left: left
          , top: top
          , right: right
          , bottom: bottom
          , rotation: rotation
          , yplane: new Uint8Array(yplane)
          , uplane: new Uint8Array(uplane)
          , vplane: new Uint8Array(vplane)
        }
      );
      var now32 = (Date.now() & 0xFFFFFFFF) >>> 0;
      var latency = now32 - ts;
      if (latency > that.latency) {
        that.latency = latency;
      }

      resetImageData();
    }
  }

  that.setVideoProfile = function (profile) {
    if (typeof profile == 'string') {
      if (that.stream) {
        that.stream.postMessage({type: 'send', message: {
          command: 'setVideoProfile'
          , profile: profile
        }});
      } else {
        that.profile = profile;
      }
      return true;
    } else {
      return false;
    }
  }

  function resetImageData() {
    header = undefined;
    yplane = undefined;
    uplane = undefined;
    vplane = undefined;
  }

  // Private methods
  function getReso(w, h) {
    return {width: w, height: h};
  }

  var supportedVideoList = {
    'true': true,
    'unspecified': true,
    '120p': getReso(160, 120),
    '240p': getReso(320, 240),
    '360p': getReso(640, 360),
    '480p': getReso(640, 480),
    '720p': getReso(1280, 720),
    '1080p': getReso(1920, 1080),
    '4k': getReso(3840, 2160)
  };

  function onWorkerMessage(e) {
    var data = e.data;
    switch (data.type) {
      case 'init':
        that.oninit(data);
        break;
      case 'close':
        that.onclose(data);
        break;
      case 'error':
        that.onerror(data);
        break;
      case 'message':
        that.onmessage(data.data);
        break;
    };
  }

  return that;
};

AgoraRTC.createStream = function(spec) {
  return AgoraRTC.Stream(spec);
};

AgoraRTC.Client = function (spec) {
  "use strict";

  var that = AgoraRTC.EventDispatcher(spec);

  that.signal = undefined;
  that.localStream = undefined;
  that.remoteStreams = {};
  that.signalOpen = false;

  function onSignalError(e) {
    if (that.signalOpen) {
      console.log('signal connection lost.');
      AgoraCall(that.onFailure, {reason: 'LOST_CONNECTION_TO_AGENT', type:e.type, code:e.code});
      return ;
    }

    AgoraCall(that.onFailure, {
      reason: 'CLOSE_BEFORE_OPEN'
      , type: e.type
      , code: e.code
      , agentInstallUrl: getInstallUrl()
      , agentInstallGuideUrl: getInstallGuideUrl()
    });
  }

  that.init = function (vendorKey, onSuccess, onFailure) {
    spec.key = vendorKey;
    that.onFailure = onFailure;

    if (! that.signal) {
      try {
        that.signal = AgoraRTC.Signal({
          url: AgoraRTC.url
          , onFailure: onSignalError
        });
      } catch (e) {
        console.log('create signal connection failed' + e);
        AgoraCall(onFailure, e);
        return ;
      }

      that.signal.on('onopen',
        function (event) {
          that.signalOpen = true;

          that.signal.sendMessage({
            command: 'initialize'
            , key: spec.key
          }, function (err) {
            AgoraCall(onFailure, err);
          });
      });
    }

    if (that.signalOpen) {
      that.signal.sendMessage({
        command: 'initialize'
        , key: spec.key
      }, function (err) {
        AgoraCall(onFailure, err);
      });
    }

    function onError(code) {
      for (var k in L.ErrorCode) {
        if (L.ErrorCode.hasOwnProperty(k)) {
          if (L.ErrorCode[k] === code) {
            AgoraCall(onFailure, {reason: String(k)});
            return;
          }
        }
      }
      AgoraCall(onFailure, {reason: "UNKNOWN_ERROR", code: m.code});
      return;
    }

    that.signal.on('initialize',
      function (ev) {
        var m = ev.msg;
        if (m.code != true) {
          that.signal.close();
          that.signal = undefined;
          onError(m.code);
          return ;
        }
        AgoraCall(onSuccess, m);
    });

    that.signal.on('onError', function (ev) {
      var m = ev.msg;
      onError(m.code);
    });
    console.log(that.signal);
  };

  that.renewChannelDynamicKey = function (dynamicKey, onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'renewChannelDynamicKey'
      , key: dynamicKey
    }, function (e) {
      AgoraCall(onFailure, e);
    });

    that.signal.on('renewChannelDynamicKey', function (ev) {
      var m = ev.msg;
      if (m.code === true) {
        AgoraCall(onSuccess, m);
        return ;
      }

      AgoraCall(onFailure, m);
    });
  }

  that.join = function(dynamicKey, channel, uid, onSuccess, onFailure) {
    if (channel.length > 64) {
      onFailure(L.ErrorCode.INVALID_CHANNEL_NAME);
      return ;
    }
    that.signal.sendMessage({
      command: 'joinChannel'
      , key: dynamicKey
      , channel: channel
      , uid: uid
    }, function (e) {
      AgoraCall(onFailure, {error: e});
    });

    that.signal.on('joinChannel',
      function (ev) {
        that.signal.on('onAddVideoStream', onAddVideoStream);

        that.signal.on('onPeerLeave', onPeerLeave);

        var m = ev.msg;
        if (m.code == true) {
          if (! m.uid) {
            m.uid = 0;
          }
          AgoraCall(onSuccess, m.uid);
          return ;
        }

        if (m.code == L.ErrorCode.JOIN_CHANNEL_REJECTED) {
          console.error('Command joinChannel has been rejected by agent. Is this user joined a channel already?');
          AgoraCall(onFailure, m.code);
          return ;
        }

        AgoraCall(onFailure, m.code);
      }
    );
  };

  that.leave = function(onSuccess, onFailure) {
    closeLocalRemoteStreams();
    that.signal.sendMessage({
      command: 'leaveChannel'
    }, function (e) {
      console.log('leave channel failed', e);
    });

    that.signal.on('leaveChannel',
      function (ev) {
        var m = ev.msg;
        if (m.code === true) {
          AgoraCall(onSuccess, m);
          return ;
        }

        if (m.code == L.ErrorCode.LEAVE_CHANNEL_REJECTED) {
          console.error('Command leaveChannel has been rejected by agent. Is this user not in a channel?');
          AgoraCall(onSuccess, m);
          return ;
        }
        AgoraCall(onFailure, {code: m.code});
      }
    );
  };

  // It publishes the stream provided as argument.
  that.publish = function (stream, onSuccess, onFailure) {
    that.localStream = stream;
    that.signal.sendMessage({
      command: 'unmuteLocal'
    }, function (e) {
      AgoraCall(onFailure, {error: e});
    });

    that.signal.on('unmuteLocal',
      function (ev) {
        var m = ev.msg;
        if (m.code != true) {
          AgoraCall(onFailure, {code: m.code});
          return ;
        }

        AgoraCall(onSuccess, m);
      }
    );

    stream.bindClient(that);
  };

  // It unpublishes the local stream,
  that.unpublish = function (stream, onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'muteLocal'
    }, function (e) {
      AgoraCall(onFailure, {error: e});
    });

    that.signal.on('muteLocal',
      function (ev) {
        var m = ev.msg;
        if (m.code != true) {
          AgoraCall(onFailure, {code: m.code});
          return ;
        }

        AgoraCall(onSuccess, m);
      }
    );
  };

  // It subscribes to a remote stream and draws it inside the HTML tag given
  that.subscribe = function (stream, onFailure) {
    stream.init(function () {
      that.dispatchEvent(AgoraRTC.StreamEvent({type: 'stream-subscribed', stream: stream}));
    }, function (error) {
      AgoraCall(onFailure, error);
    });
  };

  // It unsubscribes from the stream, removing the HTML element
  that.unsubscribe = function (streamID, onFailure) {
    console.log("remote streams", that.remoteStreams);
    if (that.remoteStreams[streamID] == undefined) {
      AgoraCall(onFailure, {error: 'no such stream'});
      return ;
    }

    that.remoteStreams[streamID].close();
    delete that.remoteStreams[streamID];
  };

  that.enableAudio = function (stream, callback) {
    that.signal.on('enableAudio', function (ev) {
      var m = ev.msg;
      if (callback) {
        AgoraCall(callback, (m.code === true));
      }
    });
    that.signal.sendMessage({
      command: 'enableAudio'
      , streamID: stream.getId()
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(callback, e);
    });
    return true;
  };

  that.disableAudio = function (stream, callback) {
    that.signal.on('disableAudio', function (ev) {
      var m = ev.msg;
      if (callback) {
        AgoraCall(callback, (m.code === true));
      }
    });
    that.signal.sendMessage({
      command: 'disableAudio'
      , streamID: stream.getId()
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(callback, e);
    });
    return true;
  };

  that.enableVideo = function (stream, callback) {
    that.signal.on('enableVideo', function (ev) {
      var m = ev.msg;
      if (callback) {
        AgoraCall(callback, (m.code === true));
      }
    });
    that.signal.sendMessage({
      command: 'enableVideo'
      , streamID: stream.getId()
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(callback, e);
    });
    return true;
  };

  that.disableVideo = function (stream, callback) {
    that.signal.on('disableVideo', function (ev) {
      var m = ev.msg;
      if (callback) {
        AgoraCall(callback, (m.code === true));
      }
    });
    that.signal.sendMessage({
      command: 'disableVideo'
      , streamID: stream.getId()
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(callback, e);
    });
    return true;
  };

  that.getDevices = function (callback) {
    that.signal.sendMessage({
      command: 'getDevices'
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(callback, e);
    });
    that.signal.on('getDevices', function (ev) {
      var devices = ev.msg.devices;
      AgoraCall(callback, devices);
    })
  };

    that.selectDevice = function (device, onFailure) {
    that.signal.sendMessage({
      command: 'selectDevice'
      , device: device
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onFailure, e);
    });
    that.signal.on('selectDevice', function (ev) {
      console.log(ev);
    });
  };

  that.startRecording = function (key, onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'startRecording'
      , key: key
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onFailure, e);
    });

    that.signal.on('startRecording', function (ev) {
      var start = ev.msg;
      if (start.code === true) {
        AgoraCall(onSuccess, start);
      } else {
        AgoraCall(onFailure, start);
      }
    })
  };

  that.stopRecording = function (key, onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'stopRecording'
      , key: key
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onFailure, e);
    });

    that.signal.on('stopRecording', function (ev) {
      var stop = ev.msg;
      if (stop.code === true) {
        AgoraCall(onSuccess, stop);
      } else {
        AgoraCall(onFailure, stop);
      }
    });
  };

  that.queryRecordingStatus = function (onStatus) {
    that.signal.sendMessage({
      command: 'queryRecordingStatus'
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onStatus, e);
    });

    that.signal.on('queryRecordingStatus', function (ev) {
        onStatus(ev.msg);
      }
    );
  };

  that.close = function () {
    closeLocalRemoteStreams();
    if (that.signal) {
      that.signal.close();
      that.signal = undefined;
    }
  }

  that.getVersion = function (onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'getVersion'
    });
    that.signal.on('getVersion', function (ev) {
      var m = ev.msg;
      if (m.code === true) {
        onSuccess(m);
      } else {
        onFailure(m);
      }
    })
  }
  that.setParameters = function (parameters) {
    that.signal.sendMessage({
      command: 'setParameters'
      , parameters: JSON.stringify(parameters)
    });
  };
  that.setEncryptionSecret = function (secret) {
    that.signal.sendMessage({
      command: 'setEncryptionSecret'
      , secret: secret
    });
  };

    that.getWindows = function (callback) {
      that.signal.sendMessage({
        command: 'getWindows'
      }, function (e) {
        e.reason = 'CONNECTION_TO_AGENT_ERROR';
        AgoraCall(callback, e);
      });
      that.signal.on('getWindows', function (ev) {
        var windows = ev.msg.windows;
        AgoraCall(callback, windows);
      })
    };

    that.startScreenSharing = function (window, onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'startScreenSharing'
      , window: window
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onFailure, e);
    });
    that.signal.on('startScreenSharing', function (e) {
      AgoraCall(onSuccess, e);
    });
  };

    that.setScreenSharingWindow = function (window, onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'setScreenSharingWindow'
      , window: window
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onFailure, e);
    });
    that.signal.on('setScreenSharingWindow', function (e) {
      AgoraCall(onSuccess, e);
      console.log(e);
    });
  };

    that.stopScreenSharing = function (onSuccess, onFailure) {
    that.signal.sendMessage({
      command: 'stopScreenSharing'
    }, function (e) {
      e.reason = 'CONNECTION_TO_AGENT_ERROR';
      AgoraCall(onFailure, e);
    });
    that.signal.on('stopScreenSharing', function (e) {
      AgoraCall(onSuccess, e);
      console.log(e);
    });
  };

  function onPeerLeave(ev) {
    var m = ev.msg;
    if (that.remoteStreams.hasOwnProperty(m.uid)) {
        that.remoteStreams[m.uid].close();
        delete that.remoteStreams[m.uid];
        console.log("remote streams after peer leave ", that.remoteStreams);
    }

    that.dispatchEvent(AgoraRTC.ClientEvent({
      type: 'peer-leave'
      , uid: m.uid
    }))
  }

  function onAddVideoStream(ev) {
    var m = ev.msg;
    if (! that.remoteStreams.hasOwnProperty(m.uid)) {
      var stream = AgoraRTC.Stream({
        streamID: m.uid, local: false, audio: m.audio, video: m.video,
        screen: m.screen
      });
      stream.bindClient(that);
      that.remoteStreams[m.uid] = stream;
    }
    that.dispatchEvent(AgoraRTC.StreamEvent({type: 'stream-added', stream: that.remoteStreams[m.uid]}));
    console.log("remote streams", that.remoteStreams);
  }

  function getInstallUrl() {
    if (navigator.appVersion.indexOf("Mac")!=-1) {
      return AgoraRTC.macAgentInstallUrl;
    }

    return AgoraRTC.winAgentInstallUrl;
  }

  function getInstallGuideUrl() {
    var userLang = navigator.language || navigator.userLanguage;
    if (userLang.indexOf("zh") != -1) {
      return AgoraRTC.cnAgentInstallGuideUrl;
    }
    return AgoraRTC.enAgentInstallGuideUrl;
  }

  function closeLocalRemoteStreams() {
    if (that.localStream) {
      that.localStream.close();
    }
    that.localStream = undefined;

    for (var streamId in that.remoteStreams) {
      if (that.remoteStreams.hasOwnProperty(streamId)) {
          that.remoteStreams[streamId].close();
          delete that.remoteStreams[streamId];
      }
    }
  }

  return that;
};  // AgoraRTC.Client

AgoraRTC.createRtcClient = function() {
  return AgoraRTC.Client({});
};

/*
 * Copyright 2012, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of his
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else {
    // Browser globals
    var lib = factory.call(root);
    Object.keys(lib).forEach(function(key) {
      root[key] = lib[key];
    });
  }
}(this, function () {

  var topWindow = this;

  /** @module webgl-utils */

  /**
   * Wrapped logging function.
   * @param {string} msg The message to log.
   */
  function error(msg) {
    if (topWindow.console) {
      if (topWindow.console.error) {
        topWindow.console.error(msg);
      } else if (topWindow.console.log) {
        topWindow.console.log(msg);
      }
    }
  }

  /**
   * Check if the page is embedded.
   * @param {Window?) w window to check
   * @return {boolean} True of we are in an iframe
   */
  function isInIFrame(w) {
    w = w || topWindow;
    return w !== w.top;
  }

  /**
   * Creates the HTLM for a failure message
   * @param {string} canvasContainerId id of container of th
   *        canvas.
   * @return {string} The html.
   */
  function makeFailHTML(msg) {
    return '' +
      '<table style="background-color: #8CE; width: 100%; height: 100%;"><tr>' +
      '<td align="center">' +
      '<div style="display: table-cell; vertical-align: middle;">' +
      '<div style="">' + msg + '</div>' +
      '</div>' +
      '</td></tr></table>';
  }

  /**
   * Mesasge for getting a webgl browser
   * @type {string}
   */
  var GET_A_WEBGL_BROWSER = '' +
    'This page requires a browser that supports WebGL.<br/>' +
    '<a href="http://get.webgl.org">Click here to upgrade your browser.</a>';

  /**
   * Mesasge for need better hardware
   * @type {string}
   */
  var OTHER_PROBLEM = '' +
    "It doesn't appear your computer can support WebGL.<br/>" +
    '<a href="http://get.webgl.org/troubleshooting/">Click here for more information.</a>';

  /**
   * Creates a webgl context.
   * @param {HTMLCanvasElement} canvas The canvas tag to get
   *     context from. If one is not passed in one will be
   *     created.
   * @return {WebGLRenderingContext} The created context.
   */
  function create3DContext(canvas, opt_attribs) {
    var names = ["webgl", "experimental-webgl"];
    var context = null;
    for (var ii = 0; ii < names.length; ++ii) {
      try {
        context = canvas.getContext(names[ii], opt_attribs);
      } catch(e) {}  // eslint-disable-line
      if (context) {
        break;
      }
    }
    return context;
  }

  /**
   * Creates a webgl context. If creation fails it will
   * change the contents of the container of the <canvas>
   * tag to an error message with the correct links for WebGL.
   * @param {HTMLCanvasElement} canvas. The canvas element to
   *     create a context from.
   * @param {WebGLContextCreationAttirbutes} opt_attribs Any
   *     creation attributes you want to pass in.
   * @return {WebGLRenderingContext} The created context.
   * @memberOf module:webgl-utils
   */
  function setupWebGL(canvas, opt_attribs) {
    function showLink(str) {
      var container = canvas.parentNode;
      if (container) {
        container.innerHTML = makeFailHTML(str);
      }
    }

    if (!topWindow.WebGLRenderingContext) {
      showLink(GET_A_WEBGL_BROWSER);
      return null;
    }

    var context = create3DContext(canvas, opt_attribs);
    if (!context) {
      showLink(OTHER_PROBLEM);
    }
    return context;
  }

  function updateCSSIfInIFrame() {
    if (isInIFrame()) {
      document.body.className = "iframe";
    }
  }

  /**
   * @typedef {Object} GetWebGLContextOptions
   * @property {boolean} [dontResize] by default `getWebGLContext` will resize the canvas to match the size it's displayed.
   * @property {boolean} [noTitle] by default inserts a copy of the `<title>` content into the page
   * @memberOf module:webgl-utils
   */

  /**
   * Gets a WebGL context.
   * makes its backing store the size it is displayed.
   * @param {HTMLCanvasElement} canvas a canvas element.
   * @param {WebGLContextCreationAttirbutes} [opt_attribs] optional webgl context creation attributes
   * @param {module:webgl-utils.GetWebGLContextOptions} [opt_options] options
   * @memberOf module:webgl-utils
   */
  function getWebGLContext(canvas, opt_attribs, opt_options) {
    var options = opt_options || {};

    if (isInIFrame()) {
      updateCSSIfInIFrame();

      // make the canvas backing store the size it's displayed.
      if (!options.dontResize && options.resize !== false) {
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
      }
    } else if (!options.noTitle && options.title !== false) {
      var title = document.title;
      var h1 = document.createElement("h1");
      h1.innerText = title;
      document.body.insertBefore(h1, document.body.children[0]);
    }

    var gl = setupWebGL(canvas, opt_attribs);
    return gl;
  }

  /**
   * Error Callback
   * @callback ErrorCallback
   * @param {string} msg error message.
   * @memberOf module:webgl-utils
   */


  /**
   * Loads a shader.
   * @param {WebGLRenderingContext} gl The WebGLRenderingContext to use.
   * @param {string} shaderSource The shader source.
   * @param {number} shaderType The type of shader.
   * @param {module:webgl-utils.ErrorCallback} opt_errorCallback callback for errors.
   * @return {WebGLShader} The created shader.
   */
  function loadShader(gl, shaderSource, shaderType, opt_errorCallback) {
    var errFn = opt_errorCallback || error;
    // Create the shader object
    var shader = gl.createShader(shaderType);

    // Load the shader source
    gl.shaderSource(shader, shaderSource);

    // Compile the shader
    gl.compileShader(shader);

    // Check the compile status
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      // Something went wrong during compilation; get the error
      var lastError = gl.getShaderInfoLog(shader);
      errFn("*** Error compiling shader '" + shader + "':" + lastError);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Creates a program, attaches shaders, binds attrib locations, links the
   * program and calls useProgram.
   * @param {WebGLShader[]} shaders The shaders to attach
   * @param {string[]} [opt_attribs] An array of attribs names. Locations will be assigned by index if not passed in
   * @param {number[]} [opt_locations] The locations for the. A parallel array to opt_attribs letting you assign locations.
   * @param {module:webgl-utils.ErrorCallback} opt_errorCallback callback for errors. By default it just prints an error to the console
   *        on error. If you want something else pass an callback. It's passed an error message.
   * @memberOf module:webgl-utils
   */
  function createProgram(
      gl, shaders, opt_attribs, opt_locations, opt_errorCallback) {
    var errFn = opt_errorCallback || error;
    var program = gl.createProgram();
    shaders.forEach(function(shader) {
      gl.attachShader(program, shader);
    });
    if (opt_attribs) {
      obj_attrib.forEach(function(attrib, ndx) {
        gl.bindAttribLocation(
            program,
            opt_locations ? opt_locations[ndx] : ndx,
            attrib);
      });
    }
    gl.linkProgram(program);

    // Check the link status
    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        // something went wrong with the link
        var lastError = gl.getProgramInfoLog(program);
        errFn("Error in program linking:" + lastError);

        gl.deleteProgram(program);
        return null;
    }
    return program;
  }

  /**
   * Loads a shader from a script tag.
   * @param {WebGLRenderingContext} gl The WebGLRenderingContext to use.
   * @param {string} scriptId The id of the script tag.
   * @param {number} opt_shaderType The type of shader. If not passed in it will
   *     be derived from the type of the script tag.
   * @param {module:webgl-utils.ErrorCallback} opt_errorCallback callback for errors.
   * @return {WebGLShader} The created shader.
   */
  function createShaderFromScript(
      gl, scriptId, opt_shaderType, opt_errorCallback) {
    var shaderSource = "";
    var shaderType;
    var shaderScript = document.getElementById(scriptId);
    if (!shaderScript) {
      throw ("*** Error: unknown script element" + scriptId);
    }
    shaderSource = shaderScript.text;

    if (!opt_shaderType) {
      if (shaderScript.type === "x-shader/x-vertex") {
        shaderType = gl.VERTEX_SHADER;
      } else if (shaderScript.type === "x-shader/x-fragment") {
        shaderType = gl.FRAGMENT_SHADER;
      } else if (shaderType !== gl.VERTEX_SHADER && shaderType !== gl.FRAGMENT_SHADER) {
        throw ("*** Error: unknown shader type");
      }
    }

    return loadShader(
        gl, shaderSource, opt_shaderType ? opt_shaderType : shaderType,
        opt_errorCallback);
  }

  var defaultShaderType = [
    "VERTEX_SHADER",
    "FRAGMENT_SHADER",
  ];

  /**
   * Creates a program from 2 script tags.
   *
   * @param {WebGLRenderingContext} gl The WebGLRenderingContext
   *        to use.
   * @param {string[]} shaderScriptIds Array of ids of the script
   *        tags for the shaders. The first is assumed to be the
   *        vertex shader, the second the fragment shader.
   * @param {string[]} [opt_attribs] An array of attribs names. Locations will be assigned by index if not passed in
   * @param {number[]} [opt_locations] The locations for the. A parallel array to opt_attribs letting you assign locations.
   * @param {module:webgl-utils.ErrorCallback} opt_errorCallback callback for errors. By default it just prints an error to the console
   *        on error. If you want something else pass an callback. It's passed an error message.
   * @return {WebGLProgram} The created program.
   * @memberOf module:webgl-utils
   */
  function createProgramFromScripts(
      gl, shaderScriptIds, opt_attribs, opt_locations, opt_errorCallback) {
    var shaders = [];
    for (var ii = 0; ii < shaderScriptIds.length; ++ii) {
      shaders.push(createShaderFromScript(
          gl, shaderScriptIds[ii], gl[defaultShaderType[ii]], opt_errorCallback));
    }
    return createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback);
  }

  /**
   * Creates a program from 2 sources.
   *
   * @param {WebGLRenderingContext} gl The WebGLRenderingContext
   *        to use.
   * @param {string[]} shaderSourcess Array of sources for the
   *        shaders. The first is assumed to be the vertex shader,
   *        the second the fragment shader.
   * @param {string[]} [opt_attribs] An array of attribs names. Locations will be assigned by index if not passed in
   * @param {number[]} [opt_locations] The locations for the. A parallel array to opt_attribs letting you assign locations.
   * @param {module:webgl-utils.ErrorCallback} opt_errorCallback callback for errors. By default it just prints an error to the console
   *        on error. If you want something else pass an callback. It's passed an error message.
   * @return {WebGLProgram} The created program.
   * @memberOf module:webgl-utils
   */
  function createProgramFromSources(
      gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback) {
    var shaders = [];
    for (var ii = 0; ii < shaderSources.length; ++ii) {
      shaders.push(loadShader(
          gl, shaderSources[ii], gl[defaultShaderType[ii]], opt_errorCallback));
    }
    return createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback);
  }

  /**
   * Returns the corresponding bind point for a given sampler type
   */
  function getBindPointForSamplerType(gl, type) {
    if (type === gl.SAMPLER_2D)   return gl.TEXTURE_2D;        // eslint-disable-line
    if (type === gl.SAMPLER_CUBE) return gl.TEXTURE_CUBE_MAP;  // eslint-disable-line
  }

  /**
   * @typedef {Object.<string, function>} Setters
   */

  /**
   * Creates setter functions for all uniforms of a shader
   * program.
   *
   * @see {@link module:webgl-utils.setUniforms}
   *
   * @param {WebGLProgram} program the program to create setters for.
   * @returns {Object.<string, function>} an object with a setter by name for each uniform
   * @memberOf module:webgl-utils
   */
  function createUniformSetters(gl, program) {
    var textureUnit = 0;

    /**
     * Creates a setter for a uniform of the given program with it's
     * location embedded in the setter.
     * @param {WebGLProgram} program
     * @param {WebGLUniformInfo} uniformInfo
     * @returns {function} the created setter.
     */
    function createUniformSetter(program, uniformInfo) {
      var location = gl.getUniformLocation(program, uniformInfo.name);
      var type = uniformInfo.type;
      // Check if this uniform is an array
      var isArray = (uniformInfo.size > 1 && uniformInfo.name.substr(-3) === "[0]");
      if (type === gl.FLOAT && isArray) {
        return function(v) {
          gl.uniform1fv(location, v);
        };
      }
      if (type === gl.FLOAT) {
        return function(v) {
          gl.uniform1f(location, v);
        };
      }
      if (type === gl.FLOAT_VEC2) {
        return function(v) {
          gl.uniform2fv(location, v);
        };
      }
      if (type === gl.FLOAT_VEC3) {
        return function(v) {
          gl.uniform3fv(location, v);
        };
      }
      if (type === gl.FLOAT_VEC4) {
        return function(v) {
          gl.uniform4fv(location, v);
        };
      }
      if (type === gl.INT && isArray) {
        return function(v) {
          gl.uniform1iv(location, v);
        };
      }
      if (type === gl.INT) {
        return function(v) {
          gl.uniform1i(location, v);
        };
      }
      if (type === gl.INT_VEC2) {
        return function(v) {
          gl.uniform2iv(location, v);
        };
      }
      if (type === gl.INT_VEC3) {
        return function(v) {
          gl.uniform3iv(location, v);
        };
      }
      if (type === gl.INT_VEC4) {
        return function(v) {
          gl.uniform4iv(location, v);
        };
      }
      if (type === gl.BOOL) {
        return function(v) {
          gl.uniform1iv(location, v);
        };
      }
      if (type === gl.BOOL_VEC2) {
        return function(v) {
          gl.uniform2iv(location, v);
        };
      }
      if (type === gl.BOOL_VEC3) {
        return function(v) {
          gl.uniform3iv(location, v);
        };
      }
      if (type === gl.BOOL_VEC4) {
        return function(v) {
          gl.uniform4iv(location, v); }
        ;
      }
      if (type === gl.FLOAT_MAT2) {
        return function(v) {
          gl.uniformMatrix2fv(location, false, v);
        };
      }
      if (type === gl.FLOAT_MAT3) {
        return function(v) {
          gl.uniformMatrix3fv(location, false, v);
        };
      }
      if (type === gl.FLOAT_MAT4) {
        return function(v) {
          gl.uniformMatrix4fv(location, false, v);
        };
      }
      if ((type === gl.SAMPLER_2D || type === gl.SAMPLER_CUBE) && isArray) {
        var units = [];
        for (var ii = 0; ii < info.size; ++ii) {
          units.push(textureUnit++);
        }
        return function(bindPoint, units) {
          return function(textures) {
            gl.uniform1iv(location, units);
            textures.forEach(function(texture, index) {
              gl.activeTexture(gl.TEXTURE0 + units[index]);
              gl.bindTexture(bindPoint, texture);
            });
          };
        }(getBindPointForSamplerType(gl, type), units);
      }
      if (type === gl.SAMPLER_2D || type === gl.SAMPLER_CUBE) {
        return function(bindPoint, unit) {
          return function(texture) {
            gl.uniform1i(location, unit);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(bindPoint, texture);
          };
        }(getBindPointForSamplerType(gl, type), textureUnit++);
      }
      throw ("unknown type: 0x" + type.toString(16)); // we should never get here.
    }

    var uniformSetters = { };
    var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (var ii = 0; ii < numUniforms; ++ii) {
      var uniformInfo = gl.getActiveUniform(program, ii);
      if (!uniformInfo) {
        break;
      }
      var name = uniformInfo.name;
      // remove the array suffix.
      if (name.substr(-3) === "[0]") {
        name = name.substr(0, name.length - 3);
      }
      var setter = createUniformSetter(program, uniformInfo);
      uniformSetters[name] = setter;
    }
    return uniformSetters;
  }

  /**
   * Set uniforms and binds related textures.
   *
   * example:
   *
   *     var programInfo = createProgramInfo(
   *         gl, ["some-vs", "some-fs");
   *
   *     var tex1 = gl.createTexture();
   *     var tex2 = gl.createTexture();
   *
   *     ... assume we setup the textures with data ...
   *
   *     var uniforms = {
   *       u_someSampler: tex1,
   *       u_someOtherSampler: tex2,
   *       u_someColor: [1,0,0,1],
   *       u_somePosition: [0,1,1],
   *       u_someMatrix: [
   *         1,0,0,0,
   *         0,1,0,0,
   *         0,0,1,0,
   *         0,0,0,0,
   *       ],
   *     };
   *
   *     gl.useProgram(program);
   *
   * This will automatically bind the textures AND set the
   * uniforms.
   *
   *     setUniforms(programInfo.uniformSetters, uniforms);
   *
   * For the example above it is equivalent to
   *
   *     var texUnit = 0;
   *     gl.activeTexture(gl.TEXTURE0 + texUnit);
   *     gl.bindTexture(gl.TEXTURE_2D, tex1);
   *     gl.uniform1i(u_someSamplerLocation, texUnit++);
   *     gl.activeTexture(gl.TEXTURE0 + texUnit);
   *     gl.bindTexture(gl.TEXTURE_2D, tex2);
   *     gl.uniform1i(u_someSamplerLocation, texUnit++);
   *     gl.uniform4fv(u_someColorLocation, [1, 0, 0, 1]);
   *     gl.uniform3fv(u_somePositionLocation, [0, 1, 1]);
   *     gl.uniformMatrix4fv(u_someMatrix, false, [
   *         1,0,0,0,
   *         0,1,0,0,
   *         0,0,1,0,
   *         0,0,0,0,
   *       ]);
   *
   * Note it is perfectly reasonable to call `setUniforms` multiple times. For example
   *
   *     var uniforms = {
   *       u_someSampler: tex1,
   *       u_someOtherSampler: tex2,
   *     };
   *
   *     var moreUniforms {
   *       u_someColor: [1,0,0,1],
   *       u_somePosition: [0,1,1],
   *       u_someMatrix: [
   *         1,0,0,0,
   *         0,1,0,0,
   *         0,0,1,0,
   *         0,0,0,0,
   *       ],
   *     };
   *
   *     setUniforms(programInfo.uniformSetters, uniforms);
   *     setUniforms(programInfo.uniformSetters, moreUniforms);
   *
   * @param {Object.<string, function>} setters the setters returned from
   *        `createUniformSetters`.
   * @param {Object.<string, value>} an object with values for the
   *        uniforms.
   * @memberOf module:webgl-utils
   */
  function setUniforms(setters, values) {
    Object.keys(values).forEach(function(name) {
      var setter = setters[name];
      if (setter) {
        setter(values[name]);
      }
    });
  }

  /**
   * Creates setter functions for all attributes of a shader
   * program. You can pass this to {@link module:webgl-utils.setBuffersAndAttributes} to set all your buffers and attributes.
   *
   * @see {@link module:webgl-utils.setAttributes} for example
   * @param {WebGLProgram} program the program to create setters for.
   * @return {Object.<string, function>} an object with a setter for each attribute by name.
   * @memberOf module:webgl-utils
   */
  function createAttributeSetters(gl, program) {
    var attribSetters = {
    };

    function createAttribSetter(index) {
      return function(b) {
          gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
          gl.enableVertexAttribArray(index);
          gl.vertexAttribPointer(
              index, b.numComponents || b.size, b.type || gl.FLOAT, b.normalize || false, b.stride || 0, b.offset || 0);
        };
    }

    var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (var ii = 0; ii < numAttribs; ++ii) {
      var attribInfo = gl.getActiveAttrib(program, ii);
      if (!attribInfo) {
        break;
      }
      var index = gl.getAttribLocation(program, attribInfo.name);
      attribSetters[attribInfo.name] = createAttribSetter(index);
    }

    return attribSetters;
  }

  /**
   * Sets attributes and binds buffers (deprecated... use {@link module:webgl-utils.setBuffersAndAttributes})
   *
   * Example:
   *
   *     var program = createProgramFromScripts(
   *         gl, ["some-vs", "some-fs");
   *
   *     var attribSetters = createAttributeSetters(program);
   *
   *     var positionBuffer = gl.createBuffer();
   *     var texcoordBuffer = gl.createBuffer();
   *
   *     var attribs = {
   *       a_position: {buffer: positionBuffer, numComponents: 3},
   *       a_texcoord: {buffer: texcoordBuffer, numComponents: 2},
   *     };
   *
   *     gl.useProgram(program);
   *
   * This will automatically bind the buffers AND set the
   * attributes.
   *
   *     setAttributes(attribSetters, attribs);
   *
   * Properties of attribs. For each attrib you can add
   * properties:
   *
   * *   type: the type of data in the buffer. Default = gl.FLOAT
   * *   normalize: whether or not to normalize the data. Default = false
   * *   stride: the stride. Default = 0
   * *   offset: offset into the buffer. Default = 0
   *
   * For example if you had 3 value float positions, 2 value
   * float texcoord and 4 value uint8 colors you'd setup your
   * attribs like this
   *
   *     var attribs = {
   *       a_position: {buffer: positionBuffer, numComponents: 3},
   *       a_texcoord: {buffer: texcoordBuffer, numComponents: 2},
   *       a_color: {
   *         buffer: colorBuffer,
   *         numComponents: 4,
   *         type: gl.UNSIGNED_BYTE,
   *         normalize: true,
   *       },
   *     };
   *
   * @param {Object.<string, function>} setters Attribute setters as returned from createAttributeSetters
   * @param {Object.<string, module:webgl-utils.AttribInfo>} buffers AttribInfos mapped by attribute name.
   * @memberOf module:webgl-utils
   * @deprecated use {@link module:webgl-utils.setBuffersAndAttributes}
   */
  function setAttributes(setters, buffers) {
    Object.keys(buffers).forEach(function(name) {
      var setter = setters[name];
      if (setter) {
        setter(buffers[name]);
      }
    });
  }

  /**
   * @typedef {Object} ProgramInfo
   * @property {WebGLProgram} program A shader program
   * @property {Object<string, function>} uniformSetters: object of setters as returned from createUniformSetters,
   * @property {Object<string, function>} attribSetters: object of setters as returned from createAttribSetters,
   * @memberOf module:webgl-utils
   */

  /**
   * Creates a ProgramInfo from 2 sources.
   *
   * A ProgramInfo contains
   *
   *     programInfo = {
   *        program: WebGLProgram,
   *        uniformSetters: object of setters as returned from createUniformSetters,
   *        attribSetters: object of setters as returned from createAttribSetters,
   *     }
   *
   * @param {WebGLRenderingContext} gl The WebGLRenderingContext
   *        to use.
   * @param {string[]} shaderSourcess Array of sources for the
   *        shaders or ids. The first is assumed to be the vertex shader,
   *        the second the fragment shader.
   * @param {string[]} [opt_attribs] An array of attribs names. Locations will be assigned by index if not passed in
   * @param {number[]} [opt_locations] The locations for the. A parallel array to opt_attribs letting you assign locations.
   * @param {module:webgl-utils.ErrorCallback} opt_errorCallback callback for errors. By default it just prints an error to the console
   *        on error. If you want something else pass an callback. It's passed an error message.
   * @return {module:webgl-utils.ProgramInfo} The created program.
   * @memberOf module:webgl-utils
   */
  function createProgramInfo(
      gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback) {
    shaderSources = shaderSources.map(function(source) {
      var script = document.getElementById(source);
      return script ? script.text : source;
    });
    var program = createProgramFromSources(gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback);
    if (!program) {
      return null;
    }
    var uniformSetters = createUniformSetters(gl, program);
    var attribSetters = createAttributeSetters(gl, program);
    return {
      program: program,
      uniformSetters: uniformSetters,
      attribSetters: attribSetters,
    };
  }

  /**
   * Sets attributes and buffers including the `ELEMENT_ARRAY_BUFFER` if appropriate
   *
   * Example:
   *
   *     var programInfo = createProgramInfo(
   *         gl, ["some-vs", "some-fs");
   *
   *     var arrays = {
   *       position: { numComponents: 3, data: [0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0], },
   *       texcoord: { numComponents: 2, data: [0, 0, 0, 1, 1, 0, 1, 1],                 },
   *     };
   *
   *     var bufferInfo = createBufferInfoFromArrays(gl, arrays);
   *
   *     gl.useProgram(programInfo.program);
   *
   * This will automatically bind the buffers AND set the
   * attributes.
   *
   *     setBuffersAndAttributes(programInfo.attribSetters, bufferInfo);
   *
   * For the example above it is equivilent to
   *
   *     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
   *     gl.enableVertexAttribArray(a_positionLocation);
   *     gl.vertexAttribPointer(a_positionLocation, 3, gl.FLOAT, false, 0, 0);
   *     gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
   *     gl.enableVertexAttribArray(a_texcoordLocation);
   *     gl.vertexAttribPointer(a_texcoordLocation, 4, gl.FLOAT, false, 0, 0);
   *
   * @param {WebGLRenderingContext} gl A WebGLRenderingContext.
   * @param {Object.<string, function>} setters Attribute setters as returned from `createAttributeSetters`
   * @param {module:webgl-utils.BufferInfo} buffers a BufferInfo as returned from `createBufferInfoFromArrays`.
   * @memberOf module:webgl-utils
   */
  function setBuffersAndAttributes(gl, setters, buffers) {
    setAttributes(setters, buffers.attribs);
    if (buffers.indices) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    }
  }

  // Add your prefix here.
  var browserPrefixes = [
    "",
    "MOZ_",
    "OP_",
    "WEBKIT_",
  ];

  /**
   * Given an extension name like WEBGL_compressed_texture_s3tc
   * returns the supported version extension, like
   * WEBKIT_WEBGL_compressed_teture_s3tc
   * @param {string} name Name of extension to look for
   * @return {WebGLExtension} The extension or undefined if not
   *     found.
   * @memberOf module:webgl-utils
   */
  function getExtensionWithKnownPrefixes(gl, name) {
    for (var ii = 0; ii < browserPrefixes.length; ++ii) {
      var prefixedName = browserPrefixes[ii] + name;
      var ext = gl.getExtension(prefixedName);
      if (ext) {
        return ext;
      }
    }
  }

  /**
   * Resize a canvas to match the size its displayed.
   * @param {HTMLCanvasElement} canvas The canvas to resize.
   * @param {boolean} true if the canvas was resized.
   * @memberOf module:webgl-utils
   */
  function resizeCanvasToDisplaySize(canvas, multiplier) {
    multiplier = multiplier || 1;
    var width  = canvas.clientWidth  * multiplier;
    var height = canvas.clientHeight * multiplier;
    if (canvas.width !== width ||  canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  /**
   * Get's the iframe in the parent document
   * that is displaying the specified window .
   * @param {Window} window window to check.
   * @return {HTMLIFrameElement?) the iframe element if window is in an iframe
   */
  function getIFrameForWindow(window) {
    if (!isInIFrame(window)) {
      return;
    }
    var iframes = window.parent.document.getElementsByTagName("iframe");
    for (var ii = 0; ii < iframes.length; ++ii) {
      var iframe = iframes[ii];
      if (iframe.contentDocument === window.document) {
        return iframe;  // eslint-disable-line
      }
    }
  }

  /**
   * Returns true if window is on screen. The main window is
   * always on screen windows in iframes might not be.
   * @param {Window} window the window to check.
   * @return {boolean} true if window is on screen.
   */
  function isFrameVisible(window) {
    try {
      var iframe = getIFrameForWindow(window);
      if (!iframe) {
        return true;
      }

      var bounds = iframe.getBoundingClientRect();
      var isVisible = bounds.top < window.parent.innerHeight && bounds.bottom >= 0 &&
                      bounds.left < window.parent.innerWidth && bounds.right >= 0;

      return isVisible && isFrameVisible(window.parent);
    } catch (e) {
      return true;  // We got a security error?
    }
  }

  /**
   * Returns true if element is on screen.
   * @param {HTMLElement} element the element to check.
   * @return {boolean} true if element is on screen.
   */
  function isOnScreen(element) {
    var isVisible = true;

    if (element) {
      var bounds = element.getBoundingClientRect();
      isVisible = bounds.top < topWindow.innerHeight && bounds.bottom >= 0;
    }

    return isVisible && isFrameVisible(topWindow);
  }



  // Add `push` to a typed array. It just keeps a 'cursor'
  // and allows use to `push` values into the array so we
  // don't have to manually compute offsets
  function augmentTypedArray(typedArray, numComponents) {
    var cursor = 0;
    typedArray.push = function() {
      for (var ii = 0; ii < arguments.length; ++ii) {
        var value = arguments[ii];
        if (value instanceof Array || (value.buffer && value.buffer instanceof ArrayBuffer)) {
          for (var jj = 0; jj < value.length; ++jj) {
            typedArray[cursor++] = value[jj];
          }
        } else {
          typedArray[cursor++] = value;
        }
      }
    };
    typedArray.reset = function(opt_index) {
      cursor = opt_index || 0;
    };
    typedArray.numComponents = numComponents;
    Object.defineProperty(typedArray, 'numElements', {
      get: function() {
        return this.length / this.numComponents | 0;
      },
    });
    return typedArray;
  }

  /**
   * creates a typed array with a `push` function attached
   * so that you can easily *push* values.
   *
   * `push` can take multiple arguments. If an argument is an array each element
   * of the array will be added to the typed array.
   *
   * Example:
   *
   *     var array = createAugmentedTypedArray(3, 2);  // creates a Float32Array with 6 values
   *     array.push(1, 2, 3);
   *     array.push([4, 5, 6]);
   *     // array now contains [1, 2, 3, 4, 5, 6]
   *
   * Also has `numComponents` and `numElements` properties.
   *
   * @param {number} numComponents number of components
   * @param {number} numElements number of elements. The total size of the array will be `numComponents * numElements`.
   * @param {constructor} opt_type A constructor for the type. Default = `Float32Array`.
   * @return {ArrayBuffer} A typed array.
   * @memberOf module:webgl-utils
   */
  function createAugmentedTypedArray(numComponents, numElements, opt_type) {
    var Type = opt_type || Float32Array;
    return augmentTypedArray(new Type(numComponents * numElements), numComponents);
  }

  function createBufferFromTypedArray(gl, array, type, drawType) {
    type = type || gl.ARRAY_BUFFER;
    var buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, array, drawType || gl.STATIC_DRAW);
    return buffer;
  }

  function allButIndices(name) {
    return name !== "indices";
  }

  function createMapping(obj) {
    var mapping = {};
    Object.keys(obj).filter(allButIndices).forEach(function(key) {
      mapping["a_" + key] = key;
    });
    return mapping;
  }

  function getGLTypeForTypedArray(gl, typedArray) {
    if (typedArray instanceof Int8Array)    { return gl.BYTE; }            // eslint-disable-line
    if (typedArray instanceof Uint8Array)   { return gl.UNSIGNED_BYTE; }   // eslint-disable-line
    if (typedArray instanceof Int16Array)   { return gl.SHORT; }           // eslint-disable-line
    if (typedArray instanceof Uint16Array)  { return gl.UNSIGNED_SHORT; }  // eslint-disable-line
    if (typedArray instanceof Int32Array)   { return gl.INT; }             // eslint-disable-line
    if (typedArray instanceof Uint32Array)  { return gl.UNSIGNED_INT; }    // eslint-disable-line
    if (typedArray instanceof Float32Array) { return gl.FLOAT; }           // eslint-disable-line
    throw "unsupported typed array type";
  }

  // This is really just a guess. Though I can't really imagine using
  // anything else? Maybe for some compression?
  function getNormalizationForTypedArray(typedArray) {
    if (typedArray instanceof Int8Array)    { return true; }  // eslint-disable-line
    if (typedArray instanceof Uint8Array)   { return true; }  // eslint-disable-line
    return false;
  }

  function isArrayBuffer(a) {
    return a.buffer && a.buffer instanceof ArrayBuffer;
  }

  function guessNumComponentsFromName(name, length) {
    var numComponents;
    if (name.indexOf("coord") >= 0) {
      numComponents = 2;
    } else if (name.indexOf("color") >= 0) {
      numComponents = 4;
    } else {
      numComponents = 3;  // position, normals, indices ...
    }

    if (length % numComponents > 0) {
      throw "can not guess numComponents. You should specify it.";
    }

    return numComponents;
  }

  function makeTypedArray(array, name) {
    if (isArrayBuffer(array)) {
      return array;
    }

    if (Array.isArray(array)) {
      array = {
        data: array,
      };
    }

    if (!array.numComponents) {
      array.numComponents = guessNumComponentsFromName(name, array.length);
    }

    var type = array.type;
    if (!type) {
      if (name === "indices") {
        type = Uint16Array;
      }
    }
    var typedArray = createAugmentedTypedArray(array.numComponents, array.data.length / array.numComponents | 0, type);
    typedArray.push(array.data);
    return typedArray;
  }

  /**
   * @typedef {Object} AttribInfo
   * @property {number} [numComponents] the number of components for this attribute.
   * @property {number} [size] the number of components for this attribute.
   * @property {number} [type] the type of the attribute (eg. `gl.FLOAT`, `gl.UNSIGNED_BYTE`, etc...) Default = `gl.FLOAT`
   * @property {boolean} [normalized] whether or not to normalize the data. Default = false
   * @property {number} [offset] offset into buffer in bytes. Default = 0
   * @property {number} [stride] the stride in bytes per element. Default = 0
   * @property {WebGLBuffer} buffer the buffer that contains the data for this attribute
   * @memberOf module:webgl-utils
   */


  /**
   * Creates a set of attribute data and WebGLBuffers from set of arrays
   *
   * Given
   *
   *      var arrays = {
   *        position: { numComponents: 3, data: [0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0], },
   *        texcoord: { numComponents: 2, data: [0, 0, 0, 1, 1, 0, 1, 1],                 },
   *        normal:   { numComponents: 3, data: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],     },
   *        color:    { numComponents: 4, data: [255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 255, 255], type: Uint8Array, },
   *        indices:  { numComponents: 3, data: [0, 1, 2, 1, 2, 3],                       },
   *      };
   *
   * returns something like
   *
   *      var attribs = {
   *        a_position: { numComponents: 3, type: gl.FLOAT,         normalize: false, buffer: WebGLBuffer, },
   *        a_texcoord: { numComponents: 2, type: gl.FLOAT,         normalize: false, buffer: WebGLBuffer, },
   *        a_normal:   { numComponents: 3, type: gl.FLOAT,         normalize: false, buffer: WebGLBuffer, },
   *        a_color:    { numComponents: 4, type: gl.UNSIGNED_BYTE, normalize: true,  buffer: WebGLBuffer, },
   *      };
   *
   * @param {WebGLRenderingContext} gl The webgl rendering context.
   * @param {Object.<string, array|typedarray>} arrays The arrays
   * @param {Object.<string, string>} [opt_mapping] mapping from attribute name to array name.
   *     if not specified defaults to "a_name" -> "name".
   * @return {Object.<string, module:webgl-utils.AttribInfo>} the attribs
   * @memberOf module:webgl-utils
   */
  function createAttribsFromArrays(gl, arrays, opt_mapping) {
    var mapping = opt_mapping || createMapping(arrays);
    var attribs = {};
    Object.keys(mapping).forEach(function(attribName) {
      var bufferName = mapping[attribName];
      var array = makeTypedArray(arrays[bufferName], bufferName);
      attribs[attribName] = {
        buffer:        createBufferFromTypedArray(gl, array),
        numComponents: array.numComponents || guessNumComponentsFromName(bufferName),
        type:          getGLTypeForTypedArray(gl, array),
        normalize:     getNormalizationForTypedArray(array),
      };
    });
    return attribs;
  }

  /**
   * tries to get the number of elements from a set of arrays.
   */
  function getNumElementsFromNonIndexedArrays(arrays) {
    var key = Object.keys(arrays)[0];
    var array = arrays[key];
    if (isArrayBuffer(array)) {
      return array.numElements;
    } else {
      return array.data.length / array.numComponents;
    }
  }

  /**
   * @typedef {Object} BufferInfo
   * @property {number} numElements The number of elements to pass to `gl.drawArrays` or `gl.drawElements`.
   * @property {WebGLBuffer} [indices] The indices `ELEMENT_ARRAY_BUFFER` if any indices exist.
   * @property {Object.<string, module:webgl-utils.AttribInfo>} attribs The attribs approriate to call `setAttributes`
   * @memberOf module:webgl-utils
   */


  /**
   * Creates a BufferInfo from an object of arrays.
   *
   * This can be passed to {@link module:webgl-utils.setBuffersAndAttributes} and to
   * {@link module:webgl-utils:drawBufferInfo}.
   *
   * Given an object like
   *
   *     var arrays = {
   *       position: { numComponents: 3, data: [0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0], },
   *       texcoord: { numComponents: 2, data: [0, 0, 0, 1, 1, 0, 1, 1],                 },
   *       normal:   { numComponents: 3, data: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],     },
   *       indices:  { numComponents: 3, data: [0, 1, 2, 1, 2, 3],                       },
   *     };
   *
   *  Creates an BufferInfo like this
   *
   *     bufferInfo = {
   *       numElements: 4,        // or whatever the number of elements is
   *       indices: WebGLBuffer,  // this property will not exist if there are no indices
   *       attribs: {
   *         a_position: { buffer: WebGLBuffer, numComponents: 3, },
   *         a_normal:   { buffer: WebGLBuffer, numComponents: 3, },
   *         a_texcoord: { buffer: WebGLBuffer, numComponents: 2, },
   *       },
   *     };
   *
   *  The properties of arrays can be JavaScript arrays in which case the number of components
   *  will be guessed.
   *
   *     var arrays = {
   *        position: [0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0],
   *        texcoord: [0, 0, 0, 1, 1, 0, 1, 1],
   *        normal:   [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
   *        indices:  [0, 1, 2, 1, 2, 3],
   *     };
   *
   *  They can also by TypedArrays
   *
   *     var arrays = {
   *        position: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0]),
   *        texcoord: new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]),
   *        normal:   new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
   *        indices:  new Uint16Array([0, 1, 2, 1, 2, 3]),
   *     };
   *
   *  Or augmentedTypedArrays
   *
   *     var positions = createAugmentedTypedArray(3, 4);
   *     var texcoords = createAugmentedTypedArray(2, 4);
   *     var normals   = createAugmentedTypedArray(3, 4);
   *     var indices   = createAugmentedTypedArray(3, 2, Uint16Array);
   *
   *     positions.push([0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0]);
   *     texcoords.push([0, 0, 0, 1, 1, 0, 1, 1]);
   *     normals.push([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
   *     indices.push([0, 1, 2, 1, 2, 3]);
   *
   *     var arrays = {
   *        position: positions,
   *        texcoord: texcoords,
   *        normal:   normals,
   *        indices:  indices,
   *     };
   *
   * For the last example it is equivalent to
   *
   *     var bufferInfo = {
   *       attribs: {
   *         a_position: { numComponents: 3, buffer: gl.createBuffer(), },
   *         a_texcoods: { numComponents: 2, buffer: gl.createBuffer(), },
   *         a_normals: { numComponents: 3, buffer: gl.createBuffer(), },
   *       },
   *       indices: gl.createBuffer(),
   *       numElements: 6,
   *     };
   *
   *     gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.attribs.a_position.buffer);
   *     gl.bufferData(gl.ARRAY_BUFFER, arrays.position, gl.STATIC_DRAW);
   *     gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.attribs.a_texcoord.buffer);
   *     gl.bufferData(gl.ARRAY_BUFFER, arrays.texcoord, gl.STATIC_DRAW);
   *     gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.attribs.a_normal.buffer);
   *     gl.bufferData(gl.ARRAY_BUFFER, arrays.normal, gl.STATIC_DRAW);
   *     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferInfo.indices);
   *     gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrays.indices, gl.STATIC_DRAW);
   *
   * @param {WebGLRenderingContext} gl A WebGLRenderingContext
   * @param {Object.<string, array|object|typedarray>} arrays Your data
   * @param {Object.<string, string>} [opt_mapping] an optional mapping of attribute to array name.
   *    If not passed in it's assumed the array names will be mapped to an attibute
   *    of the same name with "a_" prefixed to it. An other words.
   *
   *        var arrays = {
   *           position: ...,
   *           texcoord: ...,
   *           normal:   ...,
   *           indices:  ...,
   *        };
   *
   *        bufferInfo = createBufferInfoFromArrays(gl, arrays);
   *
   *    Is the same as
   *
   *        var arrays = {
   *           position: ...,
   *           texcoord: ...,
   *           normal:   ...,
   *           indices:  ...,
   *        };
   *
   *        var mapping = {
   *          a_position: "position",
   *          a_texcoord: "texcoord",
   *          a_normal:   "normal",
   *        };
   *
   *        bufferInfo = createBufferInfoFromArrays(gl, arrays, mapping);
   *
   * @return {module:webgl-utils.BufferInfo} A BufferInfo
   * @memberOf module:webgl-utils
   */
  function createBufferInfoFromArrays(gl, arrays, opt_mapping) {
    var bufferInfo = {
      attribs: createAttribsFromArrays(gl, arrays, opt_mapping),
    };
    var indices = arrays.indices;
    if (indices) {
      indices = makeTypedArray(indices, "indices");
      bufferInfo.indices = createBufferFromTypedArray(gl, indices, gl.ELEMENT_ARRAY_BUFFER);
      bufferInfo.numElements = indices.length;
    } else {
      bufferInfo.numElements = getNumElementsFromNonIndexedArrays(arrays);
    }

    return bufferInfo;
  }

  /**
   * Creates buffers from typed arrays
   *
   * Given something like this
   *
   *     var arrays = {
   *        positions: [1, 2, 3],
   *        normals: [0, 0, 1],
   *     }
   *
   * returns something like
   *
   *     buffers = {
   *       positions: WebGLBuffer,
   *       normals: WebGLBuffer,
   *     }
   *
   * If the buffer is named 'indices' it will be made an ELEMENT_ARRAY_BUFFER.
   *
   * @param {WebGLRenderingContext) gl A WebGLRenderingContext.
   * @param {Object<string, array|typedarray>} arrays
   * @return {Object<string, WebGLBuffer>} returns an object with one WebGLBuffer per array
   * @memberOf module:webgl-utils
   */
  function createBuffersFromArrays(gl, arrays) {
    var buffers = { };
    Object.keys(arrays).forEach(function(key) {
      var type = key === "indices" ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
      var array = makeTypedArray(arrays[key], name);
      buffers[key] = createBufferFromTypedArray(gl, array, type);
    });

    // hrm
    if (arrays.indices) {
      buffers.numElements = arrays.indices.length;
    } else if (arrays.position) {
      buffers.numElements = arrays.position.length / 3;
    }

    return buffers;
  }

  /**
   * Calls `gl.drawElements` or `gl.drawArrays`, whichever is appropriate
   *
   * normally you'd call `gl.drawElements` or `gl.drawArrays` yourself
   * but calling this means if you switch from indexed data to non-indexed
   * data you don't have to remember to update your draw call.
   *
   * @param {WebGLRenderingContext} gl A WebGLRenderingContext
   * @param {enum} type eg (gl.TRIANGLES, gl.LINES, gl.POINTS, gl.TRIANGLE_STRIP, ...)
   * @param {module:webgl-utils.BufferInfo} bufferInfo as returned from createBufferInfoFromArrays
   * @param {number} [count] An optional count. Defaults to bufferInfo.numElements
   * @param {number} [offset] An optional offset. Defaults to 0.
   * @memberOf module:webgl-utils
   */
  function drawBufferInfo(gl, type, bufferInfo, count, offset) {
    var indices = bufferInfo.indices;
    var numElements = count === undefined ? bufferInfo.numElements : count;
    offset = offset === undefined ? offset : 0;
    if (indices) {
      gl.drawElements(type, numElements, gl.UNSIGNED_SHORT, offset);
    } else {
      gl.drawArrays(type, offset, numElements);
    }
  }

  /**
   * @typedef {Object} DrawObject
   * @property {module:webgl-utils.ProgramInfo} programInfo A ProgramInfo as returned from createProgramInfo
   * @property {module:webgl-utils.BufferInfo} bufferInfo A BufferInfo as returned from createBufferInfoFromArrays
   * @property {Object<string, ?>} uniforms The values for the uniforms
   * @memberOf module:webgl-utils
   */

  /**
   * Draws a list of objects
   * @param {WebGLRenderingContext} gl A WebGLRenderingContext
   * @param {DrawObject[]} objectsToDraw an array of objects to draw.
   * @memberOf module:webgl-utils
   */
  function drawObjectList(gl, objectsToDraw) {
    var lastUsedProgramInfo = null;
    var lastUsedBufferInfo = null;

    objectsToDraw.forEach(function(object) {
      var programInfo = object.programInfo;
      var bufferInfo = object.bufferInfo;
      var bindBuffers = false;

      if (programInfo !== lastUsedProgramInfo) {
        lastUsedProgramInfo = programInfo;
        gl.useProgram(programInfo.program);
        bindBuffers = true;
      }

      // Setup all the needed attributes.
      if (bindBuffers || bufferInfo !== lastUsedBufferInfo) {
        lastUsedBufferInfo = bufferInfo;
        setBuffersAndAttributes(gl, programInfo.attribSetters, bufferInfo);
      }

      // Set the uniforms.
      setUniforms(programInfo.uniformSetters, object.uniforms);

      // Draw
      drawBufferInfo(gl, gl.TRIANGLES, bufferInfo);
    });
  }

  return {
    createAugmentedTypedArray: createAugmentedTypedArray,
    createAttribsFromArrays: createAttribsFromArrays,
    createBuffersFromArrays: createBuffersFromArrays,
    createBufferInfoFromArrays: createBufferInfoFromArrays,
    createAttributeSetters: createAttributeSetters,
    createProgram: createProgram,
    createProgramFromScripts: createProgramFromScripts,
    createProgramFromSources: createProgramFromSources,
    createProgramInfo: createProgramInfo,
    createUniformSetters: createUniformSetters,
    drawBufferInfo: drawBufferInfo,
    drawObjectList: drawObjectList,
    getWebGLContext: getWebGLContext,
    updateCSSIfInIFrame: updateCSSIfInIFrame,
    getExtensionWithKnownPrefixes: getExtensionWithKnownPrefixes,
    resizeCanvasToDisplaySize: resizeCanvasToDisplaySize,
    setAttributes: setAttributes,
    setBuffersAndAttributes: setBuffersAndAttributes,
    setUniforms: setUniforms,
    setupWebGL: setupWebGL,
  };

}));
