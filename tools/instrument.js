#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

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

class WatParseError extends Error {
  constructor(message, loc) {
    super(`${message} at ${loc.line}:${loc.col}`);
    this.name = "WatParseError";
    this.loc = loc;
  }
}

function locFor(index, line, col) {
  return { index, line, col };
}

function advanceLoc(source, state, text) {
  for (let i = 0; i < text.length; i += 1) {
    state.index += 1;
    if (text[i] === "\n") {
      state.line += 1;
      state.col = 1;
    } else {
      state.col += 1;
    }
  }
}

function skipLineComment(source, state) {
  while (state.index < source.length && source[state.index] !== "\n") {
    advanceLoc(source, state, source[state.index]);
  }
}

function skipBlockComment(source, state) {
  let depth = 1;
  advanceLoc(source, state, "(;");

  while (state.index < source.length && depth > 0) {
    const pair = source.slice(state.index, state.index + 2);

    if (pair === "(;") {
      depth += 1;
      advanceLoc(source, state, pair);
    } else if (pair === ";)") {
      depth -= 1;
      advanceLoc(source, state, pair);
    } else {
      advanceLoc(source, state, source[state.index]);
    }
  }

  if (depth !== 0) {
    throw new WatParseError("unterminated block comment", locFor(state.index, state.line, state.col));
  }
}

function readString(source, state) {
  const start = locFor(state.index, state.line, state.col);
  let raw = "";
  advanceLoc(source, state, "\"");
  raw += "\"";

  while (state.index < source.length) {
    const char = source[state.index];
    raw += char;
    advanceLoc(source, state, char);

    if (char === "\\") {
      if (state.index >= source.length) {
        break;
      }
      raw += source[state.index];
      advanceLoc(source, state, source[state.index]);
      continue;
    }

    if (char === "\"") {
      return { type: "string", raw, loc: start };
    }

    if (char === "\n") {
      throw new WatParseError("unterminated string", start);
    }
  }

  throw new WatParseError("unterminated string", start);
}

function readAtom(source, state) {
  const start = locFor(state.index, state.line, state.col);
  let value = "";

  while (state.index < source.length) {
    const char = source[state.index];
    const pair = source.slice(state.index, state.index + 2);

    if (/\s/.test(char) || char === "(" || char === ")" || pair === ";;" || pair === "(;") {
      break;
    }

    value += char;
    advanceLoc(source, state, char);
  }

  return { type: "atom", value, loc: start };
}

function tokenizeWat(source) {
  const state = { index: 0, line: 1, col: 1 };
  const tokens = [];

  while (state.index < source.length) {
    const char = source[state.index];
    const pair = source.slice(state.index, state.index + 2);

    if (/\s/.test(char)) {
      advanceLoc(source, state, char);
    } else if (pair === ";;") {
      skipLineComment(source, state);
    } else if (pair === "(;") {
      skipBlockComment(source, state);
    } else if (char === "(" || char === ")") {
      tokens.push({ type: char, loc: locFor(state.index, state.line, state.col) });
      advanceLoc(source, state, char);
    } else if (char === "\"") {
      tokens.push(readString(source, state));
    } else {
      const token = readAtom(source, state);
      if (token.value.length === 0) {
        throw new WatParseError(`unexpected character ${JSON.stringify(char)}`, token.loc);
      }
      tokens.push(token);
    }
  }

  return tokens;
}

function parseWat(source) {
  const tokens = tokenizeWat(source);
  let cursor = 0;

  function parseNode() {
    const token = tokens[cursor];

    if (token === undefined) {
      throw new WatParseError("unexpected end of input", locFor(source.length, 1, 1));
    }

    cursor += 1;

    if (token.type === "atom" || token.type === "string") {
      return { ...token };
    }

    if (token.type === ")") {
      throw new WatParseError("unexpected close paren", token.loc);
    }

    const node = { type: "list", items: [], loc: token.loc, endLoc: null };

    while (cursor < tokens.length && tokens[cursor].type !== ")") {
      node.items.push(parseNode());
    }

    if (cursor >= tokens.length) {
      throw new WatParseError("missing close paren", token.loc);
    }

    node.endLoc = tokens[cursor].loc;
    cursor += 1;
    return node;
  }

  const body = [];
  while (cursor < tokens.length) {
    body.push(parseNode());
  }

  return { type: "program", body };
}

function atom(value, loc = null) {
  return { type: "atom", value, loc };
}

function stringLiteral(raw, loc = null) {
  return { type: "string", raw, loc };
}

function list(items, loc = null) {
  return { type: "list", items, loc, endLoc: null };
}

function headValue(node) {
  return node?.type === "list" && node.items[0]?.type === "atom" ? node.items[0].value : null;
}

function isListHead(node, value) {
  return headValue(node) === value;
}

function isAtomValue(node, value) {
  return node?.type === "atom" && node.value === value;
}

function cloneLoc(loc) {
  return loc === null ? null : { ...loc };
}

