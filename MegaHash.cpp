// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#include "MegaHash.h"

Response Hash::store(unsigned char *key, BH_KLEN_T keyLength, unsigned char *content, BH_LEN_T contentLength, unsigned char flags) {
	// store key/value pair in hash
	unsigned char digest[BH_DIGEST_SIZE];
	Response resp;
	
	// first digest key
	digestKey(key, keyLength, digest);
	
	// combine key and content together, with length prefixes, into single blob
	// this reduces malloc bashing and memory frag
	BH_LEN_T payloadSize = sizeof(Bucket) + BH_KLEN_SIZE + keyLength + BH_LEN_SIZE + contentLength;
	BH_LEN_T offset = sizeof(Bucket);
	unsigned char *payload = (unsigned char *)malloc(payloadSize);
	
	memcpy( (void *)&payload[offset], (void *)&keyLength, BH_KLEN_SIZE ); offset += BH_KLEN_SIZE;
	memcpy( (void *)&payload[offset], (void *)key, keyLength ); offset += keyLength;
	memcpy( (void *)&payload[offset], (void *)&contentLength, BH_LEN_SIZE ); offset += BH_LEN_SIZE;
	memcpy( (void *)&payload[offset], (void *)content, contentLength ); offset += contentLength;
	
	unsigned char digestIndex = 0;
	unsigned char ch;
	unsigned char bucketIndex = 0;
	Tag *tag = (Tag *)index;
	Index *level, *newLevel;
	Bucket *bucket, *newBucket, *lastBucket;
	
	while (tag && (tag->type == BH_SIG_INDEX)) {
		level = (Index *)tag;
		ch = digest[digestIndex];
		tag = level->data[ch];
		if (!tag) {
			// create new bucket list here
			bucket = (Bucket *)payload;
			bucket->init();
			bucket->flags = flags;
			level->data[ch] = (Tag *)bucket;
			
			resp.result = BH_ADD;
			stats->dataSize += keyLength + contentLength;
			stats->metaSize += sizeof(Bucket) + BH_KLEN_SIZE + BH_LEN_SIZE;
			stats->numKeys++;
			tag = NULL; // break
		}
		else if (tag->type == BH_SIG_BUCKET) {
			// found bucket list, append
			bucket = (Bucket *)tag;
			lastBucket = NULL;
			
			while (bucket) {
				if (bucketKeyEquals(bucket, key, keyLength)) {
					// replace
					newBucket = (Bucket *)payload;
					newBucket->init();
					newBucket->flags = flags;
					if (lastBucket) lastBucket->next = newBucket;
					else level->data[ch] = (Tag *)newBucket;
					
					resp.result = BH_REPLACE;
					stats->dataSize -= (bucketGetKeyLength(bucket) + bucketGetContentLength(bucket));
					stats->dataSize += keyLength + contentLength;
					
					free((void *)bucket);
					bucket = NULL; // break
				}
				else if (!bucket->next) {
					// append here
					newBucket = (Bucket *)payload;
					newBucket->init();
					newBucket->flags = flags;
					bucket->next = newBucket;
					resp.result = BH_ADD;
					
					stats->dataSize += keyLength + contentLength;
					stats->metaSize += sizeof(Bucket) + BH_KLEN_SIZE + BH_LEN_SIZE;
					stats->numKeys++;
					bucket = NULL; // break
					
					// possibly reindex here
					if ((bucketIndex >= maxBuckets + (ch % reindexScatter)) && (digestIndex < BH_DIGEST_SIZE - 1)) {
						// deeper we go
						digestIndex++;
						
						newLevel = new Index();
						stats->indexSize += sizeof(Index);
						
						bucket = (Bucket *)tag;
						level->data[ch] = (Tag *)newLevel;
						
						while (bucket) {
							lastBucket = bucket;
							bucket = bucket->next;
							reindexBucket(lastBucket, newLevel, digestIndex);
						}
					} // reindex
				}
				else {
					lastBucket = bucket;
					bucket = bucket->next;
					bucketIndex++;
				}
			} // while bucket
			
			tag = NULL; // break
		}
		else {
			digestIndex++;
		}
	} // while tag
	
	return resp;
}

