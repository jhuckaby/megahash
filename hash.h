// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

#ifndef MEGAHASH_H
#define MEGAHASH_H

#include <napi.h>
#include "MegaHash.h"

class MegaHash : public Napi::ObjectWrap<MegaHash> {
public:
	static Napi::Object Init(Napi::Env env, Napi::Object exports);
	MegaHash(const Napi::CallbackInfo& info);
	~MegaHash();

private:
	static Napi::FunctionReference constructor;

	Napi::Value Set(const Napi::CallbackInfo& info);
	Napi::Value Get(const Napi::CallbackInfo& info);
	Napi::Value Has(const Napi::CallbackInfo& info);
	Napi::Value Remove(const Napi::CallbackInfo& info);
	Napi::Value Clear(const Napi::CallbackInfo& info);
	Napi::Value Stats(const Napi::CallbackInfo& info);
	Napi::Value FirstKey(const Napi::CallbackInfo& info);
	Napi::Value NextKey(const Napi::CallbackInfo& info);

	Hash *hash;
};

#endif
