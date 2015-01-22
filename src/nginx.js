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

  data.defaultServer = vhosts['default'] ? toTemplateServer('default', vhosts['default']) : null;

  data.vhosts = Object.keys(vhosts)
    .filter(function (slug) {
      return slug !== 'default';
    }).map(function (slug) {
      return toTemplateServer(slug, vhosts[slug]);
    });

  return data;
}

function toTemplateServer (slug, vhost) {
  return {slug: slug, host: vhost[0].name, servers: vhost};
}

function getTemplate (cb) {
  fs.readFile(path.join(__dirname, '..', 'tpl', 'nginx.mustache'), 'utf8', function (err, content) {
    if (err) {
      return cb(err);
    }
    return cb(null, content);
  });
}
