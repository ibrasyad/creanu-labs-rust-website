import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'h-8 w-8' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 shadow-sm rounded-lg`}
    aria-hidden="true"
  >
    <rect width="32" height="32" rx="7" fill="#059669" />
    <path
      d="M11 12.5L13.2 7.5H18.8L21 12.5"
      stroke="#FFFFFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 12.5H25.5L23.6 24C23.4 24.85 22.65 25.5 21.75 25.5H10.25C9.35 25.5 8.6 24.85 8.4 24L6.5 12.5Z"
      stroke="#FFFFFF"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <rect x="11" y="19" width="2.2" height="3.5" rx="0.6" fill="#FFFFFF" />
    <rect x="14.9" y="16.5" width="2.2" height="6" rx="0.6" fill="#FFFFFF" />
    <rect x="18.8" y="14.2" width="2.2" height="8.3" rx="0.6" fill="#FFFFFF" />
  </svg>
);
