// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

var MegaHash = require('bindings')('megahash').MegaHash;

const MH_TYPE_BUFFER = 0;
const MH_TYPE_STRING = 1;
const MH_TYPE_NUMBER = 2;
const MH_TYPE_BOOLEAN = 3;
const MH_TYPE_OBJECT = 4;
const MH_TYPE_BIGINT = 5;
const MH_TYPE_NULL = 6;

MegaHash.prototype.set = function(key, value) {
	// store key/value in hash, auto-convert format to buffer
	var flags = MH_TYPE_BUFFER;
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	var valueBuf = value;
	
	if (!Buffer.isBuffer(valueBuf)) {
		if (valueBuf === null) {
			valueBuf = Buffer.alloc(0);
			flags = MH_TYPE_NULL;
		}
		else if (typeof(valueBuf) == 'object') {
			valueBuf = Buffer.from( JSON.stringify(value) );
			flags = MH_TYPE_OBJECT;
		}
		else if (typeof(valueBuf) == 'number') {
			valueBuf = Buffer.alloc(8);
			valueBuf.writeDoubleBE( value );
			flags = MH_TYPE_NUMBER;
		}
		else if (typeof(valueBuf) == 'bigint') {
			valueBuf = Buffer.alloc(8);
			valueBuf.writeBigInt64BE( value );
			flags = MH_TYPE_BIGINT;
		}
		else if (typeof(valueBuf) == 'boolean') {
			valueBuf = Buffer.alloc(1);
			valueBuf.writeUInt8( value ? 1 : 0 );
			flags = MH_TYPE_BOOLEAN;
		}
		else {
			valueBuf = Buffer.from(''+value, 'utf8');
			flags = MH_TYPE_STRING;
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
		case MH_TYPE_NULL:
			value = null;
		break;
		
		case MH_TYPE_OBJECT: 
			value = JSON.parse( value.toString() ); 
		break;
		
		case MH_TYPE_NUMBER:
			value = value.readDoubleBE();
		break;
		
		case MH_TYPE_BIGINT:
			value = value.readBigInt64BE();
		break;
		
		case MH_TYPE_BOOLEAN:
			value = (value.readUInt8() == 1) ? true : false;
		break;
		
		case MH_TYPE_STRING:
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
