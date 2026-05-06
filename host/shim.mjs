import { makeCanvasHost } from "./canvas.mjs";
import { makeFilePickerHost } from "./file-picker.mjs";
import { makeMemoryView } from "./memory.mjs";
import { makeOpfsSourceHost } from "./opfs-source.mjs";
import { makePointerHost } from "./pointer.mjs";

export function makeShim(memory) {
  const canvas = document.getElementById("tracy");
  const memoryView = makeMemoryView(memory);
  const { files, ...fileHost } = makeFilePickerHost(memoryView);

  return {
    ...makeCanvasHost(canvas, memoryView),
    ...fileHost,
    ...makeOpfsSourceHost(memoryView, files),
    ...makePointerHost(canvas, memoryView),
  };
}
