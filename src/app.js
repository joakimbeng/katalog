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
  if (!/^(::ffff:)?(192\.168\.|127\.0\.0\.1|172\.1[67]\.)/.test(ip)) {
    logger.log('Blocked: ' + ip);
    return res.sendStatus(403);
  }
  next();
});

app.use(function (req, res, next) {
  // Adding `sendJson` function to response
  // with the ability to pretty-print the json data
  // if query param `pretty` is provided
  var pretty = typeof req.query.pretty !== 'undefined';
  res.sendJson = function sendJson (status, json) {
    if (json) {
      res.type('json');
      res.status(status).send(JSON.stringify(json, null, pretty ? 2 : null));
    } else {
      res.sendStatus(status);
    }
  };
  next();
});

app.set('port', process.env.PORT || 5005);

app.get('/value', function (req, res) {
  return res.sendJson(200, storage.getValues());
});

app.get('/value/:key', function (req, res) {
  var val = storage.getValue(req.params.key);
  if (typeof val === 'undefined') {
    return res.sendStatus(204);
  }
  return res.sendJson(200, val);
});

app.post('/value/:key', function (req, res) {
  var val = req.body;
  storage.setValue(req.params.key, val);
  return res.sendStatus(204);
});

app.get('/service/:name', function (req, res) {
  var services = storage.getServices(req.query.all);
  var name = req.params.name;
  if (!services || !services[name]) {
    return res.sendStatus(404);
  }
  return res.sendJson(200, services[name]);
});

app.post('/service', function (req, res) {
  var body = req.body;
  body.ip = getOverridableIp(req);
  try {
    verifyFields(body, ['name', 'port', 'ip', 'version']);
  } catch (e) {
    return res.sendJson(400, {message: e.message});
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
  res.sendJson(200, data);
});

app.delete('/service/:id', function (req, res) {
  var id = req.params.id;
  storage.removeImage(id);
  res.sendStatus(204);
});

app.delete('/vhost/:id', function (req, res) {
  var id = req.params.id;
  storage.removeImage(id);
  res.sendStatus(204);
});

app.get('/service', function (req, res) {
  var services = storage.getServices(req.query.all);
  if (!services) {
    return res.sendStatus(404);
  }
  return res.sendJson(200, services);
});

app.post('/vhost', function (req, res) {
  var body = req.body;
  body.ip = getOverridableIp(req);
  try {
    verifyFields(body, ['name', 'port', 'ip', 'version']);
  } catch (e) {
    return res.sendJson(400, {message: e.message});
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
  res.sendJson(200, data);
});

app.get('/vhost', function (req, res) {
  var vhosts = storage.getVhosts(req.query.all);
  if (!vhosts) {
    return res.sendStatus(404);
  }
  return res.sendJson(200, vhosts);
});

app.get('/nginx', function (req, res) {
  nginx.render(function (err, config) {
    if (err) {
      return res.status(500).send(err);
    }
    return res.sendJson(200, config);
  });
});

app.put('/refresh', function (req, res) {
  docker.refresh();
  res.sendStatus(204);
});

module.exports = exports = app;

function verifyFields (body, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (!body[fields[i]]) {
      throw new Error('Missing `' + fields[i] + '`!');
    }
  }
}

function getId (body) {
  var id = body.id || (body.ip + '_' + body.slug + '_' + body.port + '_' + body.version);
  return id;
}

function getOverridableIp (req) {
  return req.body.ip || getIp(req);
}

function getIp(req){
  return req.connection.remoteAddress;
}
