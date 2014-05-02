"use strict";

var Class = require("../class");
// Simple id generator and accessor functions will be used to assign unique identifier
// to objects without exposing them to a consumer.
var targets = new WeakMap();
var handlers = new WeakMap();

var Handler = Class({
  constructor: function(listener) {
    this.listener = listener;
    handlers.set(listener, this);
  },
  handleEvent = function(event) {
    // patch event to fix up event target.
    this.listener(Object.create(event, {
      target: { value: event.target.owner }
    }));
  }
});


// Custom `EventTarget` implementation that can be used as a regular `EventTarget`
// who's method can actually be invoked. This will become unnecessary once `EventTarget`
// is properly exposed by platform.
var EventTarget = Class({
  // Inherit from `window.EventTarget` so that `x instanceof EventTarget` will be `true`.
  extends: window.EventTarget,
  constructor: function() {
    var target = document.createElement("code");
    target.owner = this;
    targets.set(this, target);
  },
  addEventListener: function(type, listener, capture) {
    var handler = Handler.for(listener) || new Handler(listener);
    targets.get(this).addEventListener(type, handler, capture);
  },
  removeEventListener: function(type, listener, capture) {
    var handler = Handler.for(listener);
    if (handler)
      targets.get(this).removeEventListener(type, handler, capture);
  },
  dispatchEvent: function(event) {
    targets.get(this).dispatchEvent(event);
  }
});
exports.EventTarget = EventTarget;
exports.MessageEvent = MessageEvent;
