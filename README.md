<details><summary>Table of Contents</summary>

<!-- toc -->
- [Overview](#overview)
	* [MegaHash Features](#megahash-features)
	* [Performance](#performance)
		+ [Memory Usage](#memory-usage)
		+ [1 Billion Keys](#1-billion-keys)
- [Installation](#installation)
- [Usage](#usage)
	* [Setting and Getting](#setting-and-getting)
		+ [Buffers](#buffers)
		+ [Strings](#strings)
		+ [Objects](#objects)
		+ [Numbers](#numbers)
		+ [BigInts](#bigints)
		+ [Booleans](#booleans)
		+ [Null](#null)
	* [Deleting and Clearing](#deleting-and-clearing)
	* [Iterating over Keys](#iterating-over-keys)
	* [Hash Stats](#hash-stats)
- [API](#api)
	* [set](#set)
	* [get](#get)
	* [has](#has)
	* [delete](#delete)
	* [clear](#clear)
	* [nextKey](#nextkey)
	* [length](#length)
	* [stats](#stats)
- [Internals](#internals)
	* [Limits](#limits)
	* [Memory Overhead](#memory-overhead)
- [Future](#future)
- [License](#license)

</details>

# Overview

**MegaHash** is a super-fast C++ [hash table](https://en.wikipedia.org/wiki/Hash_table) with a Node.js wrapper, capable of storing over 1 billion keys, has read/write speeds above 500,000 keys per second (depending on CPU speed and total keys in hash), and relatively low memory overhead.  This module is designed primarily as a replacement for [ES6 Maps](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), which seem to crash Node.js after about 15 million keys.

I do know of the [hashtable](https://www.npmjs.com/package/hashtable) module on NPM, and have used it in the past.  The problem is, that implementation stores everything on the V8 heap, so it runs into serious performance dips with tens of millions of keys (see below).  Also, it seems like the author may have abandoned it (open issues are going unanswered), and it doesn't compile on Node v12.

## MegaHash Features

- Very fast reads, writes, deletes and key iteration.
- Stable, predictable performance.
- Low memory overhead.
- All data is stored off the V8 heap.
- Buffers, strings, numbers, booleans and objects are supported.
- Tested up to 1 billion keys.
- Mostly compatible with the basic ES6 Map API.

## Performance

For performance benchmarking, we compare MegaHash to the native Node.js [ES6 Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), the C++ [std::unordered_map](https://en.cppreference.com/w/cpp/container/unordered_map) (with Node.js wrapper), and also the NPM [hashtable](https://www.npmjs.com/package/hashtable) module.  All tests were run on a AWS [c5.9xlarge](https://aws.amazon.com/ec2/instance-types/c5/) virtual machine with Node v12.11.1 (and Node v6 for the hashtable module).  Keys were varied between 1 to 9 bytes in length, and values were between 96 to 128 bytes.

Here are write speeds up to 100 million keys *(higher is better)*:

![](https://pixlcore.com/software/megahash/docs/perf-writes-100m-4bit.png)

A few things to note here.  First, with hash sizes under 5 million keys, the native Node.js ES6 Map absolutely blows everything else out of the water.  It is **lightning fast**.  However, as you can see, performance dips quickly thereafter, and the line stops abruptly around 15 million keys, which is where Node.js [crashes](https://gist.github.com/jhuckaby/cb0ac839cd704ec28b122555fe8c8bf8).  This seems like some kind of hard key limit with Maps, as it dies here every time (yes, I increased the memory with `--max-old-space-size`).

The NPM [hashtable](https://www.npmjs.com/package/hashtable) module made it all the way, but unfortunately has some severe performance dips, where it totally stalls out for up to a minute or more, then picks back up again.  This trend continues all the way to 100M keys.  The overall average was only 30,000 keys per second for this module, due to all the stalling.

The C++ [std::unordered_map](https://en.cppreference.com/w/cpp/container/unordered_map) (with a Node.js wrapper) performs pretty well, but also suffers from occasional performance dips, presumably when it resizes its indexes (as the dips also correspond with a sharp increase in performance).

And here are random read speeds up to 100 million keys *(higher is better)*:

![](https://pixlcore.com/software/megahash/docs/perf-reads-100m-4bit.png)

Basically the same story here with ES6 Maps.  With smaller hash sizes, it is the clear winner by a mile, topping out at almost 1.5 million keys per second.  But again, with hashes over 10M keys, it starts to get very wonky, intermittently stalling out, and finally [hard crashes Node.js](https://gist.github.com/jhuckaby/cb0ac839cd704ec28b122555fe8c8bf8).

For reading random keys, the graph seems to indicate that [hashtable](https://www.npmjs.com/package/hashtable) comes out ahead of MegaHash.  But as you can see it still has performance dips, where it drops to almost 0 keys/sec in a full on "stall", then it recovers.  I suspect this is because all data is stored on the V8 heap (just a guess).

The C++ [std::unordered_map](https://en.cppreference.com/w/cpp/container/unordered_map) performs the best overall with random reads, beating MegaHash consistently all the way to 100M keys.  However, MegaHash wins in both write performance, and memory usage (see below).

### Memory Usage

Here is a look at process memory usage up to 100 million keys *(lower is better)*:

![](https://pixlcore.com/software/megahash/docs/mem-100m.png)

All four of the libraries were fed the exact same keys and values, and yet MegaHash seems to use the least amount of memory.  This may be due to MegaHash's [unique approach to indexing](#internals).  All 4 processes were measured the same way, using [process.memoryUsage().rss](https://nodejs.org/api/process.html#process_process_memoryusage).  

### 1 Billion Keys

Pushing past 100M keys, here is a performance graph of MegaHash all the way to 1 billion keys (I rented an [i3.8xlarge](https://aws.amazon.com/ec2/instance-types/i3/) for this test):

![](https://pixlcore.com/software/megahash/docs/perf-writes-1b-4bit.png)

That small performance dip between 150 and 350 million keys is due to reindexing, which is an unfortunate side effect of hashing.  However, it never drops below 450K writes/sec, and averages around 500K/sec.  At 1 billion keys, reads/sec were about 300K/sec.

# Installation

Use [npm](https://www.npmjs.com/) to install the module locally:

```
npm install megahash
```

You will need a C++ compiler toolchain to build the source into a shared library:

| Platform | Instructions |
|----------|--------------|
| **Linux** | Download and install [GCC](https://gcc.gnu.org).  On RedHat/CentOS, run `sudo yum install gcc gcc-c++ libstdc++-devel pkgconfig make`.  On Debian/Ubuntu, run `sudo apt-get install build-essential`. |
| **macOS** | Download and install [Xcode](https://developer.apple.com/xcode/download/).  You also need to install the `XCode Command Line Tools` by running `xcode-select --install`. Alternatively, if you already have the full Xcode installed, you can find them under the menu `Xcode -> Open Developer Tool -> More Developer Tools...`. This step will install `clang`, `clang++`, and `make`. |
| **Windows** | Install all the required tools and configurations using Microsoft's [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) using `npm install --global --production windows-build-tools` from an elevated PowerShell or CMD.exe (run as Administrator). |

Once you have that all setup, use `require()` to load MegaHash in your Node.js code:

```js
const MegaHash = require('megahash');
```

# Usage

Here is a simple example:

```js
var hash = new MegaHash();

hash.set( "hello", "there" );
console.log( hash.get("hello") );
hash.delete("hello");
hash.clear();
```

## Setting and Getting

To add or replace a key in a hash, use the [set()](#set) method.  This accepts two arguments, a key and a value:

```js
hash.set( "hello", "there" );
hash.set( "hello", "REPLACED!" );
```

To fetch an existing value given a key, use the [get()](#get) method.  This accepts a single argument, the key:

```js
var value = hash.get("hello");
```

The following data types are supported for values:

### Buffers

Buffers are the internal type used by the hash, and will give you the best performance.  This is true for both keys and values, so if you can pass them in as Buffers, all the better.  All other data types besides buffers are auto-converted.  Example use:

```js
var buf = Buffer.allocSafe(32);
buf.write("Hi");
hash.set( "mybuf", buf );

var bufCopy = hash.get("mybuf");
```

It should be noted here that memory is **copied** when it enters and exits MegaHash from Node.js land.  So if you insert a buffer and then retrieve it, you'll get a brand new buffer with a fresh copy of the data.

### Strings

Strings are converted to buffers using UTF-8 encoding.  This includes both keys and values.  However, for values MegaHash remembers the original data type, and will reverse the conversion when getting keys, and return a proper string value to you.  Example:

```js
hash.set( "hello", "there" );
console.log( hash.get("hello") );
```

Keys are returned as strings when iterating using [nextKey()](#nextkey).

### Objects

Object values are automatically serialized to JSON, then converted to buffers using UTF-8 encoding.  The reverse procedure occurs when fetching keys, and your values will be returned as proper objects.  Example:

```js
hash.set( "user1", { name: "Joe", age: 43 } );

var user = hash.get("user1");
console.log( user.name, user.age );
```

### Numbers

Number values are auto-converted to double-precision floating point decimals, and stored as 64-bit buffers internally.  Number keys are converted to strings, then to UTF-8 buffers which are used internally.  Example:

```js
hash.set( 1, 9.99999999 );
var value = hash.get(1);
```

### BigInts

MegaHash has support for [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) numbers, which are automatically detected and converted to/from 64-bit signed integers.  Example:

```js
hash.set( "big", 9007199254740993n );
var value = hash.get("big");
```

Note that BigInts are only supported in Node 10.4.0 and up.

### Booleans

Booleans are internally stored as a 1-byte buffer containing `0` or `1`.  These are auto-converted back to Booleans when you fetch keys.  Example:

```js
hash.set("bool1", true);
var test = hash.get("bool1");
```

### Null

You can specify `null` as a hash value, and it will be preserved as such.  Example:

```js
hash.set("nope", null);
```

You cannot, however, use `undefined` as a value.  Doing so will result in undefined behavior (get it?).

## Deleting and Clearing

To delete individual keys, use the [delete()](#delete) method.  Example:

```js
hash.delete("key1");
hash.delete("key2");
```

To delete **all** keys, call [clear()](#clear) (or just delete the hash object -- it'll be garbage collected like any normal Node.js object).  Example:

```js
hash.clear();
```

## Iterating over Keys

To iterate over keys in the hash, you can use the [nextKey()](#nextkey) method.  Without an argument, this will give you the "first" key in undefined order.  If you pass it the previous key, it will give you the next one, until finally `undefined` is returned.  Example:

```js
var key = hash.nextKey();
while (key) {
	// do something with key
	key = hash.nextKey(key);
}
```

Please note that if new keys are added to the hash while an iteration is in progress, it may *miss* some keys, due to indexing (i.e. reshuffling the position of keys).

## Hash Stats

To get current statistics about the hash, including the number of keys, raw data size, and other internals, call [stats()](#stats).  Example:

```js
var stats = hash.stats();
console.log(stats);
```

Example stats:

```js
{
	"numKeys": 10000,
	"dataSize": 217780,
	"indexSize": 87992,
	"metaSize": 300000,
	"numIndexes": 647
}
```

The response object will contain the following properties:

| Property Name | Description |
|---------------|-------------|
| `numKeys` | The total number of keys in the hash.  You can also get this by calling [length()](#length). |
| `dataSize` | The total data size in bytes (all of your raw keys and values). |
| `indexSize` | Internal memory usage by the MegaHash indexing system (i.e. overhead). |
| `metaSize` | Internal memory stored along with your key/value pairs (i.e. overhead). |
| `numIndexes` | The number of internal indexes current in use. |

# API

Here is the API reference for the MegaHash instance methods:

## set

```
VOID set( KEY, VALUE )
```

Set or replace one key/value in the hash.  Ideally both key and value are passed as Buffers, as this provides the highest performance.  Most built-in data types are supported of course, but they are converted to buffers one way or the other.  Example use:

```js
hash.set( "key1", "value1" );
```

## get

```
MIXED get( KEY )
```

Fetch a value given a key.  Since the value data type is stored internally as a flag with the raw data, this is used to convert the buffer back to the original type when the key is fetched.  So if you store a string then fetch it, it'll come back as a string.  Example use:

```js
var value = hash.get("key1");
```

## has

```
BOOLEAN has( KEY )
```

Check if a key exists in the hash.  Return `true` if found, `false` if not.  This is faster than a [get()](#get) as the value doesn't have to be serialized or sent over the wall between C++ and Node.js.  Example use:

```js
if (hash.has("key1")) console.log("Exists!");
```

## delete

```
BOOLEAN delete( KEY )
```

Delete one key/value pair from the has, given the key.  Returns `true` if found, `false` if not.  Example use:

```js
hash.delete("key1");
```

## clear

```
VOID clear()
```

Delete *all* keys from the hash, effectively freeing all memory (except for indexes).  Example use:

```js
hash.clear();
```

## nextKey

```
STRING nextKey()
STRING nextKey( KEY )
```

Without an argument, fetch the *first* key in the hash, in undefined order.  With a key specified, fetch the *next* key, also in undefined order.  Returns `undefined` when the end of the hash has been reached.  Example use:

```js
var key = hash.nextKey();
while (key) {
	// do something with key
	key = hash.nextKey(key);
}
```

## length

```
NUMBER length()
```

Return the total number of keys currently in the hash.  This is very fast, as it does not have to iterate over the keys (an internal counter is kept up to date on each set/delete).  Example use:

```js
var numKeys = hash.length();
```

## stats

```
OBJECT stats()
```

Fetch statistics about the current hash, including the number of keys, total data size in memory, and more.  The return value is a native Node.js object with several properties populated.  Example use:

```js
var stats = hash.stats();

// Example stats:
{
	"numKeys": 10000,
	"dataSize": 217780,
	"indexSize": 87992,
	"metaSize": 300000,
	"numIndexes": 647
}
```

See [Hash Stats](#hash-stats) for more details about these properties.

# Internals

MegaHash uses [separate chaining](https://en.wikipedia.org/wiki/Hash_table#Separate_chaining) to store data, which is a combination of an index and a linked list.  However, our indexing system is unique in that the indexes themselves become links on the chain, when the linked lists reach a certain size.  Effectively, the indexes are *nested*, using different bits of the key digest, and the index tree grows as more keys are added.

Keys are digested using the 32-bit [DJB2](http://www.cs.yorku.ca/~oz/hash.html) algorithm, but then MegaHash splits the digest into 8 slices (4 bits each).  Each slice becomes a separate index level (each with 16 slots).  The indexes are dynamic and only create themselves as needed, so a hash starts with only one main index, utilizing only the first 4 bits of the key digest.  When lists grow beyond a fixed size (plus a scatter factor), a "reindex" occurs, where new indexes nest inside themselves, using additional slices of the digest.

This design allows MegaHash to grow and reindex without losing much performance or stalling / lagging.  Effectively a reindex event only has to move a handful of keys each time.

MegaHash is currently hard-coded to use between 8 and 24 buckets (key/value pairs) per linked list before reindexing (this number is varied to scatter the reindexes).  In my testing, this range seems to strike a good balance between speed and memory overhead.  In the future, these values may be configurable.

## Limits

- Keys can be up to 65K bytes each (16-bit unsigned int).
- Values can be up to 2 GB each (32-bit signed, the size limit of Node.js buffers).
- There is no predetermined total key limit.
- All keys are buffers (strings are encoded with UTF-8), and must be non-zero length.
- Values may be zero length, and are also buffers internally.
- String values are automatically converted to/from UTF-8 buffers.
- Numbers are converted to/from double-precision floats.
- BigInts are converted to/from 64-bit signed integers.
- Object values are automatically serialized to/from JSON.

## Memory Overhead

Each MegaHash index record is 128 bytes (16 pointers, 64-bits each), and each bucket adds 24 bytes of overhead.  The tuple (key + value, along with lengths) is stored as a single blob (single `malloc()` call) to reduce memory fragmentation from allocating the key and value separately.

At 100 million keys, the total memory overhead is approximately 3.3 GB.  At 1 billion keys, it is 30 GB:

![](https://pixlcore.com/software/megahash/docs/mem-1b-4bit.png)

This is primarily due to the per-bucket "metadata" storage, which is currently adding 24 bytes per key.  Frankly, at least 7 bytes of this is total waste, due to C++ memory alignment.  I'm sure there are many potential improvements to be made here, but for now, it works well enough for my uses.

# Future

- Precompiled binaries
- Reduce per-bucket memory overhead
- Implement more of the ES6 Map interface

# License

**The MIT License (MIT)**

*Copyright (c) 2019 Joseph Huckaby*

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