function cloneNode(node) {
  if (node.type === "atom") {
    return atom(node.value, cloneLoc(node.loc));
  }

  if (node.type === "string") {
    return stringLiteral(node.raw, cloneLoc(node.loc));
  }

  return {
    type: "list",
    items: node.items.map(cloneNode),
    loc: cloneLoc(node.loc),
    endLoc: cloneLoc(node.endLoc),
  };
}

function coverageImportNode() {
  return list([
    atom("import"),
    stringLiteral("\"cov\""),
    stringLiteral("\"hit\""),
    list([atom("func"), atom("$cov_hit"), list([atom("param"), atom("i32")])]),
  ]);
}

function counterNodes(id) {
  return [atom("i32.const"), atom(String(id)), atom("call"), atom("$cov_hit")];
}

function manifestLoc(node) {
  return {
    line: node?.loc?.line ?? 1,
    col: node?.loc?.col ?? 1,
  };
}

function funcName(funcNode, fallback) {
  for (const item of funcNode.items.slice(1)) {
    if (item.type === "atom" && item.value.startsWith("$")) {
      return item.value;
    }

    if (isListHead(item, "export") && item.items[1]?.type === "string") {
      return item.items[1].raw.slice(1, -1);
    }
  }

  return fallback;
}

function isFuncImport(funcNode) {
  return funcNode.items.slice(1).some((item) => isListHead(item, "import"));
}

function moduleNodeFor(program) {
  if (program.type !== "program" || program.body.length !== 1 || !isListHead(program.body[0], "module")) {
    throw new WatParseError("expected a single WAT module", program.body[0]?.loc ?? locFor(0, 1, 1));
  }

  return program.body[0];
}

function hasCoverageImport(moduleNode) {
  return moduleNode.items.some((item) => {
    if (!isListHead(item, "import")) {
      return false;
    }

    const [, moduleName, fieldName, desc] = item.items;
    return (
      moduleName?.type === "string" &&
      moduleName.raw === "\"cov\"" &&
      fieldName?.type === "string" &&
      fieldName.raw === "\"hit\"" &&
      isListHead(desc, "func") &&
      desc.items.some((part) => isAtomValue(part, "$cov_hit"))
    );
  });
}

function injectCoverageImport(moduleNode) {
  if (hasCoverageImport(moduleNode)) {
    return;
  }

  moduleNode.items.splice(1, 0, coverageImportNode());
}

function isFuncPrelude(node) {
  if (node?.type === "atom") {
    return node.value.startsWith("$");
  }

  return funcPreludeHeads.has(headValue(node));
}

function isBlockPrelude(node) {
  if (node?.type === "atom") {
    return node.value.startsWith("$");
  }

  return blockPreludeHeads.has(headValue(node));
}

function isLikelyInstructionStart(node) {
  if (node?.type !== "atom") {
    return node?.type === "list";
  }

  if (node.value.startsWith("$") || /^-?(?:0x[0-9a-fA-F]+|\d)/.test(node.value)) {
    return false;
  }

  return (
    node.value.includes(".") ||
    branchOpcodes.has(node.value) ||
    controlBoundaryAtoms.has(node.value) ||
    definitionHeads.has(node.value)
  );
}

function branchOperandEnd(items, index) {
  const opcode = items[index].value;
  let cursor = index + 1;

  if (opcode === "br" || opcode === "br_if") {
    return Math.min(cursor + 1, items.length);
  }

  if (opcode === "br_table") {
    while (cursor < items.length && !isLikelyInstructionStart(items[cursor])) {
      cursor += 1;
    }
    return cursor;
  }

  return cursor;
}

function instrumentSequence(items, startIndex, state, func, enclosingEndAtoms = new Set()) {
  const output = [];

  for (let index = startIndex; index < items.length; index += 1) {
    const item = items[index];

    if (item.type === "atom" && enclosingEndAtoms.has(item.value)) {
      output.push(cloneNode(item));
      continue;
    }

    if (item.type === "atom" && (item.value === "block" || item.value === "loop")) {
      output.push(cloneNode(item));
      index += 1;
      while (index < items.length && isBlockPrelude(items[index])) {
        output.push(cloneNode(items[index]));
        index += 1;
      }
      index -= 1;
      output.push(...addBlock(state, func, item.value, item));
      continue;
    }

    if (item.type === "atom" && item.value === "if") {
      output.push(cloneNode(item));
      index += 1;
      while (index < items.length && isBlockPrelude(items[index])) {
        output.push(cloneNode(items[index]));
        index += 1;
      }
      index -= 1;
      output.push(...addBlock(state, func, "if-then", item));
      continue;
    }

    if (item.type === "atom" && item.value === "else") {
      output.push(cloneNode(item));
      output.push(...addBlock(state, func, "if-else", item));
      continue;
    }

    if (item.type === "atom" && branchOpcodes.has(item.value)) {
      const end = branchOperandEnd(items, index);
      for (let branchIndex = index; branchIndex < end; branchIndex += 1) {
        output.push(cloneNode(items[branchIndex]));
      }
      output.push(...addBlock(state, func, "post-branch", item));
      index = end - 1;
      continue;
    }

    output.push(instrumentNode(item, state, func));

    if (isBranchList(item)) {
      output.push(...addBlock(state, func, "post-branch", item));
    }
  }

  return output;
}

