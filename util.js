"use strict";

var keys = Object.keys;
exports.keys = keys;

// Returns array of values for the given object.
var values = function(object) {
  return keys(object).map(function(key) {
    return object[key]
  });
};
exports.values = values;

// Returns [key, value] pairs for the given object.
var pairs = function(object) {
  return keys(object).map(function(key) {
    return [key, object[key]]
  });
};
exports.pairs = pairs;


// Queries an object for the field nested with in it.
var query = function(object, path) {
  return path.reduce(function(object, entry) {
    return object && object[entry]
  }, object);
};
exports.query = query;

var isObject = function(x) {
  return x && typeof(x) === "object"
}

var findPath = function(object, key) {
  var path = void(0);
  if (object && typeof(object) === "object") {
    var names = keys(object);
    if (names.indexOf(key) >= 0) {
      path = [];
    } else {
      var index = 0;
      var count = names.length;
      while (index < count && !path){
        var head = names[index];
        var tail = findPath(object[head], key);
        path = tail ? [head].concat(tail) : tail;
        index = index + 1
      }
    }
  }
  return path;
};
exports.findPath = findPath;
