// MegaHash v1.0
// Copyright (c) 2019 Joseph Huckaby
// Based on DeepHash, (c) 2003 Joseph Huckaby

#include <napi.h>
#include "hash.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  return MegaHash::Init(env, exports);
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll)
