'use strict';
var fs = require('fs');
var path = require('path');
var util = require('util');
var semver = require('semver');
var logger = require('./logger')('storage');

var LOCATION = path.join(__dirname, '..', 'data', 'storage.json');

var storage = null;
var listeners = {persist: []};

exports.get = function get () {
  return storage;
};

exports.setValue = function setValue (key, value) {
  if (!storage.keys) {
    storage.keys = {};
  }
  storage.keys[key] = value;
  exports.persist();
};

exports.addVhost = function addVhost (host) {
  if (!storage.vhosts) {
    storage.vhosts = {};
  }
  if (!storage.vhosts[host.slug]) {
    storage.vhosts[host.slug] = [];
  }
  var i = containerIndexInArray(storage.vhosts[host.name], host.id);
  if (i < 0) {
    storage.vhosts[host.slug].push(host);
  } else {
    storage.vhosts[host.slug][i] = host;
  }
  exports.persist();
};

exports.addService = function addService (service) {
  if (!storage.services) {
    storage.services = {};
  }
  if (!storage.services[service.name]) {
    storage.services[service.name] = [];
  }
  var i = containerIndexInArray(storage.services[service.name], service.id);
  if (i < 0) {
    storage.services[service.name].push(service);
  } else {
    storage.services[service.name][i] = service;
  }
  exports.persist();
};

exports.getValue = function getValue (key) {
  return (storage.keys || {})[key];
};

exports.getValues = function getValues () {
  return (storage.keys || {});
};

exports.getServices = function getServices (all) {
  if (!storage.services) {
    return {};
  }
  if (!!all) {
    return storage.services;
  }
  return Object.keys(storage.services).reduce(function (obj, name) {
    if (!storage.services[name]) {
      return obj;
    }
    var maxVersion = getMaxVersion(storage.services[name]);
    obj[name] = storage.services[name].filter(function (service) {
      return service.version === maxVersion;
    });
    return obj;
  }, {});
};

exports.getVhosts = function getVhosts (all) {
  if (!storage.vhosts) {
    return {};
  }
  if (!!all) {
    return storage.vhosts;
  }
  return Object.keys(storage.vhosts).reduce(function (obj, name) {
    if (!storage.vhosts[name]) {
      return obj;
    }
    var maxVersion = getMaxVersion(storage.vhosts[name]);
    obj[name] = storage.vhosts[name].filter(function (service) {
      return service.version === maxVersion;
    });
    return obj;
  }, {});
};

function getMaxVersion (services) {
  return services.reduce(function (max, curr) {
    return !max || curr.version === 'latest' || semver.gt(curr.version, max) ? curr.version : max;
  }, null);
}

exports.removeImages = function removeNonManualImages () {
  removeImages(function (container) {
    return !container.manual;
  });
};

exports.removeImage = function removeImage (id) {
  removeImages(function (container) {
    return container.id === id;
  });
};

function removeImages (filter) {
  var hasChanged = false;
  hasChanged = removeServices(filter) || hasChanged;
  hasChanged = removeVhosts(filter) || hasChanged;
  if (hasChanged) {
    exports.persist();
  }
}

function removeServices (filter) {
  var hasRemoved = false;
  if (storage.services) {
    Object.keys(storage.services).forEach(function (name) {
      if (!storage.services[name]) {
        return;
      }
      hasRemoved = removeService(name, filter) || hasRemoved;
      if (!storage.services[name].length) {
        storage.services[name] = undefined;
      }
    });
  }
  return hasRemoved;
}

function removeService (name, filter) {
  var hasRemoved = false;
  for (var i = 0; i < storage.services[name].length; i++) {
    if (filter(storage.services[name][i])) {
      hasRemoved = true;
      storage.services[name].splice(i, 1);
    }
  }
  return hasRemoved;
}

function removeVhosts (filter) {
  var hasRemoved = false;
  if (storage.vhosts) {
    Object.keys(storage.vhosts).forEach(function (name) {
      if (!storage.vhosts[name]) {
        return;
      }
      hasRemoved = removeVhost(name, filter) || hasRemoved;
      if (!storage.vhosts[name].length) {
        storage.vhosts[name] = undefined;
      }
    });
  }
  return hasRemoved;
}

function removeVhost (name, filter) {
  var hasRemoved = false;
  for (var i = 0; i < storage.vhosts[name].length; i++) {
    if (filter(storage.vhosts[name][i])) {
      hasRemoved = true;
      storage.vhosts[name].splice(i, 1);
    }
  }
  return hasRemoved;
}

exports.save = function save (storage, cb) {
  var data = JSON.stringify(storage || {});
  fs.writeFile(LOCATION, data, 'utf8', function (err) {
    cb(err);
  });
};

exports.load = function load (cb) {
  fs.exists(LOCATION, function (exists) {
    if (!exists) {
      return cb(null, {});
    }
    fs.readFile(LOCATION, 'utf8', function (err, data) {
      if (err) {
        return cb(err);
      }
      try {
        data = JSON.parse(data || '{}');
      } catch (e) {
      }
      cb(null, data);
    });
  });
};

exports.onPersist = function onPersist (listener) {
  listeners.persist.push(listener);
};

exports.persist = function persist (cb) {
  printStorage();

  trigger('persist');

  exports.save(storage, function (err) {
    if (err) {
      console.error(err);
    }
    cb && cb(err);
  });
};

exports.init = function init (cb) {
  exports.load(function (err, data) {
    storage = data;
    printStorage();
    cb && cb(err);
  });
};

function printStorage () {
  logger.log('vhosts', toJsonString(storage.vhosts));
  logger.log('services', toJsonString(storage.services));
}

function toJsonString (data) {
  data = data || {};
  if ('production' !== process.env.NODE_ENV) {
    return util.inspect.call(util, data, {colors: true, depth: 10});
  }
  return JSON.stringify(data);
}

function trigger (evt) {
  listeners[evt].forEach(function (listener) {
    setTimeout(function () {
      listener();
    }, 0);
  });
}

function containerIndexInArray (arr, containerId) {
  arr = arr || [];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === containerId) {
      return i;
    }
  }
  return -1;
}
