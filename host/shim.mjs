import { makeCanvasHost } from "./canvas.mjs";
import { makeFilePickerHost } from "./file-picker.mjs";
import { makeMemoryView } from "./memory.mjs";
import {
  makeOpfsMainHost,
  makeOpfsSourceHost,
  makeOpfsWorkerHost,
} from "./opfs-source.mjs";
import { makePointerHost } from "./pointer.mjs";

function makeBrowserHost(memoryView, options = {}) {
  const canvas = document.getElementById("tracy");
  const { files, ...fileHost } = makeFilePickerHost(memoryView, options);

  return {
    files,
    ...makeCanvasHost(canvas, memoryView),
    ...fileHost,
    ...makePointerHost(canvas, memoryView),
  };
}

export function makeMainThreadHost(memory, options = {}) {
  const memoryView = makeMemoryView(memory);
  const { files, ...browserHost } = makeBrowserHost(memoryView, options);

  return {
    ...browserHost,
    ...makeOpfsMainHost(memoryView, files),
  };
}

export function makeWorkerThreadHost(memory) {
  return makeOpfsWorkerHost(makeMemoryView(memory));
}

export function makeShim(memory) {
  const memoryView = makeMemoryView(memory);
  const { files, ...browserHost } = makeBrowserHost(memoryView);

  return {
    ...browserHost,
    ...makeOpfsSourceHost(memoryView, files),
  };
}
