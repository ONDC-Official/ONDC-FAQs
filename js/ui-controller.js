// UI Controller - Manages all UI interactions
class UIController {
  constructor(faqManager, searchEngine) {
    this.faqManager = faqManager;
    this.searchEngine = searchEngine;
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentResults = [];
    this.selectedCategory = null;
    this.selectedTags = [];
    this.sortBy = 'relevance';
    
    this.elements = this.cacheElements();
    this.debounceTimer = null;
  }

  cacheElements() {
    return {
      // Search elements
      searchInput: document.getElementById('searchInput'),
      clearSearch: document.getElementById('clearSearch'),
      searchSuggestions: document.getElementById('searchSuggestions'),
      
      // Filter elements
      categoryList: document.getElementById('categoryList'),
      dateFilter: document.getElementById('dateFilter'),
      clearFilters: document.getElementById('clearFilters'),
      sortBy: document.getElementById('sortBy'),
      
      // Results elements
      resultsContainer: document.getElementById('resultsContainer'),
      faqResults: document.getElementById('faqResults'),
      resultsCount: document.getElementById('resultsCount'),
      searchQuery: document.getElementById('searchQuery'),
      loadingState: document.getElementById('loadingState'),
      noResults: document.getElementById('noResults'),
      pagination: document.getElementById('pagination'),
      
      // Stats
      totalFAQs: document.getElementById('totalFAQs'),
      totalCategories: document.getElementById('totalCategories'),
      
      // Modal
      faqModal: document.getElementById('faqModal'),
      modalTitle: document.getElementById('modalTitle'),
      modalBody: document.getElementById('modalBody'),
      
      // Export
      exportBtn: document.getElementById('exportBtn'),
      
      // Mobile
      sidebar: document.getElementById('sidebar'),
      sidebarToggle: document.getElementById('sidebarToggle'),
      sidebarOverlay: document.getElementById('sidebarOverlay')
    };
  }

  initialize() {
    this.setupEventListeners();
    this.renderCategories();
    this.updateStats();
    this.performSearch();
  }

