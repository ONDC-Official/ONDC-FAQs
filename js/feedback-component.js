class FeedbackComponent {
  constructor() {
    this.feedbackStorage = new GoogleSheetsFeedback();
    this.feedbackData = new Map();
  }

  createFeedbackHTML(questionId, question) {
    const feedbackState = this.feedbackData.get(questionId) || { liked: false, disliked: false };
    
    return `
      <div class="feedback-section" data-question-id="${questionId}">
        <div class="feedback-header">
          <span class="feedback-question">Was this helpful?</span>
        </div>
        <div class="feedback-actions">
          <button class="btn btn-sm feedback-btn like-btn ${feedbackState.liked ? 'active' : ''}" 
                  data-action="like" 
                  data-question="${this.escapeHtml(question)}"
                  ${feedbackState.liked ? 'disabled' : ''}>
            <i class="fas fa-thumbs-up"></i>
            <span class="feedback-count">Yes</span>
          </button>
          <button class="btn btn-sm feedback-btn dislike-btn ${feedbackState.disliked ? 'active' : ''}" 
                  data-action="dislike" 
                  data-question="${this.escapeHtml(question)}"
                  ${feedbackState.disliked ? 'disabled' : ''}>
            <i class="fas fa-thumbs-down"></i>
            <span class="feedback-count">No</span>
          </button>
          <button class="btn btn-sm feedback-btn comment-btn" 
                  data-action="comment" 
                  data-question="${this.escapeHtml(question)}">
            <i class="fas fa-comment"></i>
            <span>Add Comment</span>
          </button>
        </div>
        <div class="feedback-message" style="display: none;">
          <small class="text-success">Thank you for your feedback!</small>
        </div>
      </div>
    `;
  }

  init() {
    document.addEventListener('click', (e) => {
      const feedbackBtn = e.target.closest('.feedback-btn');
      if (feedbackBtn) {
        e.preventDefault();
        this.handleFeedback(feedbackBtn);
      }
    });

    if (!document.getElementById('commentModal')) {
      this.createCommentModal();
    }
  }

  async handleFeedback(button) {
    const action = button.dataset.action;
    const question = button.dataset.question;
    const feedbackSection = button.closest('.feedback-section');
    const questionId = feedbackSection.dataset.questionId;

    if (action === 'comment') {
      this.showCommentModal(question, questionId);
    } else {
      const category = this.getCurrentCategory();
      await this.submitFeedback(question, action, '', category);
      
      this.updateFeedbackUI(feedbackSection, action);
      
      const state = this.feedbackData.get(questionId) || { liked: false, disliked: false };
      if (action === 'like') {
        state.liked = true;
        state.disliked = false;
      } else {
        state.disliked = true;
        state.liked = false;
      }
      this.feedbackData.set(questionId, state);
    }
  }

  updateFeedbackUI(feedbackSection, action) {
    const likeBtn = feedbackSection.querySelector('.like-btn');
    const dislikeBtn = feedbackSection.querySelector('.dislike-btn');
    const message = feedbackSection.querySelector('.feedback-message');

    if (action === 'like') {
      likeBtn.classList.add('active');
      likeBtn.disabled = true;
      dislikeBtn.classList.remove('active');
      dislikeBtn.disabled = false;
    } else if (action === 'dislike') {
      dislikeBtn.classList.add('active');
      dislikeBtn.disabled = true;
      likeBtn.classList.remove('active');
      likeBtn.disabled = false;
    }

    message.style.display = 'block';
    setTimeout(() => {
      message.style.display = 'none';
    }, 3000);
  }

  createCommentModal() {
    const modalHTML = `
      <div class="modal fade" id="commentModal" tabindex="-1" aria-labelledby="commentModalLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="commentModalLabel">Add Your Feedback</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label text-muted small">Question:</label>
                <p class="question-text" id="commentQuestion"></p>
              </div>
              <div class="mb-3">
                <label for="feedbackComment" class="form-label">Your Comment</label>
                <textarea class="form-control" id="feedbackComment" rows="4" 
                          placeholder="Please share your feedback or suggestions..."></textarea>
                <small class="text-muted">Your feedback helps us improve our FAQs</small>
              </div>
              <div class="mb-3">
                <label for="feedbackEmail" class="form-label">Email (Optional)</label>
                <input type="email" class="form-control" id="feedbackEmail" 
                       placeholder="your.email@example.com">
                <small class="text-muted">Provide your email if you'd like us to follow up on your feedback</small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="submitComment">Submit Feedback</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('submitComment').addEventListener('click', () => {
      this.submitComment();
    });

    document.getElementById('feedbackEmail').addEventListener('blur', (e) => {
      const email = e.target.value.trim();
      if (email && !this.isValidEmail(email)) {
        e.target.classList.add('is-invalid');
        if (!e.target.nextElementSibling || !e.target.nextElementSibling.classList.contains('invalid-feedback')) {
          e.target.insertAdjacentHTML('afterend', '<div class="invalid-feedback">Please enter a valid email address</div>');
        }
      } else {
        e.target.classList.remove('is-invalid');
        const errorMsg = e.target.nextElementSibling;
        if (errorMsg && errorMsg.classList.contains('invalid-feedback')) {
          errorMsg.remove();
        }
      }
    });
  }

  showCommentModal(question, questionId) {
    const modal = new bootstrap.Modal(document.getElementById('commentModal'));
    document.getElementById('commentQuestion').textContent = question;
    document.getElementById('feedbackComment').value = '';
    document.getElementById('feedbackEmail').value = '';
    
    const emailInput = document.getElementById('feedbackEmail');
    emailInput.classList.remove('is-invalid');
    const errorMsg = emailInput.nextElementSibling;
    if (errorMsg && errorMsg.classList.contains('invalid-feedback')) {
      errorMsg.remove();
    }
    
    this.currentCommentQuestion = question;
    this.currentQuestionId = questionId;
    
    modal.show();
  }

  async submitComment() {
    const comment = document.getElementById('feedbackComment').value.trim();
    const email = document.getElementById('feedbackEmail').value.trim();
    
    if (!comment) {
      this.showToast('Please enter a comment', 'error');
      document.getElementById('feedbackComment').focus();
      return;
    }

    if (email && !this.isValidEmail(email)) {
      this.showToast('Please enter a valid email address', 'error');
      document.getElementById('feedbackEmail').focus();
      return;
    }

    const category = this.getCurrentCategory();
    const feedbackData = { comment, email };
    const success = await this.submitFeedback(this.currentCommentQuestion, 'comment', feedbackData, category);
    
    if (success) {
      const modal = bootstrap.Modal.getInstance(document.getElementById('commentModal'));
      modal.hide();
      
      this.showToast('Thank you for your feedback!', 'success');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async submitFeedback(question, feedbackType, comment, category) {
    try {
      const success = await this.feedbackStorage.submitFeedback(question, feedbackType, comment, category);
      
      if (success) {
        return true;
      } else {
        console.error('Failed to submit feedback');
        return false;
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      this.showToast('Failed to submit feedback. Please try again.', 'error');
      return false;
    }
  }

  getCurrentCategory() {
    const activeCategory = document.querySelector('.category-item.active');
    return activeCategory ? activeCategory.textContent.trim() : 'General';
  }

  showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
      document.body.appendChild(toastContainer);
    }

    const toastHTML = `
      <div class="toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0" 
           role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="true" data-bs-delay="3000">
        <div class="d-flex">
          <div class="toast-body">
            ${message}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = toastContainer.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async getFeedbackStats() {
    return null;
  }
}

window.FeedbackComponent = FeedbackComponent;