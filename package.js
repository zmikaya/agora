Package.describe({
  name: 'agora',
  version: '1.0.0',
  summary: 'This is a wrapper for the Agora.io Video Web SDK.',
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use('ecmascript');
  api.use('check', 'server');
  
  api.addFiles('./client/AgoraRtcAgentSDK-1.5.0.js', 'client');
  
  api.addFiles('./server/AgoraSignGenerator.js', 'server');
  api.addFiles('./server/methods.js', 'server');
  
  api.export('AgoraRTC', 'client');
  api.export('AgoraSignGenerator', 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
