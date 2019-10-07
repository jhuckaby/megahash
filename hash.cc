// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

#include <stdio.h>
#include <stdint.h>
#include "hash.h"

Napi::FunctionReference MegaHash::constructor;

Napi::Object MegaHash::Init(Napi::Env env, Napi::Object exports) {
	// initialize class
	Napi::HandleScope scope(env);
	
	Napi::Function func = DefineClass(env, "MegaHash", {
		InstanceMethod("_set", &MegaHash::Set),
		InstanceMethod("_get", &MegaHash::Get),
		InstanceMethod("_has", &MegaHash::Has),
		InstanceMethod("_remove", &MegaHash::Remove),
		InstanceMethod("clear", &MegaHash::Clear),
		InstanceMethod("stats", &MegaHash::Stats),
		InstanceMethod("_firstKey", &MegaHash::FirstKey),
		InstanceMethod("_nextKey", &MegaHash::NextKey)
	});
	
	constructor = Napi::Persistent(func);
 	constructor.SuppressDestruct();
 	
	exports.Set("MegaHash", func);
	return exports;
}

MegaHash::MegaHash(const Napi::CallbackInfo& info) : Napi::ObjectWrap<MegaHash>(info) {
	// construct new hash table
	Napi::Env env = info.Env();
	Napi::HandleScope scope(env);
	
	// 8 buckets per list with 16 scatter is about the perfect balance of speed and memory
	// FUTURE: Make this configurable from Node.js side?
	this->hash = new Hash( 8, 16 );
}

MegaHash::~MegaHash() {
	// cleanup and free memory
	delete this->hash;
}

Napi::Value MegaHash::Set(const Napi::CallbackInfo& info) {
	// store key/value pair, no return value
	Napi::Buffer<unsigned char> keyBuf = info[0].As<Napi::Buffer<unsigned char>>();
	unsigned char *key = keyBuf.Data();
	BH_KLEN_T keyLength = (BH_KLEN_T)keyBuf.Length();
	
	Napi::Buffer<unsigned char> valueBuf = info[1].As<Napi::Buffer<unsigned char>>();
	unsigned char *value = valueBuf.Data();
	BH_LEN_T valueLength = (BH_LEN_T)valueBuf.Length();
	
	unsigned char flags = 0;
	if (info.Length() > 2) {
		flags = (unsigned char)info[2].As<Napi::Number>().Uint32Value();
	}
	
	this->hash->store( key, keyLength, value, valueLength, flags );
	return info.Env().Undefined();
}

Napi::Value MegaHash::Get(const Napi::CallbackInfo& info) {
	// fetch value given key
	Napi::Env env = info.Env();
	
	Napi::Buffer<unsigned char> keyBuf = info[0].As<Napi::Buffer<unsigned char>>();
	unsigned char *key = keyBuf.Data();
	BH_KLEN_T keyLength = (BH_KLEN_T)keyBuf.Length();
	
	Response resp = this->hash->fetch( key, keyLength );
	
	if (resp.result == BH_OK) {
		Napi::Buffer<unsigned char> valueBuf = Napi::Buffer<unsigned char>::Copy( env, resp.content, resp.contentLength );
		if (resp.flags) valueBuf.Set( "flags", (double)resp.flags );
		return valueBuf;
	}
	else return env.Undefined();
}

Napi::Value MegaHash::Has(const Napi::CallbackInfo& info) {
	// see if a key exists, return boolean true/value
	Napi::Env env = info.Env();
	
	Napi::Buffer<unsigned char> keyBuf = info[0].As<Napi::Buffer<unsigned char>>();
	unsigned char *key = keyBuf.Data();
	BH_KLEN_T keyLength = (BH_KLEN_T)keyBuf.Length();
	
	Response resp = this->hash->fetch( key, keyLength );
	return Napi::Boolean::New(env, (resp.result == BH_OK));
}

Napi::Value MegaHash::Remove(const Napi::CallbackInfo& info) {
	// remove key/value pair, free up memory
	Napi::Env env = info.Env();
	
	Napi::Buffer<unsigned char> keyBuf = info[0].As<Napi::Buffer<unsigned char>>();
	unsigned char *key = keyBuf.Data();
	BH_KLEN_T keyLength = (BH_KLEN_T)keyBuf.Length();
	
	Response resp = this->hash->remove( key, keyLength );
	return Napi::Boolean::New(env, (resp.result == BH_OK));
}

Napi::Value MegaHash::Clear(const Napi::CallbackInfo& info) {
	// delete some or all keys/values from hash, free all memory
	unsigned char slice = 0;
	
	if (info.Length() > 0) {
		slice = (unsigned char)info[0].As<Napi::Number>().Uint32Value();
		this->hash->clear( slice );
	}
	else {
		this->hash->clear();
	}
	
	return info.Env().Undefined();
}

Napi::Value MegaHash::Stats(const Napi::CallbackInfo& info) {
	// return stats as node object
	Napi::Env env = info.Env();
	
	Napi::Object obj = Napi::Object::New(env);
	obj.Set(Napi::String::New(env, "indexSize"), (double)this->hash->stats->indexSize);
	obj.Set(Napi::String::New(env, "metaSize"), (double)this->hash->stats->metaSize);
	obj.Set(Napi::String::New(env, "dataSize"), (double)this->hash->stats->dataSize);
	obj.Set(Napi::String::New(env, "numKeys"), (double)this->hash->stats->numKeys);
	obj.Set(Napi::String::New(env, "numIndexes"), (double)(this->hash->stats->indexSize / (int)sizeof(Index)));
	
	return obj;
}

Napi::Value MegaHash::FirstKey(const Napi::CallbackInfo& info) {
	// return first key in hash (in undefined order)
	Napi::Env env = info.Env();
	
	Response resp = this->hash->firstKey();
	if (resp.result == BH_OK) {
		return Napi::Buffer<unsigned char>::Copy( env, resp.content, resp.contentLength );
	}
	else return env.Undefined();
}

Napi::Value MegaHash::NextKey(const Napi::CallbackInfo& info) {
	// return next key in hash given previous one (in undefined order)
	Napi::Env env = info.Env();
	
	Napi::Buffer<unsigned char> keyBuf = info[0].As<Napi::Buffer<unsigned char>>();
	unsigned char *key = keyBuf.Data();
	BH_KLEN_T keyLength = (BH_KLEN_T)keyBuf.Length();
	
	Response resp = this->hash->nextKey( key, keyLength );
	if (resp.result == BH_OK) {
		return Napi::Buffer<unsigned char>::Copy( env, resp.content, resp.contentLength );
	}
	else return env.Undefined();
}
