'use strict';
var fs = require('fs');
var path = require('path');
var util = require('util');
var semver = require('semver');
var groupBy = require('lodash.groupby');
var debounce = require('lodash.debounce');
var Datastore = require('nedb');
var pify = require('pify');
var slug = require('./slug');
var logger = require('./logger')('storage');

var join = file => path.resolve(__dirname, '..', 'data', file);
var readFile = pify(fs.readFile);
var readJson = file => readFile(file, 'utf8').then(content => JSON.parse(content || '{}'));
var unlink = pify(fs.unlink);
var noop = () => {};

var OLD_STORAGE = join('storage.json');

var listeners = {persist: []};
var print = debounce(printStorage, 100);

var db = {
  values: new Datastore({filename: join('values.db'), autoload: true}),
  vhosts: new Datastore({filename: join('vhosts.db'), autoload: true}),
  services: new Datastore({filename: join('services.db'), autoload: true})
};

db.removeValues = pify(db.values.remove).bind(db.values);
db.removeVhosts = pify(db.vhosts.remove).bind(db.vhosts);
db.removeServices = pify(db.services.remove).bind(db.services);

var FIVE_MINUTES = 5 * 60 * 1000;
db.values.persistence.setAutocompactionInterval(FIVE_MINUTES - 200);
db.vhosts.persistence.setAutocompactionInterval(FIVE_MINUTES);
db.services.persistence.setAutocompactionInterval(FIVE_MINUTES + 200);

exports.get = function get () {
  return db;
};

exports.setValue = function setValue (key, value) {
  return new Promise((resolve, reject) => {
    db.values.update({_id: key}, {_id: key, value}, {upsert: true}, err => {
      if (err) {
        logger.error(err.stack || err);
        reject(err);
      } else {
        exports.persist({reason: 'SET_VALUE'});
        resolve();
      }
    });
  });
};

exports.addVhost = function addVhost (host) {
  return new Promise((resolve, reject) => {
    db.vhosts.update({name: host.name, id: host.id}, host, {upsert: true}, err => {
      if (err) {
        logger.error(err.stack || err);
        reject(err);
      } else {
        exports.persist({reason: 'ADD_VHOST'});
        resolve();
      }
    });
  });
};

exports.addService = function addService (service) {
  return new Promise((resolve, reject) => {
    db.services.update({name: service.name, id: service.id}, service, {upsert: true}, err => {
      if (err) {
        logger.error(err.stack || err);
        reject(err);
      } else {
        exports.persist({reason: 'ADD_SERVICE'});
        resolve();
      }
    });
  });
};

exports.getValue = function getValue (key) {
  return new Promise((resolve, reject) => {
    db.values.findOne({_id: key}, (err, doc) => {
      if (err) {
        return reject(err);
      }
      resolve(doc.value);
    });
  });
};

exports.getValues = function getValues () {
  return new Promise((resolve, reject) => {
    db.values.find({}, (err, docs) => {
      if (err) {
        return reject(err);
      }
      resolve(
        docs.reduce((values, {_id: key, value}) => (
          Object.assign(values, {[key]: value})
        ), {})
      );
    });
  });
};

exports.getService = function getService (name, all = false) {
  return new Promise((resolve, reject) => {
    db.services.find({name}, (err, docs) => {
      if (err) {
        return reject(err);
      }
      if (!all) {
        var maxVersion = getMaxVersion(docs);
        resolve(docs.filter(({version}) => version === maxVersion));
        return;
      }
      resolve(docs);
    });
  });
};

exports.getServices = function getServices (all = false) {
  return new Promise((resolve, reject) => {
    db.services.find({}, (err, docs) => {
      if (err) {
        return reject(err);
      }
      var grouped = groupBy(docs, 'name');
      if (!all) {
        Object.keys(grouped).forEach(name => {
          var maxVersion = getMaxVersion(grouped[name]);
          grouped[name] = grouped[name].filter(({version}) => version === maxVersion);
        });
      }
      resolve(grouped);
    });
  });
};

