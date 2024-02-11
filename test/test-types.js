const { performance } = require("perf_hooks");
const MegaHash = require('../');
const hash = new MegaHash();
const N = 5000000;

console.log(`Benchmarking ${N} operations for each type`);

run("buffer", Buffer.from("abcdfeghijklmnopqrstuvwxyz"));
run("string", "abcdfeghijklmnopqrstuvwxyz");
run("number", 79483759);
run("true", true);
run("false", false);
run("object", {a:10, b:20, c:30, d:null, e:"abc"});
run("bigint", 3948759398787n);
run("big bigint", 48579384759349273948273985798475928349726347263957298759387459834n);
run("null", null);
run("nan", NaN);
run("infinity", Infinity);
run("function", () => true);
run("undefined", undefined);

function run(name, data) {
	try {
		let time = performance.now();
		for(let i = 0; i < N; i++) {
			hash.set(i, data);
		}
		time = performance.now() - time;
		console.log(`${name} - write: ${(N * 1000 / time).toFixed(3)} op/s (${time.toFixed(3)}ms)`);
	
		time = performance.now();
		for(let i = 0; i < N; i++) {
			hash.get(i);
		}
		time = performance.now() - time;
		console.log(`${name} - read: ${(N * 1000 / time).toFixed(3)} op/s (${time.toFixed(3)}ms)`);
		//console.log(process.memoryUsage())
		//console.log(`${name} - integrity test`, data, hash.get(1));
		hash.clear();
	} catch(e) {
		console.log(`${name} - Failed (${e})`);
	}
}
