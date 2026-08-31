// Simple benchmarking script for MegaHash
// Generates JSON output and an HTML report
// node bench.js --max 100000000 --name mytest

var MegaHash = require('../');
var fs = require('fs');
var os = require('os');
var cli = require('pixl-cli');
cli.global();

var Tools = cli.Tools;
var mkdirp = Tools.mkdirp;
var args = cli.args;

const MAX_KEYS = args.max || 100000000;
const METRICS_EVERY = Math.floor( MAX_KEYS / 1000 ) || 1;

var metrics = {
	info: {
		versions: process.versions,
		arch: process.arch,
		platform: process.platform,
		argv: process.argv,
		cpus: os.cpus(),
		endianness: os.endianness(),
		mem: os.totalmem(),
		date: Tools.timeNow(true)
	},
	key_len: '1 - 6 chars',
	value_len: '1 char',
	args: args,
	rows: []
};

// add our version
metrics.info.versions.mega = require('../package.json').version;

var output_name = args.name || '';
if (!output_name) {
	output_name = 'v' + metrics.info.versions.mega + '-' + metrics.info.platform + '-' + metrics.info.arch + '-ideal-' + short_num(MAX_KEYS);
}
print("\n");
print("Test Name: " + output_name + "\n");

var results_dir = __dirname + '/results';
mkdirp.sync( results_dir );

var template_file = __dirname + '/template.html';
if (!fs.existsSync(template_file)) die("Cannot locate template file: " + template_file + "\n");
var template_html = fs.readFileSync(template_file, 'utf8');

var hash = new MegaHash();

print("Max Keys: " + Tools.commify(MAX_KEYS) + "\n");
print("Metrics Every: " + Tools.commify(METRICS_EVERY) + "\n");
print("Starting run...\n\n");

var mem_start = process.memoryUsage().rss;
// var time_start = Tools.timeNow();
var last_report = Date.now();
var write_iter_sec = 0;
var read_iter_sec = 0;
var now = 0;
var mem = null;
var idx, idy, key, value, keyBuf, valueBuf;

// keyBuf = Buffer.alloc(4);
// valueBuf = Buffer.from('Z');

for (idx = 1; idx <= MAX_KEYS; idx++) {
	// keyBuf.writeUInt32BE( idx );
	keyBuf = Buffer.from( idx.toString(36) );
	valueBuf = Buffer.from('Z');
	
	hash.set( keyBuf, valueBuf );
	
	if (idx && (idx % METRICS_EVERY == 0)) {
		now = Date.now();
		write_iter_sec = Math.floor( METRICS_EVERY / ((now - last_report) / 1000) );
		mem = process.memoryUsage().rss - mem_start;
		
		// pause and do some reads
		now = Date.now();
		last_report = now;
		for (var idy = idx - METRICS_EVERY; idy < idx; idy++) {
			key = '' + idy;
			hash.get(key);
		}
		now = Date.now();
		read_iter_sec = Math.floor( METRICS_EVERY / ((now - last_report) / 1000) );
		
		print(
			"Total Keys: " + Tools.commify(idx) + 
			", Writes/sec: " + Tools.commify(write_iter_sec) + 
			", Reads/sec: " + Tools.commify(read_iter_sec) + 
			", Memory: " + Tools.getTextFromBytes(mem) + "\n"
		);
		
		metrics.rows.push({
			idx: idx,
			write_iter_sec: write_iter_sec,
			read_iter_sec: read_iter_sec,
			stats: hash.stats(),
			mem: mem
		});
		
		now = Date.now();
		last_report = now;
	}
} // main loop

var metrics_file = results_dir + '/' + output_name + '.js';
fs.writeFileSync( metrics_file, 'load(' + JSON.stringify(metrics, null, "\t") + ");\n" );

var html_file = results_dir + '/' + output_name + '.html';
fs.writeFileSync( html_file, template_html.replace(/_OUTPUT_NAME_/, output_name) );

var stats = hash.stats();
print("\n");
print("Index Size: " + Tools.getTextFromBytes(stats.indexSize) + " (" + Tools.commify(stats.indexSize) + " bytes)\n");
print("Meta Size: " + Tools.getTextFromBytes(stats.metaSize) + " (" + Tools.commify(stats.metaSize) + " bytes)\n");
print("Data Size: " + Tools.getTextFromBytes(stats.dataSize) + " (" + Tools.commify(stats.dataSize) + " bytes)\n");

print("\n");
print("MegaHash Overhead: " + Tools.getTextFromBytes(stats.indexSize + stats.metaSize) + "\n");
print("Overhead Per Key: " + Tools.getTextFromBytes( Math.round((stats.indexSize + stats.metaSize) / stats.numKeys) ) + "\n");

var mem = process.memoryUsage().rss - mem_start;
var os_total = mem;
var os_overhead = os_total - (stats.indexSize + stats.metaSize + stats.dataSize);
var total_overhead = os_total - stats.dataSize;

print("\n");
print("Process Memory: " + Tools.getTextFromBytes(os_total) + "\n");
print("OS Overhead: " + Tools.getTextFromBytes(os_overhead) + "\n");
print("Total Overhead: " + Tools.getTextFromBytes(total_overhead) + "\n");
print("Total Overhead Per Key: " + Tools.getTextFromBytes( Math.round(total_overhead / stats.numKeys) ) + "\n");

print("\n");
print("Wrote: " + metrics_file + "\n");
print("Wrote: " + html_file + "\n");

print("\nExiting.\n");
process.exit(0);

function short_num(num) {
	// shorten number to K/M/B
	if (num >= 1000000000) num = '' + Math.floor(num / 1000000000) + 'B';
	else if (num >= 1000000) num = '' + Math.floor(num / 1000000) + 'M';
	else if (num >= 1000) num = '' + Math.floor(num / 1000) + 'K';
	return num;
};
