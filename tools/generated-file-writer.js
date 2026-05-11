const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

function resolveOutputPath(root, outputPath) {
  return path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
}

function relativeOutputPath(root, outputPath) {
  return path.relative(root, resolveOutputPath(root, outputPath)) || ".";
}

function defaultStaleMessage(relativePath, command) {
  return command === undefined
    ? `${relativePath} is out of date`
    : `${relativePath} is out of date; run ${command}`;
}

function replaceGeneratedBlock(text, start, end, body) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`missing generated block ${start} ${end}`);
  }

  const bodyStart = startIndex + start.length;
  return `${text.slice(0, bodyStart)}\n${body}\n${text.slice(endIndex)}`;
}

function readUtf8IfExists(absolutePath) {
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return null;
  }
}

async function readUtf8IfExistsAsync(absolutePath) {
  try {
    return await fsp.readFile(absolutePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return null;
  }
}

function createGeneratedFileWriter(options) {
  const {
    root,
    checkOnly,
    command,
    staleMessage = defaultStaleMessage,
    reportStale = (message) => console.error(message),
  } = options;

  if (typeof root !== "string") {
    throw new TypeError("generated file writer requires a root path");
  }

  function reportStaleOutput(outputPath) {
    const relativePath = relativeOutputPath(root, outputPath);
    reportStale(staleMessage(relativePath, command));
  }

  function writeIfChanged(outputPath, content) {
    const absolutePath = resolveOutputPath(root, outputPath);
    const previous = readUtf8IfExists(absolutePath);

    if (previous === content) {
      return true;
    }

    if (checkOnly) {
      reportStaleOutput(outputPath);
      return false;
    }

    fs.writeFileSync(absolutePath, content);
    return true;
  }

  async function writeIfChangedAsync(outputPath, content) {
    const absolutePath = resolveOutputPath(root, outputPath);
    const previous = await readUtf8IfExistsAsync(absolutePath);

    if (previous === content) {
      return true;
    }

    if (checkOnly) {
      reportStaleOutput(outputPath);
      return false;
    }

    await fsp.writeFile(absolutePath, content);
    return true;
  }

  function updateMarkedFile(outputPath, replacements) {
    const absolutePath = resolveOutputPath(root, outputPath);
    let text = fs.readFileSync(absolutePath, "utf8");

    for (const replacement of replacements) {
      text = replaceGeneratedBlock(text, replacement.start, replacement.end, replacement.body);
    }

    return writeIfChanged(outputPath, text);
  }

  return {
    updateMarkedFile,
    writeIfChanged,
    writeIfChangedAsync,
  };
}

module.exports = {
  createGeneratedFileWriter,
  replaceGeneratedBlock,
};
