import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Upload, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import useStore from '../store/useStore';
import axios from 'axios';

export default function BrainTumor() {
  const navigate = useNavigate();
  const { theme } = useStore();
  const isLight = theme === 'light';
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const card = isLight ? 'bg-white border border-gray-200 shadow-sm' : 'bg-slate-900 border border-slate-800';
  const muted = isLight ? 'text-gray-500' : 'text-slate-400';

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type.startsWith('image/') || f.name.endsWith('.dcm'))) {
      handleFile(f);
    }
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const { predictBrainTumor } = await import('../services/api');
      const res = await predictBrainTumor(formData);
      
      navigate('/report', { state: { result: { ...res.data, type: 'mri' } } });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Brain tumor service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>Brain Tumor Detection AI</h1>
        <p className={`text-sm mt-1 ${muted}`}>Upload an MRI scan for production-ready tumor classification and report generation</p>
      </div>

      <div className="max-w-2xl mx-auto mt-10">
        {/* Upload Section */}
        <div className={`${card} rounded-xl p-8`}>
          <h2 className={`text-sm font-semibold mb-4 ${isLight ? 'text-gray-800' : 'text-white'}`}>Upload MRI Scan</h2>

          {!preview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-colors ${
                isDragging
                   ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : isLight ? 'border-gray-300 hover:border-gray-400' : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <input
                type="file"
                accept="image/*,.dcm"
                onChange={(e) => handleFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload size={32} className={`mb-3 ${muted}`} />
              <p className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Drag & drop MRI image
              </p>
              <p className={`text-xs mt-1 ${muted}`}>JPG, PNG, DICOM supported</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden">
                <img src={preview} alt="MRI Preview" className="w-full h-64 object-cover" />
                <button
                  onClick={clearFile}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center text-white hover:bg-black/80"
                >
                  <X size={16} />
                </button>
              </div>
              <p className={`text-xs ${muted}`}>{file.name} • {(file.size / 1024 / 1024).toFixed(1)} MB</p>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Analyzing Scan...</>
                ) : (
                  <><Brain size={18} /> Analyze MRI Scan</>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
            isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${isLight ? 'text-red-800' : 'text-red-400'}`}>Analysis Error</p>
              <p className={`text-xs mt-1 ${isLight ? 'text-red-600' : 'text-red-400/80'}`}>{error}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
