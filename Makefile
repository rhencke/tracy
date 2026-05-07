SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

PATH := $(CURDIR)/node_modules/.bin:$(PATH)

.DELETE_ON_ERROR:

WAT_SOURCES := $(shell find wat -type f -name '*.wat' -print | sort)
WAT_INCLUDES := $(shell find wat -type f -name '*.inc' -print | sort)
WASM_FILES := $(patsubst wat/%.wat,dist/wasm/%.wasm,$(WAT_SOURCES))
WAT_COMPAT_FILES :=
COV_WAT_FILES := $(patsubst wat/%.wat,dist/wasm-cov/%.wat,$(WAT_SOURCES))
COV_WASM_FILES := $(patsubst %.wat,%.wasm,$(COV_WAT_FILES))
COV_MANIFEST_FILES :=

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

.PHONY: all generated wasm wasm-cov check-generated

all: generated wasm

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

define WAT_WASM_RULE
$(eval _wat_inputs := $(shell node tools/assemble-wat.js --inputs $(1) --relative-to $(CURDIR)))
$(eval _rel_wat := $(patsubst wat/%,%,$(1)))
$(eval _compat_wat := dist/.wat-compat/$(_rel_wat))
$(eval _compat_inputs := dist/.wat-compat/$(_rel_wat).inputs)
$(eval _wasm := dist/wasm/$(patsubst %.wat,%.wasm,$(_rel_wat)))
$(eval WAT_COMPAT_FILES += $(_compat_wat) $(_compat_inputs))
$(_compat_wat): $(_wat_inputs) tools/assemble-wat.js
	mkdir -p $$(dir $$@)
	node tools/assemble-wat.js $(1) $$@

$(_compat_inputs): $(_wat_inputs) tools/assemble-wat.js
	mkdir -p $$(dir $$@)
	node tools/assemble-wat.js --inputs $(1) --relative-to $$(CURDIR) > $$@

$(_wasm): $(_compat_wat) $(_compat_inputs)
	mkdir -p $$(dir $$@)
	wat2wasm $$< -o $$@
endef

$(foreach wat,$(WAT_SOURCES),$(eval $(call WAT_WASM_RULE,$(wat))))

wasm: $(WASM_FILES)

define WAT_COV_RULE
$(eval _rel_wat := $(patsubst wat/%,%,$(1)))
$(eval _compat_wat := dist/.wat-compat/$(_rel_wat))
$(eval _compat_inputs := dist/.wat-compat/$(_rel_wat).inputs)
$(eval _cov_wat := dist/wasm-cov/$(_rel_wat))
$(eval _cov_manifest := dist/wasm-cov/$(patsubst %.wat,%.cov.json,$(_rel_wat)))
$(eval _cov_wasm := dist/wasm-cov/$(patsubst %.wat,%.wasm,$(_rel_wat)))
$(if $(filter %.test.wat,$(1)),\
$(_cov_wat): $(_compat_wat) $(_compat_inputs)
	mkdir -p $$(dir $$@)
	cp $$< $$@
,\
$(eval COV_MANIFEST_FILES += $(_cov_manifest))\
$(_cov_wat) $(_cov_manifest) &: $(_compat_wat) $(_compat_inputs) tools/instrument.js tools/wat-parser.js
	mkdir -p $$(dir $(_cov_wat))
	node tools/instrument.js $(_compat_wat) $(_cov_wat) $(_cov_manifest) $(1)
)

$(_cov_wasm): $(_cov_wat)
	mkdir -p $$(dir $$@)
	wat2wasm $$< -o $$@
endef

$(foreach wat,$(WAT_SOURCES),$(eval $(call WAT_COV_RULE,$(wat))))

wasm-cov: $(COV_WAT_FILES) $(COV_MANIFEST_FILES) $(COV_WASM_FILES)

check-generated: generated
	git diff --exit-code -- $(GENERATED_FILES)
