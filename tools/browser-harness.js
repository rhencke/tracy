"use strict";

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

async function flushMicrotasks(count = 1) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

module.exports = {
  createRafHarness,
  flushMicrotasks,
  installBrowserGlobals,
  installFakeDocument,
  installFakeWindow,
  installJspiStubs,
  makeFakeCanvas,
  makeFakeCanvasContext,
  makeFakeDocument,
  makeFakeElement,
};
