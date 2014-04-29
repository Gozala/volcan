(function(exports) {
"use strict";

var Class = require("./class").Class;
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

  return type || client.types[type];
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
  var subType = parts.slice(1);

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

var Dictionary = Class({
  exteds: Type,
  category: "dict",
  get name() { return this.type; },
  constructor: function(descriptor) {
    this.type = descriptor.typeName;
    this.types = descriptor.specializations;
  },
  read: function(input, client) {
    var output = {};
    for (var key in input) {
      output[key] = client.read(input[key], this.types[key]);
    }
    return output;
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
  },
  make: function(id, client) {
    var actor = client.make(id, this.type);
    client.marshallPool().manage(actor);
    return actor;
  },
  read: function(input, client, detail) {
    var id = typeof(input) === "string" ? input : input.actor;

    var actor = client.get(id) || this.make(id);
    actor.form(input, detail);

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
    this.responseType = query(descriptor.response, this.path)._retval;
    this.requestType = descriptor.request.type;

    var params = [];
    for (var key in descriptor.request) {
      if (key !== "type") {
        var param = descriptor.request[key];
        params[param._arg] = {
          type: param.type,
          key: key,
          index: param._arg
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

})(typeof(exports) !== "undefined" ? exports : this);

