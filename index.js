"use strict";

var Port = require("./port").Port;
var Client = require("./client").Client;

function connect(port, host) {
  var client = new Client();
  if (typeof(port) === "number") {
    console.warn("Use of `connect(port, host)` API is deprecated. " +
                 "Please use " +
                 "`connect(new (require('volcan/port').Port)(port, host))" +
                 " instead.");
    port = new Port(port, host);
  }
  return client.connect(port);
}
exports.connect = connect;
