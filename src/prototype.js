module.exports = Prototype;

var util = require("./util"),
    Type = require("./type");

/**
 * Runtime message prototype ready to be extended by custom classes or generated code.
 * @constructor
 * @param {Object.<string,*>} [properties] Properties to set on the instance. Only relevant when extended.
 * @abstract
 * @see {@link Type#create}
 */
function Prototype(properties) {
    if (properties)
        Object.keys(properties).forEach(function(key) {
            if (this.constructor.$type.fields[key])
                this[key] = properties[key];
        }, this);

    // NOTE: Extending Prototype leaves optimization up to you. This method is here as a simple
    // way to set only properties that actually reference a field, so that instances have a fixed
    // set of fields and hopefully do not resort to become a hashmap. If you need your classes to
    // copy any properties for example, you can do that by implementing initialization yourself,
    // not calling this method from your constructor at all.
}

/**
 * Makes the specified constructor extend the runtime message prototype.
 * @param {function(new:Message)} constructor Constructor to extend
 * @param {Type} type Reflected message type
 * @param {Object.<string,*>} [options] Additional options
 * @param {boolean} [options.noStatics=false] Skips adding the default static methods on the constructor
 * @param {boolean} [options.noRegister=false] Skips registering the constructor with the reflected type
 * @returns {Object} Prototype
 */
Prototype.extend = function extend(constructor, type, options) {
    if (!util.isFunction(constructor))
        throw util._TypeError("constructor", "a function");
    if (!(type instanceof Type))
        throw util._TypeError("type", "a Type");
    if (!options)
        options = {};

    // Underlying reflected message type for reference
    constructor.$type = type;

    if (!options.noStatics) {

        // Creates a new message
        constructor.create = function(properties) {
            return this.$type.create(properties, constructor);
        };

        // Encodes to a buffer
        constructor.encode = function encode(message) {
            return this.$type.encode(message).finish();
        };

        // Encodes to a buffer, length delimited
        constructor.encodeDelimited = function encodeDelimited(message) {
            return this.$type.encodeDelimited(message).finish();
        };

        // Decodes from a buffer
        constructor.decode = function decode(buffer) {
            return this.$type.decode(buffer, constructor);
        };

        // Decodes from a buffer, length delimited
        constructor.decodeDelimited = function decodeDelimited(buffer) {
            return this.$type.decodeDelimited(buffer, constructor);
        };

    }

    var prototype = Prototype.init(new Prototype(), type);
    constructor.prototype = prototype;
    prototype.constructor = constructor;

    // Register the now-known constructor for this type
    if (!options.noRegister)
        type.register(constructor);

    return prototype;
};

/**
 * Initializes the specified prototype with the required references and getters/setters for the
 * reflected type's fields.
 * @param {Prototype} prototype Prototype to initialize
 * @param {Type} type Reflected message type
 * @returns {Prototype} prototype
 */
Prototype.init = function init(prototype, type) {

    var defaultValues = {};
    
    var defineProperties = {

        /**
         * Reflected type.
         * @name Prototype#$type
         * @type {Type}
         */
        $type: {
            value: type,
            enumerable: false
        },

        /**
         * Field values.
         * @name Prototype#$values
         * @type {Object.<string,*>}
         */
        $values: {
            value: defaultValues,
            enumerable: false
        },

        /**
         * Field names of the respective fields set for each oneof.
         * @name Prototype#$oneofs
         * @type {Object.<string,string>}
         */
        $oneofs: {
            value: {},
            enumerable: false
        }
    };

    // Initialize default values and define each field with a getter and a setter
    type.fieldsArray.forEach(function(field) {
        field.resolve();
        defaultValues[field.name] = field.defaultValue;
        defineProperties[field.name] = {
            get: function() {
                return this.$values[field.name];
            },
            set: function(value) {
                if (field.partOf) { // Handle oneof side effects
                    var fieldNameSet = this.$oneofs[field.partOf.name];
                    if (value === undefined || value === null) {
                        if (fieldNameSet === field.name)
                            this.$oneofs[field.partOf.name] = undefined;
                        this.$values[field.name] = field.defaultValue;
                    } else {
                        if (fieldNameSet !== undefined)
                            this.$values[fieldNameSet] = type.fields[fieldNameSet].defaultValue;
                        this.$values[field.name] = value;
                        this.$oneofs[field.partOf.name] = field.name;
                    }
                } else // Just set the value and reset to the default when unset
                    this.$values[field.name] = value === undefined || value === null
                        ? field.defaultValue
                        : value;
            },
            enumerable: true
        };
    });

    // Define each oneof with a non-enumerable getter returning the name of the currently set field
    type.oneofsArray.forEach(function(oneof) {
        oneof.resolve();
        defineProperties[oneof.name] = {
            get: function() {
                return this.$oneofs[oneof.name];
            },
            enumerable: false
        };
    });

    Object.defineProperties(prototype, defineProperties);
    return prototype;
};
