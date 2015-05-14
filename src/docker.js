'use strict';
var Docker = require('dockerode');
var DockerEvents = require('docker-events');
var storage = require('./storage');
var slug = require('./slug');
var logger = require('./logger')('docker');

var docker = new Docker({
  socketPath: '/var/run/docker.sock'
});

var emitter = new DockerEvents({docker: docker});

exports.start = function start (cb) {
  storage.init(function (err) {
    if (err) {
      return cb && cb(err);
    }
    emitter.start();
    emitter.on('connect', function () {
      logger.log('Connected');
      cb && cb();
    });
    emitter.on('error', function (err) {
      logger.error(err);
      cb && cb(err);
    });
  });
};

exports.refresh = function refresh (cb) {
  storage.removeImages();
  docker.listContainers(function (err, containers) {
    if (err) {
      return cb && cb(err);
    }
    containers.forEach(function (info) {
      var msg = {id: info.Id, status: 'start'};
      syncContainer(msg);
    });
    cb && cb();
  });
};

emitter.on('start', function(message) {
  logger.log('container started:', message);
  syncContainer(message);
});

emitter.on('stop', function(message) {
  logger.log('container stopped:', message);
  syncContainer(message);
});

emitter.on('die', function(message) {
  logger.log('container died:', message);
  syncContainer(message);
});

emitter.on('destroy', function(message) {
  logger.log('container destroyed:', message);
  syncContainer(message);
});

function syncContainer (message) {
  if (message.status !== 'start') {
    storage.removeImage(message.id);
    return;
  }
  var container = docker.getContainer(message.id);

  container.inspect(function (err, data) {
    if (err) {
      return logger.error(err);
    }

    var config = getConfig(message, data);

    var hosts = getHosts(config);

    var services = getServices(config);

    var i;
    for (i = 0; i < hosts.length; i++) {
      storage.addVhost(hosts[i]);
    }
    for (i = 0; i < services.length; i++) {
      storage.addService(services[i]);
    }

  });
}

function getConfig (message, data) {
  var nameParts = data.Config.Image.split(':');
  var name = nameParts[0];
  var version = fixVersion(nameParts[1]) || 'latest';
  var env = data.Config.Env ? arrayToObject(parseEnvVars(data.Config.Env)) : {};

  return {
    id: message.id,
    ip: data.NetworkSettings.IPAddress,
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
