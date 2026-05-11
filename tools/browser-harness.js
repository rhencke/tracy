"use strict";

const { moduleUrl } = require("./acceptance-wasm-helpers.js");

function makeFakeElement(overrides = {}) {
  return {
    addEventListener() {},
    removeAttribute() {},
    removeEventListener() {},
    setAttribute() {},
    style: {},
    set hidden(value) {
      this.isHidden = value;
    },
    ...overrides,
  };
}

function makeFakeCanvasContext(overrides = {}) {
  return {
    set fillStyle(value) {
      this.lastFillStyle = value;
    },
    fillRect() {},
    setTransform() {},
    ...overrides,
  };
}

function makeFakeCanvas({
  context = makeFakeCanvasContext(),
  elementOverrides = {},
  height = 240,
  id = "tracy",
  width = 320,
} = {}) {
  return {
    clientHeight: height,
    clientWidth: width,
    height: 0,
    hidden: false,
    id,
    width: 0,
    addEventListener() {},
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
    getContext() {
      return context;
    },
    ...elementOverrides,
  };
}

function makeFakeDocument({
  body = { appendChild() {} },
  canvas = makeFakeCanvas(),
  createElement = () => makeFakeElement(),
} = {}) {
  return {
    body,
    createElement,
    getElementById(id) {
      return id === canvas?.id ? canvas : null;
    },
  };
}

function installFakeDocument(options = {}) {
  const canvas = options.canvas ?? makeFakeCanvas(options.canvasOptions);
  const document = makeFakeDocument({ ...options, canvas });

  globalThis.document = document;

  return { canvas, document };
}

function installFakeWindow(options = {}) {
  const window = {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    ...options,
  };

  globalThis.window = window;

  return window;
}

function createRafHarness() {
  const frames = [];

  globalThis.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };

  return { frames };
}

async function runAnimationFrame(frames, timestamp, options = {}) {
  const frame = frames.shift();

  if (typeof frame !== "function") {
    throw new Error(`expected a frame callback at ${timestamp} ms`);
  }

  options.beforeFrame?.(timestamp);
  const startedAt = options.performance?.now?.();
  frame(timestamp);
  if (startedAt !== undefined) {
    options.frameDurations?.push(options.performance.now() - startedAt);
  }
  await flushMicrotasks(options.microtasks ?? 1);
}

function installJspiStubs() {
  globalThis.WebAssembly.Suspending = class Suspending {
    constructor(fn) {
      return fn;
    }
  };
  globalThis.WebAssembly.promising = (fn) => fn;
}

function installBrowserGlobals(options = {}) {
  const installed = installFakeDocument(options);
  const window = installFakeWindow(options.window);
  const raf = options.raf === false ? { frames: [] } : createRafHarness();

  if (options.jspi !== false) {
    installJspiStubs();
  }

  return { ...installed, ...raf, window };
}

function installRuntimeBrowserGlobals(options = {}) {
  const {
    canvas,
    createElement = () => makeFakeElement(),
    ...browserOptions
  } = options;
  const canvasOverrides = { hidden: false, id: "tracy", ...canvas };
  const runtimeCanvas =
    typeof canvas?.getContext === "function"
      ? canvas
      : makeFakeCanvas({
          elementOverrides: canvasOverrides,
          height: canvas?.height,
          width: canvas?.width,
        });

  return installBrowserGlobals({
    canvas: runtimeCanvas,
    createElement,
    ...browserOptions,
  });
}

async function flushMicrotasks(count = 1) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

async function flushRuntimeMicrotasks(count = 8) {
  await flushMicrotasks(count);
}

async function flushAsyncWork(options = {}) {
  await flushMicrotasks(options.beforeImmediateMicrotasks ?? 1);
  if (options.immediate !== false) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await flushMicrotasks(options.afterImmediateMicrotasks ?? 1);
}

const RUNTIME_APP_FIRST_FRAME_TIMESTAMP_MS = 0;
const RUNTIME_APP_READY_FRAME_TIMESTAMP_MS = 16;

