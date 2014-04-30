"use strict";

var Socket = require("net").Socket;
var Class = require("./class").Class;
var EventTarget = require("./event").EventTarget;

var Message = Class({
  constructor: function(data) {
    this.data = data;
  },
  type: "message",
  bubbles: true,
  cancelable: false
});

var Port = Class({
  extends: EventTarget,
  EventTarget: EventTarget,
  constructor: function(port, host) {
    this.port = port;
    this.host = host;
    this.EventTarget();
    this.socket = new Socket();
    this.socket.on("data", this.receive.bind(this));
    this.addEventListener("message", this);
  },
  handleEvent: function(event) {
    var listener = this.onmessage;
    return listener && listener(event);
  },
  start: function() {
    this.socket.connect(this.port, this.host);
  },
  close: function() {
    this.socket.end();
  },
  get onmessage(listener) {
    return this.listener;
  },
  set onmessage(listener) {
    this.listener = listener;
  },
  receive: function(chunk) {
    var buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (buffer.length) {
      var index = buffer.toString().indexOf(":");
      var size = parseInt(buffer.slice(0, index));
      var start = index + 1;
      var end = start + size;
      if (buffer.length >= end) {
        var frame = buffer.slice(start, end).toString();
        this.dispatchEvent(new Message(JSON.parse(frame)));
        buffer = buffer.slice(end);
      } else {
        break;
      }
    }
    this.buffer = buffer;
  },
  postMessage: function(data) {
    var frame = JSON.stringify(data);
    var packet = frame.length + ":" + frame;
    this.socket.write(packet);
  }
});

exports.Port = Port;
