import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  // ts-jest specific options go in transform config
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Isolate modules to prevent singleton pollution between tests
        isolatedModules: true
      }
    ]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|inquirer)/)'
  ]
};

export default config;
