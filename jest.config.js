/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  setupFiles: ['<rootDir>/jest.setup.canvas.js'],
  testEnvironment: 'jest-environment-jsdom',
  resolver: '<rootDir>/jest.resolver.js',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^canvas$': '<rootDir>/src/__mocks__/node-canvas.js',
    '^canvas/(.*)$': '<rootDir>/src/__mocks__/node-canvas.js',
    '^p-map$': '<rootDir>/src/__mocks__/p-map.js',
    '^tokenx$': '<rootDir>/src/__mocks__/tokenx.js',
    '^three/examples/jsm/(.*)$':
      '<rootDir>/src/__mocks__/three/examples/jsm/$1',
    // Next.js internal modules
    '^next/dist/(.*)$': '<rootDir>/node_modules/next/dist/$1',
    // Reactコンポーネントのモック
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  modulePathIgnorePatterns: [
    'node_modules/canvas',
    'node_modules/@ffmpeg-installer',
    'node_modules/fluent-ffmpeg',
    '<rootDir>/.open-next',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          moduleResolution: 'node',
          resolveJsonModule: true,
          allowJs: true,
          strict: true,
          paths: {
            '@/*': ['./src/*'],
          },
          baseUrl: '.',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@pixiv/three-vrm|three/examples/jsm|pdfjs-dist|i18next|idb))',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/src/__mocks__'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/\.next/',
    '/\.open-next/',
    // @mastra/core が ESM パッケージのため ts-jest（CJS環境）でトランスパイルできず
    // 「SyntaxError: Cannot use import statement outside a module」が発生する。
    // これは本家 AITuberKit 由来の既知問題であり、イティエルプロジェクトでは
    // YouTube連携ワークフロー（Mastra）を使用しないため、テストごとスキップする方針とした。
    // 修正するには jest.config.js の transform を ESM 対応にするか、Mastra の
    // パッケージ構成が CJS を提供するまで待つ必要がある。
    '/__tests__/lib/mastra/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}

module.exports = config
