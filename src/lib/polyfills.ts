if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto
}

if (typeof crypto.randomUUID === 'undefined') {
  // Cast to the same overloaded signature `crypto.randomUUID` exposes
  // (() => `${string}-${string}-${string}-${string}-${string}`). Our polyfill
  // returns a real UUID string at runtime; TS just can't infer the template
  // literal narrowing from string-builder code, so we widen with `as`.
  crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  } as typeof crypto.randomUUID
}
