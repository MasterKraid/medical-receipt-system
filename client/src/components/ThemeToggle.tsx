import React, { useEffect, useState } from 'react';

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Toggle state
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`fixed top-4 left-4 z-0 p-2 transition-all duration-300 flex items-center justify-center no-invert hover:scale-110 active:scale-95 ${
        isAnimating 
          ? 'text-blue-500 scale-110' 
          : isDark 
            ? 'text-slate-300 hover:text-white' 
            : 'text-slate-600 hover:text-slate-900'
      }`}
      aria-label="Toggle Dark Mode"
      title="Toggle Dark Mode"
    >
      <i className={`fa-solid ${isDark ? 'fa-sun text-xl' : 'fa-moon text-xl'} transition-transform duration-300 ${isAnimating ? 'rotate-180' : 'rotate-0'}`}></i>
    </button>
  );
};

export default ThemeToggle;
