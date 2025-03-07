
import React from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

const Chip: React.FC<ChipProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50";
  
  const variantClasses = {
    default: "bg-web3-gray text-web3-darkGray",
    primary: "bg-web3-skyBlue text-web3-blue",
    secondary: "bg-web3-lightBlue text-web3-blue",
    outline: "border border-web3-gray text-web3-darkGray",
  };
  
  const sizeClasses = {
    sm: "text-xs px-2.5 py-1 rounded-full",
    md: "text-sm px-3 py-1 rounded-full",
  };
  
  return (
    <span className={cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {children}
    </span>
  );
};

export default Chip;
