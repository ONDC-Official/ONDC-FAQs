class FAQManager {
  constructor() {
    this.faqs = [];
    this.categories = new Map();
    this.tags = new Set();
    this.analytics = {
      searches: []
    };
    this.categoryFileMap = {
      'Getting Started with ONDC': 'getting_started_with_ondc.yaml',
      'Technical Architecture': 'technical_architecture.yaml',
      'Integration': 'integration.yaml',
      'Registry & Network': 'registry_and_network.yaml',
      'Retail': 'retail.yaml',
      'Mobility & Travel': 'mobility_and_travel.yaml',
      'Logistics': 'logistics.yaml',
      'Financial Services (FIS)': 'financial_services_fis.yaml',
      'Log Submissions': 'log_submissions.yaml',
      'Reference Applications': 'reference_applications.yaml',
      'Reconciliation and Settlement Framework (RSF)': 'reconciliation_and_settlement_framework_rsf.yaml',
      'IGM & Support': 'igm_and_support.yaml',
      'Priority Features': 'priority_features.yaml',
      'Errors & Troubleshooting': 'errors_and_troubleshooting.yaml',
      'Network Observability': 'network_observability.yaml'
    };
    this.loadedCategories = new Set();
    this.isFullyLoaded = false;
  }

  async loadFAQs() {
    try {
      console.log('Loading FAQs from multiple domain files...');
      
      // Load all category files and merge them
      const loadPromises = Object.entries(this.categoryFileMap).map(async ([category, filename]) => {
        try {
          const filePath = `data/domains/${filename}`;
          console.log(`Loading ${category} from ${filePath}`);
          const response = await fetch(filePath);
          
          if (!response.ok) {
            console.warn(`Failed to load ${filename}: ${response.status}`);
            return [];
          }
          
          const yamlText = await response.text();
          const rawFAQs = window.jsyaml.load(yamlText);
          console.log(`Loaded ${rawFAQs ? rawFAQs.length : 0} FAQs from ${category}`);
          
          return rawFAQs || [];
        } catch (error) {
          console.warn(`Error loading ${filename}:`, error);
          return [];
        }
      });
      
      const results = await Promise.all(loadPromises);
      const allFAQs = results.flat();
      
      console.log(`Total FAQs loaded from domain files: ${allFAQs.length}`);
      
      // Mark all categories as loaded
      Object.keys(this.categoryFileMap).forEach(category => {
        this.loadedCategories.add(category);
      });
      
      this.faqs = this.processFAQs(allFAQs);
      this.extractCategories();
      this.extractTags();
      this.isFullyLoaded = true;
      
      return this.faqs;
    } catch (error) {
      console.error('Error loading FAQs from domain files:', error);
      
      // Fallback to original single file
      try {
        console.log('Falling back to original faqs.yaml file...');
        const response = await fetch('data/faqs.yaml');
        const yamlText = await response.text();
        const rawFAQs = window.jsyaml.load(yamlText);
        
        this.faqs = this.processFAQs(rawFAQs);
        this.extractCategories();
        this.extractTags();
        this.isFullyLoaded = true;
        
        console.log(`Fallback: Loaded ${this.faqs.length} FAQs from original file`);
        return this.faqs;
      } catch (fallbackError) {
        console.error('Error loading fallback FAQs:', fallbackError);
        throw fallbackError;
      }
    }
  }

  processFAQs(rawFAQs) {
    return rawFAQs.map((faq, index) => {
      // Use categories field for category extraction
      const category = this.extractCategory(faq.categories);
      
      const processedAnswer = this.processAnswer(faq.answer);
      
      return {
        id: `faq-${index}`,
        question: faq.question.trim(),
        answer: processedAnswer,
        answerPreview: this.createPreview(processedAnswer),
        categories: Array.isArray(faq.categories) ? faq.categories : [],
        tags: Array.isArray(faq.tags) ? faq.tags : [],
        category: category,
        searchText: `${faq.question} ${processedAnswer} ${(faq.categories || []).join(' ')} ${(faq.tags || []).join(' ')}`.toLowerCase(),
        lastUpdated: faq.lastUpdated || new Date().toISOString(),
        relatedQuestions: []
      };
    });
  }

  extractCategory(categories) {
    if (!categories || !Array.isArray(categories)) return 'General';
    
    const categoryMappings = {
      'Getting Started with ONDC': ['getting started', 'introduction', 'basics', 'ondc'],
      'Technical Architecture': ['technical', 'architecture', 'api', 'protocol'],
      'Integration': ['integration', 'api flow', 'implementation'],
      'Errors & Troubleshooting': ['error', 'troubleshooting', 'issue', 'problem'],
      'Logistics': ['logistics', 'delivery', 'shipping'],
      'Reconciliation and Settlement Framework (RSF)': ['payment', 'settlement', 'rsf', 'reconciliation'],
      'Registry & Network': ['registry', 'network', 'participant'],
      'IGM & Support': ['igm', 'support', 'grievance'],
      'Retail': ['retail', 'commerce', 'product', 'catalog'],
      'Mobility & Travel': ['mobility', 'travel', 'ride', 'booking']
    };
    
    for (const [category, patterns] of Object.entries(categoryMappings)) {
      if (categories.some(cat => patterns.some(pattern => 
        cat.toLowerCase().includes(pattern)
      ))) {
        return category;
      }
    }
    
    return categories[0] || 'General';
  }

  processAnswer(answer) {
    return answer
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .replace(/^A:\s*/gm, '');
  }

  createPreview(answer, maxLength = 150) {
    const plainText = answer
      .replace(/[#*`]/g, '') 
      .replace(/\n+/g, ' ')
      .trim();
    
    if (plainText.length <= maxLength) return plainText;
    
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return truncated.substring(0, lastSpace) + '...';
  }

  extractCategories() {
    this.categories.clear();
    
    this.faqs.forEach(faq => {
      const count = this.categories.get(faq.category) || 0;
      this.categories.set(faq.category, count + 1);
    });
    
    this.categories = new Map(
      [...this.categories.entries()].sort((a, b) => b[1] - a[1])
    );
  }

  extractTags() {
    this.tags.clear();
    
    this.faqs.forEach(faq => {
      faq.tags.forEach(tag => this.tags.add(tag));
    });
  }

  findRelatedFAQs(faqId, limit = 5) {
    const targetFAQ = this.faqs.find(f => f.id === faqId);
    if (!targetFAQ) return [];
    
    const scored = this.faqs
      .filter(faq => faq.id !== faqId)
      .map(faq => ({
        faq,
        score: this.calculateSimilarity(targetFAQ, faq)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return scored.map(item => item.faq);
  }

  calculateSimilarity(faq1, faq2) {
    let score = 0;
    
    // Check shared categories
    const sharedCategories = faq1.categories.filter(cat => faq2.categories.includes(cat));
    score += sharedCategories.length * 3;
    
    // Check shared tags
    const sharedTags = faq1.tags.filter(tag => faq2.tags.includes(tag));
    score += sharedTags.length * 2;
    
    if (faq1.category === faq2.category) score += 3;
    
    const words1 = new Set(faq1.question.toLowerCase().split(/\s+/));
    const words2 = new Set(faq2.question.toLowerCase().split(/\s+/));
    const commonWords = [...words1].filter(word => words2.has(word) && word.length > 3);
    score += commonWords.length;
    
    return score;
  }

  trackSearch(query, resultCount) {
    this.analytics.searches.push({
      query,
      resultCount,
      timestamp: new Date().toISOString()
    });
  }




  getRecentFAQs(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.faqs.filter(faq => 
      new Date(faq.lastUpdated) > cutoffDate
    );
  }

  exportToJSON(faqIds = null) {
    const faqsToExport = faqIds 
      ? this.faqs.filter(f => faqIds.includes(f.id))
      : this.faqs;
    
    return JSON.stringify(faqsToExport, null, 2);
  }

  exportToMarkdown(faqIds = null) {
    const faqsToExport = faqIds 
      ? this.faqs.filter(f => faqIds.includes(f.id))
      : this.faqs;
    
    let markdown = '# ONDC FAQs\n\n';
    
    const byCategory = {};
    faqsToExport.forEach(faq => {
      if (!byCategory[faq.category]) {
        byCategory[faq.category] = [];
      }
      byCategory[faq.category].push(faq);
    });
    
    Object.entries(byCategory).forEach(([category, faqs]) => {
      markdown += `## ${category}\n\n`;
      
      faqs.forEach(faq => {
        markdown += `### ${faq.question}\n\n`;
        markdown += `${faq.answer}\n\n`;
        if (faq.categories.length > 0) {
          markdown += `**Categories:** ${faq.categories.join(', ')}\n\n`;
        }
        if (faq.tags.length > 0) {
          markdown += `**Tags:** ${faq.tags.join(', ')}\n\n`;
        }
        markdown += '---\n\n';
      });
    });
    
    return markdown;
  }

  getFAQsByCategory(category) {
    return this.faqs.filter(faq => faq.category === category);
  }
}

window.FAQManager = FAQManager;