import React from 'react';

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const classes = [
    'input',
    type === 'color' ? 'input--color' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      type={type}
      className={classes}
      ref={ref}
      {...props}
    />
  );
});



Input.displayName = 'Input';

export { Input }; 