module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist/frontend/browser',
      isSinglePageApplication: false,
      numberOfRuns: 1,
      url: [
        'http://localhost/',
        'http://localhost/kurals/',
        'http://localhost/kural/1/',
        'http://localhost/adhigaram/1/',
      ],
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu',
      },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:seo': ['error', {minScore: 0.95}],
        'categories:best-practices': ['warn', {minScore: 0.9}],
        'categories:accessibility': ['warn', {minScore: 0.9}],
        'categories:performance': ['warn', {minScore: 0.7}],
      },
    },
  },
};
