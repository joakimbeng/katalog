var fs = require('fs');
var path = require('path');
var util = require('util');
var semver = require('semver');

var LOCATION = path.join(__dirname, '..', 'data', 'storage.json');

var storage = null;

exports.get = function get () {
  return storage;
};

exports.addVhost = function addVhost (host) {
  if (!storage.vhosts) {
    storage.vhosts = {};
  }
  if (!storage.vhosts[host.slug]) {
    storage.vhosts[host.slug] = [];
  }
  storage.vhosts[host.slug].push(host);
  exports.persist();
};

exports.addService = function addService (service) {
  if (!storage.services) {
    storage.services = {};
  }
  if (!storage.services[service.name]) {
    storage.services[service.name] = [];
  }
  storage.services[service.name].push(service);
  exports.persist();
};

exports.getServices = function getServices (all) {
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

exports.removeImage = function removeImage (id) {
  if (storage.services) {
    Object.keys(storage.services).forEach(function (name) {
      if (!storage.services[name]) {
        return;
      }
      for (var i = 0; i < storage.services[name].length; i++) {
        if (storage.services[name][i].id === id) {
          storage.services[name].splice(i, 1);
        }
      }
      if (!storage.services[name].length) {
        storage.services[name] = undefined;
      }
    });
  }
  if (storage.vhosts) {
    Object.keys(storage.vhosts).forEach(function (name) {
      if (!storage.vhosts[name]) {
        return;
      }
      for (var i = 0; i < storage.vhosts[name].length; i++) {
        if (storage.vhosts[name][i].id === id) {
          storage.vhosts[name].splice(i, 1);
        }
      }
      if (!storage.vhosts[name].length) {
        storage.vhosts[name] = undefined;
      }
    });
  }
  exports.persist();
};

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

exports.persist = function persist (cb) {
  print(storage);
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
    print(storage);
    cb && cb(err);
  });
};

function print (what) {
  if (process.env.NODE_ENV !== 'production') {
    log('vhosts', util.inspect.apply(util, [what.vhosts || {}].concat({colors: true, depth: 10})));
    log('services', util.inspect.apply(util, [what.services || {}].concat({colors: true, depth: 10})));
    return;
  }
  log('vhosts', JSON.stringify(what.vhosts || {}));
  log('services', JSON.stringify(what.services || {}));
}

function log () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[storage]');
  console.log.apply(console, args);
}
