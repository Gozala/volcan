"use strict";

var Client = require("../client").Client;

function connect(port) {
  var client = new Client();
  return client.connect(port);
}
exports.connect = connect;
