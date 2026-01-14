import React, { memo, useState } from 'react';
import { 
  Type, Move, Trash2, AlignLeft, AlignCenter, AlignRight, Moon, ChevronUp, ChevronDown, Circle, CheckSquare, Square, GripVertical, Sliders, ArrowUp, ArrowDown, Lock, Plus, Sparkles, RefreshCw
} from 'lucide-react';
import { SlideData, TextSettings, ImageEffects, SlideTextLayer } from '../types';

interface ControlsProps {
  slide: SlideData;
  globalSettings: TextSettings;
  globalEffects: ImageEffects;
  setGlobalSettings: (s: TextSettings) => void;
  setGlobalEffects: (e: ImageEffects) => void;
  onUpdate: (updates: Partial<SlideData>) => void;
  onApplyAll: () => void;
  onDelete: () => void;
}

const FONTS = [
  { name: 'TikTok Sans', value: 'TikTok Sans' },
  { name: 'Anton (Impact)', value: 'Anton' },
  { name: 'Oswald', value: 'Oswald' },
  { name: 'Montserrat', value: 'Montserrat' },
  { name: 'Poppins', value: 'Poppins' },
  { name: 'Inter', value: 'Inter' }
];

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="p-5 border-b border-white/5 space-y-4">
    <div className="flex items-center gap-2 mb-2">
      <div className="text-purple-400">{icon}</div>
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{title}</h3>
    </div>
    {children}
  </div>
);

// Enhanced Toggle Switch Component
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button 
    onClick={onChange}
    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 border focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
      checked 
        ? 'bg-purple-600 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
        : 'bg-zinc-900 border-white/10 hover:border-white/20 hover:bg-zinc-800'
    }`}
    type="button"
  >
    <div 
      className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 cubic-bezier(0.4, 0.0, 0.2, 1) ${
        checked ? 'translate-x-6' : 'translate-x-0 bg-zinc-400'
      }`} 
    />
  </button>
);

