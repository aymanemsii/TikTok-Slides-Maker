import React, { useMemo, useRef, useState, useEffect } from 'react';
import { SlideData, AspectRatio } from '../types';

interface SlidePreviewProps {
  slide: SlideData;
  aspectRatio: AspectRatio;
  onPositionChange?: (x: number, y: number) => void;
  onUpdateSettings?: (settings: any) => void;
}

const PREVIEW_WIDTHS = { '9:16': 320, '1:1': 400, '16:9': 600 };
const PREVIEW_HEIGHTS = { '9:16': 569, '1:1': 400, '16:9': 338 };

const SlidePreview: React.FC<SlidePreviewProps> = ({ slide, aspectRatio, onPositionChange, onUpdateSettings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const width = PREVIEW_WIDTHS[aspectRatio];
  const height = PREVIEW_HEIGHTS[aspectRatio];
  const fontScaleFactor = width / 1000;

  const dragStartRef = useRef<{ 
    x: number; y: number; initialX: number; initialY: number;
  } | null>(null);

  const layout = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { layers: [], totalHeight: 0, maxLineWidth: 0, needsShrink: false };
    
    const layersData: any[] = [];
    let totalHeight = 0;
    let maxW = 0;
    let needsShrink = false;

    slide.layers.forEach((layer) => {
      let baseSize = layer.fontSize || (layer.type === 'heading' ? slide.settings.fontSize * 1.5 : slide.settings.fontSize);
      let size = Math.max(12, baseSize) * fontScaleFactor;
      const weight = layer.type === 'heading' ? 900 : 600;
      ctx.font = `${weight} ${size}px "${layer.fontFamily || slide.settings.fontFamily}", sans-serif`;
      
      const content = layer.type === 'heading' ? layer.content.toUpperCase() : layer.content;
      const lines: string[] = [];
      
      content.split('\n').forEach(p => {
        const words = p.split(' ');
        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
          if (ctx.measureText(currentLine + " " + words[i]).width < width) {
            currentLine += " " + words[i];
          } else {
            lines.push(currentLine);
            maxW = Math.max(maxW, ctx.measureText(currentLine).width);
            currentLine = words[i];
          }
        }
        lines.push(currentLine);
        maxW = Math.max(maxW, ctx.measureText(currentLine).width);
      });

      if (maxW > width) needsShrink = true;
      
      const lineHeight = size * 1.15;
      const h = lines.length * lineHeight;
      const gap = (slide.settings.fontSize * fontScaleFactor) * 0.15;
      layersData.push({ ...layer, lines, lineHeight, size, weight, height: h, gap });
      totalHeight += h + gap;
    });
    
    if (layersData.length > 0) totalHeight -= layersData[layersData.length - 1].gap;
    return { layers: layersData, totalHeight, maxLineWidth: maxW, needsShrink };
  }, [slide, width, fontScaleFactor]);

  useEffect(() => {
    if (layout.needsShrink && onUpdateSettings) {
      onUpdateSettings({ fontSize: Math.max(10, slide.settings.fontSize - 1) });
    }
  }, [layout.needsShrink, slide.settings.fontSize, onUpdateSettings]);

  // Map 0-100% to (0 to slideWidth - textWidth)
  const getRenderPos = (pctX: number, pctY: number) => {
    const maxX = Math.max(0, width - layout.maxLineWidth);
    const bottomBound = aspectRatio === '9:16' ? 0.88 : 1; // TikTok safe area
    const maxY = Math.max(0, (height * bottomBound) - layout.totalHeight);

    return {
      x: (pctX / 100) * maxX,
      y: (pctY / 100) * maxY
    };
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragStartRef.current || !containerRef.current || !onPositionChange) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;
    
    let nx = Math.max(0, Math.min(100, dragStartRef.current.initialX + dx));
    let ny = Math.max(0, Math.min(100, dragStartRef.current.initialY + dy));

    if (Math.abs(nx - 50) < 1.0) nx = 50;
    onPositionChange(nx, ny);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onPositionChange || !containerRef.current) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { 
      x: e.clientX, y: e.clientY, 
      initialX: slide.settings.positionX, initialY: slide.settings.positionY 
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const { x: blockLeft, y: blockTop } = getRenderPos(slide.settings.positionX, slide.settings.positionY);

  return (
    <div ref={containerRef} 
         className="relative bg-black shadow-2xl ring-1 ring-zinc-800 select-none overflow-hidden p-0 m-0" 
         style={{ aspectRatio: aspectRatio.replace(':', '/'), width: '100%', maxWidth: width }}>
      <img src={slide.image} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ 
        filter: slide.effects.enabled ? `grayscale(${slide.effects.grayscale ? 1 : 0}) brightness(${slide.effects.brightness}%) contrast(${slide.effects.contrast}%)` : 'none',
        objectPosition: `${slide.effects.imageOffset}% ${slide.effects.imageOffsetY}%`
      }} alt="" />
      
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 z-10 overflow-visible" onPointerDown={handlePointerDown} style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
        <defs>
          <filter id={`sh-${slide.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx={0} dy={2 * fontScaleFactor} stdDeviation={8 * fontScaleFactor} floodOpacity="0.8" />
          </filter>
        </defs>
        <g style={{ filter: slide.settings.shadow ? `url(#sh-${slide.id})` : 'none' }}>
          {layout.layers.reduce<{ nodes: React.ReactNode[], currentY: number }>((acc, layer) => {
            const node = (
              <text 
                key={layer.id} 
                x={blockLeft} 
                y={acc.currentY} 
                fill={slide.settings.color} 
                stroke={slide.settings.strokeColor} 
                strokeWidth={slide.settings.strokeWidth * fontScaleFactor * 1.5} 
                paintOrder="stroke" 
                style={{ 
                  fontFamily: `"${layer.fontFamily || slide.settings.fontFamily}", sans-serif`, 
                  fontWeight: layer.weight, 
                  fontSize: `${layer.size}px`, 
                  dominantBaseline: 'hanging' 
                }}
              >
                {layer.lines.map((line: string, i: number) => {
                  // Calculate X for internal alignment within the block
                  let lineX = blockLeft;
                  let anchor: 'start' | 'middle' | 'end' = 'start';
                  if (slide.settings.alignment === 'center') {
                    lineX = blockLeft + (layout.maxLineWidth / 2);
                    anchor = 'middle';
                  } else if (slide.settings.alignment === 'right') {
                    lineX = blockLeft + layout.maxLineWidth;
                    anchor = 'end';
                  }

                  return (
                    <tspan key={i} x={lineX} dy={i === 0 ? 0 : layer.lineHeight} textAnchor={anchor}>
                      {line}
                    </tspan>
                  );
                })}
              </text>
            );
            return { nodes: [...acc.nodes, node], currentY: acc.currentY + layer.height + layer.gap };
          }, { nodes: [], currentY: blockTop }).nodes}
        </g>
      </svg>
    </div>
  );
};

export default SlidePreview;