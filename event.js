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
    Object.defineProperty(this, $emitter, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: new EventEmitter()
    });
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
    event.target = this;
    this[$emitter].emit(event.type, event);
  }
});
exports.EventTarget = EventTarget;

var MessageEvent = Class({
  constructor: function(type, options) {
    options = options || {};
    this.type = type;
    this.data = options.data === void(0) ? null : options.data;

    this.lastEventId = options.lastEventId || "";
    this.origin = options.origin || "";
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
  },
  source: null,
  ports: null,
  preventDefault: function() {
  },
  stopPropagation: function() {
  },
  stopImmediatePropagation: function() {
  }
});
exports.MessageEvent = MessageEvent;
