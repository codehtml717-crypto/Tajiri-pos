/**
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/dom.setup.js"],
  testPathIgnorePatterns: ["node_modules", "dom.setup.js"],
};
