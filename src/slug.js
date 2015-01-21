'use strict';
module.exports = exports = function slug (val) {
  val = val.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (/^[0-9]+$/.test(val)) {
    return 'ip' + val;
  }
  return val;
};
