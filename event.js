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
    this.type = type;
    this.target = null;

    this.data = options.data;
    this.origin = options.origin || "";
    this.lastEventId = options.lastEventId || "";
    this.channel = options.channel || null;
    this.source = options.source || null;
    this.prots = options.ports || null;
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
  }
});
exports.MessageEvent = MessageEvent;
