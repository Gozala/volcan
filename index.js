"use strict";

var Port = require("./port").Port;
var Client = require("./client").Client;

function connect(port, host) {
  var client = new Client();
  return client.connect(new Port(port, host));
}
exports.connect = connect;
