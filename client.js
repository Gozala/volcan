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

// Type to represent superviser actor relations to actors they supervise
// in terms of lifetime management.
var Supervisor = Class({
  constructor: function(id) {
    this.id = id;
    this.workers = [];
  }
});

var Telemetry = Class({
  add: function(id, ms) {
    console.log("telemetry::", id, ms)
  }
});

// Consider making client a root actor.

var Client = Class({
  extends: EventTarget,
  constructor: function() {
    this.root = null;
    this.telemetry = new Telemetry();

    this.setupConnection();
    this.setupLifeManagement();
    this.setupTypeSystem();
  },

  setupConnection: function() {
    this.requests = [];
  },
  setupLifeManagement: function() {
    this.cache = Object.create(null);
    this.graph = Object.create(null);
    this.get = this.get.bind(this);
    this.release = this.release.bind(this);
  },
  setupTypeSystem: function() {
    this.typeSystem = new TypeSystem();
    this.typeSystem.registerTypes(specification);
  },

  connect: function(connection) {
    this.connection = connection;
    connection.onmessage = this.receive.bind(this);
    this.connection.start();
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

      this.root = this.typeSystem.read("root", null, "root");
      this.root
          .protocolDescription()
          .catch(recoverActorDescriptions)
          .then(this.typeSystem.registerTypes.bind(this.typeSystem))
          .then(this.dispatchEvent.bind(this, {type: "ready", target: this}));
    } else {
      var actor = this.get(packet.from);
      var event = actor.events[packet.type];
      if (event) {
        actor.dispatchEvent(event.read(packet));
      } else {
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

  get: function(id) {
    return this.cache[id];
  },
  supervisorOf: function(actor) {
    for (var id in this.graph) {
      if (this.graph[id].indexOf(actor.id) >= 0) {
        return id;
      }
    }
  },
  workersOf: function(actor) {
    return this.graph[actor.id];
  },
  supervise: function(actor, worker) {
    var workers = this.workersOf(actor)
    if (workers.indexOf(worker.id) < 0) {
      workers.push(worker.id);
    }
  },
  unsupervise: function(actor, worker) {
    var workers = this.workersOf(actor);
    var index = workers.indexOf(worker.id)
    if (index >= 0) {
      workers.splice(index, 1)
    }
  },

  register: function(actor) {
    var registered = this.get(actor.id);
    if (!registered) {
      this.cache[actor.id] = actor;
      this.graph[actor.id] = [];
    } else if (registered !== actor) {
      throw new Error("Different actor with same id is already registered");
    }
  },
  unregister: function(actor) {
    if (this.get(actor.id)) {
      delete this.cache[actor.id];
      delete this.graph[actor.id];
    }
  },

  release: function(actor) {
    var supervisor = this.supervisorOf(actor);
    if (supervisor)
      this.unsupervise(supervisor, actor);

    var workers = this.workersOf(actor)

    if (workers) {
      workers.map(this.get).forEach(this.release)
    }
    this.unergister(actor);
  }
});
exports.Client = Client;
