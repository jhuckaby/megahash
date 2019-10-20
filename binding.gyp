{
  "targets": [
    {
      "target_name": "megahash",
      "cflags": [ "-O3", "-fno-exceptions" ],
      "cflags_cc": [ "-O3", "-fno-exceptions" ],
      "sources": [ "main.cc", "hash.cc", "MegaHash.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    }
  ]
}
