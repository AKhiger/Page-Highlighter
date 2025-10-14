import React from 'react';
import { createRoot } from 'react-dom/client';

let toastContainer = null;

function createToastContainer() {
  if (toastContainer) return toastContainer;

  const container = document.createElement('div');
  container.className = 'toast-container';
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
    <div className={`toast toast--${type}`}>
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
