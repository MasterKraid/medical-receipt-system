import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // CHANGED: We now get the error and a way to clear it directly from the context
  const { login, user, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();

  // NEW: When the component unmounts (e.g., we navigate away), clear any old errors.
  useEffect(() => {
    return () => {
      clearAuthError();
    };
  }, [clearAuthError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      // We can still handle simple validation locally if we want
      return; 
    }
    // The login function now handles all its own state updates.
    await login(username, password);
  };
  
  React.useEffect(() => {
    if (user) {
        const targetDashboard = user.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard';
        navigate(targetDashboard);
    }
  }, [user, navigate]);


  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 bg-white shadow-xl rounded-xl"
      >
        <div className="flex justify-center mb-6">
          <img src="/company-logo.png" alt="Company Logo" className="h-16" />
        </div>

        {/* CHANGED: We now display the error directly from the AuthContext */}
        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 text-sm" role="alert">
            <span className="block sm:inline">{authError}</span>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="userId" className="sr-only">User ID</label>
          <input
            type="text"
            id="userId"
            name="userId"
            placeholder="User ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="sr-only">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