const Controls: React.FC<ControlsProps> = ({ 
  slide, onUpdate, onApplyAll, onDelete, setGlobalSettings, setGlobalEffects
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    const parent = target.closest('.layer-card') as HTMLElement;
    if (parent) parent.style.opacity = '0.4';
  };

  const onDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    const parent = (e.target as HTMLElement).closest('.layer-card') as HTMLElement;
    if (parent) parent.style.opacity = '1';
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newLayers = [...slide.layers];
    const draggedItem = newLayers[draggedIndex];
    newLayers.splice(draggedIndex, 1);
    newLayers.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    onUpdate({ layers: newLayers });
  };

  const toggleLayerSelection = (id: string) => {
    onUpdate({ 
      layers: slide.layers.map(l => l.id === id ? { ...l, selected: !l.selected } : l) 
    });
  };

  const updateSelectedLayersPosition = (key: 'x' | 'y', value: number) => {
    const hasSelection = slide.layers.some(l => l.selected);
    onUpdate({
      layers: slide.layers.map(l => {
        if (hasSelection) {
          return l.selected ? { ...l, [key]: value } : l;
        }
        return { ...l, [key]: value }; 
      })
    });
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
    const newLayers = [...slide.layers];
    if (direction === 'up' && index > 0) {
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    } else if (direction === 'down' && index < newLayers.length - 1) {
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    }
    onUpdate({ layers: newLayers });
  };

  const selectedLayers = slide.layers.filter(l => l.selected);
  const displayX = selectedLayers.length === 1 ? selectedLayers[0].x : slide.layers[0]?.x || 50;
  const displayY = selectedLayers.length === 1 ? selectedLayers[0].y : slide.layers[0]?.y || 50;
  const hasSelectedLayer = selectedLayers.length > 0;

  return (
    <div className="flex flex-col select-none pb-20 overscroll-contain text-slate-300">
      
      {/* 2. TYPOGRAPHY */}
      <Section title="Layers & Text" icon={<Type size={16} />}>
        <div className="space-y-4">
          <div className="space-y-3">
            {slide.layers.map((layer, idx) => (
              <div 
                key={layer.id} 
                onDragOver={(e) => onDragOver(e, idx)}
                className={`layer-card p-3 rounded-xl border transition-all space-y-3 group cursor-default relative backdrop-blur-md ${layer.selected ? 'border-purple-500/40 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.05)]' : 'border-white/5 bg-black/40 hover:border-white/10 hover:bg-black/60'} ${draggedIndex === idx ? 'scale-[0.98]' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 flex-1 mr-2">
                    <div 
                      draggable
                      onDragStart={(e) => onDragStart(e, idx)}
                      onDragEnd={onDragEnd}
                      className="cursor-grab active:cursor-grabbing text-zinc-600 group-hover:text-zinc-400 transition-colors"
                    >
                      <GripVertical size={14} />
                    </div>
                    
                    <button 
                      onClick={() => toggleLayerSelection(layer.id)}
                      className={`shrink-0 transition-colors ${layer.selected ? 'text-purple-400' : 'text-zinc-600'}`}
                    >
                      {layer.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <div className="relative flex-1 group/name">
                      <input 
                        type="text"
                        value={layer.customName || `Layer ${idx + 1}`}
                        onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, customName: e.target.value} : l) })}
                        className="bg-transparent text-[10px] font-black text-purple-400 uppercase outline-none focus:text-white border-b border-transparent focus:border-purple-500/50 w-full placeholder-zinc-700 tracking-wider"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                     <button onClick={() => moveLayer(idx, 'up')} disabled={idx === 0} className="text-zinc-600 hover:text-white disabled:opacity-20 p-1"><ArrowUp size={12} /></button>
                     <button onClick={() => moveLayer(idx, 'down')} disabled={idx === slide.layers.length - 1} className="text-zinc-600 hover:text-white disabled:opacity-20 p-1"><ArrowDown size={12} /></button>
                     {slide.layers.length > 1 && (
                      <button 
                        onClick={() => onUpdate({ layers: slide.layers.filter(l => l.id !== layer.id) })} 
                        className="text-zinc-600 hover:text-red-500 transition-colors shrink-0 p-1 ml-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {layer.selected && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                          value={layer.fontFamily || slide.settings.fontFamily} 
                          onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, fontFamily: e.target.value} : l) })}
                          className="w-full bg-black/50 text-white pl-3 pr-8 py-2 rounded-lg border border-white/10 text-[10px] font-bold outline-none appearance-none cursor-pointer focus:border-purple-500 hover:bg-white/5 transition-colors"
                        >
                          {FONTS.map(f => <option key={f.value} value={f.value} className="bg-zinc-900 text-white">{f.name}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                      <button 
                        onClick={() => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, uppercase: !l.uppercase} : l) })}
                        className={`px-3 rounded-lg border text-[10px] font-bold transition-all ${layer.uppercase ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black/50 border-white/10 text-zinc-500 hover:text-white'}`}
                        title="Toggle All Caps"
                      >
                        TT
                      </button>
                    </div>
                    
                    <div className="space-y-2 px-1">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Size</span>
                          <span className="text-[9px] font-mono text-white">{layer.fontSize || 60}px</span>
                        </div>
                        <input 
                          type="range" min="12" max="300" step="1"
                          value={layer.fontSize || 60} 
                          onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, fontSize: Number(e.target.value)} : l) })}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Width Limit</span>
                          <span className="text-[9px] font-mono text-white">{layer.width || 100}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" step="1"
                          value={layer.width || 100} 
                          onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, width: Number(e.target.value)} : l) })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block">Line Height</label>
                            <input 
                              type="range" min="0.8" max="2.0" step="0.05"
                              value={layer.lineHeight || 1.15} 
                              onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, lineHeight: Number(e.target.value)} : l) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block">Spacing</label>
                            <input 
                              type="range" min="-5" max="20" step="1"
                              value={layer.letterSpacing || 0} 
                              onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, letterSpacing: Number(e.target.value)} : l) })}
                            />
                          </div>
                      </div>

                      {/* STROKE CONTROLS */}
                      <div className="space-y-2 pt-3 border-t border-white/5 mt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Outline</label>
                          <div className="flex items-center gap-2">
                            {layer.stroke && (
                              <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/20 shadow-sm">
                                <input 
                                  type="color" 
                                  value={layer.strokeColor || '#000000'}
                                  onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, strokeColor: e.target.value} : l) })}
                                  className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 border-none cursor-pointer"
                                />
                              </div>
                            )}
                            <ToggleSwitch 
                              checked={!!layer.stroke} 
                              onChange={() => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, stroke: !l.stroke, strokeWidth: l.strokeWidth || 4, strokeColor: l.strokeColor || '#000000' } : l) })}
                            />
                          </div>
                        </div>
                        
                        {layer.stroke && (
                          <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-bold text-zinc-500 uppercase">Thickness</span>
                                <span className="text-[8px] font-mono text-white">{layer.strokeWidth}px</span>
                            </div>
                            <input 
                              type="range" min="1" max="20" step="0.5"
                              value={layer.strokeWidth || 4} 
                              onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, strokeWidth: Number(e.target.value)} : l) })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Individual Alignment Controls */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5 mt-2">
                  <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10 flex-1">
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button 
                        key={align} 
                        onClick={() => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, alignment: align} : l) })} 
                        className={`flex-1 flex justify-center py-1 rounded-md transition-all ${ (layer.alignment || 'center') === align ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}
                      >
                        {align === 'left' ? <AlignLeft size={12} /> : align === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea 
                  rows={4}
                  className="w-full bg-black/30 text-white p-2.5 rounded-lg text-xs font-bold resize-none border border-white/5 focus:border-purple-500/50 outline-none placeholder-zinc-700"
                  value={layer.content}
                  placeholder="Enter text content..."
                  onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, content: e.target.value} : l) })}
                />
              </div>
            ))}
            <button 
              onClick={() => onUpdate({ 
                layers: [...slide.layers, { 
                  id: Math.random().toString(), 
                  type: 'body', 
                  content: 'New Text', 
                  fontSize: 60, 
                  x: 50, 
                  y: 50,
                  width: 100,
                  selected: false,
                  alignment: 'center',
                  lineHeight: 1.15,
                  letterSpacing: 0,
                  uppercase: false
                }] 
              })} 
              className="w-full py-3 border border-dashed border-zinc-700 hover:border-purple-500 bg-black/20 hover:bg-purple-900/10 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-purple-400 transition-all flex items-center justify-center gap-2 group"
            >
              <Plus size={14} className="group-hover:scale-110 transition-transform"/> Add Text Layer
            </button>
          </div>
          
          <div className="pt-2">
             <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Global Text Scale</label>
                  <span className="text-[9px] font-mono text-purple-400">{slide.settings.fontSize}%</span>
                </div>
                <input type="range" min="10" max="300" value={slide.settings.fontSize} onChange={(e) => onUpdate({ settings: { ...slide.settings, fontSize: Number(e.target.value) } })} />
              </div>
          </div>
        </div>
      </Section>

      {/* 3. POSITIONING */}
      <Section title="Layout" icon={<Move size={16} />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
             <div className="flex items-center gap-2">
               <Lock size={12} className="text-zinc-500" />
               <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Constrain to Slide</label>
             </div>
             <ToggleSwitch 
               checked={!!slide.settings.constrainToSlide} 
               onChange={() => onUpdate({ settings: { ...slide.settings, constrainToSlide: !slide.settings.constrainToSlide } })}
             />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
                <label className="text-[9px] font-black text-zinc-500 block uppercase tracking-wider">X Position</label>
                <span className="text-[9px] font-mono text-white">{displayX.toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="100" step="0.1" value={displayX} onChange={(e) => updateSelectedLayersPosition('x', Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
                <label className="text-[9px] font-black text-zinc-500 block uppercase tracking-wider">Y Position</label>
                <span className="text-[9px] font-mono text-white">{displayY.toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="100" step="0.1" value={displayY} onChange={(e) => updateSelectedLayersPosition('y', Number(e.target.value))} />
          </div>
        </div>
      </Section>

      {/* 4. TEXT EFFECTS */}
      <Section title="Effects" icon={<Moon size={16} />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Drop Shadow</label>
            <ToggleSwitch 
              checked={slide.settings.shadow} 
              onChange={() => onUpdate({ settings: { ...slide.settings, shadow: !slide.settings.shadow } })}
            />
          </div>
          {slide.settings.shadow && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 p-3 bg-black/30 rounded-lg border border-white/5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider">Blur Radius</label>
                <input type="range" min="0" max="100" step="1" value={slide.settings.shadowBlur} onChange={(e) => onUpdate({ settings: { ...slide.settings, shadowBlur: Number(e.target.value) } })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider">Opacity</label>
                <input type="range" min="0" max="100" step="1" value={slide.settings.shadowOpacity || 80} onChange={(e) => onUpdate({ settings: { ...slide.settings, shadowOpacity: Number(e.target.value) } })} />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 5. IMAGE FILTERS */}
      <Section title="Image Filters" icon={<Sliders size={16} />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Enable Filters</label>
            <ToggleSwitch 
              checked={slide.effects.enabled} 
              onChange={() => onUpdate({ effects: { ...slide.effects, enabled: !slide.effects.enabled } })}
            />
          </div>
          
          {slide.effects.enabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 p-3 bg-black/30 rounded-lg border border-white/5">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Brightness</label>
                  <button onClick={() => onUpdate({ effects: { ...slide.effects, brightness: 100 } })} className="text-[8px] font-bold text-zinc-500 hover:text-white uppercase">Reset</button>
                </div>
                <input type="range" min="0" max="200" value={slide.effects.brightness} onChange={(e) => onUpdate({ effects: { ...slide.effects, brightness: Number(e.target.value) } })} />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Contrast</label>
                  <button onClick={() => onUpdate({ effects: { ...slide.effects, contrast: 100 } })} className="text-[8px] font-bold text-zinc-500 hover:text-white uppercase">Reset</button>
                </div>
                <input type="range" min="0" max="200" value={slide.effects.contrast} onChange={(e) => onUpdate({ effects: { ...slide.effects, contrast: Number(e.target.value) } })} />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Saturation</label>
                  <button onClick={() => onUpdate({ effects: { ...slide.effects, saturation: 100 } })} className="text-[8px] font-bold text-zinc-500 hover:text-white uppercase">Reset</button>
                </div>
                <input type="range" min="0" max="200" value={slide.effects.saturation ?? 100} onChange={(e) => onUpdate({ effects: { ...slide.effects, saturation: Number(e.target.value) } })} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">B&W Mode</label>
                <ToggleSwitch 
                  checked={slide.effects.grayscale} 
                  onChange={() => onUpdate({ effects: { ...slide.effects, grayscale: !slide.effects.grayscale } })}
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      <div className="p-5 space-y-3">
        <button onClick={() => { setGlobalSettings(slide.settings); setGlobalEffects(slide.effects); onApplyAll(); }} className="w-full py-3 bg-zinc-800/50 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/5 transition-all shadow-lg backdrop-blur-sm">Apply Styles to All</button>
        <button onClick={onDelete} className="w-full py-3 bg-red-950/20 hover:bg-red-950/40 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-red-900/30 transition-all backdrop-blur-sm hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]">Remove Slide</button>
      </div>
    </div>
  );
};

export default memo(Controls);