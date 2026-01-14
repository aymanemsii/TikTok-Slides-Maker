import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { SlideData, AspectRatio, SlideTextLayer } from '../types';

interface SlidePreviewProps {
  slide: SlideData;
  aspectRatio: AspectRatio;
  zoom?: number;
  onPositionChange?: (layers: SlideTextLayer[]) => void;
}

const SlidePreview: React.FC<SlidePreviewProps> = ({ slide, aspectRatio, zoom = 1, onPositionChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [showSnapX, setShowSnapX] = useState(false);
  const [showSnapY, setShowSnapY] = useState(false);

  // Interaction State
  const [activeOperation, setActiveOperation] = useState<'none' | 'drag' | 'resize'>('none');
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Refs for Event Handlers to avoid stale closures
  const slideRef = useRef(slide);
  const onPositionChangeRef = useRef(onPositionChange);
  const dimsRef = useRef(dims);
  
  // Layout Ref to access calculated dimensions during drag without recalculating
  const layoutRef = useRef<{ layers: any[] }>({ layers: [] });

  // MUTABLE INTERACTION REF - Stores truth for the active drag operation
  const interactionRef = useRef<{ 
    startX: number; 
    startY?: number;
    initialPositions: Map<string, { x: number, y: number }>;
    // Stores the pixel position of the edge OPPOSITE to the one being dragged
    fixedOppositeEdgePx?: number; 
    operation: 'drag' | 'resize';
    layerId: string;
    handleSide?: 'left' | 'right';
  } | null>(null);

  // Keep Refs updated
  useEffect(() => { slideRef.current = slide; }, [slide]);
  useEffect(() => { onPositionChangeRef.current = onPositionChange; }, [onPositionChange]);
  useEffect(() => { dimsRef.current = dims; }, [dims]);

  // Keyboard Shortcuts (Delete & Nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentSlide = slideRef.current;
      const selectedLayers = currentSlide.layers.filter(l => l.selected);
      if (selectedLayers.length === 0 || !onPositionChangeRef.current) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const remaining = currentSlide.layers.filter(l => !l.selected);
        onPositionChangeRef.current(remaining);
        return;
      }

      const shiftMultiplier = e.shiftKey ? 2.0 : 0.2; // 2% with shift, 0.2% without
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -shiftMultiplier;
      if (e.key === 'ArrowRight') dx = shiftMultiplier;
      if (e.key === 'ArrowUp') dy = -shiftMultiplier;
      if (e.key === 'ArrowDown') dy = shiftMultiplier;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const newLayers = currentSlide.layers.map(l => {
          if (l.selected) {
            return {
              ...l,
              x: Math.max(0, Math.min(100, l.x + dx)),
              y: Math.max(0, Math.min(100, l.y + dy))
            };
          }
          return l;
        });
        onPositionChangeRef.current(newLayers);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dimension Observer
  const updateDims = useCallback(() => {
    if (containerRef.current) {
      // Use offsetWidth/offsetHeight to get the layout size ignoring transforms (scale)
      const { offsetWidth, offsetHeight } = containerRef.current;
      if (offsetWidth > 0 && offsetHeight > 0) {
        setDims({ width: offsetWidth, height: offsetHeight });
      }
    }
  }, []);

  useEffect(() => {
    updateDims();
    const observer = new ResizeObserver(() => requestAnimationFrame(updateDims));
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', updateDims);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDims);
    };
  }, [aspectRatio, updateDims]);

  const fontScaleFactor = dims.width / 1000;
  const globalScale = (slide.settings.fontSize || 100) / 100;

  // Layout Calculation
  const layout = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || dims.width <= 0) return { layers: [] };
    
    const layers = slide.layers.map((layer) => {
      let baseSize = layer.fontSize || 60;
      let size = baseSize * globalScale * fontScaleFactor;
      const weight = layer.type === 'heading' ? 900 : 600;
      ctx.font = `${weight} ${size}px "${layer.fontFamily || slide.settings.fontFamily}", sans-serif`;
      
      // Attempt to support letter spacing in measurement if supported
      // @ts-ignore
      if (ctx.letterSpacing) ctx.letterSpacing = `${(layer.letterSpacing || 0) * fontScaleFactor}px`;

      const content = layer.uppercase ? layer.content.toUpperCase() : layer.content;
      const lines: string[] = [];
      // Standardize default width to 80% if missing
      const widthPercent = layer.width || 80;
      const maxAllowedWidthPx = (widthPercent / 100) * dims.width;
      
      let actualMaxLineWidth = 0;
      content.split('\n').forEach(p => {
        const words = p.split(/\s+/);
        let currentLine = words[0] || "";
        for (let i = 1; i < words.length; i++) {
          const testLine = currentLine + " " + words[i];
          if (ctx.measureText(testLine).width <= maxAllowedWidthPx) {
            currentLine = testLine;
          } else {
            lines.push(currentLine);
            actualMaxLineWidth = Math.max(actualMaxLineWidth, ctx.measureText(currentLine).width);
            currentLine = words[i];
          }
        }
        lines.push(currentLine);
        actualMaxLineWidth = Math.max(actualMaxLineWidth, ctx.measureText(currentLine).width);
      });
      
      // Use layer specific line height or default
      const lhMultiplier = layer.lineHeight || 1.15;
      const lineHeight = size * lhMultiplier;
      const h = lines.length * lineHeight;

      // STROKE CALC
      let strokeWidth = 0;
      let strokeColor = slide.settings.strokeColor;
      
      if (layer.stroke !== undefined) {
         // Layer specific setting exists
         if (layer.stroke) {
             strokeWidth = (layer.strokeWidth || 4) * fontScaleFactor * 1.5;
             strokeColor = layer.strokeColor || '#000000';
         } else {
             strokeWidth = 0;
         }
      } else {
         // Fallback to global
         strokeWidth = slide.settings.strokeWidth * fontScaleFactor * 1.5;
         strokeColor = slide.settings.strokeColor;
      }
      
      return { 
        ...layer, 
        lines, 
        lineHeight, 
        size, 
        weight, 
        height: h, 
        boundaryWidthPx: maxAllowedWidthPx,
        actualContentWidth: actualMaxLineWidth,
        widthPercent, // store strictly for reference
        strokeWidth,
        strokeColor
      };
    });

    return { layers };
  }, [slide, dims.width, fontScaleFactor, globalScale]);

  // Update layout ref
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // --- Interaction Logic ---

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!interactionRef.current || !containerRef.current || !onPositionChangeRef.current) return;
    
    const { startX, startY, initialPositions, operation, handleSide, layerId, fixedOppositeEdgePx } = interactionRef.current;
    
    const currentSlide = slideRef.current;
    const containerRect = containerRef.current.getBoundingClientRect();
    const computedLayout = layoutRef.current;
    const refDims = dimsRef.current;

    const newLayers = [...currentSlide.layers];

    // --- RESIZE OPERATION ---
    if (operation === 'resize' && fixedOppositeEdgePx !== undefined && handleSide) {
       const layerIndex = newLayers.findIndex(l => l.id === layerId);
       if (layerIndex === -1) return;

       const layer = newLayers[layerIndex];
       
       // Current Pointer Position relative to container
       let pointerX = e.clientX - containerRect.left;

       // 1. Constrain pointer to Canvas Boundaries if Constrain is enabled
       if (currentSlide.settings.constrainToSlide) {
         pointerX = Math.max(0, Math.min(containerRect.width, pointerX));
       }

       let newWidthPx = 0;
       let newCenterPx = 0;
       const minWidthPx = containerRect.width * 0.1; // Min 10% width

       if (handleSide === 'left') {
         // Left is moving, Right is fixed. 
         // Ensure we don't cross the right edge minus min width
         pointerX = Math.min(pointerX, fixedOppositeEdgePx - minWidthPx);
         
         newWidthPx = fixedOppositeEdgePx - pointerX;
         newCenterPx = pointerX + (newWidthPx / 2);
       } else {
         // Right is moving, Left is fixed.
         // Ensure we don't cross the left edge plus min width
         pointerX = Math.max(pointerX, fixedOppositeEdgePx + minWidthPx);

         newWidthPx = pointerX - fixedOppositeEdgePx;
         newCenterPx = fixedOppositeEdgePx + (newWidthPx / 2);
       }
       
       let newWidthPercent = (newWidthPx / containerRect.width) * 100;
       let newXPercent = (newCenterPx / containerRect.width) * 100;

       if (newWidthPercent > 100 && currentSlide.settings.constrainToSlide) newWidthPercent = 100;
       
       newLayers[layerIndex] = { 
         ...layer, 
         width: newWidthPercent,
         x: newXPercent
       };
       
       onPositionChangeRef.current(newLayers);
       return;
    }

    // --- DRAG OPERATION ---
    if (operation === 'drag' && startY !== undefined) {
       // Visual Delta in Percent (Zoom agnostic)
       const rawDx = ((e.clientX - startX) / containerRect.width) * 100;
       const rawDy = ((e.clientY - startY) / containerRect.height) * 100;

       // Simple Snap Logic
       let finalDx = rawDx;
       let finalDy = rawDy;
       let isSnappedX = false;
       let isSnappedY = false;

       // Only calculate snap if one item selected
       if (initialPositions.size === 1) {
          const [id, pos] = initialPositions.entries().next().value;
          const layerLayout = computedLayout.layers.find(ly => ly.id === id);
          
          if (layerLayout) {
             const align = currentSlide.layers.find(ly => ly.id === id)?.alignment || 'center';
             const w = layerLayout.boundaryWidthPx;
             const c = layerLayout.actualContentWidth;
             let offsetPx = 0;

             if (align === 'left') offsetPx = (c - w) / 2;
             else if (align === 'right') offsetPx = (w - c) / 2;
             
             // Convert to reference % to align with snap targets
             // Since we snap to center (50%), the pixels don't matter as much for target,
             // but offset calculation should be consistent.
             const offsetPercent = (offsetPx / refDims.width) * 100;
             const targetX = 50 - offsetPercent;
          
             // Snap threshold 1.5%
             if (Math.abs(pos.x + rawDx - targetX) < 1.5) { 
                finalDx = targetX - pos.x; 
                isSnappedX = true; 
             }
             if (Math.abs(pos.y + rawDy - 50) < 1.5) { 
                finalDy = 50 - pos.y; 
                isSnappedY = true; 
             }
          }
       }
       setShowSnapX(isSnappedX);
       setShowSnapY(isSnappedY);

       initialPositions.forEach((pos: any, id: string) => {
         const idx = newLayers.findIndex(l => l.id === id);
         if (idx !== -1) {
           let targetX = pos.x + finalDx;
           let targetY = pos.y + finalDy;

           // --- CONSTRAIN LOGIC ---
           if (currentSlide.settings.constrainToSlide) {
             const layerLayout = computedLayout.layers.find(ly => ly.id === id);
             const layerState = newLayers[idx];

             // Use Reference Dimensions (Unscaled) for Layout Calculations to match computedLayout
             const refW = refDims.width;
             const refH = refDims.height;

             if (layerLayout && refW > 0 && refH > 0) {
                // 1. Calculate Vertical Constraints
                const paddingPx = 12 * (refW / 1000); 
                const boxHPx = layerLayout.height + (paddingPx * 2);
                const halfHPct = (boxHPx / refH) * 100 / 2;
                
                targetY = Math.max(halfHPct, Math.min(100 - halfHPct, targetY));

                // 2. Calculate Horizontal Constraints
                const displayWPx = layerLayout.actualContentWidth; 
                const boundaryWPx = layerLayout.boundaryWidthPx;
                const alignment = layerState.alignment || 'center';

                let deltaLeftPx = 0;
                let deltaRightPx = 0;

                if (alignment === 'left') {
                    deltaLeftPx = -(boundaryWPx / 2) - paddingPx;
                    deltaRightPx = -(boundaryWPx / 2) + displayWPx + paddingPx;
                } else if (alignment === 'right') {
                    deltaLeftPx = (boundaryWPx / 2) - displayWPx - paddingPx;
                    deltaRightPx = (boundaryWPx / 2) + paddingPx;
                } else {
                    deltaLeftPx = -(displayWPx / 2) - paddingPx;
                    deltaRightPx = (displayWPx / 2) + paddingPx;
                }

                // Convert to percent using Reference Width (Unscaled)
                const deltaLeftPct = (deltaLeftPx / refW) * 100;
                const deltaRightPct = (deltaRightPx / refW) * 100;

                const minX = -deltaLeftPct;
                const maxX = 100 - deltaRightPct;

                targetX = Math.max(minX, Math.min(maxX, targetX));
             }
           }

           newLayers[idx] = { ...newLayers[idx], x: targetX, y: targetY };
         }
       });
       onPositionChangeRef.current(newLayers);
    }
  }, []);

  const handleWindowPointerUp = useCallback(() => {
    setActiveOperation('none');
    setActiveLayerId(null);
    setShowSnapX(false);
    setShowSnapY(false);
    interactionRef.current = null;
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
  }, [handleWindowPointerMove]);

  const handlePointerDown = (e: React.PointerEvent, operation: 'drag' | 'resize', layerId: string, side?: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;

    const currentSlide = slideRef.current;
    const initialPositions = new Map();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    const clickedLayer = currentSlide.layers.find(l => l.id === layerId);
    const isSelected = clickedLayer?.selected;
    
    let fixedOppositeEdgePx: number | undefined;

    if (operation === 'resize' && clickedLayer && side) {
      // Logic for Asymmetric Resize
      // If we grab Left, we lock Right. If we grab Right, we lock Left.
      
      const currentXPx = (clickedLayer.x / 100) * containerRect.width;
      const currentWidthPx = ((clickedLayer.width || 80) / 100) * containerRect.width;
      
      const leftEdgePx = currentXPx - (currentWidthPx / 2);
      const rightEdgePx = currentXPx + (currentWidthPx / 2);

      if (side === 'left') {
        fixedOppositeEdgePx = rightEdgePx;
      } else {
        fixedOppositeEdgePx = leftEdgePx;
      }

      if (!isSelected && onPositionChangeRef.current) {
        const newLayers = currentSlide.layers.map(l => ({ ...l, selected: l.id === layerId }));
        onPositionChangeRef.current(newLayers);
      }
    } else if (operation === 'drag') {
      currentSlide.layers.forEach(l => {
        if (isSelected ? l.selected : l.id === layerId) {
          initialPositions.set(l.id, { x: l.x, y: l.y });
        }
      });
      if (!isSelected && onPositionChangeRef.current) {
          const newLayers = currentSlide.layers.map(l => ({ ...l, selected: l.id === layerId }));
          onPositionChangeRef.current(newLayers);
      }
    }

    interactionRef.current = { 
      startX: e.clientX, 
      startY: e.clientY,
      initialPositions,
      operation,
      layerId,
      handleSide: side,
      fixedOppositeEdgePx
    };

    setActiveOperation(operation);
    setActiveLayerId(layerId);
    
    // Attach global listeners
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
  };

  // Styles
  const containerStyle = useMemo(() => {
    const base: React.CSSProperties = { position: 'relative', backgroundColor: 'black', display: 'block', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', transformOrigin: 'center center', transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out' };
    if (aspectRatio === '9:16') return { ...base, height: '80vh', width: 'calc(80vh * 9/16)' };
    if (aspectRatio === '1:1') return { ...base, width: 'min(70vh, 70vw)', height: 'min(70vh, 70vw)' };
    if (aspectRatio === '16:9') return { ...base, width: 'min(80vw, 800px)', height: 'calc(min(80vw, 800px) * 9/16)' };
    return base;
  }, [aspectRatio, zoom]);

  return (
    <div className="flex-1 w-full h-full flex items-center justify-center p-4 relative overflow-auto bg-transparent custom-scrollbar">
      <div ref={containerRef} style={containerStyle} className="select-none relative touch-none ring-1 ring-white/10 shadow-2xl shrink-0">
        <img 
          src={slide.image} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
          style={{ 
            filter: slide.effects.enabled ? `grayscale(${slide.effects.grayscale ? 1 : 0}) brightness(${slide.effects.brightness}%) contrast(${slide.effects.contrast}%) saturate(${slide.effects.saturation ?? 100}%)` : 'none',
            objectPosition: `${slide.effects.imageOffset}% ${slide.effects.imageOffsetY}%` 
          }} 
          alt="" 
        />
        
        {/* Neon Snap Lines */}
        {showSnapX && <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-purple-500 shadow-[0_0_12px_#a855f7] z-30 pointer-events-none opacity-80" />}
        {showSnapY && <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-purple-500 shadow-[0_0_12px_#a855f7] z-30 pointer-events-none opacity-80" />}

        <svg 
          width="100%" height="100%" viewBox={`0 0 ${dims.width || 100} ${dims.height || 100}`} 
          className="absolute inset-0 z-10 overflow-visible"
        >
          <defs>
            <filter id={`sh-${slide.id}`} x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx={0} dy={4 * fontScaleFactor} stdDeviation={(slide.settings.shadowBlur || 0) * fontScaleFactor / 1.5} floodOpacity={(slide.settings.shadowOpacity || 80) / 100} floodColor={slide.settings.shadowColor || "black"} />
            </filter>
          </defs>

          {layout.layers.map((layer: any) => {
            const centerX = (layer.x / 100) * dims.width;
            const centerY = (layer.y / 100) * dims.height;
            
            // Text alignment & position calculation
            const alignment = layer.alignment || 'center';
            let textX = centerX;
            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
            
            const padding = 12 * fontScaleFactor;
            
            // Determine box dimensions
            const isResizingThis = activeOperation === 'resize' && activeLayerId === layer.id;
            
            const contentW = layer.actualContentWidth;
            const displayW = isResizingThis ? Math.max(contentW, layer.boundaryWidthPx) : contentW;
            
            let boxX = 0;
            const boxW = displayW + (padding * 2);
            
            if (alignment === 'left') {
               textX = centerX - (layer.boundaryWidthPx / 2); // Text starts at left boundary
               textAnchor = 'start';
               boxX = textX - padding;
            } else if (alignment === 'right') {
               textX = centerX + (layer.boundaryWidthPx / 2); // Text ends at right boundary
               textAnchor = 'end';
               boxX = textX - displayW - padding;
            } else {
               // Center
               textX = centerX;
               textAnchor = 'middle';
               boxX = centerX - (displayW / 2) - padding;
            }

            const textAnchorY = centerY - ((layer.lines.length - 1) * layer.lineHeight) / 2;
            const boxH = layer.height + (padding * 2);
            const boxY = centerY - (layer.height / 2) - padding;

            return (
              <g key={layer.id} className="group/layer">
                {/* 1. VISUAL LAYER (Text) */}
                <g style={{ filter: slide.settings.shadow ? `url(#sh-${slide.id})` : 'none' }} className="pointer-events-none">
                  <text 
                    x={textX} 
                    y={textAnchorY} 
                    fill={slide.settings.color} 
                    stroke={layer.strokeColor} 
                    strokeWidth={layer.strokeWidth} 
                    paintOrder="stroke fill"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    letterSpacing={(layer.letterSpacing || 0) * fontScaleFactor}
                    style={{ 
                      fontFamily: `"${layer.fontFamily || slide.settings.fontFamily}", sans-serif`, 
                      fontWeight: layer.weight, 
                      fontSize: `${layer.size}px`, 
                      dominantBaseline: 'central',
                      textAnchor: textAnchor
                    }}
                  >
                    {layer.lines.map((line: string, i: number) => (
                      <tspan key={i} x={textX} dy={i === 0 ? 0 : layer.lineHeight}>{line}</tspan>
                    ))}
                  </text>
                </g>

                {/* 2. DRAG HIT LAYER (Content Only - Transparent but interactive) */}
                <rect 
                  x={boxX} y={boxY} width={boxW} height={boxH} 
                  fill="rgba(255,255,255,0.01)" 
                  className="cursor-grab active:cursor-grabbing pointer-events-auto"
                  onPointerDown={(e) => handlePointerDown(e, 'drag', layer.id)}
                />

                {/* 3. SELECTION UI */}
                {layer.selected && (
                  <g>
                     {/* Dashed Box */}
                    <rect 
                      x={boxX} y={boxY} 
                      width={boxW} height={boxH} 
                      fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="6 4" 
                      className="opacity-70 pointer-events-none filter drop-shadow-[0_0_2px_#a855f7]"
                      rx="6" ry="6"
                    />
                    
                    {/* Visual Handles Group */}
                    <g className={`${isResizingThis ? 'opacity-100' : 'opacity-0 group-hover/layer:opacity-100'} transition-opacity duration-200`}>
                        {/* Rounded Handle Left */}
                        <circle 
                          cx={boxX} cy={boxY + boxH/2} r="6"
                          fill="white" stroke="#a855f7" strokeWidth="2"
                          className="pointer-events-none shadow-[0_0_8px_rgba(168,85,247,1)]"
                        />
                        {/* Rounded Handle Right */}
                        <circle 
                          cx={boxX + boxW} cy={boxY + boxH/2} r="6"
                          fill="white" stroke="#a855f7" strokeWidth="2"
                          className="pointer-events-none shadow-[0_0_8px_rgba(168,85,247,1)]"
                        />
                    </g>
                    
                    {/* Hit Area Handles (Invisible, wider) */}
                    <rect 
                      x={boxX - 20} y={boxY} 
                      width="40" height={boxH} 
                      fill="transparent"
                      className="cursor-ew-resize pointer-events-auto"
                      onPointerDown={(e) => handlePointerDown(e, 'resize', layer.id, 'left')}
                    />
                    <rect 
                      x={boxX + boxW - 20} y={boxY} 
                      width="40" height={boxH} 
                      fill="transparent"
                      className="cursor-ew-resize pointer-events-auto"
                      onPointerDown={(e) => handlePointerDown(e, 'resize', layer.id, 'right')}
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default SlidePreview;