var express = require('express');
var mustache = require('mustache');
var fs = require('fs');
var path = require('path');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var storage = require('./storage');
var slug = require('./slug');
var env = process.env.NODE_ENV || 'development';
var app = express();

app.use(bodyParser.json({strict: false}));
app.use(morgan('development' === env ? 'dev' : 'combined'));

app.use(function (req, res, next) {
  var ip = getIp(req);
  // Only allow LAN, Localhost and Docker
  if (!/^(192\.168\.|127\.0\.0\.1|172\.1[67]\.)/.test(ip)) {
    log('Blocked: ' + ip);
    return res.status(403).send();
  }
  next();
});

app.set('port', process.env.PORT || 5005);

app.get('/value', function (req, res) {
  return res.status(200).send(storage.getValues());
});

app.get('/value/:key', function (req, res) {
  var val = storage.getValue(req.params.key);
  if (typeof val === 'undefined') {
    return res.status(204).send();
  }
  return res.status(200).send(val);
});

app.post('/value/:key', function (req, res) {
  var val = req.body;
  storage.setValue(req.params.key, val);
  return res.status(204).send();
});

app.get('/service/:name', function (req, res) {
  var services = storage.getServices(req.query.all);
  var name = req.params.name;
  if (!services || !services[name]) {
    return res.status(404).send();
  }
  return res.status(200).send(services[name]);
});

app.post('/service', function (req, res) {
  var body = req.body;
  if (!body.name) {
    return res.status(400).send({message: 'Missing `name`!'});
  }
  if (!body.port) {
    return res.status(400).send({message: 'Missing `port`!'});
  }
  var ip = body.ip || getIp(req);
  if (!ip) {
    return res.status(400).send({message: 'Missing `ip`!'});
  }
  if (!body.version) {
    return res.status(400).send({message: 'Missing `version`!'});
  }
  var id = body.id || (ip + '_' + body.name + '_' + body.port + '_' + body.version);
  var data = {
    name: body.name,
    ip: ip,
    id: id,
    version: body.version,
    port: body.port
  };
  storage.addService(data);
  res.status(200).send(data);
});

app.delete('/service/:id', function (req, res) {
  var id = req.params.id;
  storage.removeImage(id);
  res.status(204).send();
});

app.delete('/vhost/:id', function (req, res) {
  var id = req.params.id;
  storage.removeImage(id);
  res.status(204).send();
});

app.get('/service', function (req, res) {
  var services = storage.getServices(req.query.all);
  if (!services) {
    return res.status(404).send();
  }
  return res.status(200).send(services);
});

app.post('/vhost', function (req, res) {
  var body = req.body;
  if (!body.name) {
    return res.status(400).send({message: 'Missing `name`!'});
  }
  if (!body.port) {
    return res.status(400).send({message: 'Missing `port`!'});
  }
  var ip = body.ip || getIp(req);
  if (!ip) {
    return res.status(400).send({message: 'Missing `ip`!'});
  }
  if (!body.version) {
    return res.status(400).send({message: 'Missing `version`!'});
  }
  var slugName = slug(body.name);
  var id = body.id || (ip + '_' + slugName + '_' + body.port + '_' + body.version);
  var data = {
    name: body.name,
    ip: ip,
    id: id,
    slug: slugName,
    version: body.version,
    port: body.port
  };
  storage.addVhost(data);
  res.status(200).send(data);
});

app.get('/vhost', function (req, res) {
  var vhosts = storage.getVhosts(req.query.all);
  if (!vhosts) {
    return res.status(404).send();
  }
  return res.status(200).send(vhosts);
});

app.get('/nginx', function (req, res) {
  var vhosts = storage.getVhosts() || {};

  var data = {vhosts: []};

  data.vhosts = Object.keys(vhosts).map(function (slug) {
    return {slug: slug, host: vhosts[slug][0].name, servers: vhosts[slug]};
  });

  fs.readFile(path.join(__dirname, '..', 'tpl', 'nginx.mustache'), 'utf8', function (err, content) {
    if (err) {
      return res.status(500).send(err);
    }
    return res.status(200).send(mustache.render(content, data));
  });
});

module.exports = exports = app;

function getIp(req){
  return req.connection.remoteAddress;
}

function log () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[app]');
  console.log.apply(console, args);
}
