import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const [showRetry, setShowRetry] = React.useState(false);

  React.useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setShowRetry(true), 12000); // Increased from 6s to 12s
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-6"></div>
        {showRetry && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center px-4"
          >
            <p className="text-slate-400 mb-4 font-medium">Backend connection is taking longer than expected. Retrying...</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-all"
            >
              Reload Page
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