exports.getVhosts = function getVhosts (all = false) {
  return new Promise((resolve, reject) => {
    db.vhosts.find({}, (err, docs) => {
      if (err) {
        return reject(err);
      }
      var grouped = groupBy(docs, ({name}) => slug(name));
      if (!all) {
        Object.keys(grouped).forEach(name => {
          var maxVersion = getMaxVersion(grouped[name]);
          grouped[name] = grouped[name].filter(({version}) => version === maxVersion);
        });
      }
      resolve(grouped);
    });
  });
};

function getMaxVersion (services) {
  return services.reduce(function (max, curr) {
    return !max || curr.version === 'latest' || semver.gt(curr.version, max) ? curr.version : max;
  }, null);
}

exports.removeValue = function removeValue (key) {
  return db.removeValues({_id: key});
};

exports.removeImages = function removeNonManualImages () {
  return removeImages({manual: {$exists: false}});
};

exports.removeImage = function removeImage (id) {
  return removeImages({id});
};

function removeImages (filter) {
  return Promise.all([
    db.removeVhosts(filter, {multi: true}),
    db.removeServices(filter, {multi: true})
  ])
  .then(([numRemovedVhosts, numRemovedServices]) => {
    var reasons = [];
    if (numRemovedServices) {
      reasons.push('REMOVE_SERVICE');
    }
    if (numRemovedVhosts) {
      reasons.push('REMOVE_VHOSTS');
    }
    if (reasons.length) {
      exports.persist({reason: reasons.join(',')});
    }
  });
}

exports.onPersist = function onPersist (listener) {
  listeners.persist.push(listener);
};

exports.persist = function persist (data, cb) {
  print();

  trigger('persist', data);

  cb && cb();
};

exports.init = function init (cb) {
  cb = cb || noop;
  exports.migrate()
    .then(print)
    .then(cb, cb);
};

exports.migrate = function migrate () {
  return readJson(OLD_STORAGE)
    .then((storage = {}) => {
      logger.log('Migrating data');
      var promises = [];
      if (storage.keys) {
        promises = promises.concat(
          Object.keys(storage.keys)
          .map(key => exports.setValue(key, storage.keys[key]))
        );
      }
      if (storage.services) {
        promises = promises.concat(
          Object.keys(storage.services)
          .map(key => storage.services[key])
          .reduce((services, service) => services.concat(service), [])
          .filter(service => service.manual)
          .map(service => exports.addService(service))
        );
      }
      if (storage.vhosts) {
        promises = promises.concat(
          Object.keys(storage.vhosts)
          .map(key => storage.vhosts[key])
          .reduce((vhosts, vhost) => vhosts.concat(vhost), [])
          .filter(vhost => vhost.manual)
          .map(vhost => exports.addVhost(vhost))
        );
      }
      return Promise.all(promises);
    })
    .then(() => unlink(OLD_STORAGE))
    .then(() => logger.log('Migration finished'))
    .catch(err => {
      if (err.code === 'ENOENT') {
        logger.log('No migration needed');
      } else {
        logger.error(err.stack || err);
      }
    });
};

function printStorage () {
  db.vhosts.find({}, (err, docs) => {
    if (err) {
      return;
    }
    if (docs.length === 0) {
      logger.log('vhosts: 0');
    } else {
      var vhosts = docs.map(doc => `${doc.name}${doc.path} -> ${doc.ip}:${doc.port} ${doc.image || '<manual>'}:${doc.version} (${doc.id.slice(0, 12)})`);
      logger.log('vhosts:\n  - ' + vhosts.join('\n  - '));
    }
  });
  db.services.find({}, (err, docs) => {
    if (err) {
      return;
    }
    if (docs.length === 0) {
      logger.log('services: 0');
    } else {
      var services = docs.map(doc => `${doc.name} -> ${doc.ip}:${doc.port} ${doc.image || '<manual>'}:${doc.version} (${doc.id.slice(0, 12)})`);
      logger.log('services:\n  - ' + services.join('\n  - '));
    }
  });
}

function trigger (evt, data) {
  listeners[evt].forEach(function (listener) {
    setTimeout(function () {
      listener(data);
    }, 0);
  });
}
