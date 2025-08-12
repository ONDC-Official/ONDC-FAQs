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

    this.miniSearch.addAll(faqs);

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

  search(query, options = {}) {
    const {
      limit = 20,
      category = null,
      tags = [],
      sortBy = 'relevance',
      faqs = null
    } = options;

    const searchableFAQs = faqs || this.faqManager.faqs;

    const cacheKey = JSON.stringify({ query, options });
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey);
    }

    const cleanQuery = this.cleanQuery(query);
    if (!cleanQuery) {
      return this.getFilteredResults(category, tags, sortBy, limit, searchableFAQs);
    }

    this.trackSearch(cleanQuery);

    let results = this.performMultiStrategySearch(cleanQuery, searchableFAQs);

    if (category || tags.length > 0) {
      results = this.applyFilters(results, category, tags);
    }

    results = this.sortResults(results, sortBy);

    results = results.slice(0, limit);

    this.searchCache.set(cacheKey, results);

    this.faqManager.trackSearch(cleanQuery, results.length);

    return results;
  }

  performMultiStrategySearch(query, searchableFAQs) {
    const results = new Map();
    
    const exactMatches = this.findExactMatches(query, searchableFAQs);
    exactMatches.forEach(faq => results.set(faq.id, { faq, score: 10 }));

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

  getSuggestions(partial, limit = 5) {
    if (partial.length < 2) return [];

    if (this.suggestionCache.has(partial)) {
      return this.suggestionCache.get(partial);
    }

    const suggestions = [];
    
    const searchResults = this.miniSearch.search(partial, {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR'
    });

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

    const historySuggestions = this.getHistorySuggestions(partial, limit - suggestions.length);
    suggestions.push(...historySuggestions);

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
        return results;
    }
  }

  clearCache() {
    this.searchCache.clear();
    this.suggestionCache.clear();
  }

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

window.SearchEngine = SearchEngine;