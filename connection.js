"use strict";

var Class = require("./class").Class;
var EventTarget = require("./event").EventTarget;
var Set = require("es6-set");
var Map = require("es6-map");
var Promise = require("es6-promise").Promise;
var Symbol = require("es6-symbol");

var Connection = Class({
  extends: EventTarget,
  constructor: function() {
    // Queue of the outgoing messages.
    this.outbox = [];
    // Map of pending requests.
    this.pending = new Map();
    this.pools = new Set();
    this.EventTarget();
  },
  isConnected: function() {
    return !!this.port;
  },
  connect: function(port) {
    this.port = port;
    port.addEventListener("message", this);
    port.start();

    this.flush();
  },
  disconnect: function() {
    this.port.stop();
    this.port = null;
    for (var request of this.pending.values()) {
      request.reject(new Error("Connection closed"));
    }
    this.pending.clear();

    var requests = this.outbox.splice(0);
    for (var request of request) {
      requests.reject(new Error("Connection closed"));
    }
  },
  handleEvent: function(event) {
    this.receive(event.data);
  },
  flush: function() {
    if (this.isConnected()) {
      for (var request of this.outbox) {
        if (!this.pending.has(request.to)) {
          this.outbox.splice(this.outbox.indexOf(request), 1);
          this.pending.set(request.to, request);
          this.send(request.packet);
        }
      }
    }
  },
  send: function(packet) {
    this.port.postMessage(packet);
  },
  request: function(packet) {
    return new Promise(function(resolve, reject) {
      this.outbox.push({
        to: packet.to,
        packet: packet,
        resolve: resolve,
        reject: reject
      });
      this.flush();
    });
  },
  receive: function(packet) {
    var { from, type, why } = packet;
    var receiver = this.pending.get(from);
    if (!receiver) {
      console.warn("Unable to handle received packet", data);
    } else {
      this.pending.delete(from);
      if (packet.error)
        receiver.reject(packet.error);
      else
        receiver.resolve(packet);
    }
    this.flush();
  },
});
