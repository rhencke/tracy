#!/usr/bin/env node

const fs = require("node:fs/promises");

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
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("usage: instrument input.wat output.wat");
    process.exitCode = 64;
    return;
  }

  const source = await fs.readFile(inputPath, "utf8");
  const program = parseWat(source);
  await fs.writeFile(outputPath, writeWat(program));
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
  parseWat,
  stringLiteral,
  tokenizeWat,
  writeWat,
};
