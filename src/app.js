'use strict';
var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var storage = require('./storage');
var slug = require('./slug');
var nginx = require('./nginx');
var docker = require('./docker');
var logger = require('./logger')('app');
var env = process.env.NODE_ENV || 'development';
var app = express();

app.use(bodyParser.json({strict: false}));
app.use(morgan('development' === env ? 'dev' : 'combined'));

app.use(function (req, res, next) {
  var ip = getIp(req);
  // Only allow LAN, Localhost and Docker
  if (!/^(192\.168\.|127\.0\.0\.1|172\.1[67]\.)/.test(ip)) {
    logger.log('Blocked: ' + ip);
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
  body.ip = getOverridableIp(req);
  try {
    verifyFields(body, ['name', 'port', 'ip', 'version']);
  } catch (e) {
    return res.status(400).send({message: e.message});
  }
  body.slug = body.name;
  var data = {
    name: body.name,
    ip: body.ip,
    id: getId(body),
    version: body.version,
    port: body.port,
    manual: true
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
  body.ip = getOverridableIp(req);
  try {
    verifyFields(body, ['name', 'port', 'ip', 'version']);
  } catch (e) {
    return res.status(400).send({message: e.message});
  }
  body.slug = slug(body.name);
  var data = {
    name: body.name,
    ip: body.ip,
    id: getId(body),
    slug: body.slug,
    version: body.version,
    port: body.port,
    manual: true
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
  nginx.render(function (err, config) {
    if (err) {
      return res.status(500).send(err);
    }
    return res.status(200).send(config);
  });
});

app.put('/refresh', function (req, res) {
  docker.refresh();
  res.status(204).send();
});

module.exports = exports = app;

function verifyFields (body, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (!body[fields[i]]) {
      throw new Error('Missing `' + fields[i] + '`!');
    }
  }
}

function getId (ip, body) {
  var id = body.id || (body.ip + '_' + body.slug + '_' + body.port + '_' + body.version);
  return id;
}

function getOverridableIp (req) {
  return req.body.ip || getIp(req);
}

function getIp(req){
  return req.connection.remoteAddress;
}
