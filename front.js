"use strict";

var Class = require("./class").Class;
var EventTarget = require("./event").EventTarget;
var Promise = require("es6-promise").Promise;
var pairs = require("./util").pairs;
var values = require("./util").values;

var Pool = Class({
  extends: EventTarget,
  EventTarget: EventTarget,
  constructor: function(client) {
    this.client = client;
    this.workers = Object.create(null);
    this.EventTarget();
    this.client.addPool(this);
  },
  get id() {
    throw Error("Implementation must implement id field");
  },
  get parent() {
    return this.client.poolFor(this.id);
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
    this.workers[worker.id] = worker;
  },
  unmanage: function(worker) {
    delete this.workers[worker.id];
  },

  destroy: function() {
    if (!this.destroyed) {
      this.destroyed = true;

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
exports.Pool = Pool;


var Front = Class({
  extends: Pool,
  Pool: Pool,
  constructor: function(client) {
    this.requests = [];
    this.Pool(client);
  },
  get id() {
    return this.state.actor;
  },
  form: function(state, detail) {
    if (this.state !== state) {
      if (detail) {
        this.state[detail] = state[detail];
      } else {
        pairs(state).forEach(function(pair) {
          var key = pair[0], value = pair[1];
          this.state[key] = value;
        }, this);
      }
    }
  },
  request: function(packet) {
    var requests = this.requests;
    var client = this.client;
    packet.to = this.id;

    return new Promise(function(resolve, reject) {
      requests.push({ resolve: resolve, reject: reject });
      client.send(packet);
    });
  },
  receive: function(packet) {
    var event = this.events[packet.type];
    if (event) {
      this.dispatchEvent(event.read(packet, this.client));
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
exports.Front = Front;
