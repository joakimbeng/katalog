'use strict';
module.exports = exports = function slug (val) {
  return val.toLowerCase().replace(/[^a-z_]/g, '_');
};
