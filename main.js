// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

var MegaHash = require('bindings')('megahash').MegaHash;

const MH_TYPE_BUFFER = 0;
const MH_TYPE_STRING = 1;
const MH_TYPE_NUMBER = 2;
const MH_TYPE_TRUE = 3;
const MH_TYPE_FALSE = 4;
const MH_TYPE_OBJECT = 5;
const MH_TYPE_BIGINT = 6;
const MH_TYPE_BIG_BIGINT_POS = 7;
const MH_TYPE_BIG_BIGINT_NEG = 8;
const MH_TYPE_NULL = 9;
const MH_TYPE_NAN = 10;
const MH_TYPE_INFINITY_POS = 11;
const MH_TYPE_INFINITY_NEG = 12;
const MH_TYPE_FUNCTION = 13;
const MH_TYPE_UNDEFINED = 14;

MegaHash.prototype.set = function(key, value) {
	// store key/value in hash, auto-convert format to buffer
	var flags = MH_TYPE_BUFFER;
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	var valueBuf;

	if(Buffer.isBuffer(value)) {
		valueBuf = value;
	}
	else {
		switch(typeof value) {
			case "undefined":
				flags = MH_TYPE_UNDEFINED;
			break;

			case "number":
				if(Number.isFinite(value)) {
					valueBuf = Buffer.allocUnsafe(8);
					valueBuf.writeDoubleBE(value);
					flags = MH_TYPE_NUMBER;
				} else {
					if(Number.isNaN(value)) {
						flags = MH_TYPE_NAN;
					} else {
						flags = value > 0 ? MH_TYPE_INFINITY_POS : MH_TYPE_INFINITY_NEG;
					}
				}
			break;

			case "boolean":
				flags = value ? MH_TYPE_TRUE : MH_TYPE_FALSE;
			break;

			case "bigint":
				if(value === BigInt.asIntN(64,value)) {
					valueBuf = Buffer.allocUnsafe(8);
					valueBuf.writeBigInt64BE(value);
					flags = MH_TYPE_BIGINT;
				} else {
					flags = value > 0n ? MH_TYPE_BIG_BIGINT_POS : MH_TYPE_BIG_BIGINT_NEG;
					value = value.toString(16);
					if(flags === MH_TYPE_BIG_BIGINT_NEG) { value = value.slice(1); }
					if(value.length % 2) { value = '0'+value; }
					valueBuf = Buffer.from(value, 'hex');
				}
			break;

			case "object":
				if(value === null) {
					flags = MH_TYPE_NULL;
				} else {
					valueBuf = Buffer.from(JSON.stringify(value));
					flags = MH_TYPE_OBJECT;
				}
			break;

			case "function":
				try {
					// check if function is serializable, otherwise it will throw when attempting to fetch it
					new Function(`return ${value.toString()}`);
				} catch(e) {
					throw new Error(`This function is not serializable - ${e.message} in "${value}"`);
				}
				valueBuf = Buffer.from(''+value, 'utf8');
				flags = MH_TYPE_FUNCTION;
			break;

			default: 
				if(value) {
					valueBuf = Buffer.from(''+value, 'utf8');
				}
				flags = MH_TYPE_STRING;
			break;
		}
	}
	
	return this._set(keyBuf, valueBuf, flags);
};

MegaHash.prototype.get = function(key) {
	// fetch value given key, auto-convert back to original format
	var keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(''+key, 'utf8');
	if (!keyBuf.length) throw new Error("Key must have length");
	
	var value = this._get( keyBuf );

	if(Buffer.isBuffer(value)) {
		if(!value.flags) return value;
		switch (value.flags) {
			case MH_TYPE_OBJECT: value = JSON.parse(value.toString()); break;
			case MH_TYPE_NUMBER: value = value.readDoubleBE(); break;
			case MH_TYPE_BIGINT: value = value.readBigInt64BE(); break;
			case MH_TYPE_BIG_BIGINT_POS: value = BigInt("0x"+value.hexSlice()); break;
			case MH_TYPE_BIG_BIGINT_NEG: value = -BigInt("0x"+value.hexSlice()); break;
			case MH_TYPE_FUNCTION: value = new Function(`return ${value.toString()}`)(); break;
			case MH_TYPE_STRING: value = value.toString(); break;
		}
	}
	else if(typeof value === "number") {
		switch (value) {
			case MH_TYPE_UNDEFINED: value = void 0;	break;
			case MH_TYPE_NULL: value = null; break;
			case MH_TYPE_NAN: value = NaN; break;
			case MH_TYPE_INFINITY_POS: value = Infinity; break;
			case MH_TYPE_INFINITY_NEG: value = -Infinity; break;
			case MH_TYPE_TRUE: value = true; break;
			case MH_TYPE_FALSE: value = false; break;
			case MH_TYPE_STRING: value = ""; break; // empty strings are short-circuited
		}
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
