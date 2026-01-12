import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, 
  Settings, 
  Play, 
  Download, 
  Layers, 
  Trash2, 
  RefreshCw,
  Maximize,
  Plus,
  Undo2,
  Redo2,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square
} from 'lucide-react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { AspectRatio, SlideData, TemplateType, TextSettings, ImageEffects, SlideTextLayer } from './types';
import SlidePreview from './components/SlidePreview';
import Controls from './components/Controls';
import { generateSlideImage } from './services/imageService';

const DEFAULT_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const MAX_HISTORY = 50;

const App: React.FC = () => {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'design' | 'preview'>('upload');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  
  // Selection state (does not need to be in undo/redo history)
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());

  // History state
  const [history, setHistory] = useState<SlideData[][]>([]);
  const [future, setFuture] = useState<SlideData[][]>([]);
  
  const lastSavedStateRef = useRef<SlideData[]>([]);
  const historyDebounceTimer = useRef<number | null>(null);

  const [globalSettings, setGlobalSettings] = useState<TextSettings>({
    fontSize: 80,
    fontFamily: 'TikTok Sans',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
    shadow: true,
    shadowBlur: 20,
    shadowColor: '#000000',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    positionX: 50,
    positionY: 50,
    alignment: 'center',
    constrainToSlide: true // Set to true by default
  });

  const [globalEffects, setGlobalEffects] = useState<ImageEffects>({
    enabled: false,
    grayscale: false,
    brightness: 85, 
    contrast: 105,
    imageOffset: 50,
    imageOffsetY: 50
  });

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const commitToHistory = useCallback((stateToSave: SlideData[]) => {
    if (JSON.stringify(stateToSave) === JSON.stringify(lastSavedStateRef.current)) return;
    setHistory(prev => [...prev, lastSavedStateRef.current].slice(-MAX_HISTORY));
    setFuture([]);
    lastSavedStateRef.current = stateToSave;
  }, []);

  const debouncedCommitToHistory = useCallback((stateToSave: SlideData[]) => {
    if (historyDebounceTimer.current) window.clearTimeout(historyDebounceTimer.current);
    historyDebounceTimer.current = window.setTimeout(() => {
      commitToHistory(stateToSave);
      historyDebounceTimer.current = null;
    }, 500);
  }, [commitToHistory]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);
    setFuture(prev => [slides, ...prev].slice(0, MAX_HISTORY));
    setHistory(newHistory);
    setSlides(previous);
    lastSavedStateRef.current = previous;
  }, [history, slides]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setHistory(prev => [...prev, slides].slice(-MAX_HISTORY));
    setFuture(newFuture);
    setSlides(next);
    lastSavedStateRef.current = next;
  }, [future, slides]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsProcessing(true);
    const newSlidesBase: SlideData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        newSlidesBase.push({
          id: generateId(),
          image: imageData,
          layers: [
            { id: generateId(), type: 'body', content: `Body Content #${slides.length + i + 1}` }
          ],
          template: TemplateType.NONE,
          settings: { ...globalSettings },
          effects: { ...globalEffects }
        });
      }
    }

    if (newSlidesBase.length > 0) {
      const finalSlides = [...slides, ...newSlidesBase];
      commitToHistory(finalSlides);
      setSlides(finalSlides);
      setActiveTab('design');
    }
    setIsProcessing(false);
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const rows = results.data as any[];
        const updatedSlides = [...slides];
        rows.forEach((row, index) => {
          if (updatedSlides[index]) {
            const content = row[Object.keys(row)[0]] || "";
            updatedSlides[index].layers = [
              { id: generateId(), type: 'body', content: content }
            ];
          }
        });
        commitToHistory(updatedSlides);
        setSlides(updatedSlides);
      }
    });
  };

  const updateCurrentSlide = useCallback((updates: Partial<SlideData>) => {
    setSlides(prev => {
      const next = [...prev];
      if (next[currentSlideIndex]) {
        next[currentSlideIndex] = { ...next[currentSlideIndex], ...updates };
      }
      debouncedCommitToHistory(next);
      return next;
    });
  }, [currentSlideIndex, debouncedCommitToHistory]);

  const applyGlobalToAll = useCallback(() => {
    const nextSlides = slides.map(s => ({
      ...s,
      settings: { ...globalSettings },
      effects: { ...globalEffects }
    }));
    commitToHistory(nextSlides);
    setSlides(nextSlides);
  }, [slides, globalSettings, globalEffects, commitToHistory]);

  const deleteSlide = (index: number) => {
    const slideToDelete = slides[index];
    const newSlides = slides.filter((_, i) => i !== index);
    commitToHistory(newSlides);
    setSlides(newSlides);
    
    // Cleanup selection if deleted
    if (slideToDelete) {
      setSelectedSlideIds(prev => {
        const next = new Set(prev);
        next.delete(slideToDelete.id);
        return next;
      });
    }

    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(Math.max(0, newSlides.length - 1));
    }
  };

  const clearWorkspace = () => {
    commitToHistory([]);
    setSlides([]);
    setSelectedSlideIds(new Set());
  };

  const toggleSlideSelection = (id: string) => {
    setSelectedSlideIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSlideIds(new Set(slides.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSlideIds(new Set());
  };

  const downloadFile = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const downloadSingleSlide = async (slide: SlideData, index: number) => {
    setIsProcessing(true);
    try {
      const dataUrl = await generateSlideImage(slide, aspectRatio);
      downloadFile(dataUrl, `slide_${index + 1}.png`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSelectedSlides = async () => {
    if (selectedSlideIds.size === 0) return;
    setIsProcessing(true);
    
    try {
      const selectedList = slides.filter(s => selectedSlideIds.has(s.id));
      
      if (selectedList.length === 1) {
        const idx = slides.findIndex(s => s.id === selectedList[0].id);
        const dataUrl = await generateSlideImage(selectedList[0], aspectRatio);
        downloadFile(dataUrl, `slide_${idx + 1}.png`);
      } else {
        const zip = new JSZip();
        const folder = zip.folder("selected_slides");
        
        for (const slide of selectedList) {
          const idx = slides.findIndex(s => s.id === slide.id);
          const dataUrl = await generateSlideImage(slide, aspectRatio);
          const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
          folder?.file(`slide_${idx + 1}.png`, base64Data, { base64: true });
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        downloadFile(url, `selected_slides_${Date.now()}.zip`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAllZip = async () => {
    setIsProcessing(true);
    const zip = new JSZip();
    const folder = zip.folder("all_slides");

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const dataUrl = await generateSlideImage(slide, aspectRatio);
      const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
      folder?.file(`slide_${i + 1}.png`, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    downloadFile(url, `all_slides_${Date.now()}.zip`);
    setIsProcessing(false);
  };

  const currentSlide = useMemo(() => slides[currentSlideIndex], [slides, currentSlideIndex]);

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Header - Fixed Height & Stable Layout */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 bg-zinc-950 border-b border-zinc-900 shadow-xl z-20 gap-3 md:gap-8 shrink-0 relative">
        
        {/* Left Section: Brand & Mobile Undo/Redo */}
        <div className="flex items-center justify-between w-full md:w-auto shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Maximize className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h1 className="text-[20px] md:text-[23px] font-black tracking-tighter text-white uppercase italic">
              TikTok <span className="text-purple-500">Slides</span> <span className="hidden sm:inline">Maker</span>
            </h1>
          </div>
          
          {/* Mobile Actions (Visible only on mobile) */}
          <div className="flex md:hidden items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
             <button type="button" onClick={undo} disabled={history.length === 0} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-20"><Undo2 size={16} /></button>
             <button type="button" onClick={redo} disabled={future.length === 0} className="p-1.5 text-zinc-400 hover:text-white rounded disabled:opacity-20"><Redo2 size={16} /></button>
          </div>
        </div>
        
        {/* Right Section: Navigation & Desktop Actions - Separated for Stability */}
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto md:flex-1 md:justify-end">
          
          {/* Navigation - Centered in mobile column, or flexible in desktop row */}
          <nav className="flex items-center justify-center gap-1 md:gap-2 bg-zinc-900/50 p-1 rounded-full border border-zinc-800/50 w-full md:w-auto overflow-x-auto md:overflow-visible no-scrollbar">
            <button 
              type="button"
              onClick={() => setActiveTab('upload')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all shrink-0 ${activeTab === 'upload' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              <Upload size={16} /> <span className="text-xs md:text-sm font-semibold">Sources</span>
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('design')} 
              disabled={slides.length === 0} 
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all shrink-0 ${activeTab === 'design' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white disabled:opacity-30'}`}
            >
              <Settings size={16} /> <span className="text-xs md:text-sm font-semibold">Design</span>
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('preview')} 
              disabled={slides.length === 0} 
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all shrink-0 ${activeTab === 'preview' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white disabled:opacity-30'}`}
            >
              <Play size={16} /> <span className="text-xs md:text-sm font-semibold">Preview</span>
            </button>
          </nav>

          {/* Desktop Actions - Fixed to the right */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="hidden md:flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              <button 
                type="button"
                onClick={undo} 
                disabled={history.length === 0} 
                title="Undo (Ctrl+Z)"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-20 transition-all"
              >
                <Undo2 size={18} />
              </button>
              <button 
                type="button"
                onClick={redo} 
                disabled={future.length === 0} 
                title="Redo (Ctrl+Y)"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-20 transition-all"
              >
                <Redo2 size={18} />
              </button>
            </div>

            <select 
              value={aspectRatio} 
              onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} 
              className="bg-zinc-900 text-white px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer text-xs font-bold uppercase tracking-wider w-full md:w-24"
            >
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </select>
            
            <button 
              type="button"
              onClick={exportAllZip} 
              disabled={slides.length === 0 || isProcessing} 
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-black uppercase tracking-wider text-xs transition-all shadow-lg min-w-[120px]"
            >
              {isProcessing ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
              <span>EXPORT ALL</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          
          {/* Sources Tab */}
          <div className={`flex-1 overflow-y-auto ${activeTab === 'upload' ? 'block' : 'hidden'}`}>
             <div className="flex flex-col items-center justify-start min-h-full p-4 md:p-8 pt-20 md:pt-32 pb-40 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter">Content Sources.</h2>
                <p className="text-zinc-500 font-medium text-sm md:text-base">Add visuals manually or in bulk to get started.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                <label className="flex flex-col items-center justify-center aspect-square p-6 md:p-8 border-2 border-dashed border-zinc-800 hover:border-purple-500 bg-zinc-900/30 rounded-2xl cursor-pointer group transition-all">
                  <Upload className="w-8 h-8 md:w-12 md:h-12 text-zinc-600 group-hover:text-purple-500 mb-4 transition-colors" />
                  <span className="text-sm md:text-lg font-bold text-white mb-2 uppercase tracking-wide">Images</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                
                <label className="flex flex-col items-center justify-center aspect-square p-6 md:p-8 border-2 border-dashed border-zinc-800 hover:border-cyan-500 bg-zinc-900/30 rounded-2xl cursor-pointer group transition-all">
                  <Layers className="w-8 h-8 md:w-12 md:h-12 text-zinc-600 group-hover:text-cyan-500 mb-4 transition-colors" />
                  <span className="text-sm md:text-lg font-bold text-white mb-2 uppercase tracking-wide">Import CSV</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                </label>
              </div>
              {slides.length > 0 && (
                <div className="w-full max-w-6xl bg-zinc-950 rounded-xl p-4 md:p-6 border border-zinc-900">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Queue ({slides.length})</h3>
                      <button type="button" onClick={clearWorkspace} className="text-red-500 hover:text-red-400 text-xs font-bold flex items-center gap-1"><Trash2 size={14} /> Clear</button>
                   </div>
                   <div className="grid grid-cols-4 md:grid-cols-10 gap-3 overflow-y-auto max-h-64">
                      {slides.map((slide, idx) => (
                        <div key={slide.id} className={`relative aspect-[9/16] bg-zinc-900 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${currentSlideIndex === idx ? 'border-purple-500 scale-105 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'border-transparent'}`} onClick={() => { setCurrentSlideIndex(idx); setActiveTab('design'); }}>
                          <img src={slide.image} className="w-full h-full object-cover opacity-60" />
                          <div className="absolute inset-0 flex items-center justify-center"><span className="text-[10px] font-black text-white/40">{idx + 1}</span></div>
                        </div>
                      ))}
                   </div>
                </div>
              )}
             </div>
          </div>

          {/* Design Tab - Mobile Responsive Layout */}
          <div className={`h-full w-full bg-black ${activeTab === 'design' ? 'flex flex-col lg:flex-row' : 'hidden'}`}>
            {currentSlide ? (
              <>
                {/* Preview Area - Top on Mobile, Left on Desktop */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 bg-black min-h-[45vh] lg:min-h-auto border-b lg:border-b-0 border-zinc-900">
                  <SlidePreview 
                    slide={currentSlide} 
                    aspectRatio={aspectRatio} 
                    onPositionChange={(x, y) => {
                      updateCurrentSlide({ 
                        settings: { 
                          ...currentSlide.settings, 
                          positionX: x, 
                          positionY: y 
                        } 
                      });
                    }}
                  />
                  <div className="mt-4 md:mt-8 flex items-center gap-4 bg-zinc-950 p-2 rounded-full border border-zinc-900 shadow-2xl scale-90 md:scale-100">
                    <button type="button" onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))} disabled={currentSlideIndex === 0} className="p-3 text-white hover:bg-zinc-800 rounded-full disabled:opacity-20 transition-all"><Play className="rotate-180" size={24} fill="currentColor" /></button>
                    <span className="text-xs font-black text-zinc-500 w-24 text-center">{currentSlideIndex + 1} / {slides.length}</span>
                    <button type="button" onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))} disabled={currentSlideIndex === slides.length - 1} className="p-3 text-white hover:bg-zinc-800 rounded-full disabled:opacity-20 transition-all"><Play size={24} fill="currentColor" /></button>
                  </div>
                </div>
                
                {/* Controls Area - Bottom on Mobile, Right on Desktop */}
                <div className="w-full lg:w-[420px] h-full lg:h-full bg-zinc-950 border-t lg:border-t-0 lg:border-l border-zinc-900 overflow-y-auto shadow-2xl overscroll-contain">
                  <Controls key="stable-controls" slide={currentSlide} globalSettings={globalSettings} globalEffects={globalEffects} setGlobalSettings={setGlobalSettings} setGlobalEffects={setGlobalEffects} onUpdate={updateCurrentSlide} onApplyAll={applyGlobalToAll} onDelete={() => deleteSlide(currentSlideIndex)} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 font-bold uppercase tracking-widest">No slides.</div>
            )}
          </div>

          {/* Preview Tab (Enhanced with Selection and Manual Downloads) */}
          <div className={`h-full w-full overflow-y-auto p-4 md:p-12 bg-black ${activeTab === 'preview' ? 'block' : 'hidden'}`}>
             <div className="max-w-7xl mx-auto pb-20">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-zinc-900 pb-8">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter">Final Production</h2>
                    <p className="text-zinc-500 text-sm">Manual review and custom export options.</p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                      <button onClick={selectAll} className="px-3 py-1.5 text-[10px] font-black text-zinc-400 hover:text-white uppercase tracking-widest transition-all">Select All</button>
                      <button onClick={deselectAll} className="px-3 py-1.5 text-[10px] font-black text-zinc-400 hover:text-white uppercase tracking-widest transition-all border-l border-zinc-800">Deselect</button>
                    </div>
                    <button 
                      onClick={downloadSelectedSlides}
                      disabled={selectedSlideIds.size === 0 || isProcessing}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 text-white px-6 py-3 rounded-xl font-black transition-all shadow-xl text-xs uppercase tracking-widest"
                    >
                      {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                      Download Selected ({selectedSlideIds.size})
                    </button>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                  {slides.map((slide, idx) => {
                    const isSelected = selectedSlideIds.has(slide.id);
                    return (
                      <div key={slide.id} className="group relative space-y-3">
                         {/* Selection Overlay Checkbox */}
                         <button 
                            onClick={() => toggleSlideSelection(slide.id)}
                            className={`absolute top-2 right-2 md:top-4 md:right-4 z-20 p-2 rounded-full transition-all border-2 ${isSelected ? 'bg-purple-600 border-white text-white' : 'bg-black/60 border-zinc-700 text-zinc-400 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
                         >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                         </button>

                         <div 
                           className={`relative rounded-2xl overflow-hidden border-2 shadow-2xl transition-all ${isSelected ? 'border-purple-500 scale-[1.02] ring-2 md:ring-4 ring-purple-600/20' : 'border-zinc-800 grayscale-[0.3] hover:grayscale-0'}`}
                           onClick={() => toggleSlideSelection(slide.id)}
                         >
                            <SlidePreview slide={slide} aspectRatio={aspectRatio} />
                            
                            {/* Hover Action Menu */}
                            <div className="absolute inset-x-0 bottom-0 p-2 md:p-4 bg-gradient-to-t from-black/80 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all flex justify-end gap-2">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); downloadSingleSlide(slide, idx); }}
                                 className="p-2 md:p-2.5 bg-zinc-900/80 hover:bg-white hover:text-black rounded-lg text-white transition-all shadow-lg"
                                 title="Download Image"
                               >
                                 <Download size={16} />
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); deleteSlide(idx); }}
                                 className="p-2 md:p-2.5 bg-red-900/80 hover:bg-red-600 rounded-lg text-white transition-all shadow-lg"
                                 title="Delete Slide"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                         </div>
                         
                         <div className="flex justify-between items-center px-1 md:px-2">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Slide {idx + 1}</span>
                              <span className="text-[8px] text-zinc-500 font-mono truncate max-w-[80px] md:max-w-[120px]">{slide.id}</span>
                           </div>
                           <button 
                            type="button" 
                            onClick={() => {
                              setCurrentSlideIndex(idx);
                              setActiveTab('design');
                            }} 
                            className="text-[10px] font-black text-purple-500 hover:text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 md:px-3 py-1.5 rounded-lg border border-purple-500/20"
                           >
                              Edit
                           </button>
                         </div>
                      </div>
                    );
                  })}
               </div>
               
               {slides.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-32 text-zinc-700">
                    <Play size={48} className="mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest text-sm italic">Queue is currently empty</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </main>
      
      <footer className="px-4 md:px-6 py-2 bg-zinc-950 border-t border-zinc-900 text-[10px] text-zinc-600 uppercase tracking-widest flex justify-between items-center">
        <div className="flex gap-2 md:gap-4">
          <span className="hidden md:inline">Storage: Optimized</span>
          <span>Theme: Ultra Dark Purple</span>
          <span className="text-purple-500/80">Sel: {selectedSlideIds.size}</span>
        </div>
        <div className="hidden md:block">
          TikTok Slides Maker &copy; 2025
        </div>
      </footer>
    </div>
  );
};

export default App;