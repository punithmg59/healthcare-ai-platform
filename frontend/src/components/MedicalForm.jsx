import React, { useState } from 'react';
import {
  User,
  Activity,
  Droplets,
  Heart,
  Zap,
  Wind,
  AlertCircle,
  Navigation,
  ChevronRight,
  TrendingUp,
  Brain,
  Cigarette,
  Dna,
  Upload,
  Loader2,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractReport } from '../services/api';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function MedicalForm({ onSubmit, loading }) {
  const { formData, setFormData } = useStore();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numValue = Number(value);
    setFormData({ [name]: isNaN(numValue) ? value : numValue });
  };

  const handleToggle = (name, value) => {
    setFormData({ [name]: value });
  };

  const handleOcrUpload = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    setOcrSuccess(false);
    setOcrError(null);

    try {
      const payload = new FormData();
      payload.append('file', file);
      
      const response = await extractReport(payload);
      
      if (response && response.data && response.data.success) {
        const extracted = response.data.extracted_data;
        if (Object.keys(extracted).length > 0) {
            setFormData({ ...formData, ...extracted });
            setOcrSuccess(true);
            setTimeout(() => setOcrSuccess(false), 5000);
        } else {
            setOcrError("No health values could be extracted.");
        }
      } else {
        setOcrError(response?.message || "Failed to extract data.");
      }
    } catch (err) {
      setOcrError("An error occurred during extraction.");
    } finally {
      setOcrLoading(false);
    }
  };

  const inputClasses = "glass-input w-full px-4 py-3 rounded-2xl text-sm font-medium text-white transition-all";
  const labelClasses = "text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2";

  return (
    <div className="flex flex-col gap-8 h-full custom-scrollbar overflow-y-auto pr-2">
      
      {/* Auto-Fill OCR Section */}
      <section className="relative">
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleOcrUpload(e.dataTransfer.files[0]);
            }
          }}
          className={cn(
            "relative w-full rounded-2xl border-2 border-dashed p-6 transition-all duration-300 flex flex-col items-center justify-center text-center",
            isDragging ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 hover:border-white/20 bg-slate-900/40"
          )}
        >
            <input 
                type="file" 
                accept="image/*,.pdf"
                onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        handleOcrUpload(e.target.files[0]);
                    }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center pointer-events-none">
                {ocrLoading ? (
                    <>
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                        <h4 className="text-sm font-bold text-white">Extracting Clinical Data...</h4>
                        <p className="text-xs text-slate-400 mt-1">Applying OCR & NLP to parse report</p>
                    </>
                ) : ocrSuccess ? (
                    <>
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 text-emerald-400">
                            <CheckCircle2 size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-400">Auto-Fill Complete!</h4>
                        <p className="text-xs text-emerald-500/70 mt-1">Verify the extracted values below.</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3 text-indigo-400 transition-transform group-hover:scale-110">
                            <FileText size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-white">Auto-Fill from Report</h4>
                        <p className="text-xs text-slate-400 mt-1">Upload PDF or Image to instantly fill clinical metrics</p>
                    </>
                )}
                {ocrError && <p className="text-xs text-rose-400 mt-3 font-semibold">{ocrError}</p>}
            </div>
        </div>
      </section>

      {/* Basic Information */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <User size={20} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Basic Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClasses}><Dna size={14} /> Age (years)</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClasses}><User size={14} /> Biological Sex</label>
            <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => handleToggle('sex', 1)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                  formData.sex === 1 ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Male
              </button>
              <button
                onClick={() => handleToggle('sex', 0)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                  formData.sex === 0 ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Female
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Metrics */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Activity size={20} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Clinical Metrics</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClasses}><Droplets size={14} /> Resting BP (mmHg)</label>
            <input
              type="number"
              name="trestbps"
              value={formData.trestbps}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClasses}><TrendingUp size={14} /> Cholesterol (mg/dl)</label>
            <input
              type="number"
              name="chol"
              value={formData.chol}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClasses}><Heart size={14} /> Max Heart Rate</label>
            <input
              type="number"
              name="thalach"
              value={formData.thalach}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClasses}><Zap size={14} /> Chest Pain Type</label>
            <select
              name="cp"
              value={formData.cp}
              onChange={handleChange}
              className={inputClasses}
            >
              <option value="0">Typical Angina</option>
              <option value="1">Atypical Angina</option>
              <option value="2">Non-anginal Pain</option>
              <option value="3">Asymptomatic</option>
            </select>
          </div>
        </div>
      </section>

      {/* Symptoms & Lifestyle */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Brain size={20} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Symptoms & Lifestyle</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Cigarette size={16} className="text-slate-500" /> Smoking Status
            </label>
            <div className="flex h-8 bg-slate-900 rounded-full p-1 border border-white/5 w-24">
              <button
                onClick={() => handleToggle('smoking', 0)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.smoking === 0 ? "bg-slate-700 text-white" : "text-slate-600")}
              >
                No
              </button>
              <button
                onClick={() => handleToggle('smoking', 1)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.smoking === 1 ? "bg-red-500/80 text-white" : "text-slate-600")}
              >
                Yes
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Wind size={16} className="text-slate-500" /> Shortness of Breath
            </label>
            <div className="flex h-8 bg-slate-900 rounded-full p-1 border border-white/5 w-24">
              <button
                onClick={() => handleToggle('short_breath', 0)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.short_breath === 0 ? "bg-slate-700 text-white" : "text-slate-600")}
              >
                No
              </button>
              <button
                onClick={() => handleToggle('short_breath', 1)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.short_breath === 1 ? "bg-amber-500/80 text-white" : "text-slate-600")}
              >
                Yes
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Activity size={16} className="text-slate-500" /> Fatigue
            </label>
            <div className="flex h-8 bg-slate-900 rounded-full p-1 border border-white/5 w-24">
              <button
                onClick={() => handleToggle('fatigue', 0)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.fatigue === 0 ? "bg-slate-700 text-white" : "text-slate-600")}
              >
                No
              </button>
              <button
                onClick={() => handleToggle('fatigue', 1)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.fatigue === 1 ? "bg-amber-500/80 text-white" : "text-slate-600")}
              >
                Yes
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <AlertCircle size={16} className="text-slate-500" /> Exercise Angina
            </label>
            <div className="flex h-8 bg-slate-900 rounded-full p-1 border border-white/5 w-24">
              <button
                onClick={() => handleToggle('exang', 0)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.exang === 0 ? "bg-slate-700 text-white" : "text-slate-600")}
              >
                No
              </button>
              <button
                onClick={() => handleToggle('exang', 1)}
                className={cn("flex-1 rounded-full text-[10px] font-bold", formData.exang === 1 ? "bg-red-500/80 text-white" : "text-slate-600")}
              >
                Yes
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stress Level Index</label>
            <span className="text-primary font-bold">{formData.stress_level}/10</span>
          </div>
          <input
            type="range"
            name="stress_level"
            min="1"
            max="10"
            step="1"
            value={formData.stress_level}
            onChange={handleChange}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Navigation size={20} className="text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Pain Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClasses}>Pain Severity</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  onClick={() => handleToggle('pain_severity', level)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                    formData.pain_severity === level ? "bg-purple-500 text-white" : "bg-slate-900/60 text-slate-500"
                  )}
                >
                  L{level}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelClasses}>Chest Pain Location</label>
            <select
              name="chest_location"
              value={formData.chest_location}
              onChange={handleChange}
              className={inputClasses}
            >
              <option value="1">Center Chest</option>
              <option value="0">Left/Right Sides</option>
            </select>
          </div>
        </div>
      </section>

      <div className="pt-6 mt-auto">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="w-full relative group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-indigo-600 group-hover:scale-105 transition-transform duration-300" />
          <div className="relative h-14 rounded-2xl flex items-center justify-center gap-3 text-white font-bold shadow-xl shadow-primary/30">
            {loading ? (
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Heart size={20} className="group-hover:scale-125 transition-transform" />
                Analyze Cardiac Risk
                <ChevronRight size={20} />
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
