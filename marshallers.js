"use strict";

var Class = require("./class").Class;
var Front = require("./front").Front;
var util = require("./util");
var keys = util.keys;
var values = util.values;
var pairs = util.pairs;
var query = util.query;
var findPath = util.findPath;

var typeFor = function(client, typeName) {
  typeName = typeName || "primitive";
  var type = client.types[typeName] || bultins[typeName];
  if (!type)
    defineType(client, typeName);

  return type || client.types[typeName];
};
exports.typeFor = typeFor;

var defineType = function(client, descriptor) {
  var type = void(0)
  if (typeof(descriptor) === "string") {
    if (descriptor.indexOf(":") > 0)
      type = makeCompoundType(descriptor);
    else if (descriptor.indexOf("#") > 0)
      type = new ActorDetail(descriptor);
    else if (client.specification[descriptor])
      type = makeCategoryType(client.specification[descriptor]);
  } else {
    type = makeCategoryType(descriptor);
  }

  if (type)
    client.types[type.name] = type;
  else
    throw TypeError("Invalid type: " + descriptor);
};
exports.defineType = defineType;


var makeCompoundType = function(name) {
  var index = name.indexOf(":");
  var baseType = name.slice(0, index);
  var subType = name.slice(index + 1);

  return baseType === "array" ? new ArrayOf(subType) :
         baseType === "nullable" ? new Maybe(subType) :
         null;
};
exports.makeCompoundType = makeCompoundType;

var makeCategoryType = function(descriptor) {
  var category = descriptor.category;
  return category === "dict" ? new Dictionary(descriptor) :
         category === "actor" ? new Actor(descriptor) :
         null;
};
exports.makeCategoryType = makeCompoundType;


var Type = Class({
  constructor: function() {
  },
  get name() {
    return this.category ? this.category + ":" + this.type :
           this.type;
  },
  read: function(input, client) {
    throw new TypeError("`Type` subclass must implement `read`");
  },
  write: function(input, client) {
    throw new TypeError("`Type` subclass must implement `write`");
  }
});

var Primitve = Class({
  extends: Type,
  constuctor: function(type) {
    this.type = type;
  },
  read: function(input, client) {
    return input;
  },
  write: function(input, client) {
    return input;
  }
});
exports.Primitve = Primitve;

var Maybe = Class({
  extends: Type,
  category: "nullable",
  constructor: function(type) {
    this.type = type;
  },
  read: function(input, client) {
    return input === null ? null :
           input === void(0) ? void(0) :
           client.read(input, this.type);
  },
  write: function(input, client) {
    return input === null ? null :
           input === void(0) ? void(0) :
           client.write(input, this.type);
  }
});
exports.Maybe = Maybe;

var ArrayOf = Class({
  extends: Type,
  category: "array",
  constructor: function(type) {
    this.type = type;
  },
  read: function(input, client) {
    var type = this.type;
    return input.map(function($) { return client.read($, type) });
  },
  write: function(input, client) {
    var type = this.type;
    return input.map(function($) { return client.write($, type) });
  }
});
exports.ArrayOf = ArrayOf;

function makeField(name, type) {
  return {
    enumerable: true,
    configurable: true,
    get: function() {
      Object.defineProperty(this, name, {
        configurable: false,
        value: this.client.read(this.state[name], type)
      });
      return this[name];
    }
  }
}
exports.makeField = makeField;

var Dictionary = Class({
  exteds: Type,
  category: "dict",
  get name() { return this.type; },
  constructor: function(descriptor) {
    this.type = descriptor.typeName;
    this.types = descriptor.specializations;

    var getters = {};
    pairs(descriptor.specializations).forEach(function(pair) {
      var key = pair[0], type = pair[1];
      getters[key] = makeField(key, type);
    });

    var proto = Object.defineProperties({
      types: this.types,
      constructor: function(input, client) {
        this.state = input;
        this.client = client;
      }
    }, getters);

    this.class = new Class(proto);
  },
  read: function(input, client) {
    return new this.class(input, client);
  },
  write: function(input, client) {
    var output = {};
    for (var key in input) {
      output[key] = client.write(value, this.types[key]);
    }
    return output;
  }
});
exports.Dictionary = Dictionary;

