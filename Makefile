SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

PATH := $(CURDIR)/node_modules/.bin:$(PATH)
DIST_COMPRESSED_BUDGET_BYTES ?= 200000

.DELETE_ON_ERROR:

WAT_SOURCES := $(shell find wat -type f -name '*.wat' -print | sort)
WAT_INCLUDES := $(shell find wat -type f -name '*.inc' -print | sort)
GENERATED_WAT_FILES := \
	wat/app.test.wat \
	wat/app.wat \
	wat/parser.test.wat \
	wat/parser.wat \
	wat/parser_state.test.wat \
	wat/parser_state.wat \
	wat/std/mem.test.wat \
	wat/std/mem.wat
GENERATED_WAT_INCLUDES := \
	wat/trace-renderer-abi.wat.inc
GENERATOR_WAT_INPUTS := $(filter-out $(GENERATED_WAT_FILES),$(WAT_SOURCES))
GENERATOR_WAT_INCLUDE_INPUTS := $(filter-out $(GENERATED_WAT_INCLUDES),$(WAT_INCLUDES))
WASM_FILES := $(patsubst wat/%.wat,dist/wasm/%.wasm,$(WAT_SOURCES))
PRODUCTION_WASM_FILES := $(filter-out %.test.wasm,$(WASM_FILES))
WAT_COMPAT_FILES :=
COV_WAT_FILES := $(patsubst wat/%.wat,dist/wasm-cov/%.wat,$(WAT_SOURCES))
COV_WASM_FILES := $(patsubst %.wat,%.wasm,$(COV_WAT_FILES))
COV_MANIFEST_FILES :=
HOST_JS_GENERATED := host/abi.mjs host/index-format-spec.mjs host/startup-spec.mjs host/trace-renderer-spec.mjs host/wasm-modules.mjs
HOST_JS := $(sort $(shell find host -type f -name '*.mjs' -print) $(HOST_JS_GENERATED))
APP_JS_SOURCES := bootstrap.mjs worker.js
APP_JS_DIST_FILES := $(patsubst %,dist/%,$(APP_JS_SOURCES))
HOST_JS_DIST_FILES := $(patsubst host/%,dist/host/%,$(HOST_JS))
JS_DIST_FILES := \
	$(APP_JS_DIST_FILES) \
	$(HOST_JS_DIST_FILES)
STATIC_FILES := $(shell find static -type f -print | sort)
STATIC_DIST_FILES := $(patsubst static/%,dist/%,$(STATIC_FILES))
APP_SHELL_FILES := dist/index.html dist/manifest.webmanifest
SERVICE_WORKER_FILES := dist/service-worker.js dist/precache-manifest.js
APP_RUNTIME_DIST_FILES := \
	$(PRODUCTION_WASM_FILES) \
	$(JS_DIST_FILES) \
	$(APP_SHELL_FILES) \
	$(STATIC_DIST_FILES)
PRECACHE_DIST_FILES := \
	$(APP_RUNTIME_DIST_FILES) \
	dist/build-info.js \
	dist/service-worker.js
DIST_FILES := \
	$(WASM_FILES) \
	$(JS_DIST_FILES) \
	$(APP_SHELL_FILES) \
	$(STATIC_DIST_FILES) \
	dist/build-info.js \
	$(SERVICE_WORKER_FILES)

MODULE_DOC_GENERATOR := $(wildcard tools/generate-wasm-modules-docs.js)

GENERATED_FILES := \
	HOST_ABI.md \
	MEMORY.md \
	abi/wasm-modules.json \
	host/abi.mjs \
	host/index-format-spec.mjs \
	host/startup-spec.mjs \
	host/trace-renderer-spec.mjs \
	host/wasm-modules.mjs \
	$(GENERATED_WAT_FILES) \
	$(GENERATED_WAT_INCLUDES)

ifneq ($(MODULE_DOC_GENERATOR),)
GENERATED_FILES += docs/MODULES.md
endif

CLEAN_GENERATED_FILES := \
	HOST_ABI.md \
	abi/wasm-modules.json \
	host/abi.mjs \
	host/index-format-spec.mjs \
	host/startup-spec.mjs \
	host/trace-renderer-spec.mjs \
	host/wasm-modules.mjs

ifneq ($(MODULE_DOC_GENERATOR),)
CLEAN_GENERATED_FILES += docs/MODULES.md
endif

