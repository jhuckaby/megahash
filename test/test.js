// Unit tests for MegaHash
// Copyright (c) 2019 Joseph Huckaby

// Run via: npm test

const MegaHash = require('../');

module.exports = {
	tests: [
		
		function testBasicSet(test) {
			var hash = new MegaHash();
			hash.set("hello", "there");
			var stats = hash.stats();
			test.ok(stats.numKeys === 1, '1 key in stats');
			test.ok(stats.numIndexes === 1, '1 index in stats');
			test.ok(stats.dataSize === 10, '10 bytes in data store');
			test.ok(stats.indexSize > 0, 'Index size is non-zero');
			test.ok(stats.metaSize > 0, 'Meta size is non-zero');
			test.done();
		},
		
		function testString(test) {
			var hash = new MegaHash();
			hash.set("hello", "there");
			var value = hash.get("hello");
			test.ok(value === "there", 'Basic string set/get');
			test.done();
		},

		function testEmptyString(test) {
			var hash = new MegaHash();
			hash.set("hello", "");
			var value = hash.get("hello");
			test.ok(value === "", 'Empty string set/get');
			test.done();
		},
		
		function testUnicodeValue(test) {
			var hash = new MegaHash();
			hash.set("hello", "😃");
			var value = hash.get("hello");
			test.ok(value === "😃", 'Unicode value set/get');
			test.done();
		},
		
		function testUnicodeKey(test) {
			var hash = new MegaHash();
			hash.set("😃", "there");
			var value = hash.get("😃");
			test.ok(value === "there", 'Unicode key set/get');
			test.done();
		},
		
		function testEmptyKeyError(test) {
			test.expect(4);
			var hash = new MegaHash();
			
			try {
				hash.set("", "there");
			}
			catch (err) {
				test.ok( !!err, "Expected error with zero-length key (set)" );
			}
			
			try {
				var value = hash.get("");
			}
			catch (err) {
				test.ok( !!err, "Expected error with zero-length key (get)" );
			}
			
			try {
				var value = hash.has("");
			}
			catch (err) {
				test.ok( !!err, "Expected error with zero-length key (has)" );
			}
			
			try {
				hash.remove("");
			}
			catch (err) {
				test.ok( !!err, "Expected error with zero-length key (remove)" );
			}
			
			test.done();
		},
		
		function testBufferValue(test) {
			var hash = new MegaHash();
			hash.set("hello", Buffer.from("there"));
			var value = hash.get("hello");
			test.ok( Buffer.isBuffer(value), "Value is buffer" );
			test.ok( value.toString() === "there", 'Buffer set/get');
			test.done();
		},
		
		function testBufferKey(test) {
			var hash = new MegaHash();
			var keyBuf = Buffer.from("hello");
			hash.set(keyBuf, "there");
			var value = hash.get(keyBuf);
			test.ok(value === "there", 'Correct value with buffer key');
			test.done();
		},
		
		function testZeroLengthBuffer(test) {
			var hash = new MegaHash();
			hash.set("hello", Buffer.alloc(0));
			var value = hash.get("hello");
			test.ok( Buffer.isBuffer(value), "Value is buffer" );
			test.ok( value.length === 0, 'Buffer has zero length');
			test.done();
		},
		
		function testNumbers(test) {
			var hash = new MegaHash();
			
			hash.set("hello", 1);
			test.ok(hash.get("hello") === 1, 'Positive int set/get');
			
			hash.set("hello", 0);
			test.ok(hash.get("hello") === 0, 'Zero set/get');
			
			hash.set("hello", -1);
			test.ok(hash.get("hello") === -1, 'Negative int set/get');
			
			hash.set("hello", 42.8);
			test.ok(hash.get("hello") === 42.8, 'Positive float set/get');
			
			hash.set("hello", -9999.55);
			test.ok(hash.get("hello") === -9999.55, 'Negative float set/get');
			
			test.done();
		},
		
		function testNumberKeys(test) {
			var hash = new MegaHash();
			
			hash.set( 4, 772 );
			hash.set( 5, 9.99999999 );
			hash.set( 6, -0.00000001 );
			
			test.ok(hash.get(4) === 772, 'Number key set/get 1');
			test.ok(hash.get(5) === 9.99999999, 'Number key set/get 2');
			test.ok(hash.get(6) === -0.00000001, 'Number key set/get 3');
			
			test.done();
		},
		
		function testBigInts(test) {
			var hash = new MegaHash();
			
			hash.set( "big", 9007199254740993n );
			test.ok( hash.get("big") === 9007199254740993n, "Positive BigInt came through unscathed" );
			
			hash.set( "big2", -9007199254740992n );
			test.ok( hash.get("big2") === -9007199254740992n, "Negative BigInt came through unscathed" );

			hash.set( "big3", 90071998759837958703870284254740993n );
			test.ok( hash.get("big3") === 90071998759837958703870284254740993n, "Very big positive BigInt came through unscathed" );
			
			hash.set( "big4", -90071998759837958703870284254740993n );
			test.ok( hash.get("big4") === -90071998759837958703870284254740993n, "Very big negative BigInt came through unscathed" );

			test.done();
		},

		function testNaN(test) {
			var hash = new MegaHash();
			hash.set("nope", NaN);
			test.ok( Number.isNaN(hash.get("nope")), "NaN" );
			test.done();
		},

		function testInfinity(test) {
			var hash = new MegaHash();

			hash.set("infinity", Infinity);
			test.ok( hash.get("infinity") === Infinity, "Positive infinity" );

			hash.set("infinity2", -Infinity);
			test.ok( hash.get("infinity2") === -Infinity, "Negative infinity" );

			test.done();
		},
		
		function testNull(test) {
			var hash = new MegaHash();
			hash.set("nope", null);
			test.ok( hash.get("nope") === null, "Null is null" );
			test.done();
		},

		function testUndefined(test) {
			var hash = new MegaHash();
			hash.set("nope", undefined);
			test.ok( hash.get("nope") === undefined, "Undefined" );
			test.done();
		},

		function testFunction(test) {
			var hash = new MegaHash();
			var f = function(a) { return 10; };
			hash.set("function", f);
			var result = hash.get("function");
			test.ok( typeof result === "function" && result.toString() === f.toString(), "Function serialization" );
			test.done();
		},
		
		function testBooleans(test) {
			var hash = new MegaHash();
			hash.set("yes", true);
			hash.set("no", false);
			var yes = hash.get("yes");
			test.ok(yes === true, 'Boolean true');
			var no = hash.get("no");
			test.ok(no === false, 'Boolean false');
			test.done();
		},
		
		function testObjects(test) {
			var hash = new MegaHash();
			hash.set("obj", { hello: "there", num: 82 });
			var value = hash.get("obj");
			test.ok( !!value, "Got object value" );
			test.ok( typeof(value) == 'object', "Value has correct type" );
			test.ok( value.hello === "there", "String inside object is correct" );
			test.ok( value.num === 82, "Number inside object is correct" );
			test.done();
		},
		
		function testManyKeys(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 1000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			for (var idx = 0; idx < 1000; idx++) {
				var value = hash.get( "key" + idx );
				test.ok( value === "value here " + idx );
			}
			test.ok( hash.get("noexist") === undefined, "Missing key" );
			test.done();
		},
		
		function testReplace(test) {
			var hash = new MegaHash();
			hash.set("hello", "there");
			hash.set("hello", "foobar");
			test.ok( hash.get("hello") === "foobar", "Replaced value is correct" );
			
			var stats = hash.stats();
			test.ok(stats.numKeys === 1, '1 key in stats');
			test.ok(stats.numIndexes === 1, '1 index in stats');
			test.ok(stats.dataSize === 11, '11 bytes in data store');
			test.ok(stats.indexSize > 0, 'Index size is non-zero');
			test.ok(stats.metaSize > 0, 'Meta size is non-zero');
			test.done();
		},
		
		function testSetReturnValue(test) {
			// make sure set() returns the expected return values
			var hash = new MegaHash();
			test.ok( hash.set("hello", "there") == 1, "Unique key returns 1 on set" );
			test.ok( hash.set("hello", "there") == 2, "Replaced key returns 2 on set" );
			test.done();
		},
		
		function testRemove(test) {
			var hash = new MegaHash();
			hash.set("key1", "value1");
			hash.set("key2", "value2");
			
			test.ok( !!hash.remove("key1"), "remove returned true for good key" );
			test.ok( !hash.remove("key3"), "remove returned false for missing key" );
			
			test.ok( !hash.has("key1"), "Key1 was removed" );
			test.ok( hash.has("key2"), "Key2 is still there" );
			
			var stats = hash.stats();
			test.ok(stats.numKeys === 1, '1 key in stats');
			test.ok(stats.dataSize === 10, '10 bytes in data store');
			test.ok(stats.numIndexes === 1, '1 index in stats');
			
			test.done();
		},
		
		function testRemoveMany(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 1000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			for (var idx = 0; idx < 1000; idx += 2) {
				// remove even keys, leave odd ones
				hash.remove( "key" + idx );
			}
			for (var idx = 0; idx < 1000; idx++) {
				var result = hash.has( "key" + idx );
				// test.debug( '' + idx + ": " + result + "\n" );
				test.ok( (idx % 2 == 0) ? !result : result, "Odd keys should exist, even keys should not" );
			}
			
			var stats = hash.stats();
			test.ok( stats.numKeys == 500, "500 keys remain" );
			
			test.done();
		},
		
		function testClear(test) {
			var hash = new MegaHash();
			hash.set("key1", "value1");
			hash.set("key2", "value2");
			hash.clear();
			
			var stats = hash.stats();
			test.ok(stats.numKeys === 0, '0 keys in stats: ' + stats.numKeys);
			test.ok(stats.dataSize === 0, '0 bytes in data store: ' + stats.dataSize);
			test.ok(stats.metaSize === 0, '0 bytes in meta store: ' + stats.metaSize);
			test.ok(stats.numIndexes === 1, '1 index in stats');
			
			test.done();
		},
		
		function testClearMany(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 1000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			hash.clear();
			
			var stats = hash.stats();
			test.ok(stats.numKeys === 0, '0 keys in stats');
			test.ok(stats.dataSize === 0, '0 bytes in data store');
			test.ok(stats.numIndexes === 1, '1 index in stats');
			
			test.done();
		},
		
		function testClearSlices(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 1000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			
			var lastNumKeys = hash.stats().numKeys;
			for (var idx = 0; idx < 256; idx++) {
				hash.clear(idx);
				var numKeys = hash.stats().numKeys;
				test.ok( numKeys <= lastNumKeys, "numKeys is dropping" );
				lastNumKeys = numKeys;
			}
			
			var stats = hash.stats();
			test.ok(stats.numKeys === 0, '0 keys in stats: ' + stats.numKeys);
			test.ok(stats.dataSize === 0, '0 bytes in data store: ' + stats.dataSize);
			test.ok(stats.numIndexes === 1, '1 index in stats: ' + stats.numIndexes);
			
			test.done();
		},
		
		function testKeyIteration(test) {
			var hash = new MegaHash();
			hash.set("key1", "value1");
			hash.set("key2", "value2");
			
			var key = hash.nextKey();
			test.ok( !!key, "Got key from nextKey" );
			test.ok( key.match(/^(key1|key2)$/), "Key is one or the other" );
			
			key = hash.nextKey(key);
			test.ok( !!key, "Got another key from nextKey" );
			test.ok( key.match(/^(key1|key2)$/), "Key is one or the other" );
			
			key = hash.nextKey(key);
			test.ok( !key, "Nothing after 2nd key, end of list" );
			
			test.done();
		},
		
		function testKeyIteration1000(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 1000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			
			var key = hash.nextKey();
			var idx = 0;
			var allKeys = new Map();
			
			while (key) {
				test.ok( !allKeys.has(key), "Key is unique" );
				allKeys.set( key, true );
				idx++;
				key = hash.nextKey(key);
			}
			
			test.ok( idx == 1000, "Iterated exactly 1000 times: " + idx );
			test.done();
		},
		
		function testKeyIterationRemoval500(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 1000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			for (var idx = 0; idx < 1000; idx += 2) {
				// remove even keys, leave odd ones
				hash.remove( "key" + idx );
			}
			
			var key = hash.nextKey();
			var idx = 0;
			var allKeys = new Map();
			
			while (key) {
				test.ok( key.match(/^key\d*[13579]$/), "Key is odd: " + key );
				test.ok( !allKeys.has(key), "Key is unique" );
				allKeys.set( key, true );
				idx++;
				key = hash.nextKey(key);
				test.debug("KEY: '" + key + "'");
			}
			
			test.ok( idx == 500, "Iterated exactly 500 times: " + idx );
			test.done();
		},
		
		function testKeyIteration10000(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 10000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			
			var key = hash.nextKey();
			var idx = 0;
			var allKeys = new Map();
			
			while (key) {
				test.ok( !allKeys.has(key), "Key is unique" );
				allKeys.set( key, true );
				idx++;
				key = hash.nextKey(key);
			}
			
			test.ok( idx == 10000, "Iterated exactly 10000 times: " + idx );
			test.done();
		},
		
		function testKeyIterationRemoval5000(test) {
			var hash = new MegaHash();
			for (var idx = 0; idx < 10000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			for (var idx = 0; idx < 10000; idx += 2) {
				// remove even keys, leave odd ones
				hash.remove( "key" + idx );
			}
			
			var key = hash.nextKey();
			var idx = 0;
			var allKeys = new Map();
			
			while (key) {
				test.ok( key.match(/^key\d*[13579]$/), "Key is odd: " + key );
				test.ok( !allKeys.has(key), "Key is unique" );
				allKeys.set( key, true );
				idx++;
				key = hash.nextKey(key);
			}
			
			test.ok( idx == 5000, "Iterated exactly 5000 times: " + idx );
			test.done();
		},
		
		function testKeyIterationEmpty(test) {
			var hash = new MegaHash();
			
			var key = hash.nextKey();
			test.ok( !key, "Nothing in empty hash" );
			
			test.done();
		},
		
		function testKeyIterationBad(test) {
			var hash = new MegaHash();
			hash.set("key1", "value1");
			hash.set("key2", "value2");
			
			var key = hash.nextKey("key3");
			test.ok( !key, "nextKey found nothing with missing key" );
			
			test.done();
		},
		
		function testReindex(test) {
			// add enough keys so we trigger at least one reindex
			var hash = new MegaHash();
			for (var idx = 0; idx < 10000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			for (var idx = 0; idx < 10000; idx++) {
				var value = hash.get("key" + idx);
				if (value !== "value here " + idx) {
					test.ok( false, "Key " + idx + " does not match spec after reindex: " + value );
				}
			}
			
			var stats = hash.stats();
			test.debug( JSON.stringify(stats) );
			test.ok(stats.numKeys === 10000, 'Correct keys in stats: ' + stats.numKeys);
			test.ok(stats.numIndexes > 1, 'More indexes in stats: ' + stats.numIndexes);
			test.done();
		},
		
		function testSimilarDigests(test) {
			// test two keys with similar computed digests
			var hash = new MegaHash();
			
			for (var idx = 0; idx < 100000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			
			var key1 = "4723640122";
			var key2 = "4723640123";
			
			hash.set(key1, "value1");
			hash.set(key2, "value2");
			
			test.ok( hash.get(key1) === "value1", "Key '" + key1 + "' does not equal expected value.");
			test.ok( hash.get(key2) === "value2", "Key '" + key2 + "' does not equal expected value.");
			test.done();
		},
		
		function testSimilarDigestsWithReplace(test) {
			// test two keys with similar computed digests, replacing one
			var hash = new MegaHash();
			
			for (var idx = 0; idx < 100000; idx++) {
				hash.set( "key" + idx, "value here " + idx );
			}
			
			var key1 = "4723640122";
			var key2 = "4723640123";
			
			hash.set(key1, "value1");
			hash.set(key2, "value2");
			hash.set(key1, "value1_REPLACED"); // replace first value after setting second
			
			test.ok( hash.get(key1) === "value1_REPLACED", "Key '" + key1 + "' does not equal expected value.");
			test.ok( hash.get(key2) === "value2", "Key '" + key2 + "' does not equal expected value.");
			test.done();
		}
		
	]
};
