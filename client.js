"use strict";

var Class = require("./class").Class;
var EventTarget = require("./event").EventTarget;
var TypeSystem = require("./type-system").TypeSystem;
var values = require("./util").values;
var Promise = require("es6-promise").Promise;

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
    this.requests = [];
    this.typeSystem = new TypeSystem();

    this.typeSystem.registerTypes(specification);
  },
  connect: function(connection) {
    this.connection = connection;
    connection.onmessage = this.receive.bind(this);
    this.connection.start();
  },

  ready: function() {
    this.dispatchEvent({ type: "ready", target: this });
  },


  send: function(packet) {
    this.connection.postMessage(packet);
  },
  request: function(packet) {
    var requests = this.requests;
    return new Promise(function(resolve, reject) {
      requests.push(packet.to, { resolve: resolve, reject: reject });
      client.send(packet);
    });
  },
  receive: function(event) {
    var packet = event.data;
    if (!this.root) {
      if (packet.from !== "root")
        throw Error("Initial packet must be from root");
      if (!("applicationType" in packet))
        throw Error("Initial packet must contain applicationType field");

      this.root = this.typeSystem.read({ actor: "root" }, "root");
      this.addPool(this.root);
      this.root
          .protocolDescription()
          .catch(recoverActorDescriptions)
          .then(this.typeSystem.registerTypes.bind(this.typeSystem))
          .then(this.ready.bind(this));
    } else {
      var actor = this.get(packet.from);
      var event = actor.events[packet.type];
      if (event) {
        actor.dispatchEvent(event.read(packet));
      } else {
        console.log(">>>", packet);
        var index = this.requests.indexOf(packet.from);
        if (index >= 0) {
          var request = this.requests.splice(index, 2).pop();
          if (packet.error)
            request.reject(packet);
          else
            request.resolve(packet);
        } else {
          console.error(Error("Unexpected packet " + JSON.stringify(packet, 2, 2)),
                        packet,
                        this.requests.slice(0));
        }
      }
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
  }
});
exports.Client = Client;
