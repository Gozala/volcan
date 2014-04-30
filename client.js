"use strict";

var Class = require("./class").Class;
var EventTarget = require("./event").EventTarget;
var typeFor = require("./marshallers").typeFor;
var values = require("./util").values;

var specification = require("./specification/core.json");

function recoverActorDescriptions(error) {
  console.error("Error listing actor descriptions:", error);
  return require("./specification/protocol.json");
}

// Consider making client a root actor.

var Client = Class({
  extends: EventTarget,
  constructor: function() {
    this.root = null;
    this.pools = [];
    this.types = Object.create(null);
    this.constructors = Object.create(null);
    this.specification = Object.create(null);

    this.registerTypes = this.registerTypes.bind(this);
    this.registerTypes(specification);

    this.ready = this.ready.bind(this);
  },
  connect: function(connection) {
    this.connection = connection;
    connection.onmessage = this.receive.bind(this);
    this.connection.start();
  },

  registerTypes: function(descriptor) {
    var specification = this.specification;
    values(descriptor.types).forEach(function(descriptor) {
      specification[descriptor.typeName] = descriptor;
    });
  },

  ready: function() {
    this.dispatchEvent({ type: "ready", target: this });
  },


  send: function(packet) {
    this.connection.postMessage(packet);
  },
  receive: function(event) {
    var packet = event.data;
    if (!this.root) {
      if (packet.from !== "root")
        throw Error("Initial packet must be from root");
      if (!("applicationType" in packet))
        throw Error("Initial packet must contain applicationType field");

      this.root = this.read({ actor: "root" }, "root");
      this.root
          .protocolDescription()
          .catch(recoverActorDescriptions)
          .then(this.registerTypes)
          .then(this.ready);
    } else if (packet.from === "root") {
      this.root.receive(packet);
    } else {
      var actor = this.get(packet.from);
      actor.receive(packet);
    }
  },


  addPool: function(pool) {
    if (this.pools.indexOf(pool) < 0) {
      this.pools.push(pool);
    }
  },
  removePool: function(pool) {
    var index = this.pools.indexOf(pool);
    if (index >= 0) {
      this.pools.splice(index, 1);
    }
  },
  poolFor: function(id) {
    var index = 0;
    while (index < this.pools.length) {
      var pool = this.pools[index];
      index = index + 1;
      if (pool.has(id)) {
        return pool;
      }
    }
  },
  get: function(id) {
    var pool = this.poolFor(id);
    return pool && pool.get(id);
  },

  read: function(input, typeName) {
    return typeFor(this, typeName).read(input, this);
  },
  write: function(input, typeName) {
    return typeFor(this, typeName).write(input, this);
  }
});
exports.Client = Client;