void Hash::reindexBucket(Bucket *bucket, Index *index, unsigned char digestIndex) {
	// reindex existing bucket into new subindex level
	unsigned char digest[BH_DIGEST_SIZE];
	BH_KLEN_T keyLength = bucketGetKeyLength(bucket);
	unsigned char *key = bucketGetKey(bucket);
	digestKey(key, keyLength, digest);
	unsigned char ch = digest[digestIndex];
	
	Tag *tag = index->data[ch];
	if (!tag) {
		// create new bucket list here
		index->data[ch] = (Tag *)bucket;
		bucket->next = NULL;
	}
	else {
		// traverse list, append to end
		Bucket *current = (Bucket *)tag;
		while (current->next) {
			current = current->next;
		}
		current->next = bucket;
		bucket->next = NULL;
	}
}

Response Hash::fetch(unsigned char *key, BH_KLEN_T keyLength) {
	// fetch value given key
	unsigned char digest[BH_DIGEST_SIZE];
	Response resp;
	
	// first digest key
	digestKey(key, keyLength, digest);
	
	unsigned char digestIndex = 0;
	unsigned char ch;
	
	Tag *tag = (Tag *)index;
	Index *level;
	Bucket *bucket;
	
	unsigned char *bucketData;
	unsigned char *tempCL;
	
	while (tag && (tag->type == BH_SIG_INDEX)) {
		level = (Index *)tag;
		ch = digest[digestIndex];
		tag = level->data[ch];
		if (!tag) {
			// not found
			resp.result = BH_ERR;
			tag = NULL; // break
		}
		else if (tag->type == BH_SIG_BUCKET) {
			// found bucket list, append
			bucket = (Bucket *)tag;
			
			while (bucket) {
				if (bucketKeyEquals(bucket, key, keyLength)) {
					// found!
					bucketData = ((unsigned char *)bucket) + sizeof(Bucket);
					tempCL = bucketData + BH_KLEN_SIZE + keyLength;
					
					resp.result = BH_OK;
					resp.contentLength = ((BH_LEN_T *)tempCL)[0];
					resp.content = bucketData + BH_KLEN_SIZE + keyLength + BH_LEN_SIZE;
					
					resp.flags = bucket->flags;
					bucket = NULL; // break
				}
				else if (!bucket->next) {
					// not found
					resp.result = BH_ERR;
					bucket = NULL; // break
				}
				else {
					bucket = bucket->next;
				}
			} // while bucket
			
			tag = NULL; // break
		}
		else {
			digestIndex++;
		}
	} // while tag
	
	return resp;
}

Response Hash::remove(unsigned char *key, BH_KLEN_T keyLength) {
	// remove bucket given key
	unsigned char digest[BH_DIGEST_SIZE];
	Response resp;
	
	// first digest key
	digestKey(key, keyLength, digest);
	
	unsigned char digestIndex = 0;
	unsigned char ch;
	
	Tag *tag = (Tag *)index;
	Index *level;
	Bucket *bucket, *lastBucket;
	
	while (tag && (tag->type == BH_SIG_INDEX)) {
		level = (Index *)tag;
		ch = digest[digestIndex];
		tag = level->data[ch];
		if (!tag) {
			// not found
			resp.result = BH_ERR;
			tag = NULL; // break
		}
		else if (tag->type == BH_SIG_BUCKET) {
			// found bucket list, traverse
			bucket = (Bucket *)tag;
			lastBucket = NULL;
			
			while (bucket) {
				if (bucketKeyEquals(bucket, key, keyLength)) {
					// found!
					stats->dataSize -= (bucketGetKeyLength(bucket) + bucketGetContentLength(bucket));
					stats->metaSize -= (sizeof(Bucket) + BH_KLEN_SIZE + BH_LEN_SIZE);
					stats->numKeys--;
					
					if (lastBucket) lastBucket->next = bucket->next;
					else level->data[ch] = bucket->next;
					
					resp.result = BH_OK;
					free((void *)bucket);
					bucket = NULL; // break
				}
				else if (!bucket->next) {
					// not found
					resp.result = BH_ERR;
					bucket = NULL; // break
				}
				else {
					lastBucket = bucket;
					bucket = bucket->next;
				}
			} // while bucket
			
			tag = NULL; // break
		}
		else {
			digestIndex++;
		}
	} // while tag
	
	return resp;
}

void Hash::clear() {
	// clear ALL keys/values
	for (int idx = 0; idx < BH_INDEX_SIZE; idx++) {
		if (index->data[idx]) {
			clearTag( index->data[idx] );
			index->data[idx] = NULL;
		}
	}
}

