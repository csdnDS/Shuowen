const { loadHistoricalFonts } = require('./utils/historicalFonts');

App({
  globalData: {
    apiBaseUrl: 'http://localhost:3001',
    // Toggled true by request.js after a network failure so pages can show
    // a single banner without each guessing connectivity independently.
    backendUnreachable: false
  },

  onLaunch() {
    loadHistoricalFonts();
  }
});
