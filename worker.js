import { createIngestWorkerMessageHandler } from "./host/ingest-worker-runtime.mjs";

const handleMessage = createIngestWorkerMessageHandler();

self.addEventListener("message", (event) => {
  handleMessage(event);
});
