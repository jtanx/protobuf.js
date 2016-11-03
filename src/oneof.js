var ReflectionObject = require("./object"),
    Field = require("./field"),
    util  = require("./util");

module.exports = OneOf;

/**
 * Reflected OneOf.
 * @extends Namespace
 * @constructor
 * @param {string} name Oneof name
 * @param {!Array.<string>} [fieldNames] Field names
 * @param {!Object} [options] Oneof options
 */
function OneOf(name, fieldNames, options) {
    if (!util.isArray(fieldNames)) {
        options = fieldNames;
        fieldNames = undefined;
    }
    ReflectionObject.call(this, name, options);
    if (fieldNames && !util.isArray(fieldNames))
        throw util._TypeError("fieldNames", "Array");

    /**
     * Field names that belong to this oneof.
     * @type {!Array.<string>}
     */
    this.oneof = fieldNames || []; // exposed, marker

    /**
     * Fields that belong to this oneof and are possibly not yet added to its parent.
     * @type {!Array.<!Field>}
     * @private
     */
    this._fields = [];
}

var OneOfPrototype = ReflectionObject.extend(OneOf, [ "oneof" ]);

/**
 * Tests if the specified JSON object describes a oneof.
 * @param {!Object} json JSON object
 * @returns {boolean} `true` if the object describes a oneof
 */
OneOf.testJSON = function testJSON(json) {
    return Boolean(json.oneof);
};

/**
 * Constructs a oneof from JSON.
 * @param {string} name Oneof name
 * @param {!Object} json JSON object
 * @returns {!MapField} Created oneof
 * @throws {TypeError} If arguments are invalid
 */
OneOf.fromJSON = function fromJSON(name, json) {
    return new OneOf(name, json.oneof, json.options);
};

/**
 * Adds the fields of the specified oneof to the parent if not already done so.
 * @param {!OneOf} oneof The oneof
 * @returns {undefined}
 * @inner
 */
function addFieldsToParent(oneof) {
    if (oneof.parent)
        oneof._fields.forEach(function(field) {
            if (!field.parent)
                oneof.parent.add(field);
        });
}

/**
 * Adds a field to this oneof.
 * @override
 * @param {!Field} field Field to add
 * @returns {!OneOf} this
 */
OneOfPrototype.add = function add(field) {
    if (!(field instanceof Field))
        throw util._TypeError("field", "Field");
    if (field.parent)
        field.parent.remove(field);
    this._fields.push(field);
    field.partOf = this; // field.parent remains null
    addFieldsToParent(this);
    return this;
};

/**
 * Removes a field from this oneof.
 * @override
 * @param {!Field} field Field to remove
 * @returns {!OneOf} this
 */
OneOfPrototype.remove = function remove(field) {
    if (!(field instanceof Field))
        throw util._TypeError("field", "Field");
    var index = this._fields.indexOf(field);
    if (index < 0)
        throw Error(field + " is not a member of " + this);
    this._fields.splice(index, 1);
    index = this.oneof.indexOf(field.name);
    if (index > -1)
        this.oneof.splice(index, 1);
    if (field.parent)
        field.parent.remove(field);
    field.partOf = null;
    return this;
};

/**
 * @override
 */
OneOfPrototype.onAdd = function onAdd(parent) {
    ReflectionObject.prototype.onAdd.call(this, parent);
    addFieldsToParent(this);
};

/**
 * @override
 */
OneOfPrototype.onRemove = function onRemove(parent) {
    this._fields.forEach(function(field) {
        if (field.parent)
            field.parent.remove(field);
    });
    ReflectionObject.prototype.onRemove.call(this, parent);
};
