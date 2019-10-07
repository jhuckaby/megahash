// Simple benchmarking script for MegaHash

var MegaHash = require('.');
var fs = require('fs');
var Tools = require('pixl-tools');
var cli = require('pixl-cli');
cli.global();

var args = cli.args;
var metrics_log_file = args.metrics || false;
if (metrics_log_file) {
	print("Writing metrics to log: " + metrics_log_file + "\n");
	if (fs.existsSync(metrics_log_file)) fs.unlinkSync(metrics_log_file);
}

var hash = new MegaHash();
// var map = new Map();

const MAX_KEYS = 8000000;
const MAX_READS = 2000000;
const METRICS_EVERY = 100000;

print("\nMax Keys: " + Tools.commify(MAX_KEYS) + "\n");
print("Max Reads: " + Tools.commify(MAX_READS) + "\n");

print("\nWriting...\n");

var time_start = Tools.timeNow();
var last_report = Date.now();
var iter_per_sec = 0;
var now = 0;
var mem = null;
var idx, key, value, keyBuf, valueBuf;
var dataBytes = 0;

for (idx = 0; idx < MAX_KEYS; idx++) {
	key = '' + idx; //  + Tools.digestHex( "SALT_7fb1b7485647b1782c715474fba28fd1" + idx, 'md5' ).substring( idx % 8 );
	// value = Tools.digestHex( key, "sha512" ).substring( idx % 32 );
	// print("Writing key " + idx + ": " + key + " (" + value.length + " value len)\n");
	value = 'b66f91437d85f726506c3e14b56b3ef474f9e8e5af623f110775d999cc3a46150e20d307201d696a40fe39347576d51d229e8661cef8aa70aa6d45d5b3e49aef'.substring( idx % 32 );
	
	keyBuf = Buffer.from(key);
	valueBuf = Buffer.from(value);
	dataBytes += keyBuf.length + valueBuf.length;
	
	hash.set( keyBuf, valueBuf );
	// map.set( key, valueBuf );
	
	if (idx && (idx % METRICS_EVERY == 0)) {
		now = Date.now();
		iter_per_sec = Math.floor( METRICS_EVERY / ((now - last_report) / 1000) );
		mem = process.memoryUsage();
		print("Total Keys: " + Tools.commify(idx) + ", Writes/sec: " + Tools.commify(iter_per_sec) + ", Memory: " + Tools.getTextFromBytes(mem.rss) + "\n");
		if (metrics_log_file) fs.appendFileSync( metrics_log_file, JSON.stringify({
			num_keys: idx,
			iter_sec: iter_per_sec,
			stats: hash.stats(),
			mem: mem
		}) + "\n" );
		last_report = now;
	}
}

var elapsed = Tools.timeNow() - time_start;
print("\n");
print("Overall writes/sec: " + Tools.commify( Math.floor(MAX_KEYS / elapsed) ) + "\n");
print("Raw Data Size: " + Tools.getTextFromBytes(dataBytes) + " (" + Tools.commify(dataBytes) + " bytes)\n");
memReport();

print("\nReading...\n");

time_start = Tools.timeNow();
last_report = Date.now();
iter_per_sec = 0;

for (var idx = 0; idx < MAX_READS; idx++) {
	var ridx = Math.floor( Math.random() * MAX_KEYS );
	key = '' + ridx; //  + Tools.digestHex( "SALT_7fb1b7485647b1782c715474fba28fd1" + ridx, 'md5' ).substring( ridx % 8 );
	keyBuf = Buffer.from(key);
	// var value = Tools.digestHex( key, "sha512" ).substring( ridx % 32 );
	
	var buf = hash.get( keyBuf );
	// var buf = map.get( key );
	if (!buf) die("Failed to fetch key " + idx + ": " + key);
	// if (buf.toString() != value) die("Value " + idx + " does not match: " + key + "\n");
	
	if (idx && (idx % METRICS_EVERY == 0)) {
		now = Date.now();
		iter_per_sec = Math.floor( METRICS_EVERY / ((now - last_report) / 1000) );
		mem = process.memoryUsage();
		print("Reads/sec: " + Tools.commify(iter_per_sec) + ", Memory: " + Tools.getTextFromBytes(mem.rss) + "\n");
		last_report = now;
	}
}

elapsed = Tools.timeNow() - time_start;
print("\n");
print("Overall reads/sec: " + Tools.commify( Math.floor(MAX_READS / elapsed) ) + "\n");
memReport();

var stats = hash.stats();
print("\n");
print("Index Size: " + Tools.getTextFromBytes(stats.indexSize) + " (" + Tools.commify(stats.indexSize) + " bytes)\n");
print("Meta Size: " + Tools.getTextFromBytes(stats.metaSize) + " (" + Tools.commify(stats.metaSize) + " bytes)\n");
print("Data Size: " + Tools.getTextFromBytes(stats.dataSize) + " (" + Tools.commify(stats.dataSize) + " bytes)\n");

print("\n");
print("Total Overhead: " + Tools.getTextFromBytes(stats.indexSize + stats.metaSize) + "\n");

print("\n");
print("Number of Indexes: " + Tools.commify(stats.numIndexes) + "\n");
print("Number of Buckets: " + Tools.commify(stats.numKeys) + "\n");
print("\n");

function memReport() {
	var mem = process.memoryUsage();
	for (var key in mem) {
		mem[key] = Tools.getTextFromBytes(mem[key]);
	}
	print( "Memory Report: " + JSON.stringify(mem) + "\n" );
};
