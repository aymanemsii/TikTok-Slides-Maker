import React, { memo } from 'react';
import { 
  Type, Move, Trash2, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { SlideData, TextSettings, ImageEffects } from '../types';

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
  <div className="p-6 border-b border-zinc-900 space-y-4">
    <div className="flex items-center gap-2 mb-2">
      <div className="text-purple-500">{icon}</div>
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{title}</h3>
    </div>
    {children}
  </div>
);

const Controls: React.FC<ControlsProps> = ({ 
  slide, onUpdate, onApplyAll, onDelete, setGlobalSettings, setGlobalEffects
}) => {
  
  const handleAlignmentChange = (align: 'left' | 'center' | 'right') => {
    // With the new EDGE-BOUNDED system in SlidePreview:
    // positionX: 0   -> Snap to left safe edge
    // positionX: 50  -> Snap to horizontal center
    // positionX: 100 -> Snap to right safe edge
    let targetX = 50;
    if (align === 'left') targetX = 0;
    if (align === 'right') targetX = 100;

    onUpdate({ settings: { ...slide.settings, alignment: align, positionX: targetX } });
  };

  return (
    <div className="flex flex-col select-none pb-20">
      <Section title="Typography" icon={<Type size={18} />}>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-600 mb-2 block uppercase tracking-wider">Font Family</label>
            <select 
              value={slide.settings.fontFamily} 
              onChange={(e) => onUpdate({ settings: { ...slide.settings, fontFamily: e.target.value } })}
              className="w-full bg-zinc-900 text-white p-3 rounded-xl border border-zinc-800 text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            {slide.layers.map((layer, idx) => (
              <div key={layer.id} className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 space-y-3 group">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-purple-500 uppercase">Text Layer {idx + 1}</span>
                  {slide.layers.length > 1 && (
                    <button onClick={() => onUpdate({ layers: slide.layers.filter(l => l.id !== layer.id) })} className="text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                  )}
                </div>
                <textarea 
                  rows={2}
                  className="w-full bg-black text-white p-2 rounded-lg text-xs font-bold resize-none border border-transparent focus:border-purple-500/50 outline-none"
                  value={layer.content}
                  onChange={(e) => onUpdate({ layers: slide.layers.map(l => l.id === layer.id ? {...l, content: e.target.value} : l) })}
                />
              </div>
            ))}
            <button onClick={() => onUpdate({ layers: [...slide.layers, { id: Math.random().toString(), type: 'body', content: 'New Text' }] })} className="w-full py-2 border-2 border-dashed border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:border-purple-500 hover:text-white transition-all">+ Add Layer</button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-black text-zinc-600 mb-2 block uppercase tracking-wider">Size ({slide.settings.fontSize}px)</label>
              <input type="range" min="12" max="250" value={slide.settings.fontSize} onChange={(e) => onUpdate({ settings: { ...slide.settings, fontSize: Number(e.target.value) } })} className="w-full" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-zinc-600 mb-2 block uppercase tracking-wider">Align</label>
              <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                {(['left', 'center', 'right'] as const).map(a => (
                  <button key={a} onClick={() => handleAlignmentChange(a)} className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${slide.settings.alignment === a ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                    {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Positioning" icon={<Move size={18} />}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-600 block uppercase tracking-wider">X-Pos ({slide.settings.positionX.toFixed(0)}%)</label>
            <input type="range" min="0" max="100" step="0.1" value={slide.settings.positionX} onChange={(e) => onUpdate({ settings: { ...slide.settings, positionX: Number(e.target.value) } })} className="w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-600 block uppercase tracking-wider">Y-Pos ({slide.settings.positionY.toFixed(0)}%)</label>
            <input type="range" min="0" max="100" step="0.1" value={slide.settings.positionY} onChange={(e) => onUpdate({ settings: { ...slide.settings, positionY: Number(e.target.value) } })} className="w-full" />
          </div>
        </div>
      </Section>

      <div className="p-6 space-y-3">
        <button onClick={() => { setGlobalSettings(slide.settings); setGlobalEffects(slide.effects); onApplyAll(); }} className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] border border-zinc-800 transition-all hover:scale-[1.02] active:scale-95">Apply to All Slides</button>
        <button onClick={onDelete} className="w-full py-4 bg-red-950/10 hover:bg-red-950/30 text-red-500 rounded-xl text-xs font-black uppercase tracking-[0.2em] border border-red-900/20 transition-all">Remove Slide</button>
      </div>
    </div>
  );
};

export default memo(Controls);