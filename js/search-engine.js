// Enhanced Search Engine with multiple search strategies
class SearchEngine {
  constructor(faqManager) {
    this.faqManager = faqManager;
    this.miniSearch = null;
    this.fuseSearch = null;
    this.searchCache = new Map();
    this.suggestionCache = new Map();
    this.searchHistory = [];
  }

  initialize(faqs) {
    // Initialize MiniSearch for fast full-text search
    this.miniSearch = new MiniSearch({
      fields: ['question', 'answer', 'categories', 'tags', 'category'],
      storeFields: ['id', 'question', 'answerPreview', 'categories', 'tags', 'category'],
      searchOptions: {
        boost: { question: 3, categories: 2, tags: 2, category: 1.5, answer: 1 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: 'OR'
      }
    });

    // Add documents to MiniSearch
    this.miniSearch.addAll(faqs);

    // Initialize Fuse.js for fuzzy search
    this.fuseSearch = new Fuse(faqs, {
      keys: [
        { name: 'question', weight: 0.4 },
        { name: 'answer', weight: 0.25 },
        { name: 'categories', weight: 0.15 },
        { name: 'tags', weight: 0.15 },
        { name: 'category', weight: 0.05 }
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }

  // Main search method combining multiple strategies
  search(query, options = {}) {
    const {
      limit = 20,
      category = null,
      tags = [],
      sortBy = 'relevance',
      faqs = null  // Accept specific FAQ subset
    } = options;

    // Use provided FAQs or default to all
    const searchableFAQs = faqs || this.faqManager.faqs;

    // Check cache first
    const cacheKey = JSON.stringify({ query, options });
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey);
    }

    // Clean and prepare query
    const cleanQuery = this.cleanQuery(query);
    if (!cleanQuery) {
      return this.getFilteredResults(category, tags, sortBy, limit, searchableFAQs);
    }

    // Track search
    this.trackSearch(cleanQuery);

    // Perform multi-strategy search
    let results = this.performMultiStrategySearch(cleanQuery, searchableFAQs);

    // Apply filters
    if (category || tags.length > 0) {
      results = this.applyFilters(results, category, tags);
    }

    // Sort results
    results = this.sortResults(results, sortBy);

    // Limit results
    results = results.slice(0, limit);

    // Cache results
    this.searchCache.set(cacheKey, results);

    // Track analytics
    this.faqManager.trackSearch(cleanQuery, results.length);

    return results;
  }

  performMultiStrategySearch(query, searchableFAQs) {
    const results = new Map();
    
    // Strategy 1: Exact match in questions
    const exactMatches = this.findExactMatches(query, searchableFAQs);
    exactMatches.forEach(faq => results.set(faq.id, { faq, score: 10 }));

    // Strategy 2: MiniSearch full-text search
    const miniSearchResults = this.miniSearch.search(query);
    miniSearchResults.forEach(result => {
      const faq = searchableFAQs.find(f => f.id === result.id);
      if (faq) {
        const existing = results.get(faq.id);
        const score = 5 + (1 / (result.score || 1));
        if (!existing || existing.score < score) {
          results.set(faq.id, { faq, score });
        }
      }
    });

    // Strategy 3: Fuzzy search with Fuse.js - create new instance for subset
    const fuseTempSearch = new Fuse(searchableFAQs, {
      keys: [
        { name: 'question', weight: 0.4 },
        { name: 'answer', weight: 0.25 },
        { name: 'categories', weight: 0.15 },
        { name: 'tags', weight: 0.15 },
        { name: 'category', weight: 0.05 }
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
    
    const fuseResults = fuseTempSearch.search(query);
    fuseResults.forEach(result => {
      const existing = results.get(result.item.id);
      const score = 3 + (1 - result.score);
      if (!existing || existing.score < score) {
        results.set(result.item.id, { faq: result.item, score });
      }
    });

    // Strategy 4: Keyword matching
    const keywords = this.extractKeywords(query);
    if (keywords.length > 0) {
      const keywordMatches = this.findKeywordMatches(keywords, searchableFAQs);
      keywordMatches.forEach(({ faq, matchCount }) => {
        const existing = results.get(faq.id);
        const score = matchCount * 0.5;
        if (!existing) {
          results.set(faq.id, { faq, score });
        } else {
          existing.score += score;
        }
      });
    }

    // Convert to array and sort by score
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.faq);
  }

  findExactMatches(query, searchableFAQs) {
    const lowerQuery = query.toLowerCase();
    return searchableFAQs.filter(faq => 
      faq.question.toLowerCase().includes(lowerQuery)
    );
  }

  findKeywordMatches(keywords, searchableFAQs) {
    const matches = [];
    
    searchableFAQs.forEach(faq => {
      let matchCount = 0;
      keywords.forEach(keyword => {
        if (faq.searchText.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      });
      
      if (matchCount > 0) {
        matches.push({ faq, matchCount });
      }
    });
    
    return matches.sort((a, b) => b.matchCount - a.matchCount);
  }

  extractKeywords(query) {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
      'what', 'how', 'when', 'where', 'why', 'who', 'which',
      'is', 'are', 'was', 'were', 'been', 'being', 'be',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
      'to', 'for', 'of', 'with', 'by', 'from', 'about'
    ]);
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  // Get search suggestions
  getSuggestions(partial, limit = 5) {
    if (partial.length < 2) return [];

    // Check cache
    if (this.suggestionCache.has(partial)) {
      return this.suggestionCache.get(partial);
    }

    const suggestions = [];
    
    // Get MiniSearch suggestions
    const searchResults = this.miniSearch.search(partial, {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR'
    });

    // Convert to suggestions
    searchResults.slice(0, limit).forEach(result => {
      const faq = this.faqManager.faqs.find(f => f.id === result.id);
      if (faq) {
        suggestions.push({
          id: faq.id,
          title: this.highlightMatch(faq.question, partial),
          snippet: faq.answerPreview,
          category: faq.category,
          type: 'faq'
        });
      }
    });

    // Add popular search suggestions from history
    const historySuggestions = this.getHistorySuggestions(partial, limit - suggestions.length);
    suggestions.push(...historySuggestions);

    // Cache suggestions
    this.suggestionCache.set(partial, suggestions);

    return suggestions;
  }

  getHistorySuggestions(partial, limit) {
    const lowerPartial = partial.toLowerCase();
    const relevant = this.searchHistory
      .filter(search => search.toLowerCase().includes(lowerPartial))
      .slice(-limit)
      .reverse()
      .map(search => ({
        title: search,
        type: 'history'
      }));
    
    return relevant;
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  cleanQuery(query) {
    return query.trim().replace(/\s+/g, ' ');
  }

  trackSearch(query) {
    this.searchHistory.push(query);
    // Keep only last 100 searches
    if (this.searchHistory.length > 100) {
      this.searchHistory.shift();
    }
  }

  getFilteredResults(category, tags, sortBy, limit, searchableFAQs = null) {
    let results = [...(searchableFAQs || this.faqManager.faqs)];

    if (category) {
      results = results.filter(faq => faq.category === category);
    }

    if (tags.length > 0) {
      results = results.filter(faq => 
        tags.some(tag => faq.tags.includes(tag))
      );
    }

    return this.sortResults(results, sortBy).slice(0, limit);
  }

  applyFilters(results, category, tags) {
    if (category) {
      results = results.filter(faq => faq.category === category);
    }

    if (tags.length > 0) {
      results = results.filter(faq => 
        tags.some(tag => faq.tags.includes(tag))
      );
    }

    return results;
  }

  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'newest':
        return results.sort((a, b) => 
          new Date(b.lastUpdated) - new Date(a.lastUpdated)
        );
      
      case 'alphabetical':
        return results.sort((a, b) => 
          a.question.localeCompare(b.question)
        );
      
      case 'relevance':
      default:
        // Already sorted by relevance from search
        return results;
    }
  }

  // Clear caches
  clearCache() {
    this.searchCache.clear();
    this.suggestionCache.clear();
  }

  // Get search analytics
  getSearchAnalytics() {
    const queries = {};
    this.searchHistory.forEach(query => {
      queries[query] = (queries[query] || 0) + 1;
    });

    return {
      totalSearches: this.searchHistory.length,
      uniqueQueries: Object.keys(queries).length,
      topQueries: Object.entries(queries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }))
    };
  }
}

// Export for use in other modules
window.SearchEngine = SearchEngine;