function isBranchList(node) {
  return branchOpcodes.has(headValue(node));
}

function addBlock(state, func, kind, sourceNode) {
  const id = state.blocks.length;
  const loc = manifestLoc(sourceNode);
  state.blocks.push({ id, func, kind, line: loc.line, col: loc.col });
  return counterNodes(id);
}

function instrumentFoldedControl(node, state, func) {
  const head = headValue(node);
  const items = [cloneNode(node.items[0])];
  let cursor = 1;

  if (head === "block" || head === "loop") {
    while (cursor < node.items.length && isBlockPrelude(node.items[cursor])) {
      items.push(cloneNode(node.items[cursor]));
      cursor += 1;
    }
    items.push(...addBlock(state, func, head, node));
    items.push(...instrumentSequence(node.items, cursor, state, func));
    return { ...node, items };
  }

  while (cursor < node.items.length && isBlockPrelude(node.items[cursor])) {
    items.push(cloneNode(node.items[cursor]));
    cursor += 1;
  }

  for (; cursor < node.items.length; cursor += 1) {
    const item = node.items[cursor];
    if (isListHead(item, "then")) {
      items.push(instrumentThenElse(item, state, func, "if-then"));
    } else if (isListHead(item, "else")) {
      items.push(instrumentThenElse(item, state, func, "if-else"));
    } else {
      items.push(instrumentNode(item, state, func));
    }
  }

  return { ...node, items };
}

function instrumentThenElse(node, state, func, kind) {
  const items = [cloneNode(node.items[0]), ...addBlock(state, func, kind, node)];
  items.push(...instrumentSequence(node.items, 1, state, func));
  return { ...node, items };
}

function instrumentNode(node, state, func) {
  if (node.type !== "list") {
    return cloneNode(node);
  }

  const head = headValue(node);
  if (head === "block" || head === "loop" || head === "if") {
    return instrumentFoldedControl(node, state, func);
  }

  return { ...node, items: node.items.map((item) => instrumentNode(item, state, func)) };
}

function instrumentFunc(funcNode, state, fallbackName) {
  const func = funcName(funcNode, fallbackName);
  const items = [cloneNode(funcNode.items[0])];
  let cursor = 1;

  while (cursor < funcNode.items.length && isFuncPrelude(funcNode.items[cursor])) {
    items.push(cloneNode(funcNode.items[cursor]));
    cursor += 1;
  }

  items.push(...addBlock(state, func, "func-entry", funcNode));
  items.push(...instrumentSequence(funcNode.items, cursor, state, func));

  return { ...funcNode, items };
}

function instrumentWat(program, options = {}) {
  const moduleName = options.module ?? "";
  const instrumented = { type: "program", body: program.body.map(cloneNode) };
  const moduleNode = moduleNodeFor(instrumented);
  const state = { blocks: [] };
  let funcIndex = 0;

  injectCoverageImport(moduleNode);

  moduleNode.items = moduleNode.items.map((item) => {
    if (!isListHead(item, "func") || isFuncImport(item)) {
      return item;
    }

    funcIndex += 1;
    return instrumentFunc(item, state, `$func${funcIndex}`);
  });

  return {
    program: instrumented,
    manifest: {
      module: moduleName,
      blocks: state.blocks,
    },
  };
}

function isInlineList(node) {
  return (
    node.type === "list" &&
    node.items.every((item) => item.type === "atom" || item.type === "string") &&
    node.items.length <= 4
  );
}

function writeNode(node, depth) {
  if (node.type === "atom") {
    return node.value;
  }

  if (node.type === "string") {
    return node.raw;
  }

  if (node.type !== "list") {
    throw new TypeError(`unknown WAT node type ${node.type}`);
  }

  if (node.items.length === 0) {
    return "()";
  }

  if (isInlineList(node)) {
    return `(${node.items.map((item) => writeNode(item, depth)).join(" ")})`;
  }

  const indent = "  ".repeat(depth);
  const childIndent = "  ".repeat(depth + 1);
  const lines = [`(${writeNode(node.items[0], depth)}`];

  for (const item of node.items.slice(1)) {
    lines.push(`${childIndent}${writeNode(item, depth + 1)}`);
  }

  return `${lines.join("\n")}\n${indent})`;
}

function writeWat(program) {
  const body = program.type === "program" ? program.body : [program];
  return `${body.map((node) => writeNode(node, 0)).join("\n")}\n`;
}

async function main() {
  const [, , inputPath, outputPath, manifestPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("usage: instrument input.wat output.wat [output.cov.json]");
    process.exitCode = 64;
    return;
  }

  const source = await fs.readFile(inputPath, "utf8");
  const program = parseWat(source);
  const result = instrumentWat(program, { module: inputPath });
  const covPath = manifestPath ?? path.join(path.dirname(outputPath), `${path.basename(outputPath, ".wat")}.cov.json`);
  await fs.writeFile(outputPath, writeWat(result.program));
  await fs.writeFile(covPath, `${JSON.stringify(result.manifest, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  WatParseError,
  atom,
  list,
  instrumentWat,
  parseWat,
  stringLiteral,
  tokenizeWat,
  writeWat,
};
