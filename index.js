var http = require('http');
var app = require('./src/app');
var docker = require('./src/docker');
var pkg = require('./package');

docker.start();

var server = http.createServer(app);

server.listen(app.get('port'), function () {
  console.log('[katalog]', 'API v' + pkg.version + ' listening on: ' + app.get('port'));
});