GENERATED_SUPPORT_INPUTS := $(filter-out %-check.js,$(wildcard tools/generated-*.js))

GENERATED_INPUTS := \
	abi/host.json \
	abi/layout.json \
	abi/parser-state.json \
	abi/palette.json \
	abi/runtime.json \
	tools/assemble-wat.js \
	tools/extract-wasm-modules.js \
	tools/generate-host-abi.js \
	tools/generate-layout.js \
	tools/generate-palette-spec.js \
	tools/generate-parser-state-abi.js \
	tools/generate-runtime-spec.js \
	tools/generate-wasm-modules-abi.js \
	$(GENERATED_SUPPORT_INPUTS) \
	tools/layout-spec.js \
	tools/wat-parser.js \
	$(MODULE_DOC_GENERATOR) \
	$(GENERATOR_WAT_INPUTS) \
	$(GENERATOR_WAT_INCLUDE_INPUTS)

.PHONY: \
	all \
	app-load-bench \
	check-generated \
	clean \
	coverage \
	dist \
	dist-size-budget \
	generated \
	js \
	lighthouse-ci \
	test \
	wasm \
	wasm-cov

all: dist

app-load-bench: dist tools/app-load-bench.js
	node tools/app-load-bench.js

lighthouse-ci: dist .lighthouserc.cjs
	npm run lhci:autorun

generated: $(GENERATED_FILES)

$(GENERATED_FILES) &: $(GENERATED_INPUTS)
	node tools/generate-layout.js
	node tools/generate-host-abi.js
	node tools/generate-palette-spec.js
	node tools/generate-parser-state-abi.js
	node tools/generate-runtime-spec.js
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

dist/bootstrap.mjs: bootstrap.mjs
	mkdir -p $(dir $@)
	cp $< $@

dist/worker.js: worker.js
	mkdir -p $(dir $@)
	cp $< $@

dist/host/%.mjs: host/%.mjs
	mkdir -p $(dir $@)
	cp $< $@

js: $(JS_DIST_FILES)

dist/index.html: index.html
	mkdir -p $(dir $@)
	cp $< $@

dist/manifest.webmanifest: manifest.webmanifest
	mkdir -p $(dir $@)
	cp $< $@

dist/%: static/%
	mkdir -p $(dir $@)
	cp $< $@

dist/service-worker.js: service-worker.js
	mkdir -p $(dir $@)
	cp $< $@

dist/precache-manifest.js: $(PRECACHE_DIST_FILES) tools/generate-precache-manifest.js
	node tools/generate-precache-manifest.js dist $@ $(PRECACHE_DIST_FILES)

dist/build-info.js: $(APP_RUNTIME_DIST_FILES)
	build_hash="$$( \
		cd dist && \
		find . -type f ! -name 'build-info.js' ! -name 'precache-manifest.js' ! -name 'service-worker.js' ! -name '*.test.wasm' ! -path './.wat-compat/*' -print0 \
			| sort -z \
			| xargs -0 sha256sum \
			| sha256sum \
			| awk '{ print $$1 }' \
	)"; \
	printf 'export const TRACY_BUILD_HASH = "%s";\n' "$$build_hash" > $@

dist-size-budget: $(DIST_FILES) tools/dist-budget-check.js
	node tools/dist-budget-check.js --budget $(DIST_COMPRESSED_BUDGET_BYTES) $(DIST_FILES)

dist: $(DIST_FILES) dist-size-budget

check-generated: generated
	git diff --exit-code -- $(GENERATED_FILES)

test: dist check-generated
	bash tools/check-bootstrap-lines.sh
	node tools/generate-runtime-spec.js --check
	node tools/generate-palette-spec.js --check
	node tools/wasm-modules-check.js
	node tools/ingest-worker-runtime-check.js
	node tools/runtime-worker-orchestration-check.js
	node tools/production-topology-fixture-check.js
	node tools/interactive-ingest-check.js
	node tools/interactive-ingest-browser-check.js
	node tools/direct-esm-check.js
	node tools/dist-browser-helpers-check.js
	npm run test:node
	node tools/dist-budget-check.js --self-test
	node tools/app-load-bench.js --self-test
	node tools/lighthouse-ci-check.js
	node tools/coverage-selftest.js
	node tools/cold-reload-index-check.js

coverage: wasm-cov
	npm run test:node -- --coverage

clean:
	rm -rf dist $(CLEAN_GENERATED_FILES)
