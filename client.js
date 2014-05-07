"use strict";

var Class = require("./class").Class;
var TypeSystem = require("./type-system").TypeSystem;
var values = require("./util").values;
var Promise = require("es6-promise").Promise;
var MessageEvent = require("./event").MessageEvent;

var specification = require("./specification/core.json");

function recoverActorDescriptions(error) {
  console.warn("Failed to fetch protocol specification (see reason below). " +
               "Using a fallback protocal specification!",
               error);
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
    this.typeSystem = new TypeSystem(this);
    this.typeSystem.registerTypes(specification);
  },

  connect: function(port) {
    var client = this;
    return new Promise(function(resolve, reject) {
      client.port = port;
      port.onmessage = client.receive.bind(client);
      client.onReady = resolve;
      client.onFail = reject;

      port.start();
    });
  },
  send: function(packet) {
    this.port.postMessage(packet);
  },
  request: function(packet) {
    var client = this;
    return new Promise(function(resolve, reject) {
      client.requests.push(packet.to, { resolve: resolve, reject: reject });
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
          .then(this.onReady.bind(this, this.root), this.onFail);
    } else {
      var actor = this.get(packet.from) || this.root;
      var event = actor.events[packet.type];
      if (event) {
        var message = new MessageEvent(packet.type, {
          data: event.read(packet)
        });
        actor.dispatchEvent(message);
      } else {
        var index = this.requests.indexOf(actor.id);
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
    this.unregister(actor);
  }
});
exports.Client = Client;
