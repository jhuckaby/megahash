// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

var MegaHash = require('bindings')('megahash').MegaHash;

const BH_TYPE_BUFFER = 0;
const BH_TYPE_STRING = 1;
const BH_TYPE_NUMBER = 2;
const BH_TYPE_BOOLEAN = 3;
const BH_TYPE_OBJECT = 4;
const BH_TYPE_BIGINT = 5;
const BH_TYPE_NULL = 6;

MegaHash.prototype.set = function(key, value) {
	// store key/value in hash, auto-convert format to buffer
	var flags = BH_TYPE_BUFFER;
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	var valueBuf = value;
	
	if (!Buffer.isBuffer(valueBuf)) {
		if (valueBuf === null) {
			valueBuf = Buffer.alloc(0);
			flags = BH_TYPE_NULL;
		}
		else if (typeof(valueBuf) == 'object') {
			valueBuf = Buffer.from( JSON.stringify(value) );
			flags = BH_TYPE_OBJECT;
		}
		else if (typeof(valueBuf) == 'number') {
			valueBuf = Buffer.alloc(8);
			valueBuf.writeDoubleBE( value );
			flags = BH_TYPE_NUMBER;
		}
		else if (typeof(valueBuf) == 'bigint') {
			valueBuf = Buffer.alloc(8);
			valueBuf.writeBigInt64BE( value );
			flags = BH_TYPE_BIGINT;
		}
		else if (typeof(valueBuf) == 'boolean') {
			valueBuf = Buffer.alloc(1);
			valueBuf.writeUInt8( value ? 1 : 0 );
			flags = BH_TYPE_BOOLEAN;
		}
		else {
			valueBuf = Buffer.from(''+value, 'utf8');
			flags = BH_TYPE_STRING;
		}
	}
	
	return this._set(keyBuf, valueBuf, flags);
};

MegaHash.prototype.get = function(key) {
	// fetch value given key, auto-convert back to original format
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	
	var value = this._get( keyBuf );
	if (!value || !value.flags) return value;
	
	switch (value.flags) {
		case BH_TYPE_NULL:
			value = null;
		break;
		
		case BH_TYPE_OBJECT: 
			value = JSON.parse( value.toString() ); 
		break;
		
		case BH_TYPE_NUMBER:
			value = value.readDoubleBE(); break;
		break;
		
		case BH_TYPE_BIGINT:
			value = value.readBigInt64BE(); break;
		break;
		
		case BH_TYPE_BOOLEAN:
			value = (value.readUInt8() == 1) ? true : false;
		break;
		
		case BH_TYPE_STRING:
			value = value.toString();
		break;
	}
	
	return value;
};

MegaHash.prototype.has = function(key) {
	// check existence of key
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	
	return this._has( keyBuf );
};

MegaHash.prototype.remove = MegaHash.prototype.delete = function(key) {
	// remove key/value pair given key
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	
	return this._remove( keyBuf );
};

MegaHash.prototype.nextKey = function(key) {
	// get next key given previous (or omit for first key)
	// convert all keys to strings
	if (typeof(key) == 'undefined') {
		var keyBuf = this._firstKey();
		return keyBuf ? keyBuf.toString() : undefined;
	}
	else {
		var keyBuf = this._nextKey( Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8') );
		return keyBuf ? keyBuf.toString() : undefined;
	}
};

MegaHash.prototype.length = function() {
	// shortcut for numKeys
	return this.stats().numKeys;
}

module.exports = MegaHash;
