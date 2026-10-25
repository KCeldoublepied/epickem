// Vérifie que chaque message de commit suit les Conventional Commits (voir CONTRIBUTING.md).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'chore',
        'test',
        'refactor',
        'perf',
        'style',
        'ci',
        'build',
        'revert',
      ],
    ],
    'header-max-length': [2, 'always', 72],
  },
};
