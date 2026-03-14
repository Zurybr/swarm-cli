/**
 * Jest configuration for TS project using ts-jest and path aliases.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map path alias used in tests like '@/hive' or '@/agents/...' to src/*
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
