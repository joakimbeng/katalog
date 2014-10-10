var Docker = require('dockerode');
var DockerEvents = require('docker-events');
var util = require('util');
var storage = require('./storage');
var slug = require('./slug');

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
    return cb && cb();
  });
};

emitter.on('connect', function () {
  log('Connected');
});

emitter.on("start", function(message) {
  log("container started:", message);
  syncContainers(message);
});

emitter.on("stop", function(message) {
  log("container stopped:", message);
  syncContainers(message);
});

emitter.on("die", function(message) {
  log("container died:", message);
  syncContainers(message);
});

emitter.on("destroy", function(message) {
  log("container destroyed:", message);
  syncContainers(message);
});

function syncContainers (message) {
  if (message.status !== 'start') {
    storage.removeImage(message.id);
    return;
  }
  var container = docker.getContainer(message.id);

  container.inspect(function (err, data) {
    if (err) {
      return error(err);
    }

    var defaultPort = getDefaultPort(data.Config.ExposedPorts);
    var ip = data.NetworkSettings.IPAddress;
    var env = arrayToObject(parseEnvVars(data.Config.Env));
    var nameParts = data.Config.Image.split(':');
    var name = nameParts[0];
    var version = fixVersion(nameParts[1]) || 'latest';

    var hosts = (env.KATALOG_VHOSTS || []);
    if (data.Config.Hostname && data.Config.Domainname) {
      hosts.push({name: data.Config.Hostname + '.' + data.Config.Domainname});
    }
    hosts = hosts.map(function (host) {
      host.id = message.id;
      host.slug = slug(host.name);
      host.image = name;
      host.version = version;
      host.ip = ip;
      host.port = host.port || defaultPort;
      return host;
    });

    var services = (env.KATALOG_SERVICES || []);
    services = services.map(function (service) {
      service.id = message.id;
      service.image = name;
      service.version = version;
      service.ip = ip;
      service.port = service.port || defaultPort;
      return service;
    });

    for (var i = 0; i < hosts.length; i++) {
      storage.addVhost(hosts[i]);
    }
    for (var i = 0; i < services.length; i++) {
      storage.addService(services[i]);
    }

  });
}

function indexBy (arr, prop) {
  var result = {};
  for (var i = 0; i < arr.length; i++) {
    if (!result[arr[i][prop]]) {
      result[arr[i][prop]] = arr[i];
    }
  }
  return result;
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
    var values = parts[1].split(',').map(getNameAndPort);
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
  return version + Array(3 - (version.length - withoutDots.length)).join('.0');
}

function log () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[docker]');
  console.log.apply(console, args);
}

function error () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[docker]');
  console.error.apply(console, args);
}
