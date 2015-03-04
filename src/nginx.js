'use strict';
var mustache = require('mustache');
var fs = require('fs');
var path = require('path');
var storage = require('./storage');
var logger = require('./logger')('nginx');

var timeoutId = null;

storage.onPersist(function (data) {
  if (!data || !data.reason || data.reason.indexOf('VHOST') < 0) {
    logger.log('Site config not saved since unrelated event.');
    return;
  }

  var delay = data.reason.indexOf('REMOVE') > -1 ? 0 : 30;

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  logger.log('About to save site config in ' + delay + ' seconds...');

  timeoutId = setTimeout(function () {
    timeoutId = null;
    save(path.join(__dirname, '..', 'nginx', process.env.SITE_NAME || 'default-site'), function (err) {
      if (err) {
        logger.error(err);
      } else {
        logger.log('Site config saved');
      }
    });
  }, 1000 * delay);
});

exports.render = function render (cb) {
  return renderConfig(cb);
};

function save (file, cb) {
  renderConfig(function (err, config) {
    if (err) {
      return cb(err);
    }
    fs.writeFile(file, config, 'utf8', function (err) {
      return cb(err);
    });
  });
}

function renderConfig (cb) {
  getTemplate(function (err, template) {
    if (err) {
      return cb(err);
    }
    var data = getTemplateData();
    return cb(null, mustache.render(template, data));
  });
}

function getTemplateData () {
  var vhosts = storage.getVhosts() || {};

  var data = {vhosts: []};

  var servers = Object.keys(vhosts)
    .reduce(function (arr, slug) {
      arr.push.apply(arr, vhosts[slug]);
      return arr;
    }, []);

  var hostsForTemplate = transformServersForTemplate(servers);

  data.vhosts = hostsForTemplate.filter(function (vhost) {
    return vhost.host !== 'default';
  });

  data.defaultServer = hostsForTemplate.filter(function (vhost) {
    return vhost.host === 'default';
  })[0];

  return data;
}
/**
 * Transforming this:
 *
 * [
 *   {slug: 'my_domain_com_example', path: '/example', name: 'my-domain.com', ip: '127.0.0.1', port: 80}
 * ]
 *
 * into this:
 *
 * [
 *   {
 *     host: 'my-domain.com',
 *     paths: [
 *       {
 *         path: '/example/',
 *         slug: 'my_domain_com_example',
 *         servers: [
 *           {ip: '127.0.0.1', port: 80}
 *         ]
 *       }
 *     ]
 *   }
 * ]
 */
function transformServersForTemplate (servers) {
  var transformed = {};

  servers.forEach(function (server) {
    if (!transformed[server.name]) {
      transformed[server.name] = {host: server.name, paths: {}};
    }
    if (!transformed[server.name].paths[server.path]) {
      transformed[server.name].paths[server.path] = {slug: server.slug, path: fixPath(server.path), servers: []};
    }
    transformed[server.name].paths[server.path].servers.push({ip: server.ip, port: server.port});
  });

  // Transform back to arrays:
  var templateData = Object.keys(transformed).map(function (name) {
    var vhost = transformed[name];
    vhost.paths = Object.keys(vhost.paths).map(function (path) {
      return vhost.paths[path];
    });
    return vhost;
  });

  return templateData;
}

/**
 * Prepends and appends a path with slashes
 */
function fixPath (path) {
  if (!path || path.length === 0) {
    return '/';
  }
  if (path[0] !== '/') {
    path = '/' + path;
  }
  if (path[path.length - 1] !== '/') {
    path = path + '/';
  }
  return path;
}

function getTemplate (cb) {
  fs.readFile(path.join(__dirname, '..', 'tpl', 'nginx.mustache'), 'utf8', function (err, content) {
    if (err) {
      return cb(err);
    }
    return cb(null, content);
  });
}
