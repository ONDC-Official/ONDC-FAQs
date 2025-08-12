let faqManager, searchEngine, uiController;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    document.getElementById('loadingState').style.display = 'block';
    
    faqManager = new FAQManager();
    
    console.log('Loading FAQs from multiple domain files...');
    const faqs = await faqManager.loadFAQs();
    console.log(`Loaded ${faqs.length} FAQs from domain files`);
    
    searchEngine = new SearchEngine(faqManager);
    searchEngine.initialize(faqs);
    
    uiController = new UIController(faqManager, searchEngine);
    uiController.initialize();
    
    console.log('Categories:', Array.from(faqManager.categories.keys()));
    console.log('Total tags:', faqManager.tags.size);
    
    setupKeyboardShortcuts();
    
    setupPerformanceMonitoring();
    
  } catch (error) {
    console.error('Error initializing application:', error);
    showErrorMessage('Failed to load FAQs. Please refresh the page and try again.');
  }
});

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('searchInput');
      if (document.activeElement === searchInput && searchInput.value) {
        searchInput.value = '';
        document.getElementById('clearSearch').click();
      }
    }
  });
}

function setupPerformanceMonitoring() {
  const originalSearch = searchEngine.search.bind(searchEngine);
  searchEngine.search = function(...args) {
    const startTime = performance.now();
    const results = originalSearch(...args);
    const endTime = performance.now();
    
    if (endTime - startTime > 100) {
      console.warn(`Slow search detected: ${endTime - startTime}ms`);
    }
    
    return results;
  };
  
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(`Slow render detected: ${entry.name} took ${entry.duration}ms`);
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
  }
}

function showErrorMessage(message) {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = `
    <div class="alert alert-danger text-center">
      <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
      <h5>Error</h5>
      <p>${message}</p>
      <button class="btn btn-primary" onclick="location.reload()">
        <i class="fas fa-redo"></i> Refresh Page
      </button>
    </div>
  `;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
  });
}

window.getAnalytics = () => {
  return {
    search: searchEngine.getSearchAnalytics(),
    categories: Array.from(faqManager.categories.entries())
  };
};