"use strict";

function reportCheckFailure(error) {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
}

function runCheck(check) {
  try {
    const result = check();

    if (typeof result?.then === "function") {
      Promise.resolve(result).catch(reportCheckFailure);
    }
  } catch (error) {
    reportCheckFailure(error);
  }
}

module.exports = {
  runCheck,
};
