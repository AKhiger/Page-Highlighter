import React from 'react';
import { createRoot } from 'react-dom/client';
import { cn } from '../../utils/cn';

let toastContainer = null;

function createToastContainer() {
  if (toastContainer) return toastContainer;
  
  const container = document.createElement('div');
  container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
  document.body.appendChild(container);
  toastContainer = container;
  return container;
}

function ToastMessage({ message, type = 'success', onClose }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        'rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg',
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      )}
    >
      {message}
    </div>
  );
}

export const Toast = {
  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  show(message, type) {
    const container = createToastContainer();
    const toastRoot = document.createElement('div');
    container.appendChild(toastRoot);

    const root = createRoot(toastRoot);
    root.render(
      <ToastMessage
        message={message}
        type={type}
        onClose={() => {
          root.unmount();
          container.removeChild(toastRoot);
        }}
      />
    );
  }
}; 