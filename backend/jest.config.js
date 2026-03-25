'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterFramework: [],
  setupFiles: ['./tests/setup.env.js'],
  globalSetup: undefined,
  testTimeout: 15000,
  collectCoverageFrom: [
    'src/routes/**/*.js',
    'src/middleware/**/*.js',
    'src/services/**/*.js',
    '!src/**/*.test.js',
  ],
  coverageReporters: ['text', 'lcov'],
  verbose: true,
};
