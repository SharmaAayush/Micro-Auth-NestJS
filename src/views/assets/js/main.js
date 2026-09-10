// Client-side UI logic - no token handling
// All auth managed via cookies and server-side validation

/**
 * Shows a loading indicator
 * @param {string} message - Optional message to display
 */
function showLoading(message = 'Loading...') {
  // Remove any existing loading indicators
  hideLoading();

  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  loadingOverlay.innerHTML = `
    <div class="bg-white rounded-lg px-6 py-4 text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
      <p class="text-gray-600">${message}</p>
    </div>
  `;
  loadingOverlay.id = 'loading-overlay';
  document.body.appendChild(loadingOverlay);
}

/**
 * Hides the loading indicator
 */
function hideLoading() {
  const existingOverlay = document.getElementById('loading-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
}

/**
 * Shows an error message
 * @param {string} message - Error message to display
 * @param {HTMLElement} container - Optional container to place the message in
 */
function showError(message, container = null) {
  // Remove any existing error messages in container
  if (container) {
    const existingError = container.querySelector('.error-message');
    if (existingError) existingError.remove();
  } else {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
  }

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded';
  errorDiv.textContent = message;

  if (container) {
    container.prepend(errorDiv);
  } else {
    // Add to body as a global notification
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.right = '20px';
    errorDiv.style.zIndex = '1000';
    errorDiv.style.maxWidth = '300px';
    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}

/**
 * Shows a success message
 * @param {string} message - Success message to display
 * @param {HTMLElement} container - Optional container to place the message in
 */
function showSuccess(message, container = null) {
  // Remove any existing success messages in container
  if (container) {
    const existingSuccess = container.querySelector('.success-message');
    if (existingSuccess) existingSuccess.remove();
  } else {
    const existingSuccess = document.querySelector('.success-message');
    if (existingSuccess) existingSuccess.remove();
  }

  const successDiv = document.createElement('div');
  successDiv.className = 'success-message mt-4 p-4 bg-green-50 border border-green-200 text-green-600 rounded';
  successDiv.textContent = message;

  if (container) {
    container.prepend(successDiv);
  } else {
    // Add to body as a global notification
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.right = '20px';
    successDiv.style.zIndex = '1000';
    successDiv.style.maxWidth = '300px';
    document.body.appendChild(successDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      successDiv.remove();
    }, 5000);
  }
}

/**
 * Handles form submission with loading states and error/success feedback
 * @param {HTMLFormElement} form - The form to enhance
 * @param {string} successMessage - Optional success message to show
 */
function enhanceFormSubmission(form, successMessage = null) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Show loading state
    showLoading('Processing...');

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Remove CSRF token from data before sending
      delete data._csrf;
      delete data['_method'];

      const response = await fetch(form.action, {
        method: form.method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include', // Important: sends cookies
      });

      // Hide loading state
      hideLoading();

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'An error occurred';
        showError(errorMessage, form);
        return;
      }

      const result = await response.json();

      // Show success message
      const msg = successMessage || 'Operation successful';
      showSuccess(msg, form);

      // Redirect if specified in response
      if (result.redirect) {
        window.location.href = result.redirect;
      }

      // Reset form if specified
      if (result.resetForm !== false) {
        form.reset();
      }
    } catch (error) {
      // Hide loading state
      hideLoading();

      console.error('Form submission error:', error);
      showError('An unexpected error occurred. Please try again.', form);
    }
  });
}

/**
 * Initializes DOM enhancements when page loads
 */
document.addEventListener('DOMContentLoaded', () => {
  // Enhance all forms with submission handling
  document.querySelectorAll('form').forEach(form => {
    enhanceFormSubmission(form);
  });

  // Add click handlers for revoke buttons (if using fetch instead of form)
  document.querySelectorAll('[data-revoke-session]').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const sessionId = button.getAttribute('data-revoke-session');
      if (!sessionId) return;

      if (!confirm('Are you sure you want to revoke this session?')) {
        return;
      }

      showLoading('Revoking session...');

      try {
        const response = await fetch(`/views/sessions/${sessionId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        hideLoading();

        if (!response.ok) {
          const errorData = await response.json();
          showError(errorData.message || 'Failed to revoke session');
          return;
        }

        showSuccess('Session revoked successfully');

        // Remove the session item from the DOM
        const sessionItem = button.closest('.session-item');
        if (sessionItem) {
          sessionItem.remove();
        }

        // Show message if no sessions left
        const sessionsContainer = document.querySelector('.sessions-container');
        if (sessionsContainer && !sessionsContainer.querySelector('.session-item')) {
          sessionsContainer.innerHTML = '<p class="text-center py-8 text-gray-500">No active sessions found.</p>';
        }
      } catch (error) {
        hideLoading();
        console.error('Session revocation error:', error);
        showError('An unexpected error occurred. Please try again.');
      }
    });
  });

  // Add click handler for revoke all button
  const revokeAllButton = document.getElementById('revoke-all-button');
  if (revokeAllButton) {
    revokeAllButton.addEventListener('click', async (e) => {
      e.preventDefault();

      if (!confirm('Are you sure you want to log out of all other sessions? This will keep your current session active.')) {
        return;
      }

      showLoading('Revoking all other sessions...');

      try {
        const response = await fetch('/views/sessions', {
          method: 'DELETE',
          credentials: 'include',
        });

        hideLoading();

        if (!response.ok) {
          const errorData = await response.json();
          showError(errorData.message || 'Failed to revoke sessions');
          return;
        }

        const result = await response.json();
        showSuccess(`Logged out of ${result.count} other sessions`);

        // Refresh the page to show updated session list
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        hideLoading();
        console.error('Revoke all sessions error:', error);
        showError('An unexpected error occurred. Please try again.');
      }
    });
  }
});

// Export functions for use in templates if needed
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showError = showError;
window.showSuccess = showSuccess;
window.enhanceFormSubmission = enhanceFormSubmission;