function createRuntimeAppHarness(options = {}) {
  const {
    browserGlobals: defaultBrowserGlobals = {},
    host: defaultHost = {},
    memory: defaultMemory = null,
    memoryOptions: defaultMemoryOptions = { initial: 1 },
    runAppOptions: defaultRunAppOptions = {},
    runtime: defaultRuntime = null,
    runtimeModulePath: defaultRuntimeModulePath = "host/runtime.mjs",
  } = options;
  let browserGlobals = null;
  let controller = null;
  let memory = defaultMemory;
  let runtime = defaultRuntime;

  function requireBooted() {
    if (browserGlobals === null || controller === null) {
      throw new Error("runtime app harness must boot before running frames");
    }
  }

  async function flushRuntimeWork(count) {
    await flushRuntimeMicrotasks(count);
  }

  async function boot(bootOptions = {}) {
    if (controller !== null) {
      throw new Error("runtime app harness boot was already called");
    }

    browserGlobals = installRuntimeBrowserGlobals(
      bootOptions.browserGlobals ?? defaultBrowserGlobals,
    );
    memory =
      bootOptions.memory ??
      memory ??
      new WebAssembly.Memory(bootOptions.memoryOptions ?? defaultMemoryOptions);
    runtime =
      bootOptions.runtime ??
      runtime ??
      await importRepoModule(bootOptions.runtimeModulePath ?? defaultRuntimeModulePath);
    controller = runtime.runApp(
      memory,
      bootOptions.host ?? defaultHost,
      bootOptions.runAppOptions ?? defaultRunAppOptions,
    );
    await flushRuntimeWork(bootOptions.microtasks);

    return controller;
  }

  async function runFrame(timestamp, frameOptions = {}) {
    requireBooted();

    await runAnimationFrame(browserGlobals.frames, timestamp, {
      beforeFrame: frameOptions.beforeFrame,
      frameDurations: frameOptions.frameDurations,
      microtasks: 0,
      performance: frameOptions.performance,
    });
    await flushRuntimeWork(frameOptions.microtasks);
  }

  async function bootToAppReady(appReadyOptions = {}) {
    if (controller === null) {
      await boot(appReadyOptions);
    } else {
      requireBooted();
    }

    await runFrame(
      appReadyOptions.firstFrameTimestamp ?? RUNTIME_APP_FIRST_FRAME_TIMESTAMP_MS,
      appReadyOptions,
    );
    const appReadyFrameCallbacks = browserGlobals.frames.splice(0);
    for (const frame of appReadyFrameCallbacks) {
      frame(
        appReadyOptions.appReadyFrameTimestamp ??
          RUNTIME_APP_READY_FRAME_TIMESTAMP_MS,
      );
    }
    await flushRuntimeWork(appReadyOptions.microtasks);
  }

  return {
    boot,
    bootToAppReady,
    flushRuntimeWork,
    get browserGlobals() {
      return browserGlobals;
    },
    get controller() {
      return controller;
    },
    get frames() {
      return browserGlobals?.frames ?? [];
    },
    get memory() {
      return memory;
    },
    runFrame,
  };
}

function createFakeWorkerClass() {
  return class FakeWorker {
    static instances = [];

    static reset() {
      this.instances.length = 0;
    }

    constructor(url, options) {
      this.events = new Map();
      this.options = options;
      this.posted = [];
      this.url = url;
      this.constructor.instances.push(this);
    }

    addEventListener(type, callback) {
      this.events.set(type, callback);
    }

    emit(type, data) {
      this.events.get(type)?.({ data });
    }

    postMessage(message) {
      this.posted.push(message);
    }

    terminate() {
      this.terminated = true;
    }
  };
}

function repoModuleUrl(relativePath) {
  return moduleUrl(relativePath);
}

function importRepoModule(relativePath) {
  return import(repoModuleUrl(relativePath));
}

module.exports = {
  createFakeWorkerClass,
  createRafHarness,
  createRuntimeAppHarness,
  flushAsyncWork,
  flushMicrotasks,
  flushRuntimeMicrotasks,
  importRepoModule,
  installBrowserGlobals,
  installFakeDocument,
  installFakeWindow,
  installJspiStubs,
  installRuntimeBrowserGlobals,
  makeFakeCanvas,
  makeFakeCanvasContext,
  makeFakeDocument,
  makeFakeElement,
  repoModuleUrl,
  runAnimationFrame,
};
