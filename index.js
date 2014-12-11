'use strict';
var http = require('http');
var app = require('./src/app');
var docker = require('./src/docker');
var pkg = require('./package')
var logger = require('./src/logger')('katalog');

docker.start(function () {
  docker.refresh(function (err) {
    if (err) {
      logger.error(err);
      logger.error('Could not run at all!');
      logger.error('Have you shared /var/run/docker.sock with the contanier?');
      process.exit(1);
    }
  });
});

var server = http.createServer(app);

server.listen(app.get('port'), function () {
  logger.log('API v' + pkg.version + ' listening on: ' + app.get('port'));
});
