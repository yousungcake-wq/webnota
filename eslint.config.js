// @ts-check
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** Module boundaries from docs/spec/01-architecture.md §3 */
const restrict = (patterns) => ['error', { patterns }]
const noFeatures = {
  group: ['**/features/**', '@/features/**'],
  message: '이 모듈은 features를 import할 수 없습니다 (spec/01 §3).',
}
const noUiReact = {
  group: ['react', 'react-dom', '**/ui/**', '**/app/**'],
  message: 'core는 React/UI를 모릅니다 (spec/01 §3).',
}
const noCore = { group: ['**/core/**'], message: 'ui는 core를 import할 수 없습니다 (spec/01 §3).' }
const pureCore = {
  group: ['@/**', '../**', 'react', 'react-dom', 'y-indexeddb'],
  message: 'core/model·core/sync/engine은 yjs와 같은 폴더만 import합니다 (spec/01 §3).',
}
const noPlatformUp = {
  group: ['**/core/**', '**/features/**', '**/ui/**', '**/app/**'],
  message: 'platform은 다른 모듈을 import할 수 없습니다 (spec/01 §3).',
}
/** Cross-module imports go through the `@/` alias so the boundary rules can see them. */
const noRelativeEscape = {
  group: ['../../*'],
  message: '다른 최상위 모듈은 @/ 경로로 import하세요.',
}
const featureSiblings = {
  regex: String.raw`^\.\./(?!\.\.)[^/]+(/|$)`,
  message: '다른 feature는 @/features/<이름> 공개 API로 import하세요 (spec/01 §3).',
}
const featureInternals = {
  regex: String.raw`features/[^/]+/(?!index(\.tsx?)?$).+`,
  message: '다른 feature는 index.ts 공개 API로만 import하세요 (spec/01 §3).',
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'worker/node_modules', 'test-results', 'coverage', 'dev-dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'max-lines': ['warn', { max: 600, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'smart'],
    },
  },
  { files: ['src/core/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict([noFeatures, noUiReact]) } },
  { files: ['src/core/store/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict([noFeatures]) } },
  { files: ['src/ui/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict([noFeatures, noCore]) } },
  {
    files: ['src/core/model/**/*.ts', 'src/core/sync/engine.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-imports': restrict([pureCore]) },
  },
  { files: ['src/platform/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict([noPlatformUp]) } },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict([featureInternals, featureSiblings, noRelativeEscape]) },
  },
  {
    files: ['**/*.test.ts', 'tests/**', 'scripts/**', '*.config.{js,ts}'],
    // tests run code in the page (page.evaluate), so browser globals are valid there too
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off', 'max-lines': 'off' },
  },
)
