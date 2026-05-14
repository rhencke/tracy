"use strict";

const {
  BROWSER_INGEST_STATE_KEY,
} = require("./browser-file-selection-page-helper.js");

const WORKER_MESSAGE_DIAGNOSTIC_LIMIT = 8;

function emptyWorkerMessageSnapshot() {
  return {
    messageCount: 0,
    messagesHead: [],
    messagesTail: [],
    postCount: 0,
    postsHead: [],
    postsTail: [],
  };
}

function workerMessageSnapshot(value = {}) {
  const snapshot = value ?? {};
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const posts = Array.isArray(snapshot.posts) ? snapshot.posts : [];

  return {
    messageCount: snapshot.messageCount ?? messages.length,
    messagesHead:
      snapshot.messagesHead ?? messages.slice(0, WORKER_MESSAGE_DIAGNOSTIC_LIMIT),
    messagesTail:
      snapshot.messagesTail ?? messages.slice(-WORKER_MESSAGE_DIAGNOSTIC_LIMIT),
    postCount: snapshot.postCount ?? posts.length,
    postsHead: snapshot.postsHead ?? posts.slice(0, WORKER_MESSAGE_DIAGNOSTIC_LIMIT),
    postsTail: snapshot.postsTail ?? posts.slice(-WORKER_MESSAGE_DIAGNOSTIC_LIMIT),
  };
}

async function installBrowserWorkerMessageInstrumentation(page) {
  await page.evaluateOnNewDocument((stateKey) => {
    const state = globalThis[stateKey] ?? {};
    const workerMessages = {
      messages: [],
      posts: [],
    };

    state.workerMessages = workerMessages;
    globalThis[stateKey] = state;

    const NativeWorker = globalThis.Worker;
    globalThis.Worker = function InstrumentedWorker(...args) {
      const worker = new NativeWorker(...args);
      const postMessage = worker.postMessage;
      worker.postMessage = function instrumentedPostMessage(message, transfer) {
        workerMessages.posts.push({
          indexName: message?.indexName ?? null,
          sourceFile: message?.sourceFile?.name ?? null,
          sourceFileHandle: message?.sourceFileHandle ?? null,
          sourceName: message?.sourceName ?? null,
          sourceSize: message?.sourceSize ?? null,
          type: message?.type ?? null,
        });
        return postMessage.call(this, message, transfer);
      };
      worker.addEventListener("message", (event) => {
        workerMessages.messages.push({
          committedEvents: event.data?.committedEvents ?? null,
          end: event.data?.end ?? null,
          error: event.data?.message ?? null,
          fileOffset: event.data?.fileOffset ?? null,
          indexedEvents: event.data?.indexedEvents ?? null,
          parsedEvents: event.data?.parsedEvents ?? null,
          start: event.data?.start ?? null,
          totalBytes: event.data?.totalBytes ?? null,
          type: event.data?.type ?? null,
          valid: event.data?.valid ?? null,
        });
      });
      worker.addEventListener("error", (event) => {
        workerMessages.messages.push({
          error: event.message,
          fileOffset: null,
          type: "worker-error",
        });
      });
      return worker;
    };
  }, BROWSER_INGEST_STATE_KEY);
}

module.exports = {
  WORKER_MESSAGE_DIAGNOSTIC_LIMIT,
  emptyWorkerMessageSnapshot,
  installBrowserWorkerMessageInstrumentation,
  workerMessageSnapshot,
};
