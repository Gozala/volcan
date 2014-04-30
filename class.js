"use strict";

var describe = Object.getOwnPropertyDescriptor;
var Class = function(fields) {
  var names = Object.keys(fields);
  var constructor = names.indexOf("constructor") >= 0 ? fields.constructor :
                    function() {};
  var ancestor = fields.extends || Object;

  var descriptor = names.reduce(function(descriptor, key) {
    descriptor[key] = describe(fields, key);
    return descriptor;
  }, {});

  var prototype = Object.create(ancestor.prototype, descriptor);

  constructor.prototype = prototype;
  prototype.constructor = constructor;

  return constructor;
};
exports.Class = Class;
