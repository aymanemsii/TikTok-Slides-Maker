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

  // 1. Background
  ctx.save();
  if (slide.effects.enabled) {
    ctx.filter = `grayscale(${slide.effects.grayscale ? 1 : 0}) brightness(${slide.effects.brightness}%) contrast(${slide.effects.contrast}%)`;
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

  // 2. Text Layout
  const scale = width / 1000;
  let totalH = 0;
  let maxW = 0;

  const layers = slide.layers.map(layer => {
    let baseSize = layer.fontSize || (layer.type === 'heading' ? slide.settings.fontSize * 1.5 : slide.settings.fontSize);
    const size = Math.max(12, baseSize) * scale;
    const weight = layer.type === 'heading' ? 900 : 600;
    ctx.font = `${weight} ${size}px "${layer.fontFamily || slide.settings.fontFamily}", sans-serif`;
    
    const text = layer.type === 'heading' ? layer.content.toUpperCase() : layer.content;
    const lines: string[] = [];
    text.split('\n').forEach(p => {
      const words = p.split(' ');
      let cur = words[0];
      for(let i=1; i<words.length; i++) {
        if(ctx.measureText(cur + " " + words[i]).width < width) cur += " " + words[i];
        else { lines.push(cur); maxW = Math.max(maxW, ctx.measureText(cur).width); cur = words[i]; }
      }
      lines.push(cur);
      maxW = Math.max(maxW, ctx.measureText(cur).width);
    });
    const h = lines.length * size * 1.15;
    const gap = (slide.settings.fontSize * scale) * 0.15;
    totalH += h + gap;
    return { lines, size, weight, h, gap, font: ctx.font };
  });
  if (layers.length > 0) totalH -= layers[layers.length - 1].gap;

  // 3. Anchor positions
  const maxX = Math.max(0, width - maxW);
  const bottomBound = aspectRatio === '9:16' ? 0.88 : 1;
  const maxY = Math.max(0, (height * bottomBound) - totalH);

  const blockLeft = (slide.settings.positionX / 100) * maxX;
  const blockTop = (slide.settings.positionY / 100) * maxY;

  // 4. Draw
  ctx.save();
  ctx.textBaseline = 'top';

  let curY = blockTop;
  layers.forEach(l => {
    ctx.font = l.font;
    ctx.fillStyle = slide.settings.color;
    ctx.strokeStyle = slide.settings.strokeColor;
    ctx.lineWidth = slide.settings.strokeWidth * scale * 1.5;
    
    l.lines.forEach((line, i) => {
      const ly = curY + (i * l.size * 1.15);
      
      let drawX = blockLeft;
      ctx.textAlign = 'left';
      if (slide.settings.alignment === 'center') {
        drawX = blockLeft + (maxW / 2);
        ctx.textAlign = 'center';
      } else if (slide.settings.alignment === 'right') {
        drawX = blockLeft + maxW;
        ctx.textAlign = 'right';
      }

      if (slide.settings.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20 * scale;
        ctx.shadowOffsetY = 4 * scale;
      }
      
      if (slide.settings.strokeWidth > 0) ctx.strokeText(line, drawX, ly);
      ctx.fillText(line, drawX, ly);
    });
    curY += l.h + l.gap;
  });
  ctx.restore();

  return canvas.toDataURL('image/png');
};