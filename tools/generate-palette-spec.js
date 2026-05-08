#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const sourcePath = join(root, "abi/palette.json");
const spec = JSON.parse(readFileSync(sourcePath, "utf8"));
const VALID_COLOR_SCOPES = new Set(["init", "full"]);

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function parseColor(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex !== null) {
    const rgb = Number.parseInt(hex[1], 16);
    return {
      alpha: 1,
      blue: rgb & 0xff,
      green: (rgb >>> 8) & 0xff,
      red: (rgb >>> 16) & 0xff,
    };
  }

  const rgba = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i.exec(value);
  if (rgba !== null) {
    const color = {
      alpha: Number(rgba[4]),
      blue: Number(rgba[3]),
      green: Number(rgba[2]),
      red: Number(rgba[1]),
    };

    if (
      color.red > 255 ||
      color.green > 255 ||
      color.blue > 255 ||
      color.alpha < 0 ||
      color.alpha > 1
    ) {
      throw new Error(`invalid color component in ${value}`);
    }

    return color;
  }

  throw new Error(`unsupported palette color ${JSON.stringify(value)}`);
}

function channelToLinear(value) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  return (
    0.2126 * channelToLinear(color.red) +
    0.7152 * channelToLinear(color.green) +
    0.0722 * channelToLinear(color.blue)
  );
}

function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function compositeOver(foreground, background) {
  const alpha = foreground.alpha;
  return {
    alpha: 1,
    blue: foreground.blue * alpha + background.blue * (1 - alpha),
    green: foreground.green * alpha + background.green * (1 - alpha),
    red: foreground.red * alpha + background.red * (1 - alpha),
  };
}

function paletteValue(path) {
  const [paletteName, groupName, colorName] = path.split(".");
  const colorEntry = spec.palettes?.[paletteName]?.[groupName]?.[colorName];

  if (colorEntry === undefined) {
    throw new Error(`unknown palette color path ${path}`);
  }

  return colorEntry.value;
}

function validatePaletteSpec() {
  assertObject(spec.palettes, "palettes");
  assertObject(spec.palettes.default, "palettes.default");
  assertObject(spec.palettes.default.appShell, "palettes.default.appShell");
  assertObject(spec.palettes.default.traceRenderer, "palettes.default.traceRenderer");

  for (const [paletteName, palette] of Object.entries(spec.palettes)) {
    assertObject(palette, `palettes.${paletteName}`);
    for (const [groupName, group] of Object.entries(palette)) {
      assertObject(group, `palettes.${paletteName}.${groupName}`);
      for (const [colorName, entry] of Object.entries(group)) {
        if (typeof entry.value !== "string") {
          throw new Error(`${paletteName}.${groupName}.${colorName}.value must be a string`);
        }
        if (!VALID_COLOR_SCOPES.has(entry.scope)) {
          throw new Error(
            `${paletteName}.${groupName}.${colorName}.scope must be one of init, full`,
          );
        }
        parseColor(entry.value);
      }
    }
  }

  if (!Array.isArray(spec.contrastChecks)) {
    throw new Error("contrastChecks must be an array");
  }

  for (const check of spec.contrastChecks) {
    const foreground = parseColor(paletteValue(check.foreground));
    const background = parseColor(paletteValue(check.background));
    const foregroundOnBackground =
      foreground.alpha === 1 ? foreground : compositeOver(foreground, background);
    const ratio = contrastRatio(foregroundOnBackground, background);

    if (!(ratio >= check.minimumRatio)) {
      throw new Error(
        `${check.foreground} contrast ${ratio.toFixed(2)} is below ${check.minimumRatio}`,
      );
    }
  }
}

validatePaletteSpec();
