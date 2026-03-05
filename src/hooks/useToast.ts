// Simple toast implementation
let toastContainer: HTMLElement | null = null;

export const toast = {
  success: (message: string) => {
    showToast(message, 'success');
  },
  error: (message: string) => {
    showToast(message, 'error');
  },
  info: (message: string) => {
    showToast(message, 'info');
  }
};

function showToast(message: string, type: 'success' | 'error' | 'info') {
  // Create container if it doesn't exist
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toastElement = document.createElement('div');
  toastElement.className = `p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    'bg-blue-500 text-white'
  }`;

  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center';

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.className = 'ml-4 text-white hover:text-gray-200';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    toastElement.remove();
  });

  wrapper.appendChild(messageSpan);
  wrapper.appendChild(closeButton);
  toastElement.appendChild(wrapper);

  // Add to container
  toastContainer.appendChild(toastElement);

  // Animate in
  setTimeout(() => {
    toastElement.classList.remove('translate-x-full');
  }, 10);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toastElement.parentElement) {
      toastElement.classList.add('translate-x-full');
      setTimeout(() => {
        toastElement.remove();
      }, 300);
    }
  }, 5000);
}