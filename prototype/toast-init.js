/**
 * Toast Initialization Module
 * 
 * This module initializes the toast notification system and provides
 * a global function to show toast messages.
 */

// Create toast container when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toastContainer')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
        document.body.appendChild(toastContainer);
    }
});

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, info, warning)
 * @param {number} duration - How long to show the toast in milliseconds
 */
window.showToast = function(message, type = 'info', duration = 3000) {
    // Get toast container
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast flex items-center p-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out max-w-md';
    
    // Set toast type
    let icon = '';
    switch (type) {
        case 'success':
            toast.classList.add('bg-green-600', 'text-white');
            icon = '<i class="fas fa-check-circle mr-2"></i>';
            break;
        case 'error':
            toast.classList.add('bg-red-600', 'text-white');
            icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
            break;
        case 'warning':
            toast.classList.add('bg-yellow-500', 'text-white');
            icon = '<i class="fas fa-exclamation-triangle mr-2"></i>';
            break;
        case 'info':
        default:
            toast.classList.add('bg-blue-600', 'text-white');
            icon = '<i class="fas fa-info-circle mr-2"></i>';
            break;
    }
    
    // Set toast content
    toast.innerHTML = `
        ${icon}
        <span class="flex-1">${message}</span>
        <button class="ml-2 text-white hover:text-gray-200 focus:outline-none">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Animate toast in
    setTimeout(() => {
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 10);
    
    // Add close button event listener
    const closeButton = toast.querySelector('button');
    closeButton.addEventListener('click', () => {
        closeToast(toast);
    });
    
    // Auto close after duration
    const timeoutId = setTimeout(() => {
        closeToast(toast);
    }, duration);
    
    // Store timeout ID
    toast.dataset.timeoutId = timeoutId;
    
    // Close toast function
    function closeToast(toastElement) {
        // Clear timeout
        clearTimeout(parseInt(toastElement.dataset.timeoutId));
        
        // Animate out
        toastElement.classList.add('opacity-0', '-translate-x-4');
        
        // Remove after animation
        setTimeout(() => {
            toastElement.remove();
        }, 300);
    }
    
    // Return toast element
    return toast;
};

// toast-init.js
// We'll define Toast after SweetAlert2 is loaded:
const Toast = Swal.mixin({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e1e1e', // Dark secondary color
    color: '#ffffff', // White text
    iconColor: '#8a2be2', // Purple accent
    customClass: {
        popup: 'toast-popup',
        title: 'toast-title',
        timerProgressBar: 'toast-progress'
    },
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

// Add custom styles for the toast
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .toast-popup {
            border-left: 4px solid #8a2be2 !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        }
        .toast-title {
            font-family: 'Inter var', sans-serif !important;
            font-size: 0.9rem !important;
        }
        .toast-progress {
            background: #8a2be2 !important;
        }
        .swal2-success-ring {
            border-color: #8a2be2 !important;
        }
    `;
    document.head.appendChild(style);
}); 