  setupEventListeners() {
    // Search input with debouncing
    this.elements.searchInput.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      const query = e.target.value;
      
      // Show/hide clear button
      this.elements.clearSearch.style.display = query ? 'block' : 'none';
      
      // Show suggestions for partial queries
      if (query.length >= 2) {
        this.showSuggestions(query);
      } else {
        this.hideSuggestions();
      }
      
      // Debounce actual search
      this.debounceTimer = setTimeout(() => {
        this.performSearch();
      }, 300);
    });

    // Clear search
    this.elements.clearSearch.addEventListener('click', () => {
      this.elements.searchInput.value = '';
      this.elements.clearSearch.style.display = 'none';
      this.hideSuggestions();
      this.performSearch();
    });

    // Quick filters
    document.querySelectorAll('.quick-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.elements.searchInput.value = e.target.dataset.query;
        this.performSearch();
      });
    });

    // Sort dropdown
    this.elements.sortBy.addEventListener('change', () => {
      this.sortBy = this.elements.sortBy.value;
      this.performSearch();
    });


    // Clear filters
    this.elements.clearFilters.addEventListener('click', () => {
      this.selectedCategory = null;
      this.selectedTags = [];
      this.elements.dateFilter.value = '';
      this.renderCategories();
      this.performSearch();
    });

    // Date filter
    this.elements.dateFilter.addEventListener('change', () => {
      this.performSearch();
    });

    // Export button
    this.elements.exportBtn.addEventListener('click', () => {
      this.showExportOptions();
    });

    // Mobile sidebar toggle
    if (this.elements.sidebarToggle) {
      this.elements.sidebarToggle.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // Close sidebar on overlay click
    if (this.elements.sidebarOverlay) {
      this.elements.sidebarOverlay.addEventListener('click', () => {
        this.closeSidebar();
      });
    }


    // Handle suggestion clicks
    this.elements.searchSuggestions.addEventListener('click', (e) => {
      const suggestionItem = e.target.closest('.suggestion-item');
      if (suggestionItem) {
        const faqId = suggestionItem.dataset.faqId;
        if (faqId) {
          this.showFAQDetail(faqId);
        } else {
          this.elements.searchInput.value = suggestionItem.dataset.query;
          this.performSearch();
        }
        this.hideSuggestions();
      }
    });

    // Click outside to hide suggestions
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        this.hideSuggestions();
      }
    });
  }

  renderCategories() {
    const categoryHtml = Array.from(this.faqManager.categories.entries())
      .map(([category, count]) => `
        <div class="category-item ${this.selectedCategory === category ? 'active' : ''}" 
             data-category="${category}">
          <span>${category}</span>
          <span class="category-count">${count}</span>
        </div>
      `).join('');
    
    this.elements.categoryList.innerHTML = categoryHtml;
    
    // Add click handlers
    this.elements.categoryList.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', () => {
        const category = item.dataset.category;
        if (this.selectedCategory === category) {
          this.selectedCategory = null;
          item.classList.remove('active');
        } else {
          this.selectedCategory = category;
          document.querySelectorAll('.category-item').forEach(el => 
            el.classList.remove('active')
          );
          item.classList.add('active');
        }
        this.performSearch();
        
        // Close sidebar on mobile after selection
        if (window.innerWidth <= 768) {
          this.closeSidebar();
        }
      });
    });
  }

  performSearch() {
    const query = this.elements.searchInput.value.trim();
    
    // Show loading state
    this.showLoading();
    
    // Apply date filter
    let filteredFaqs = this.faqManager.faqs;
    const dateFilter = this.elements.dateFilter.value;
    if (dateFilter) {
      filteredFaqs = this.faqManager.getRecentFAQs(parseInt(dateFilter));
    }
    
    // Perform search
    const searchOptions = {
      category: this.selectedCategory,
      tags: this.selectedTags,
      sortBy: this.sortBy,
      faqs: filteredFaqs  // Pass the filtered FAQs
    };
    
    if (query) {
      this.currentResults = this.searchEngine.search(query, searchOptions);
    } else {
      // No query - just filter and sort
      this.currentResults = this.searchEngine.getFilteredResults(
        this.selectedCategory,
        this.selectedTags,
        this.sortBy,
        1000, // Get all for filtering
        filteredFaqs  // Pass the filtered FAQs
      );
    }
    
    // Reset to first page
    this.currentPage = 1;
    
    // Update UI
    this.updateResultsHeader(query);
    this.renderResults();
    this.renderPagination();
  }

  showLoading() {
    this.elements.loadingState.style.display = 'block';
    this.elements.faqResults.style.display = 'none';
    this.elements.noResults.style.display = 'none';
  }

  hideLoading() {
    this.elements.loadingState.style.display = 'none';
  }

  updateResultsHeader(query) {
    const totalResults = this.currentResults.length;
    
    if (query) {
      this.elements.resultsCount.textContent = `${totalResults} results`;
      this.elements.searchQuery.textContent = `for "${query}"`;
    } else if (this.selectedCategory) {
      this.elements.resultsCount.textContent = `${totalResults} FAQs`;
      this.elements.searchQuery.textContent = `in ${this.selectedCategory}`;
    } else {
      this.elements.resultsCount.textContent = `All FAQs (${totalResults})`;
      this.elements.searchQuery.textContent = '';
    }
  }

  renderResults() {
    this.hideLoading();
    
    if (this.currentResults.length === 0) {
      this.elements.faqResults.style.display = 'none';
      this.elements.noResults.style.display = 'block';
      return;
    }
    
    this.elements.noResults.style.display = 'none';
    this.elements.faqResults.style.display = 'block';
    
    // Get paginated results
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageResults = this.currentResults.slice(startIndex, endIndex);
    
    // Render FAQ results
    this.elements.faqResults.className = 'faq-results';
    this.elements.faqResults.innerHTML = pageResults
      .map(faq => this.renderFAQItem(faq))
      .join('');
    
    // Add click handlers
    this.elements.faqResults.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.faq-tag')) {
          this.showFAQDetail(item.dataset.faqId);
        }
      });
    });
    
    // Add tag click handlers
    this.elements.faqResults.querySelectorAll('.faq-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        this.elements.searchInput.value = tag.textContent;
        this.performSearch();
      });
    });
  }

  renderFAQItem(faq) {
    const query = this.elements.searchInput.value;
    const highlightedQuestion = query 
      ? this.searchEngine.highlightMatch(faq.question, query)
      : faq.question;
    
    const tags = faq.tags.slice(0, 3).map(tag => 
      `<span class="faq-tag">${tag}</span>`
    ).join('');
    
    return `
      <div class="faq-item" data-faq-id="${faq.id}">
        <div class="faq-question">${highlightedQuestion}</div>
        <div class="faq-answer-preview">${faq.answerPreview}</div>
        <div class="faq-meta">
          <span class="faq-category">${faq.category}</span>
          ${tags ? `<div class="faq-tags">${tags}</div>` : ''}
        </div>
      </div>
    `;
  }

  renderPagination() {
    const totalPages = Math.ceil(this.currentResults.length / this.itemsPerPage);
    
    if (totalPages <= 1) {
      this.elements.pagination.innerHTML = '';
      return;
    }
    
    let paginationHtml = '';
    
    // Previous button
    paginationHtml += `
      <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${this.currentPage - 1}">Previous</a>
      </li>
    `;
    
    // Page numbers
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage < maxPages - 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHtml += `
        <li class="page-item ${i === this.currentPage ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `;
    }
    
    // Next button
    paginationHtml += `
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${this.currentPage + 1}">Next</a>
      </li>
    `;
    
    this.elements.pagination.innerHTML = paginationHtml;
    
    // Add click handlers
    this.elements.pagination.querySelectorAll('.page-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(e.target.dataset.page);
        if (page && page !== this.currentPage) {
          this.currentPage = page;
          this.renderResults();
          this.renderPagination();
          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  showSuggestions(query) {
    const suggestions = this.searchEngine.getSuggestions(query);
    
    if (suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }
    
    const suggestionsHtml = suggestions.map(suggestion => {
      if (suggestion.type === 'faq') {
        return `
          <div class="suggestion-item" data-faq-id="${suggestion.id}">
            <div class="suggestion-title">${suggestion.title}</div>
            <div class="suggestion-snippet">${suggestion.snippet}</div>
            <small class="text-muted">${suggestion.category}</small>
          </div>
        `;
      } else {
        return `
          <div class="suggestion-item" data-query="${suggestion.title}">
            <i class="fas fa-history me-2"></i>
            ${suggestion.title}
          </div>
        `;
      }
    }).join('');
    
    this.elements.searchSuggestions.innerHTML = suggestionsHtml;
    this.elements.searchSuggestions.style.display = 'block';
  }

  hideSuggestions() {
    this.elements.searchSuggestions.style.display = 'none';
  }

  showFAQDetail(faqId) {
    const faq = this.faqManager.faqs.find(f => f.id === faqId);
    if (!faq) return;
    
    // Update modal header
    this.elements.modalTitle.innerHTML = `<i class="fas fa-question-circle"></i> ${faq.question}`;
    
    // Render answer with markdown support
    const renderedAnswer = marked ? marked.parse(faq.answer) : faq.answer.replace(/\n/g, '<br>');
    
    // Get related FAQs
    const relatedFAQs = this.faqManager.findRelatedFAQs(faqId, 3);
    const relatedHtml = relatedFAQs.length > 0 ? `
      <div class="related-faqs">
        <h5><i class="fas fa-link"></i> Related FAQs</h5>
        ${relatedFAQs.map(related => `
          <div class="related-faq-item" data-faq-id="${related.id}">
            <div class="related-faq-question">${related.question}</div>
            <div class="related-faq-preview">${related.answerPreview}</div>
          </div>
        `).join('')}
      </div>
    ` : '';
    
    // Create enhanced modal body content
    this.elements.modalBody.innerHTML = `
      <div class="answer-content">
        ${renderedAnswer}
      </div>
      ${relatedHtml}
    `;
    
    // Update modal footer with enhanced metadata and copy button
    const modalFooter = document.querySelector('#faqModal .modal-footer');
    modalFooter.innerHTML = `
      <div class="modal-meta-info">
        <div class="modal-category-badge">${faq.category}</div>
        ${faq.tags.length > 0 ? `
          <div class="modal-tags">
            ${faq.tags.map(tag => `<span class="modal-tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
        <div class="modal-updated">
          <i class="fas fa-clock"></i>
          Last updated: ${new Date(faq.lastUpdated).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-copy" data-faq-content="${faqId}">
          <i class="fas fa-copy"></i> Copy Answer
        </button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
    `;
    
    // Add click handlers for related FAQs
    this.elements.modalBody.querySelectorAll('[data-faq-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const relatedId = e.currentTarget.dataset.faqId;
        this.showFAQDetail(relatedId);
      });
    });
    
    // Add copy functionality
    const copyBtn = modalFooter.querySelector('.btn-copy');
    copyBtn.addEventListener('click', () => {
      this.copyFAQContent(faq);
    });
    
    // Show modal
    const modal = new bootstrap.Modal(this.elements.faqModal);
    modal.show();
  }

  copyFAQContent(faq) {
    const textContent = `${faq.question}\n\n${faq.answer}\n\nCategory: ${faq.category}\nTags: ${faq.tags.join(', ')}`;
    
    navigator.clipboard.writeText(textContent).then(() => {
      const copyBtn = document.querySelector('.btn-copy');
      const originalHTML = copyBtn.innerHTML;
      
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      copyBtn.classList.add('copied');
      
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy content to clipboard');
    });
  }

  showError(message) {
    // Create or get error toast element
    let errorToast = document.getElementById('errorToast');
    if (!errorToast) {
      errorToast = document.createElement('div');
      errorToast.id = 'errorToast';
      errorToast.className = 'error-toast';
      document.body.appendChild(errorToast);
    }
    
    errorToast.textContent = message;
    errorToast.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorToast.classList.remove('show');
    }, 5000);
  }


  updateStats() {
    this.elements.totalFAQs.textContent = this.faqManager.faqs.length;
    this.elements.totalCategories.textContent = this.faqManager.categories.size;
  }

  showExportOptions() {
    const exportModal = `
      <div class="modal fade" id="exportModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Export FAQs</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p>Choose export format:</p>
              <div class="d-grid gap-2">
                <button class="btn btn-outline-primary" onclick="uiController.exportFAQs('json')">
                  <i class="fas fa-file-code"></i> Export as JSON
                </button>
                <button class="btn btn-outline-primary" onclick="uiController.exportFAQs('markdown')">
                  <i class="fas fa-file-alt"></i> Export as Markdown
                </button>
                <button class="btn btn-outline-primary" onclick="uiController.exportFAQs('csv')">
                  <i class="fas fa-file-csv"></i> Export as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', exportModal);
    const modal = new bootstrap.Modal(document.getElementById('exportModal'));
    modal.show();
    
    // Clean up on hide
    document.getElementById('exportModal').addEventListener('hidden.bs.modal', (e) => {
      e.target.remove();
    });
  }

  exportFAQs(format) {
    let content, filename, mimeType;
    
    switch (format) {
      case 'json':
        content = this.faqManager.exportToJSON();
        filename = 'ondc-faqs.json';
        mimeType = 'application/json';
        break;
        
      case 'markdown':
        content = this.faqManager.exportToMarkdown();
        filename = 'ondc-faqs.md';
        mimeType = 'text/markdown';
        break;
        
      case 'csv':
        content = this.exportToCSV();
        filename = 'ondc-faqs.csv';
        mimeType = 'text/csv';
        break;
    }
    
    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
  }

  exportToCSV() {
    const headers = ['Question', 'Answer', 'Category', 'Tags', 'Last Updated'];
    const rows = this.faqManager.faqs.map(faq => [
      `"${faq.question.replace(/"/g, '""')}"`,
      `"${faq.answer.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      faq.category,
      faq.tags.join('; '),
      new Date(faq.lastUpdated).toLocaleDateString()
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  showFeedbackMessage(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alert.style.zIndex = '9999';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
      alert.remove();
    }, 3000);
  }

  // Mobile sidebar methods
  toggleSidebar() {
    this.elements.sidebar.classList.toggle('show');
    this.elements.sidebarOverlay.classList.toggle('show');
    
    // Prevent body scroll when sidebar is open
    if (this.elements.sidebar.classList.contains('show')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeSidebar() {
    this.elements.sidebar.classList.remove('show');
    this.elements.sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Export for use in main app
window.UIController = UIController;