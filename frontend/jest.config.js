// Lightweight Jest config for pure-logic module unit tests (query keys, store
// reset, API response parsing, deep-link routing). Runs in Node — the tested
// modules deliberately avoid importing React Native, so no RN/Expo runtime is
// required. UI/component tests are added later with jest-expo if needed.
module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.(t|j)sx?$": "babel-jest" },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["**/src/modules/**/__tests__/**/*.test.ts"],
  transformIgnorePatterns: ["node_modules/(?!(zustand|zod|expo)/)"],
};
