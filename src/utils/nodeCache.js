const NodeCache = require('node-cache');
const config = require('../config/config');

const cache = new NodeCache({ 
  stdTTL: config.cache.ttl, 
  checkperiod: 600,
  useClones: false, // Tiết kiệm RAM và CPU bằng cách lưu reference thay vì deep clone object
  maxKeys: 1000 // Giới hạn tối đa 1000 bản ghi để chống tràn RAM cho máy 2GB
});

module.exports = cache;
