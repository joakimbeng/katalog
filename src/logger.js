'use strict';
module.exports = exports = function logger (name) {
  return {
    log: log.bind(null, name),
    error: error.bind(null, name)
  };
};

function log (name, ...args) {
  console.log(new Date().toISOString(), `[${name}]`, ...args);
}

function error (name, ...args) {
  console.error(new Date().toISOString(), `[${name}]`, ...args);
}
