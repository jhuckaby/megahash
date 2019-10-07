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
	BH_LEN_T payloadSize = BH_KLEN_SIZE + keyLength + BH_LEN_SIZE + contentLength;
	BH_LEN_T offset = 0;
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
			bucket = new Bucket();
			bucket->data = payload;
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
				if (bucketKeyEquals(bucket->data, key, keyLength)) {
					// replace
					newBucket = new Bucket();
					newBucket->data = payload;
					newBucket->flags = flags;
					if (lastBucket) lastBucket->next = newBucket;
					else level->data[ch] = (Tag *)newBucket;
					
					resp.result = BH_REPLACE;
					stats->dataSize -= (bucketGetKeyLength(bucket->data) + bucketGetContentLength(bucket->data));
					stats->dataSize += keyLength + contentLength;
					
					free(bucket->data);
					delete bucket;
					bucket = NULL; // break
				}
				else if (!bucket->next) {
					// append here
					newBucket = new Bucket();
					newBucket->data = payload;
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
	BH_KLEN_T keyLength = bucketGetKeyLength(bucket->data);
	unsigned char *key = bucket->data + BH_KLEN_SIZE;
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
				if (bucketKeyEquals(bucket->data, key, keyLength)) {
					// found!
					resp.result = BH_OK;
					resp.content = bucketGetContent(bucket->data);
					resp.contentLength = bucketGetContentLength(bucket->data);
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
				if (bucketKeyEquals(bucket->data, key, keyLength)) {
					// found!
					stats->dataSize -= (bucketGetKeyLength(bucket->data) + bucketGetContentLength(bucket->data));
					stats->metaSize -= (sizeof(Bucket) + BH_KLEN_SIZE + BH_LEN_SIZE);
					stats->numKeys--;
					
					if (lastBucket) lastBucket->next = bucket->next;
					else level->data[ch] = bucket->next;
					
					resp.result = BH_OK;
					free(bucket->data);
					delete bucket;
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

void Hash::clear(unsigned char idx) {
	// clear one "slice" from main index (about 1/16 of total keys)
	// this is so you can split up the job into pieces and not stall the event loop for too long
	if (idx >= BH_INDEX_SIZE) return;
	if (index->data[idx]) {
		clearTag( index->data[idx] );
		index->data[idx] = NULL;
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
			
			stats->dataSize -= (bucketGetKeyLength(lastBucket->data) + bucketGetContentLength(lastBucket->data));
			stats->metaSize -= sizeof(Bucket);
			stats->numKeys--;
			
			free(lastBucket->data);
			delete lastBucket;
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
				resp->content = bucketGetKey(bucket->data);
				resp->contentLength = bucketGetKeyLength(bucket->data);
				bucket = NULL; // break;
			}
			else if (bucketKeyEquals(bucket->data, key, keyLength)) {
				// found target key, return next one
				returnNext[0] = 1;
				
				// clear all digest bits so next index ierations begin at zero
				((uint64_t *)digest)[0] = 0;
			}
			if (bucket) bucket = bucket->next;
		}
	}
}
