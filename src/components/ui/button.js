import React from 'react';

const Button = React.forwardRef(({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}, ref) => {
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});


Button.displayName = 'Button';

export { Button }; 