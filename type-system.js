"use strict";

var Class = require("./class").Class;
var Front = require("./front").Front;
var util = require("./util");
var keys = util.keys;
var values = util.values;
var pairs = util.pairs;
var query = util.query;
var findPath = util.findPath;
var EventTarget = require("./event").EventTarget;

var TypeSystem = Class({
  constructor: function(descriptor) {
    var types = Object.create(null);
    var specification = Object.create(null);

    this.specification = specification;
    this.types = types;

    var typeFor = function typeFor(typeName) {
      typeName = typeName || "primitive";
      if (!types[typeName]) {
        defineType(typeName);
      }

      return types[typeName];
    };
    this.typeFor = typeFor;

    var defineType = function(descriptor) {
      var type = void(0);
      if (typeof(descriptor) === "string") {
        if (descriptor.indexOf(":") > 0)
          type = makeCompoundType(descriptor);
        else if (descriptor.indexOf("#") > 0)
          type = new ActorDetail(descriptor);
          else if (specification[descriptor])
            type = makeCategoryType(specification[descriptor]);
      } else {
        type = makeCategoryType(descriptor);
      }

      if (type)
        types[type.name] = type;
      else
        throw TypeError("Invalid type: " + descriptor);
    };
    this.defineType = defineType;


    var makeCompoundType = function(name) {
      var index = name.indexOf(":");
      var baseType = name.slice(0, index);
      var subType = name.slice(index + 1);

      return baseType === "array" ? new ArrayOf(subType) :
      baseType === "nullable" ? new Maybe(subType) :
      null;
    };

    var makeCategoryType = function(descriptor) {
      var category = descriptor.category;
      return category === "dict" ? new Dictionary(descriptor) :
      category === "actor" ? new Actor(descriptor) :
      null;
    };

    var read = function(input, typeName) {
      return typeFor(typeName).read(input);
    }
    this.read = read;

    var write = function(input, typeName) {
      return typeFor(typeName).write(input);
    };
    this.write = write;


    var Type = Class({
      constructor: function() {
      },
      get name() {
        return this.category ? this.category + ":" + this.type :
        this.type;
      },
      read: function(input) {
        throw new TypeError("`Type` subclass must implement `read`");
      },
      write: function(input) {
        throw new TypeError("`Type` subclass must implement `write`");
      }
    });

    var Primitve = Class({
      extends: Type,
      constuctor: function(type) {
        this.type = type;
      },
      read: function(input) {
        return input;
      },
      write: function(input) {
        return input;
      }
    });

    var Maybe = Class({
      extends: Type,
      category: "nullable",
      constructor: function(type) {
        this.type = type;
      },
      read: function(input) {
        return input === null ? null :
        input === void(0) ? void(0) :
        read(input, this.type);
      },
      write: function(input) {
        return input === null ? null :
        input === void(0) ? void(0) :
        write(input, this.type);
      }
    });

    var ArrayOf = Class({
      extends: Type,
      category: "array",
      constructor: function(type) {
        this.type = type;
      },
      read: function(input) {
        var type = this.type;
        return input.map(function($) { return read($, type) });
      },
      write: function(input) {
        var type = this.type;
        return input.map(function($) { return write($, type) });
      }
    });

    var makeField = function makeField(name, type) {
      return {
        enumerable: true,
        configurable: true,
        get: function() {
          Object.defineProperty(this, name, {
            configurable: false,
            value: read(this.state[name], type)
          });
          return this[name];
        }
      }
    };

    var makeFields = function(descriptor) {
      return pairs(descriptor).reduce(function(fields, pair) {
        var name = pair[0], type = pair[1];
        fields[name] = makeField(name, type);
        return fields;
      }, {});
    }

    var DictionaryType = Class({});

    var Dictionary = Class({
      exteds: Type,
      category: "dict",
      get name() { return this.type; },
      constructor: function(descriptor) {
        this.type = descriptor.typeName;
        this.types = descriptor.specializations;

        var proto = Object.defineProperties({
          exteds: DictionaryType,
          constructor: function(state) {
            Object.defineProperty(this, "state", {
              enumerable: false,
              writable: true,
              configurable: true,
              value: state
            });
          }
        }, makeFields(this.types));

        this.class = new Class(proto);
      },
      read: function(input) {
        return new this.class(input);
      },
      write: function(input) {
        var output = {};
        for (var key in input) {
          output[key] = write(value, types[key]);
        }
        return output;
      }
    });

    var makeMethods = function(descriptors) {
      return descriptors.reduce(function(methods, descriptor) {
        methods[descriptor.name] = {
          enumerable: true,
          configurable: true,
          writable: false,
          value: makeMethod(descriptor)
        };
        return methods;
      }, {});
    };

    var makeEvents = function(descriptors) {
      return pairs(descriptors).reduce(function(events, pair) {
        var name = pair[0], descriptor = pair[1];
        var event = new Event(name, descriptor);
        events[event.eventType] = event;
        return events;
      }, Object.create(null));
    };

    var Actor = Class({
      exteds: Type,
      category: "actor",
      get name() { return this.type; },
      constructor: function(descriptor) {
        this.type = descriptor.typeName;

        var events = makeEvents(descriptor.events || {});
        var fields = makeFields(descriptor.fields || {});
        var methods = makeMethods(descriptor.methods || []);


        var proto = {
          extends: Front,
          constructor: function(state) {
            Object.defineProperty(this, "state", {
              enumerable: false,
              writable: true,
              configurable: true,
              value: state
            });
            Front.call(this);
          },
          events: events
        };
        Object.defineProperties(proto, fields);
        Object.defineProperties(proto, methods);

        this.class = Class(proto);
      },
      read: function(input, detail) {
        var state = typeof(input) === "string" ? { actor: input } : input;

        var actor = client.get(state.actor) || new this.class(state);
        actor.marshallPool.manage(actor);
        actor.form(state, detail);

        return actor;
      },
      write: function(input, detail) {
        return input.id;
      }
    });
    exports.Actor = Actor;


    var ActorDetail = Class({
      extends: Actor,
      constructor: function(name) {
        var parts = name.split("#")
        this.actorType = parts[0]
        this.detail = parts[1];
      },
      read: function(input) {
        return typeFor(this.actorType).read(input, this.detail);
      },
      write: function(input) {
        return typeFor(this.actorType).write(input, this.detail);
      }
    });
    exports.ActorDetail = ActorDetail;

    var Method = Class({
      exteds: Type,
      constructor: function(descriptor) {
        this.type = descriptor.name;
        this.path = findPath(descriptor.response, "_retval");
        this.responseType = this.path && query(descriptor.response, this.path)._retval;
        this.requestType = descriptor.request.type;

        var params = [];
        for (var key in descriptor.request) {
          if (key !== "type") {
            var param = descriptor.request[key];
            var index = param._arg || param._option;
            var isParam = param._option === index;
            var isArgument = param._arg === index;
            params[index] = {
              type: param.type,
              key: key,
              index: index,
              isParam: isParam,
              isArgument: isArgument
            };
          }
        }
        this.params = params;
      },
      read: function(input) {
        return read(query(input, this.path), this.responseType);
      },
      write: function(input) {
        return this.params.reduce(function(result, param) {
          result[param.key] = write(input[param.index], param.type);
          return result;
        }, {type: this.type});
      }
    });
    exports.Method = Method;

    function makeMethod(descriptor) {
      var type = new Method(descriptor);
      return descriptor.oneway ? makeUnidirecationalMethod(descriptor, type) :
      makeBidirectionalMethod(descriptor, type);
    }

    var makeUnidirecationalMethod = function(descriptor, type) {
      return function() {
        var packet = type.write(arguments);
        packet.to = this.id;
        client.send(packet);
        return Promise.resolve(void(0));
      };
    };

    var makeBidirectionalMethod = function(descriptor, type) {
      var read = type.read.bind(type);
      return function() {
        var packet = type.write(arguments);
        packet.to = this.id;
        return client.request(packet).then(read);
      };
    };

    var Event = Class({
      constructor: function(name, descriptor) {
        this.name = descriptor.type || name;
        this.eventType = descriptor.type || name;
        this.types = Object.create(null);

        var types = this.types;
        for (var key in descriptor) {
          if (key === "type") {
            types[key] = "string";
          } else {
            types[key] = descriptor[key].type;
          }
        }
      },
      read: function(input) {
        var output = {};
        var types = this.types;
        for (var key in input) {
          output[key] = read(input[key], types[key]);
        }
        return output;
      },
      write: function(input) {
        var output = {};
        var types = this.types;
        for (var key in this.types) {
          output[key] = write(input[key], types[key]);
        }
        return output;
      }
    });


    var Pool = Class({
      extends: EventTarget,
      EventTarget: EventTarget,
      constructor: function() {
        Object.defineProperty(this, "workers", {
          configurable: true,
          writable: true,
          enumerable: false,
          value: Object.create(null)
        });
        this.EventTarget();
        client.addPool(this);
      },
      get id() {
        throw Error("Implementation must implement id field");
      },
      get parent() {
        return client.poolFor(this.id);
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

          client.removePool(this);
          this.workers = Object.create(null);
        }
      }
    });
    exports.Pool = Pool;


    var Front = Class({
      extends: Pool,
      Pool: Pool,
      constructor: function() {
        this.Pool();
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
      /*
      request: function(packet) {
        var requests = this.requests;
        packet.to = this.id;

        return new Promise(function(resolve, reject) {
          requests.push({ resolve: resolve, reject: reject });
          client.send(packet);
        });
      },
      receive: function(packet) {
        var event = this.events[packet.type];
        if (event) {
          this.dispatchEvent(event.read(packet));
        } else if (this.request.length > 0) {
          var request = this.requests.pop();
          if (packet.error)
            request.reject(packet);
          else
            request.resolve(packet);
        }
      },
      */
      requestTypes: function() {
        return this.request({
          to: this.id,
          type: "requestTypes"
        }).then(function(packet) {
          return packet.requestTypes;
        });
      }
    });
    types.primitive = new Primitve("primitive");
    types.string = new Primitve("string");
    types.number = new Primitve("number");
    types.boolean = new Primitve("boolean");
    types.json = new Primitve("json");
    types.array = new Primitve("array");
  },
  registerTypes: function(descriptor) {
    var specification = this.specification;
    values(descriptor.types).forEach(function(descriptor) {
      specification[descriptor.typeName] = descriptor;
    });
  }
});
exports.TypeSystem = TypeSystem;
