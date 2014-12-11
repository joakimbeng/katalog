'use strict';
module.exports = exports = function logger (name) {
  return {
    log: log.bind(null, name),
    error: error.bind(null, name)
  };
};

function log (/* args */) {
  var args = Array.prototype.slice.call(arguments);
  args[0] = '[' + args[0] + ']';
  console.log.apply(console, args);
}

function error () {
  var args = Array.prototype.slice.call(arguments);
  args[0] = '[' + args[0] + ']';
  console.error.apply(console, args);
}
