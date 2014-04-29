(function(exports) {
"use strict";

var Class = require("./class").Class;
var EventTarget = require("./event").EventTarget;
var Set = require("es6-set");
var Map = require("es6-map");
var Promise = require("es6-promise").Promise;
var Symbol = require("es6-symbol");
var typeFor = require("./marshallers").typeFor;
var Event = require("./marshallers").Event;
var Method = require("./marshallers").Method;
var values = require("./util").values;
var pairs = require("./util").pairs;


var $id = Symbol("@@Actor/id");
var $destroyed = Symbol("@@Pool/destroyed");

var specification = require("./specification/core.json");

function recoverActorDescriptions(error) {
  console.error("Error listing actor descriptions:", error);
  return require("./specification/protocol.json");
}

var Client = Class({
  constructor: function() {
    this.root = null;
    this.pools = [];
    this.types = Object.create(null);
    this.constructors = Object.create(null);
    this.specification = Object.create(null);

    this.registerTypes = this.registerTypes.bind(this);
    this.registerTypes(specification);
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


  send: function(packet) {
    console.log(">>>>", packet);
    this.connection.postMessage(packet);
  },
  receive: function(event) {
    var packet = event.data;
    if (!this.root) {
      if (packet.from !== "root")
        throw Error("Initial packet must be from root");
      if (!("applicationType" in packet))
        throw Error("Initial packet must contain applicationType field");

      this.root = this.get("root") || this.make("root", "root");
      this.root
          .protocolDescription()
          .catch(recoverActorDescriptions)
          .then(this.registerTypes);
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

  make: function(id, typeName) {
    if (!this.constructors[typeName]) {
      var descriptor = this.specification[typeName];
      this.constructors[typeName] = makeActorConstructor(descriptor);
    }
    var Actor = this.constructors[typeName];
    return new Actor(id, this);
  },
  read: function(input, typeName) {
    return typeFor(this, typeName).read(input, this);
  },
  write: function(input, typeName) {
    return typeFor(this, typeName).write(input, this);
  }
});
exports.Client = Client;


var Pool = Class({
  constructor: function(client) {
    this.client = client;
    this.workers = Object.create(null);
    this.client.addPool(this);
  },
  get parent() {
    return this.client.poolFor(this[$id]);
  },
  get marshallPool() {
    return this;
  },

  has: function(id) {
    return id in this.workers;
  },
  get: function(id) {
    return this.workers[id];
  },

  manage: function(worker) {
    this.workers[worker[$id]] = worker;
  },
  unmanage: function(worker) {
    delete this.workers[worker[$id]];
  },

  destroy: function() {
    if (!this[$destroyed]) {
      this[$destroyed] = true;

      if (this.parent) {
        this.parent.unmanage(this);
      }

      values(this.workers).forEach(function(worker) {
        worker.destroy();
      })

      this.client.removePool(this);
      this.workers = Object.create(null);
    }
  }
});


var Front = Class({
  extends: Pool,
  Pool: Pool,
  constructor: function(client) {
    this.client = client;
    this.requests = [];
  },
  get id() {
    return this[$id];
  },
  request: function(packet) {
    var requests = this.requests;
    var client = this.client;
    packet.to = this[$id];

    return new Promise(function(resolve, reject) {
      requests.push({ resolve: resolve, reject: reject });
      client.send(packet);
    });
  },
  receive: function(packet) {
    console.log("<<<<", packet);
    var event = this.events[packet.type];
    if (event) {
      this.dispatchEvent(event.read(packet, this));
    } else if (this.request.length > 0) {
      var request = this.requests.pop();
      if (packet.error)
        request.reject(packet);
      else
        request.resolve(packet);
    }
  },
  requestTypes: function() {
    return this.request({
      to: this.id,
      type: "requestTypes"
    }).then(function(packet) {
      return packet.requestTypes;
    });
  }
});

function makeMethod(descriptor) {
  var type = new Method(descriptor);
  return descriptor.response ? makeBidirectionalMethod(descriptor, type) :
         makeUnidirecationalMethod(descriptor, type);
}

var makeUnidirecationalMethod = function(descriptor, type) {
  return function() {
    var packet = type.write(arguments, this.client);
    this.client.send(packet);
    return Promise.resolve(void(0));
  };
};

var makeBidirectionalMethod = function(descriptor, type) {
  return function() {
    var client = this.client;
    var packet = type.write(arguments, client);
    return this.request(packet).then(function(packet) {
      return type.read(packet, client);
    });
  };
};


function makeActorConstructor(descriptor) {
  var events = Object.create(null);
  var proto = {
    extends: Front,
    Front: Front,
    constructor: function(id, client) {
      this[$id] = id;
      this.Front(client);
    },
    events: events
  };

  descriptor.methods.forEach(function(descriptor) {
    proto[descriptor.name] = makeMethod(descriptor);
  });

  pairs(descriptor.events).forEach(function(pair) {
    var name = pair[0], descriptor = pair[1];
    events[name] = new Event(descriptor);
  });

  return Class(proto);
}

})(typeof(exports) !== "undefined" ? exports : this);