var Actor = Class({
  exteds: Type,
  category: "actor",
  get name() { return this.type; },
  constructor: function(descriptor) {
    this.type = descriptor.typeName;


    var events = Object.create(null);
    var fields = {};
    var proto = {
      extends: Front,
      Front: Front,
      constructor: function(state, client) {
        this.state = state;
        this.Front(client);
      },
      events: events
    };

    (descriptor.methods || []).forEach(function(descriptor) {
      proto[descriptor.name] = makeMethod(descriptor);
    });

    pairs(descriptor.events || {}).forEach(function(pair) {
      var name = pair[0], descriptor = pair[1];
      events[name] = new Event(descriptor);
    });

    pairs(descriptor.fields || {}).forEach(function(pair) {
      var name = pair[0], type = pair[1];
      fields[name] = makeField(name, type);
    });

    this.class = Class(Object.defineProperties(proto, fields));
  },
  read: function(input, client, detail) {
    var state = typeof(input) === "string" ? { actor: input } :
                input;

    var actor = client.get(state.actor) || new this.class(state, client);
    // client.marshallPool().manage(actor);
    actor.form(state, detail);

    return actor;
  },
  write: function(input, client, detail) {
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
  read: function(input, client) {
    typeFor(client, this.actor).read(input, client, this.detail);
  },
  write: function(input, client) {
    typeFor(client, this.actor).write(input, client, this.detail);
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
  read: function(input, client) {
    return client.read(query(input, this.path), this.responseType);
  },
  write: function(input, client) {
    return this.params.reduce(function(result, param) {
      result[param.key] = client.write(input[param.index], param.type);
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


var primitive = new Primitve("primitive");
var string = new Primitve("string");
var number = new Primitve("number");
var boolean = new Primitve("boolean");
var json = new Primitve("json");
var array = new Primitve("array");
var bultins = {
  primitive: primitive,
  string: string,
  number: number,
  boolean: boolean,
  json: json,
  array: array
};

var TypedValue = Class({
  extends: Type,
  constructor: function(name, type) {
    this.TypedValue(name, type);
  },
  TypedValue: function(name, type) {
    this.name = name;
    this.type = type;
  },
  read: function(input, client) {
    return this.client.read(input, this.type);
  },
  write: function(input, client) {
    return this.client.write(input, this.type);
  }
});

var Return = Class({
  extends: TypedValue,
  constructor: function(type) {
    this.type = type
  }
});

var Argument = Class({
  extends: TypedValue,
  constructor: function(index, type) {
    this.Argument(index, type);
  },
  Argument: function(index, type) {
    this.index = index;
    this.TypedValue("argument[" + index + "]", type);
  },
  read: function(input, client, target) {
    return target[this.index] = client.read(input, this.type);
  }
});

var Option = Class({
  extends: Argument,
  constructor: function(index, type) {
    return this.Argument(index, type);
  },
  read: function(input, client, target, name) {
    var param = target[this.index] || (target[this.index] = {});
    param[name] = input === void(0) ? input : client.read(input, this.type);
  },
  write: function(input, client, name) {
    var value = input && input[name];
    return value === void(0) ? value : client.write(value, this.type);
  }
});


var Event = Class({
  constructor: function(descriptor) {
    this.name = descriptor.type;
    this.eventType = descriptor.type;
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
  read: function(input, client) {
    var output = {};
    var types = this.types;
    for (var key in input) {
      output[key] = client.read(input[key], types[key]);
    }
    return output;
  },
  write: function(input, client) {
    var output = {};
    var types = this.types;
    for (var key in this.types) {
      output[key] = client.write(input[key], types[key]);
    }
    return output;
  }
});
exports.Event = Event;
