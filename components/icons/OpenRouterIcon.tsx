import React from 'react';

export const OpenRouterIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
      fill="#8A2BE2"
    ></path>
    <path
      d="M12 4c-3.59 0-6.7 2.01-8.15 4.91l1.45.65C6.45 7.18 8.99 6 12 6c3.01 0 5.55 1.18 6.7 3.56l1.45-.65C18.7 6.01 15.59 4 12 4z"
      fill="#8A2BE2"
    ></path>
    <path
      d="M12 18c-3.01 0-5.55-1.18-6.7-3.56l-1.45.65C5.3 17.99 8.41 20 12 20c3.59 0 6.7-2.01 8.15-4.91l-1.45-.65C17.55 16.82 15.01 18 12 18z"
      fill="#8A2BE2"
    ></path>
  </svg>
);