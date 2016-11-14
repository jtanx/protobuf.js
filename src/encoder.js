module.exports = Encoder;

var Enum    = require("./enum"),
    types   = require("./types"),
    util    = require("./util");

/**
 * Constructs a new encoder for the specified message type.
 * @classdesc Wire format encoder using code generation on top of reflection
 * @constructor
 * @param {Type} type Message type
 */
function Encoder(type) {

    /**
     * Message type.
     * @type {Type}
     */
    this.type = type;
}

/** @alias Encoder.prototype */
var EncoderPrototype = Encoder.prototype;

/**
 * Encodes a message of this encoder's message type.
 * @param {Prototype|Object} message Runtime message or plain object to encode
 * @param {Writer} writer Writer to encode to
 * @returns {Writer} writer
 */
EncoderPrototype.encode = function encode_fallback(message, writer) { // codegen reference and fallback
    /* eslint-disable block-scoped-var, no-redeclare */
    var fieldsArray = this.type.fieldsArray,
        fieldsCount = fieldsArray.length;

    for (var fi = 0; fi < fieldsCount; ++fi) {
        var field    = fieldsArray[fi].resolve(),
            type     = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type];

        // Map fields
        if (field.map) {
            var keyType     = field.resolvedKeyType /* only valid is enum */ ? "uint32" : field.keyType,
                keyWireType = types.mapKey[keyType];
            var value, keys;
            if ((value = message[field.name]) && (keys = Object.keys(value)).length) {
                writer.tag(field.id, 2).fork();
                for (var i = 0, k = keys.length, key; i < k; ++i) {
                    writer.tag(1, keyWireType)[keyType](key = keys[i]);
                    if (wireType !== undefined)
                        writer.tag(2, wireType)[type](value[key]);
                    else
                        field.resolvedType.encode_(value[key], writer.tag(2, 2).fork()).ldelim();
                }
                writer.ldelim();
            }

        // Repeated fields
        } else if (field.repeated) {
            var values = message[field.name], i = 0, k = values.length;

            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) {
                if (k) {
                    writer.tag(field.id, 2).fork();
                    while (i < k)
                        writer[type](values[i++]);
                    writer.ldelim();
                }

            // Non-packed
            } else {
                while (i < k)
                    field.resolvedType.encode_(values[i++], writer.tag(field.id, 2).fork()).ldelim();
            }

        // Non-repeated
        } else {
            var value = message[field.name],
                strict = typeof field.defaultValue === 'object' || field.long;
            if (field.required || strict && value !== field.defaultValue || !strict && value != field.defaultValue) { // eslint-disable-line eqeqeq
                if (wireType !== undefined)
                    writer.tag(field.id, wireType)[type](value);
                else
                    field.resolvedType.encode_(value, writer.tag(field.id, 2).fork()).ldelim();
            }
        }
    }
    return writer;
    /* eslint-enable block-scoped-var, no-redeclare */
};

/**
 * Generates an encoder specific to this encoder's message type.
 * @returns {function} Encoder function with an identical signature to {@link Encoder#encode}
 */
EncoderPrototype.generate = function generate() {
    /* eslint-disable no-unexpected-multiline */
    var fieldsArray = this.type.fieldsArray,
        fieldsCount = fieldsArray.length;
    var gen = util.codegen("m", "w");
    
    for (var i = 0; i < fieldsCount; ++i) {
        var field = fieldsArray[i].resolve();
        var type = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type],
            prop = util.safeProp(field.name);
        
        // Map fields
        if (field.map) {
            var keyType = field.resolvedKeyType /* only valid is enum */ ? "uint32" : field.keyType,
                keyWireType = types.mapKey[keyType];
            gen

    ("var o=m%s,ks", prop)
    ("if(o&&(ks=Object.keys(o)).length){")
        ("w.tag(%d,2).fork()", field.id)
        ("for(var i=0,l=ks.length,k;i<l;++i){")
            ("w.tag(1,%d).%s(k=ks[i])", keyWireType, keyType);
            if (wireType !== undefined) gen
            ("w.tag(2,%d).%s(o[k])", wireType, type);
            else gen
            ("$t[%d].encode_(o[k],w.tag(2,2).fork()).ldelim()", i);
            gen
        ("}")
        ("w.ldelim()")
    ("}");

        // Repeated fields
        } else if (field.repeated) { gen
    
    ("var vs=m%s,i=0,k=vs.length", prop);

            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) { gen

    ("if(k>0){")
        ("w.tag(%d,2).fork()", field.id)
        ("while(i<k)")
            ("w.%s(vs[i++])", type)
        ("w.ldelim()")
    ("}");

            // Non-packed
            } else { gen

    ("while(i<k)")
        ("$t[%d].encode_(vs[i++],w.tag(%d,2).fork()).ldelim()", i, field.id);

            }

        // Non-repeated
        } else {
            if (!field.required) gen
    ("if(m%s%s%j)", prop, typeof field.defaultValue === 'object' || field.long ? "!==" : "!=", field.defaultValue); 
            if (wireType !== undefined) gen
        ("w.tag(%d,%d).%s(m%s)", field.id, wireType, type, prop);
            else gen
        ("$t[%d].encode_(m%s,w.tag(%d,2).fork()).ldelim()", i, prop, field.id);
    
        }
    }
    return gen
    ("return w")
    .eof(this.type.fullName + "$encode", {
        $t: fieldsArray.map(function(fld) { return fld.resolvedType; })
    });
    /* eslint-enable no-unexpected-multiline */
};
