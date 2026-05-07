SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

PATH := $(CURDIR)/node_modules/.bin:$(PATH)

.DELETE_ON_ERROR:

WAT_SOURCES := $(shell find wat -type f -name '*.wat' -print | sort)
WAT_INCLUDES := $(shell find wat -type f -name '*.inc' -print | sort)

MODULE_DOC_GENERATOR := $(wildcard tools/generate-wasm-modules-docs.js)

GENERATED_FILES := \
	HOST_ABI.md \
	MEMORY.md \
	abi/wasm-modules.json \
	host/abi.mjs \
	host/wasm-modules.mjs \
	wat/app.test.wat \
	wat/app.wat \
	wat/parser.test.wat \
	wat/parser.wat \
	wat/parser_state.test.wat \
	wat/parser_state.wat \
	wat/std/mem.test.wat \
	wat/std/mem.wat

ifneq ($(MODULE_DOC_GENERATOR),)
GENERATED_FILES += docs/MODULES.md
endif

GENERATED_INPUTS := \
	abi/host.json \
	abi/layout.json \
	abi/parser-state.json \
	tools/assemble-wat.js \
	tools/extract-wasm-modules.js \
	tools/generate-host-abi.js \
	tools/generate-layout.js \
	tools/generate-parser-state-abi.js \
	tools/generate-wasm-modules-abi.js \
	tools/layout-spec.js \
	tools/wat-parser.js \
	$(MODULE_DOC_GENERATOR) \
	$(WAT_SOURCES) \
	$(WAT_INCLUDES)

.PHONY: all generated check-generated

all: generated

generated: $(GENERATED_FILES)

$(GENERATED_FILES) &: $(GENERATED_INPUTS)
	node tools/generate-layout.js
	node tools/generate-host-abi.js
	node tools/generate-parser-state-abi.js
	node tools/extract-wasm-modules.js
	node tools/generate-wasm-modules-abi.js
ifneq ($(MODULE_DOC_GENERATOR),)
	node tools/generate-wasm-modules-docs.js
endif

check-generated: generated
	git diff --exit-code -- $(GENERATED_FILES)
