module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'json', 'vue'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.vue$': '@vue/vue3-jest'
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transformIgnorePatterns: ['/node_modules/'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,vue}',
    'server.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary']
}
