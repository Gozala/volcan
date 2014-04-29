(function(exports) {
"use strict";

var Symbol = require("es6-symbol")
var EventEmitter = require("events").EventEmitter;
var Class = require("./class").Class;

var $bound = Symbol("EventTarget/handleEvent");
var $emitter = Symbol("EventTarget/emitter");

function makeHandler(handler) {
  return function(event) {
    handler.handleEvent(event);
  }
}

var EventTarget = Class({
  constructor: function() {
    this[$emitter] = new EventEmitter();
  },
  addEventListener: function(type, handler) {
    if (typeof(handler) === "function") {
      this[$emitter].on(type, handler);
    }
    else if (handler && typeof(handler) === "object") {
      if (!handler[$bound]) handler[$bound] = makeHandler(handler);
      this[$emitter].on(type, handler[$bound]);
    }
  },
  removeEventListener: function(type, handler) {
    if (typeof(handler) === "function")
      this[$emitter].removeListener(type, handler);
    else if (handler && handler[$bound])
      this[$emitter].removeListener(type, handler[$bound]);
  },
  dispatchEvent: function(event) {
    this[$emitter].emit(event.type, event);
  }
});
exports.EventTarget = EventTarget;

})(typeof(exports) !== "undefined" ? exports : this);

