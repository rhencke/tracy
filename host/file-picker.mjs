export function makeFilePickerHost(memoryView) {
  const files = new Map();
  let fileInput = null;
  let nextFileHandle = 1;

  function ensureFileInput() {
    if (fileInput !== null) {
      return fileInput;
    }

    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.hidden = true;
    fileInput.tabIndex = -1;
    document.body.appendChild(fileInput);

    return fileInput;
  }

  function filePickerOpen(acceptPtr, acceptLen) {
    const input = ensureFileInput();
    const accept = memoryView.decodeString(acceptPtr, acceptLen).trim();

    if (accept.length > 0) {
      input.accept = accept;
    } else {
      input.removeAttribute("accept");
    }

    input.value = "";

    return new Promise((resolve) => {
      let settled = false;

      function settle(value) {
        if (settled) {
          return;
        }

        settled = true;
        input.removeEventListener("change", onChange);
        window.removeEventListener("focus", onFocus);
        resolve(value);
      }

      function onChange() {
        const file = input.files?.[0] ?? null;

        if (file === null) {
          settle(-1);
          return;
        }

        const handle = nextFileHandle;
        nextFileHandle += 1;
        files.set(handle, file);
        settle(handle);
      }

      function onFocus() {
        setTimeout(() => {
          if ((input.files?.length ?? 0) === 0) {
            settle(-1);
          }
        }, 0);
      }

      input.addEventListener("change", onChange, { once: true });
      window.addEventListener("focus", onFocus, { once: true });
      input.click();
    });
  }

  return { file_picker_open: filePickerOpen, files };
}
