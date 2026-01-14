import { SlideData, AspectRatio } from '../types';

export const generateSlideImage = async (slide: SlideData, aspectRatio: AspectRatio): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas init fail");

  let width = 1080, height = 1920;
  if (aspectRatio === '1:1') { width = 1080; height = 1080; }
  else if (aspectRatio === '16:9') { width = 1920; height = 1080; }
  canvas.width = width;
  canvas.height = height;

  const img = new Image();
  img.src = slide.image;
  await new Promise(r => img.onload = r);

  // 1. Render Background
  ctx.save();
  if (slide.effects.enabled) {
    const sat = slide.effects.saturation ?? 100;
    ctx.filter = `grayscale(${slide.effects.grayscale ? 1 : 0}) brightness(${slide.effects.brightness}%) contrast(${slide.effects.contrast}%) saturate(${sat}%)`;
  }
  const imgAspect = img.width / img.height;
  const canvasAspect = width / height;
  let dW, dH, dX, dY;
  if (imgAspect > canvasAspect) { 
    dH = height; dW = height * imgAspect; 
    dX = -((dW - width) * (slide.effects.imageOffset / 100)); dY = 0; 
  } else { 
    dW = width; dH = width / imgAspect; 
    dX = 0; dY = -((dH - height) * (slide.effects.imageOffsetY / 100)); 
  }
  ctx.drawImage(img, dX, dY, dW, dH);
  ctx.restore();

  // 2. Prep Text Engine
  const scale = width / 1000;
  const globalScale = (slide.settings.fontSize || 100) / 100;
  
  // Use middle baseline to match 'central' in SVG
  ctx.textBaseline = 'middle';

  const shadowOpacity = (slide.settings.shadowOpacity || 80) / 100;
  const blurBase = (slide.settings.shadowBlur || 0) * scale;

  slide.layers.forEach(layer => {
    let baseSize = layer.fontSize || 60;
    const size = baseSize * globalScale * scale;
    const weight = layer.type === 'heading' ? 900 : 600;
    const fontFamily = layer.fontFamily || slide.settings.fontFamily;
    ctx.font = `${weight} ${size}px "${fontFamily}", sans-serif`;
    
    // Apply letter spacing if supported
    // @ts-ignore
    if (ctx.letterSpacing) ctx.letterSpacing = `${(layer.letterSpacing || 0) * scale}px`;

    const text = layer.uppercase ? layer.content.toUpperCase() : layer.content;
    const lines: string[] = [];
    const maxWrapWidth = ((layer.width || 80) / 100) * width;

    text.split('\n').forEach(p => {
      const words = p.split(/\s+/);
      let cur = words[0];
      for(let i=1; i<words.length; i++) {
        if(ctx.measureText(cur + " " + words[i]).width <= maxWrapWidth) cur += " " + words[i];
        else { lines.push(cur); cur = words[i]; }
      }
      lines.push(cur);
    });

    const lhMultiplier = layer.lineHeight || 1.15;
    const lineHeight = size * lhMultiplier;
    const layerH = lines.length * lineHeight;
    
    const centerX = (layer.x / 100) * width;
    const centerY = (layer.y / 100) * height;
    
    // Top of the bounding box
    const drawYStart = centerY - (layerH / 2);

    lines.forEach((line, i) => {
      // Calculate vertical center of the specific line
      const ly = drawYStart + (i * lineHeight) + (lineHeight / 2);
      
      const alignment = layer.alignment || 'center';
      let textX = centerX;
      
      if (alignment === 'left') {
        textX = centerX - (maxWrapWidth / 2);
        ctx.textAlign = 'left';
      } else if (alignment === 'right') {
        textX = centerX + (maxWrapWidth / 2);
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'center';
      }

      if (slide.settings.shadow) {
        ctx.save();
        ctx.fillStyle = slide.settings.shadowColor || 'black';
        ctx.shadowColor = slide.settings.shadowColor || 'black';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4 * scale;
        ctx.shadowBlur = blurBase * 2.0;
        ctx.globalAlpha = shadowOpacity;
        ctx.fillText(line, textX, ly);
        ctx.restore();
      }
      
      // STROKE
      let useStroke = false;
      let sWidth = 0;
      let sColor = slide.settings.strokeColor;

      if (layer.stroke !== undefined) {
         useStroke = layer.stroke;
         sWidth = layer.strokeWidth || 0;
         sColor = layer.strokeColor || '#000000';
      } else {
         useStroke = slide.settings.strokeWidth > 0;
         sWidth = slide.settings.strokeWidth;
         sColor = slide.settings.strokeColor;
      }

      if (useStroke && sWidth > 0) {
        ctx.save();
        ctx.strokeStyle = sColor;
        ctx.lineWidth = sWidth * scale * 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeText(line, textX, ly);
        ctx.restore();
      }
      
      ctx.fillStyle = slide.settings.color;
      ctx.fillText(line, textX, ly);
    });
  });

  return canvas.toDataURL('image/png');
};