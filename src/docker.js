'use strict';
var dockerEventStream = require('docker-event-stream');
var Docker = require('dockerode');
var pify = require('pify');
var storage = require('./storage');
var slug = require('./slug');
var logger = require('./logger')('docker');

var UNIMPORTANT_EVENTS = ['resize', 'create', 'attach'];

var docker;
var listContainers;

exports.start = function start () {
  return new Promise((resolve, reject) => {
    storage.init(function () {
      dockerEventStream((err, stream) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }

        docker = new Docker();
        listContainers = pify(docker.listContainers).bind(docker);

        stream.on('data', e => {
          if (!e.status) {
            return;
          }
          logger.log(`${e.status} container`, e);
          syncContainer(e).catch(err => logger.error(err.stack || err));
        });
        resolve();
      })
      .on('connection', function () {
        logger.log('Connected');
      })
      .on('reconnect', function (n, delay) {
        logger.log(`Reconnecting #${n} with delay: ${delay}`);
      })
      .on('disconnect', function (err) {
        if (err) {
          logger.error('Disconnected', err.stack || err);
        } else {
          logger.log('Disconnected');
        }
      });
    });
  });
};

exports.refresh = function refresh () {
  return storage.removeImages()
    .then(() => listContainers())
    .then(containers => {
      return Promise.all(containers.map(function (info) {
        var msg = {id: info.Id, status: 'start'};
        return syncContainer(msg);
      }));
    });
};

function syncContainer (message) {
  if (UNIMPORTANT_EVENTS.includes(message.status)) {
    return Promise.resolve();
  }
  if (message.status !== 'start') {
    return storage.removeImage(message.id);
  }
  var container = docker.getContainer(message.id);

  var inspect = pify(container.inspect).bind(container);

  return inspect()
    .then(data => {
      var config = getConfig(message, data);

      var hosts = getHosts(config);

      var services = getServices(config);

      return Promise.all(
        []
        .concat(hosts.map(host => storage.addVhost(host)))
        .concat(services.map(service => storage.addService(service)))
      );
    });
}

function getConfig (message, data) {
  var nameParts = data.Config.Image.split(':');
  var name = nameParts[0];
  var version = fixVersion(nameParts[1]) || 'latest';
  var env = data.Config.Env ? arrayToObject(parseEnvVars(data.Config.Env)) : {};
  var firstNet = data.NetworkSettings.Networks && Object.keys(data.NetworkSettings.Networks)[0]

  return {
    id: message.id,
    ip: data.NetworkSettings.IPAddress || data.NetworkSettings.Networks[firstNet].IPAddress,
    name: name,
    version: version,
    env: env,
    hostname: data.Config.Hostname,
    domainname: data.Config.Domainname,
    defaultPort: getDefaultPort(data.Config.ExposedPorts)
  };
}

function getHosts (config) {
  var hosts = (config.env.KATALOG_VHOSTS || []);
  if (config.hostname && config.domainname) {
    hosts.push({name: config.hostname + '.' + config.domainname});
  }
  hosts = hosts.map(function (host) {
    host.id = config.id;
    host.slug = slug(host.name); // Slug for full URL
    var pathParts = host.name.split('/');
    host.path = '/' + pathParts.slice(1).join('/'); // Only path part
    host.name = pathParts[0]; // Only domain part
    host.image = config.name;
    host.version = config.version;
    host.ip = config.ip;
    host.port = host.port || config.defaultPort;
    return host;
  });
  return hosts;
}

function getServices (config) {
  var services = (config.env.KATALOG_SERVICES || []);
  services = services.map(function (service) {
    service.id = config.id;
    service.image = config.name;
    service.version = config.version;
    service.ip = config.ip;
    service.port = service.port || config.defaultPort;
    return service;
  });
  return services;
}

function getDefaultPort (exposedPorts) {
  if (!exposedPorts) {
    return '80';
  }
  return Object.keys(exposedPorts).map(function (key) {
    var parts = key.split('/');
    return +parts[0];
  }).reduce(function (min, port) {
    return min === null || port < min ? port : min;
  }, null).toString();
}

function parseEnvVars (env) {
  return env.map(function (e) {
    var parts = e.split('=');
    var values = parts[1] ? parts[1].split(',').map(getNameAndPort) : null;
    return {key: parts[0], values: values};
  });
}

function getNameAndPort (value) {
  var parts = value.split(':');
  return {name: parts[0], port: parts[1]};
}

function arrayToObject (arr) {
  return arr.reduce(function (obj, item) {
    obj[item.key] = item.values;
    return obj;
  }, {});
}

function fixVersion (version) {
  if (!version) {
    return;
  }
  var withoutDots = version.replace(/\./g, '');
  return version + new Array(3 - (version.length - withoutDots.length)).join('.0');
}
