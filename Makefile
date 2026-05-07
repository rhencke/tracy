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
HOST_JS := $(shell find host -type f -name '*.mjs' -print | sort)
STATIC_FILES := $(shell find static -type f -print | sort)
STATIC_DIST_FILES := $(patsubst static/%,dist/%,$(STATIC_FILES))
APP_SHELL_FILES := dist/index.html dist/manifest.webmanifest
BUNDLE_FILES := \
	dist/bootstrap.bundle.js \
	dist/bootstrap.bundle.js.map \
	dist/worker.bundle.js \
	dist/worker.bundle.js.map
DIST_FILES := \
	$(WASM_FILES) \
	$(BUNDLE_FILES) \
	$(APP_SHELL_FILES) \
	$(STATIC_DIST_FILES) \
	dist/build-info.js

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

CLEAN_GENERATED_FILES := \
	HOST_ABI.md \
	abi/wasm-modules.json \
	host/abi.mjs \
	host/wasm-modules.mjs

ifneq ($(MODULE_DOC_GENERATOR),)
CLEAN_GENERATED_FILES += docs/MODULES.md
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

.PHONY: \
	all \
	bundle \
	check-generated \
	clean \
	coverage \
	coverage-report \
	coverage-strict \
	dist \
	generated \
	test \
	wasm \
	wasm-cov

all: dist

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

dist/bootstrap.bundle.js dist/bootstrap.bundle.js.map &: bootstrap.js $(HOST_JS) $(GENERATED_FILES) package-lock.json
	mkdir -p $(dir $@)
	esbuild bootstrap.js \
		--bundle \
		--minify \
		--sourcemap \
		--outfile=dist/bootstrap.bundle.js

dist/worker.bundle.js dist/worker.bundle.js.map &: worker.js $(HOST_JS) $(GENERATED_FILES) package-lock.json
	mkdir -p $(dir $@)
	esbuild worker.js \
		--bundle \
		--format=esm \
		--minify \
		--sourcemap \
		--outfile=dist/worker.bundle.js

bundle: $(BUNDLE_FILES)

dist/index.html: index.html
	mkdir -p $(dir $@)
	cp $< $@

dist/manifest.webmanifest: manifest.webmanifest
	mkdir -p $(dir $@)
	cp $< $@

dist/%: static/%
	mkdir -p $(dir $@)
	cp $< $@

dist/build-info.js: $(filter-out dist/build-info.js,$(DIST_FILES))
	build_hash="$$( \
		cd dist && \
		find . -type f ! -name 'build-info.js' ! -path './.wat-compat/*' -print0 \
			| sort -z \
			| xargs -0 sha256sum \
			| sha256sum \
			| awk '{ print $$1 }' \
	)"; \
	printf 'export const TRACY_BUILD_HASH = "%s";\n' "$$build_hash" > $@

dist: $(DIST_FILES)

check-generated: generated
	git diff --exit-code -- $(GENERATED_FILES)

test: dist check-generated
	bash tools/check-bootstrap-lines.sh
	node tools/wasm-modules-check.js
	node tools/host-shim-check.js
	node tools/ingest-worker-runtime-check.js
	node tools/runtime-worker-orchestration-check.js
	node tools/worker-bundle-check.js
	node tools/watwat.js --harness tools/tracy-watwat-harness.js dist/wasm/*.test.wasm dist/wasm/std/*.test.wasm
	node tools/watwat.js --expect-failure probe_assert_eq_i32_failure "deliberate i32 failure" dist/wasm/watwat.test.wasm
	bash tools/test-assert-probes.sh
	node tools/coverage-selftest.js
	node tools/cold-reload-index-check.js

coverage: wasm-cov
	node tools/coverage-run.js --check dist/wasm-cov

coverage-strict: coverage

coverage-report: wasm-cov
	node tools/coverage-run.js dist/wasm-cov

clean:
	rm -rf dist $(CLEAN_GENERATED_FILES)
