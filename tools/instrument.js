#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  TokenReader,
  WatParseError,
  skipWatList,
} = require("./wat-parser.js");

const branchOpcodes = new Set(["br", "br_if", "br_table", "return", "unreachable"]);
const controlBoundaryAtoms = new Set(["else", "end", "then"]);
const definitionHeads = new Set([
  "data",
  "elem",
  "export",
  "func",
  "global",
  "import",
  "memory",
  "start",
  "table",
  "type",
]);
const funcPreludeHeads = new Set(["export", "import", "local", "param", "result", "type"]);
const blockPreludeHeads = new Set(["param", "result", "type"]);

function manifestLoc(node) {
  return {
    line: node?.loc?.line ?? 1,
    col: node?.loc?.col ?? 1,
  };
}

class WatStreamWriter {
  constructor(outputPath) {
    this.stream = fs.createWriteStream(outputPath, { encoding: "utf8" });
    this.depth = 0;
    this.frames = [];
  }

  async close() {
    await new Promise((resolve, reject) => {
      this.stream.end((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async write(text) {
    if (!this.stream.write(text)) {
      await new Promise((resolve) => this.stream.once("drain", resolve));
    }
  }

  async beforeItem() {
    const frame = this.frames[this.frames.length - 1];
    if (frame === undefined) {
      return;
    }

    if (frame.count > 0) {
      await this.write(`\n${"  ".repeat(this.depth)}`);
    }
    frame.count += 1;
  }

  async openList() {
    await this.beforeItem();
    await this.write("(");
    this.frames.push({ count: 0 });
    this.depth += 1;
  }

  async closeList() {
    const frame = this.frames.pop();
    this.depth -= 1;

    if (frame.count > 1) {
      await this.write(`\n${"  ".repeat(this.depth)}`);
    }
    await this.write(")");
  }

  async token(token) {
    await this.beforeItem();
    if (token.type === "string") {
      await this.write(token.raw);
    } else if (token.type === "atom") {
      await this.write(token.value);
    } else {
      throw new WatParseError(`unexpected token ${token.type}`, token.loc);
    }
  }

  async atom(value) {
    await this.token({ type: "atom", value, loc: null });
  }
}

function tokenHeadValue(token) {
  return token?.type === "atom" ? token.value : null;
}

function isBlockPreludeToken(token, nextToken) {
  if (token?.type === "atom") {
    return token.value.startsWith("$");
  }

  return token?.type === "(" && blockPreludeHeads.has(tokenHeadValue(nextToken));
}

function isFuncPreludeToken(token, nextToken) {
  if (token?.type === "atom") {
    return token.value.startsWith("$");
  }

  return token?.type === "(" && funcPreludeHeads.has(tokenHeadValue(nextToken));
}

function isLikelyInstructionStartToken(token) {
  if (token?.type !== "atom") {
    return token?.type === "(";
  }

  if (token.value.startsWith("$") || /^-?(?:0x[0-9a-fA-F]+|\d)/.test(token.value)) {
    return false;
  }

  return (
    token.value.includes(".") ||
    branchOpcodes.has(token.value) ||
    controlBoundaryAtoms.has(token.value) ||
    definitionHeads.has(token.value)
  );
}

async function streamCounter(writer, state, func, kind, sourceToken) {
  const id = state.blocks.length;
  const loc = manifestLoc(sourceToken);
  state.blocks.push({ id, func, kind, line: loc.line, col: loc.col });
  await writer.atom("i32.const");
  await writer.atom(String(id));
  await writer.atom("call");
  await writer.atom("$cov_hit");
}

async function copyAny(reader, writer) {
  const token = await reader.next();

  if (token.type === "(") {
    const head = await reader.next();
    await copyList(reader, writer, head);
  } else if (token.type === "atom" || token.type === "string") {
    await writer.token(token);
  } else {
    throw new WatParseError("unexpected close paren", token.loc);
  }
}

async function copyList(reader, writer, head) {
  await writer.openList();
  await writer.token(head);

  while ((await reader.peek()).type !== ")") {
    await copyAny(reader, writer);
  }

  await reader.expect(")", "missing close paren");
  await writer.closeList();
}

async function parseAny(reader, writer, state, context) {
  const token = await reader.next();

  if (token.type === "(") {
    const head = await reader.next();
    await parseList(reader, writer, state, context, head, token);
    return head.value;
  }

  if (token.type === "atom" || token.type === "string") {
    await writer.token(token);
    return token.value ?? token.raw;
  }

  throw new WatParseError("unexpected close paren", token.loc);
}

async function parseList(reader, writer, state, context, head, sourceToken) {
  await writer.openList();
  await writer.token(head);

  if (context.topLevel && head.type === "atom" && head.value === "func") {
    await parseFuncList(reader, writer, state, sourceToken);
  } else if (context.func !== null && head.type === "atom" && (head.value === "block" || head.value === "loop")) {
    await parseFoldedBlock(reader, writer, state, context, head.value, sourceToken);
  } else if (context.func !== null && head.type === "atom" && head.value === "if") {
    await parseFoldedIf(reader, writer, state, context);
  } else if (context.func !== null && head.type === "atom" && (head.value === "then" || head.value === "else")) {
    await streamCounter(writer, state, context.func, head.value === "then" ? "if-then" : "if-else", sourceToken);
    await parseSequence(reader, writer, state, context);
  } else {
    await parseSequence(reader, writer, state, { ...context, topLevel: false });
  }

  await reader.expect(")", "missing close paren");
  await writer.closeList();
}

async function parseFuncPreludeList(reader, writer, state, head, funcInfo) {
  await writer.openList();
  await writer.token(head);

  if (head.value === "import") {
    funcInfo.imported = true;
  } else if (head.value === "export") {
    const token = await reader.peek();
    if (!funcInfo.explicitName && token.type === "string") {
      funcInfo.name = token.raw.slice(1, -1);
    }
  }

  await parseSequence(reader, writer, state, { func: null, topLevel: false });
  await reader.expect(")", "missing close paren");
  await writer.closeList();
}

async function parseFuncList(reader, writer, state, sourceToken) {
  const funcInfo = { explicitName: false, imported: false, name: `$func${state.funcIndex + 1}` };

  while (true) {
    const token = await reader.peek();
    const nextToken = token.type === "(" ? await reader.peek(1) : null;

    if (!isFuncPreludeToken(token, nextToken)) {
      break;
    }

    if (token.type === "atom") {
      const item = await reader.next();
      if (item.value.startsWith("$")) {
        funcInfo.explicitName = true;
        funcInfo.name = item.value;
      }
      await writer.token(item);
    } else {
      await reader.expect("(", "expected function prelude list");
      const head = await reader.next();
      await parseFuncPreludeList(reader, writer, state, head, funcInfo);
    }
  }

  if (!funcInfo.imported) {
    state.funcIndex += 1;
    await streamCounter(writer, state, funcInfo.name, "func-entry", sourceToken);
    await parseSequence(reader, writer, state, { func: funcInfo.name, topLevel: false });
  } else {
    await parseSequence(reader, writer, state, { func: null, topLevel: false });
  }
}

async function parseBlockPrelude(reader, writer) {
  while (true) {
    const token = await reader.peek();
    const nextToken = token.type === "(" ? await reader.peek(1) : null;

    if (!isBlockPreludeToken(token, nextToken)) {
      return;
    }

    await copyAny(reader, writer);
  }
}

async function parseFoldedBlock(reader, writer, state, context, kind, sourceToken) {
  await parseBlockPrelude(reader, writer);
  await streamCounter(writer, state, context.func, kind, sourceToken);
  await parseSequence(reader, writer, state, context);
}

async function parseFoldedIf(reader, writer, state, context) {
  await parseBlockPrelude(reader, writer);

  while ((await reader.peek()).type !== ")") {
    const token = await reader.peek();
    const nextToken = token.type === "(" ? await reader.peek(1) : null;

    if (token.type === "(" && nextToken?.type === "atom" && (nextToken.value === "then" || nextToken.value === "else")) {
      await reader.expect("(", "expected folded if arm");
      const head = await reader.next();
      await parseList(reader, writer, state, context, head, token);
    } else {
      await parseAny(reader, writer, state, context);
    }
  }
}

async function parseBranchOperands(reader, writer, opcode) {
  if (opcode === "br" || opcode === "br_if") {
    if ((await reader.peek()).type !== ")") {
      await parseAny(reader, writer, { blocks: [] }, { func: null, topLevel: false });
    }
    return;
  }

  if (opcode === "br_table") {
    while ((await reader.peek()).type !== ")" && !isLikelyInstructionStartToken(await reader.peek())) {
      await parseAny(reader, writer, { blocks: [] }, { func: null, topLevel: false });
    }
  }
}

async function hasPostBranchInstruction(reader) {
  const token = await reader.peek();

  return token.type !== ")" && !(token.type === "atom" && controlBoundaryAtoms.has(token.value));
}

async function parseSequence(reader, writer, state, context) {
  while ((await reader.peek()).type !== ")") {
    const token = await reader.peek();

    if (context.func !== null && token.type === "atom" && (token.value === "block" || token.value === "loop")) {
      const item = await reader.next();
      await writer.token(item);
      await parseBlockPrelude(reader, writer);
      await streamCounter(writer, state, context.func, item.value, item);
    } else if (context.func !== null && token.type === "atom" && token.value === "if") {
      const item = await reader.next();
      await writer.token(item);
      await parseBlockPrelude(reader, writer);
      await streamCounter(writer, state, context.func, "if-then", item);
    } else if (context.func !== null && token.type === "atom" && token.value === "else") {
      const item = await reader.next();
      await writer.token(item);
      await streamCounter(writer, state, context.func, "if-else", item);
    } else if (context.func !== null && token.type === "atom" && branchOpcodes.has(token.value)) {
      const item = await reader.next();
      await writer.token(item);
      await parseBranchOperands(reader, writer, item.value);
      if (await hasPostBranchInstruction(reader)) {
        await streamCounter(writer, state, context.func, "post-branch", item);
      }
    } else {
      const head = await parseAny(reader, writer, state, context);
      if (context.func !== null && branchOpcodes.has(head) && (await hasPostBranchInstruction(reader))) {
        await streamCounter(writer, state, context.func, "post-branch", token);
      }
    }
  }
}

async function scanCoverageImport(inputPath) {
  const reader = new TokenReader(inputPath);

  try {
    await reader.expect("(", "expected a single WAT module");
    const moduleHead = await reader.next();
    if (moduleHead.type !== "atom" || moduleHead.value !== "module") {
      throw new WatParseError("expected a single WAT module", moduleHead.loc);
    }

    while ((await reader.peek()).type !== ")") {
      const token = await reader.next();
      if (token.type !== "(") {
        continue;
      }

      const head = await reader.next();
      if (head.type !== "atom" || head.value !== "import") {
        await skipWatList(reader);
        continue;
      }

      const moduleName = await reader.next();
      const fieldName = await reader.next();
      let hasCovHitFunc = false;

      while ((await reader.peek()).type !== ")") {
        const item = await reader.next();
        if (item.type === "atom" && item.value === "$cov_hit") {
          hasCovHitFunc = true;
        } else if (item.type === "(") {
          await scanImportDesc(reader, (atomToken) => {
            if (atomToken.value === "$cov_hit") {
              hasCovHitFunc = true;
            }
          });
        }
      }

      await reader.expect(")", "missing close paren");
      if (
        moduleName.type === "string" &&
        moduleName.raw === "\"cov\"" &&
        fieldName.type === "string" &&
        fieldName.raw === "\"hit\"" &&
        hasCovHitFunc
      ) {
        return true;
      }
    }

    return false;
  } finally {
    await reader.close();
  }
}

async function scanImportDesc(reader, onAtom) {
  while ((await reader.peek()).type !== ")") {
    const token = await reader.next();
    if (token.type === "atom") {
      onAtom(token);
    } else if (token.type === "(") {
      await scanImportDesc(reader, onAtom);
    }
  }
  await reader.expect(")", "missing close paren");
}

async function writeCoverageImport(writer) {
  await writer.openList();
  await writer.atom("import");
  await writer.token({ type: "string", raw: "\"cov\"" });
  await writer.token({ type: "string", raw: "\"hit\"" });
  await writer.openList();
  await writer.atom("func");
  await writer.atom("$cov_hit");
  await writer.openList();
  await writer.atom("param");
  await writer.atom("i32");
  await writer.closeList();
  await writer.closeList();
  await writer.closeList();
}

async function instrumentWatFile(inputPath, outputPath, options = {}) {
  const reader = new TokenReader(inputPath);
  const writer = new WatStreamWriter(outputPath);
  const state = { blocks: [], funcIndex: 0 };

  try {
    const hasCovImport = await scanCoverageImport(inputPath);
    await reader.expect("(", "expected a single WAT module");
    const moduleHead = await reader.next();
    if (moduleHead.type !== "atom" || moduleHead.value !== "module") {
      throw new WatParseError("expected a single WAT module", moduleHead.loc);
    }

    await writer.openList();
    await writer.token(moduleHead);
    if (!hasCovImport) {
      await writeCoverageImport(writer);
    }

    await parseSequence(reader, writer, state, { func: null, topLevel: true });
    await reader.expect(")", "missing close paren");
    await writer.closeList();
    await writer.write("\n");

    const trailing = await reader.next();
    if (trailing.type !== "eof") {
      throw new WatParseError("expected a single WAT module", trailing.loc);
    }
  } finally {
    await reader.close();
    await writer.close();
  }

  return {
    module: options.module ?? inputPath,
    blocks: state.blocks,
  };
}

async function main() {
  const [, , inputPath, outputPath, manifestPath, modulePath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("usage: instrument input.wat output.wat [output.cov.json] [module.wat]");
    process.exitCode = 64;
    return;
  }

  const covPath = manifestPath ?? path.join(path.dirname(outputPath), `${path.basename(outputPath, ".wat")}.cov.json`);
  const manifest = await instrumentWatFile(inputPath, outputPath, { module: modulePath ?? inputPath });
  await fsp.writeFile(covPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  WatParseError,
  instrumentWatFile,
};
