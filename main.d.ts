/// <reference types="node" />

declare namespace MegaHash
{
	type TAvailableValue = Buffer | string | object | number | BigInt | boolean | null;

	interface IStats {
		indexSize:  number;
		metaSize:   number;
		dataSize:   number;
		numKeys:    number;
		numIndexes: number;
	}
}

declare class MegaHash {
	set(key: string | Buffer, value: MegaHash.TAvailableValue): 0 | 1 | 2;
	get<T extends MegaHash.TAvailableValue>(key: string | Buffer): T | undefined;
	has(key: string | Buffer): boolean;
	delete(key: string | Buffer): boolean;
	remove(key: string | Buffer): boolean;
	clear(): void;
	nextKey(key?: string | Buffer): string | undefined;
	length(): number;
	stats(): MegaHash.IStats;
}

export = MegaHash;
export as namespace MegaHash;