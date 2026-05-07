module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--headless=new --no-sandbox --enable-experimental-webassembly-features --enable-features=WebAssemblyJSPI --js-flags=\"--experimental-wasm-jspi --experimental-wasm-stack-switching\"",
        formFactor: "mobile",
        onlyCategories: ["performance", "pwa"],
        screenEmulation: {
          disabled: false,
          deviceScaleFactor: 2.625,
          height: 640,
          mobile: true,
          width: 360,
        },
        throttling: {
          cpuSlowdownMultiplier: 1,
          downloadThroughputKbps: 1600,
          requestLatencyMs: 150,
          rttMs: 150,
          throughputKbps: 1600,
          uploadThroughputKbps: 750,
        },
        throttlingMethod: "simulate",
      },
      staticDistDir: "./dist",
      url: ["http://localhost/"],
    },
    assert: {
      assertions: {
        "categories:pwa": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["error", { maxNumericValue: 950 }],
        "installable-manifest": "error",
        interactive: ["error", { maxNumericValue: 1000 }],
        "service-worker": "error",
        "total-byte-weight": ["error", { maxNumericValue: 65000 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
