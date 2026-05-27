import React, { useCallback, useState } from 'react';
import { 
  UploadCloud, 
  File, 
  X, 
  CheckCircle2, 
  Clock,
  Eye,
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { extractReport } from '../services/api';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const recentFiles = [
  { id: 1, name: 'chest_xray_scan.pdf', size: '2.4 MB', type: 'X-Ray', date: '2 hours ago', status: 'completed' },
  { id: 2, name: 'blood_report_may.pdf', size: '1.2 MB', type: 'Lab', date: '5 hours ago', status: 'completed' },
  { id: 3, name: 'chest_xray.jpg', size: '4.8 MB', type: 'X-Ray', date: 'Yesterday', status: 'completed' },
];

export default function DocumentUploader({ onFilesSelected }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();
  const { formData, setFormData } = useStore();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = async (newFiles) => {
    const processedFiles = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
      type: file.type.split('/')[1]?.toUpperCase() || 'FILE',
      status: 'uploading',
      progress: 0,
      originalFile: file
    }));
    
    setFiles(prev => [...prev, ...processedFiles]);

    for (const fileObj of processedFiles) {
      // 1. Simulate fast visual upload progress
      await new Promise(resolve => {
        let prog = 0;
        const interval = setInterval(() => {
          prog += 25;
          if (prog >= 100) {
            clearInterval(interval);
            resolve();
          } else {
            setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, progress: prog } : f));
          }
        }, 150);
      });

      // 2. OCR Extraction Phase
      const isExtractable = ['PDF', 'JPG', 'JPEG', 'PNG'].includes(fileObj.type);
      if (isExtractable) {
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'extracting', progress: 100 } : f));
        
        try {
          const payload = new FormData();
          payload.append('file', fileObj.originalFile);
          
          const response = await extractReport(payload);
          if (response?.data?.success) {
            const extracted = response.data.extracted_data;
            if (Object.keys(extracted).length > 0) {
              setFormData({ ...formData, ...extracted });
            }
          }
        } catch (err) {
          console.error("OCR Extraction failed for", fileObj.name, err);
        }
      }

      // 3. Mark as completed and notify parent
      setFiles(prev => {
        const next = prev.map(f => f.id === fileObj.id ? { ...f, progress: 100, status: 'completed' } : f);
        if (onFilesSelected) {
          onFilesSelected(next.filter(f => f.status === 'completed').map(f => f.originalFile));
        }
        return next;
      });
    }
  };

  const removeFile = (id) => {
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (onFilesSelected) {
        onFilesSelected(next.filter(f => f.status === 'completed').map(f => f.originalFile));
      }
      return next;
    });
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <UploadCloud size={18} className="text-primary" />
              </div>
              Upload Medical Documents
            </h2>
            <p className="text-sm text-slate-400 mt-1">Add X-Ray or blood reports for AI analysis</p>
          </div>
        </div>

        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative group border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-300 min-h-[220px]",
            isDragging ? "border-primary bg-primary/5" : "border-white/10 hover:border-white/20 bg-slate-900/40"
          )}
        >
          <input 
            type="file" 
            multiple 
            onChange={handleFileInput}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <UploadCloud className={cn("text-slate-400 transition-colors", isDragging ? "text-primary" : "group-hover:text-white")} size={32} />
          </div>
          <p className="text-white font-semibold">Drag & drop files here</p>
          <p className="text-slate-500 text-sm mt-1">Supports PDF, JPG, PNG, DICOM (Max 50MB)</p>
          
          <button className="mt-6 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium transition-all">
            Browse Files
          </button>
        </motion.div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider opacity-50">Recent Documents</h3>
          <button className="text-xs font-bold text-primary hover:underline">View All</button>
        </div>

        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  {file.status === 'completed' ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : file.status === 'extracting' ? (
                    <Loader2 size={20} className="text-indigo-400 animate-spin" />
                  ) : (
                    <Clock size={20} className="text-amber-500 animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{file.type}</span>
                    <span className="text-[11px] text-slate-500">{file.size}</span>
                    {file.status === 'extracting' && <span className="text-[10px] text-indigo-400 font-semibold ml-2">Extracting metrics...</span>}
                  </div>
                  {file.status === 'uploading' && (
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${file.progress}%` }}
                        className="h-full bg-primary" 
                      />
                    </div>
                  )}
                  {file.status === 'extracting' && (
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden relative">
                      <motion.div 
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="absolute inset-y-0 left-0 w-1/2 bg-indigo-500/50 rounded-full" 
                      />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => removeFile(file.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {files.length === 0 && recentFiles.map((file) => (
            <div key={file.id} className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex items-center gap-4 group hover:bg-slate-900/60 transition-all">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <FileText size={20} className="text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{file.date} • {file.size}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><Eye size={14} /></button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><Download size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