void Hash::clear(unsigned char slice) {
	// clear one "slice" from main index (about 1/256 of total keys)
	// this is so you can split up the job into pieces and not hang the CPU for too long
	unsigned char slice1 = slice / 16;
	unsigned char slice2 = slice % 16;
	
	// since our index system is 4-bit, we split the uchar into two pieces
	// and traverse into a nested index for the 2nd piece, if applicable
	if (index->data[slice1]) {
		Tag *tag = index->data[slice1];
		if (tag->type == BH_SIG_INDEX) {
			// nested index, use idx2
			Index *level = (Index *)tag;
			if (level->data[slice2]) {
				clearTag( level->data[slice2] );
				level->data[slice2] = NULL;
			}
			
			// also clear top-level index if it is now empty
			int empty = 1;
			for (int idx = 0; idx < BH_INDEX_SIZE; idx++) {
				if (level->data[idx]) { empty = 0; idx = BH_INDEX_SIZE; }
			}
			if (empty) {
				clearTag( tag );
				index->data[slice1] = NULL;
			}
		}
		else if (tag->type == BH_SIG_BUCKET) {
			clearTag( tag );
			index->data[slice1] = NULL;
		}
	}
}

void Hash::clearTag(Tag *tag) {
	// internal method: clear one tag (index or bucket)
	// traverse lists, recurse for nested indexes
	if (tag->type == BH_SIG_INDEX) {
		// traverse index
		Index *level = (Index *)tag;
		
		for (int idx = 0; idx < BH_INDEX_SIZE; idx++) {
			if (level->data[idx]) {
				clearTag( level->data[idx] );
				level->data[idx] = NULL;
			}
		}
		
		// kill index
		delete level;
		stats->indexSize -= sizeof(Index);
	}
	else if (tag->type == BH_SIG_BUCKET) {
		// delete all buckets in list
		Bucket *bucket = (Bucket *)tag;
		Bucket *lastBucket;
		
		while (bucket) {
			lastBucket = bucket;
			bucket = bucket->next;
			
			stats->dataSize -= (bucketGetKeyLength(lastBucket) + bucketGetContentLength(lastBucket));
			stats->metaSize -= (sizeof(Bucket) + BH_KLEN_SIZE + BH_LEN_SIZE);
			stats->numKeys--;
			
			free((void *)lastBucket);
		}
	}
}

Response Hash::firstKey() {
	// return first key found (in undefined order)
	unsigned char returnNext = 1;
	unsigned char digest[BH_DIGEST_SIZE];
	Response resp;
	
	for (int idx = 0; idx < BH_DIGEST_SIZE; idx++) {
		digest[idx] = 0;
	}
	
	traverseTag( &resp, (Tag *)index, NULL, 0, digest, 0, &returnNext );
	return resp;
}

Response Hash::nextKey(unsigned char *key, BH_KLEN_T keyLength) {
	// return next key given previous key (in undefined order)
	unsigned char returnNext = 0;
	unsigned char digest[BH_DIGEST_SIZE];
	Response resp;
	
	// first digest key
	digestKey(key, keyLength, digest);
	
	traverseTag( &resp, (Tag *)index, key, keyLength, digest, 0, &returnNext );
	return resp;
}

void Hash::traverseTag(Response *resp, Tag *tag, unsigned char *key, BH_KLEN_T keyLength, unsigned char *digest, unsigned char digestIndex, unsigned char *returnNext) {
	// internal method
	// traverse tag tree looking for key (or return next key found)
	if (tag->type == BH_SIG_INDEX) {
		// traverse index
		Index *level = (Index *)tag;
		
		for (int idx = digest[digestIndex]; idx < BH_INDEX_SIZE; idx++) {
			if (level->data[idx]) {
				traverseTag( resp, level->data[idx], key, keyLength, digest, digestIndex + 1, returnNext );
				if (resp->result == BH_OK) idx = BH_INDEX_SIZE;
			}
		}
	}
	else if (tag->type == BH_SIG_BUCKET) {
		// traverse bucket list
		Bucket *bucket = (Bucket *)tag;
		
		while (bucket) {
			if (returnNext[0]) {
				// return whatever key we landed on (repurpose the response content for this)
				resp->result = BH_OK;
				resp->content = bucketGetKey(bucket);
				resp->contentLength = bucketGetKeyLength(bucket);
				bucket = NULL; // break;
			}
			else if (bucketKeyEquals(bucket, key, keyLength)) {
				// found target key, return next one
				returnNext[0] = 1;
				
				// clear all digest bits so next index ierations begin at zero
				((uint64_t *)digest)[0] = 0;
			}
			if (bucket) bucket = bucket->next;
		}
	}
}
