const fs = require("node:fs");

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

class TokenReader {
  constructor(inputPath) {
    this.stream = fs.createReadStream(inputPath, { encoding: "utf8" });
    this.iterator = this.stream[Symbol.asyncIterator]();
    this.buffer = "";
    this.done = false;
    this.index = 0;
    this.line = 1;
    this.col = 1;
    this.cache = [];
  }

  async close() {
    this.stream.destroy();
  }

  async ensure(count) {
    while (this.buffer.length < count && !this.done) {
      const next = await this.iterator.next();
      if (next.done) {
        this.done = true;
      } else {
        this.buffer += next.value;
      }
    }
  }

  loc() {
    return locFor(this.index, this.line, this.col);
  }

  async peekChar(offset = 0) {
    await this.ensure(offset + 1);
    return this.buffer[offset] ?? "";
  }

  advanceText(text) {
    for (let i = 0; i < text.length; i += 1) {
      this.index += 1;
      if (text[i] === "\n") {
        this.line += 1;
        this.col = 1;
      } else {
        this.col += 1;
      }
    }
    this.buffer = this.buffer.slice(text.length);
  }

  async takeChar() {
    await this.ensure(1);
    const char = this.buffer[0];
    if (char !== undefined) {
      this.advanceText(char);
    }
    return char ?? "";
  }

  async skipWhitespaceAndComments() {
    while (true) {
      const char = await this.peekChar();
      const pair = `${char}${await this.peekChar(1)}`;

      if (char === "") {
        return;
      }

      if (/\s/.test(char)) {
        await this.takeChar();
      } else if (pair === ";;") {
        while ((await this.peekChar()) !== "" && (await this.peekChar()) !== "\n") {
          await this.takeChar();
        }
      } else if (pair === "(;") {
        await this.skipBlockComment();
      } else {
        return;
      }
    }
  }

  async skipBlockComment() {
    const start = this.loc();
    let depth = 0;

    while (true) {
      const char = await this.peekChar();
      const pair = `${char}${await this.peekChar(1)}`;

      if (pair === "(;") {
        depth += 1;
        this.advanceText(pair);
      } else if (pair === ";)") {
        depth -= 1;
        this.advanceText(pair);
        if (depth === 0) {
          return;
        }
      } else if (char === "") {
        throw new WatParseError("unterminated block comment", start);
      } else {
        await this.takeChar();
      }
    }
  }

  async readStringToken() {
    const start = this.loc();
    let raw = await this.takeChar();

    while (true) {
      const char = await this.takeChar();
      if (char === "") {
        throw new WatParseError("unterminated string", start);
      }

      raw += char;
      if (char === "\\") {
        const escaped = await this.takeChar();
        if (escaped === "") {
          throw new WatParseError("unterminated string", start);
        }
        raw += escaped;
      } else if (char === "\"") {
        return { type: "string", raw, loc: start };
      } else if (char === "\n") {
        throw new WatParseError("unterminated string", start);
      }
    }
  }

  async readAtomToken() {
    const start = this.loc();
    let value = "";

    while (true) {
      const char = await this.peekChar();
      const pair = `${char}${await this.peekChar(1)}`;

      if (char === "" || /\s/.test(char) || char === "(" || char === ")" || pair === ";;" || pair === "(;") {
        break;
      }

      value += await this.takeChar();
    }

    if (value.length === 0) {
      throw new WatParseError(`unexpected character ${JSON.stringify(await this.peekChar())}`, start);
    }

    return { type: "atom", value, loc: start };
  }

  async readToken() {
    await this.skipWhitespaceAndComments();
    const start = this.loc();
    const char = await this.peekChar();

    if (char === "") {
      return { type: "eof", loc: start };
    }

    if (char === "(" || char === ")") {
      await this.takeChar();
      return { type: char, loc: start };
    }

    if (char === "\"") {
      return this.readStringToken();
    }

    return this.readAtomToken();
  }

  async peek(offset = 0) {
    while (this.cache.length <= offset) {
      this.cache.push(await this.readToken());
    }
    return this.cache[offset];
  }

  async next() {
    if (this.cache.length > 0) {
      return this.cache.shift();
    }

    return this.readToken();
  }

  async expect(type, message) {
    const token = await this.next();
    if (token.type !== type) {
      throw new WatParseError(message, token.loc);
    }
    return token;
  }
}

async function skipWatExpression(reader) {
  const token = await reader.next();
  if (token.type === "(") {
    await skipWatList(reader);
  }
}

async function skipWatList(reader) {
  while ((await reader.peek()).type !== ")") {
    await skipWatExpression(reader);
  }
  await reader.expect(")", "missing close paren");
}

module.exports = {
  TokenReader,
  WatParseError,
  skipWatExpression,
  skipWatList,
};
