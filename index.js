var http = require('http');
var app = require('./src/app');
var docker = require('./src/docker');

docker.start();

var server = http.createServer(app);

server.listen(app.get('port'), function () {
  console.log('[katalog]', 'API listening on: ' + app.get('port'));
});
