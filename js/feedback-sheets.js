class GoogleSheetsFeedback {
  constructor() {
    this.scriptURL = 'https://script.google.com/macros/s/AKfycbyP6fILYYorPdFXqs8Npt4UQcTldYF2OE9igWgnbkKwoACFIXBaIsLe79gY1avHMmoH/exec';
    
    this.feedbackState = new Map();
    this.loadFeedbackState();
  }

  async generateHash(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  loadFeedbackState() {
    try {
      const saved = localStorage.getItem('feedback_state');
      if (saved) {
        const data = JSON.parse(saved);
        this.feedbackState = new Map(data);
      }
    } catch (error) {
      console.error('Error loading feedback state:', error);
    }
  }

  saveFeedbackState() {
    try {
      const data = Array.from(this.feedbackState.entries());
      localStorage.setItem('feedback_state', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving feedback state:', error);
    }
  }

  async submitFeedback(question, feedbackType, commentData, category) {
    if (!this.scriptURL || this.scriptURL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.error('Google Apps Script URL not configured!');
      alert('Feedback system not configured. Please contact the administrator.');
      return false;
    }

    let comment = '';
    let email = '';
    
    if (typeof commentData === 'object' && commentData !== null) {
      comment = commentData.comment || '';
      email = commentData.email || '';
    } else {
      comment = commentData || '';
    }

    const timestamp = Date.now();
    const message = `${timestamp}|${question}`;
    const signature = await this.generateHash(message);

    const feedbackData = {
      timestamp: timestamp,
      question: question,
      feedbackType: feedbackType,
      comment: comment,
      email: email,
      category: category || 'General',
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language || 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      signature: signature
    };

    try {
      this.showLoading(true);

      const response = await fetch(this.scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData)
      });

      
      const key = `${question}_${feedbackType}`;
      this.feedbackState.set(key, true);
      this.saveFeedbackState();

      this.showLoading(false);
      this.showSuccess('Thank you for your feedback!');
      
      return true;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      this.showLoading(false);
      this.showError('Failed to submit feedback. Please try again.');
      return false;
    }
  }

  hasFeedback(question, feedbackType) {
    const key = `${question}_${feedbackType}`;
    return this.feedbackState.has(key);
  }

  showLoading(show) {
    const existing = document.querySelector('.feedback-notification');
    if (existing) existing.remove();

    if (show) {
      const notification = document.createElement('div');
      notification.className = 'feedback-notification';
      notification.innerHTML = `
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        Submitting feedback...
      `;
      document.body.appendChild(notification);
    }
  }

  showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'feedback-notification success';
    notification.innerHTML = `
      <i class="fas fa-check-circle me-2"></i>
      ${message}
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  showError(message) {
    const notification = document.createElement('div');
    notification.className = 'feedback-notification error';
    notification.innerHTML = `
      <i class="fas fa-exclamation-circle me-2"></i>
      ${message}
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

window.GoogleSheetsFeedback = GoogleSheetsFeedback;