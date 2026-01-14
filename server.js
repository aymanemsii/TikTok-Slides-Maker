import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// Try to import canvas for server-side rendering
let canvasLib = null;
try {
  // Dynamic import to prevent crash if not installed
  canvasLib = await import('canvas');
} catch (e) {
  console.warn("Optional dependency 'canvas' not found. Server-side rendering tools will be unavailable.");
  console.warn("To enable, run: npm install canvas");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In-memory Database
let slides = [];
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- SYNC API FOR FRONTEND ---

app.get('/api/slides', (req, res) => {
  res.json(slides);
});

app.post('/api/slides/sync', (req, res) => {
  if (Array.isArray(req.body)) {
    slides = req.body;
    res.json({ success: true, count: slides.length });
  } else {
    res.status(400).json({ error: 'Invalid body' });
  }
});

// --- SERVER SIDE RENDERING LOGIC ---

const renderSlideOnServer = async (slide) => {
  if (!canvasLib) throw new Error("Server-side rendering requires 'canvas'. Run: npm install canvas");
  
  const { createCanvas, loadImage } = canvasLib.default || canvasLib;
  
  // Default dimensions (vertical 9:16)
  const width = 1080;
  const height = 1920;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Draw Background
  try {
    const img = await loadImage(slide.image);
    
    // Simple cover fit logic
    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;
    let dW, dH, dX, dY;
    
    const imageOffset = slide.effects?.imageOffset || 50;
    const imageOffsetY = slide.effects?.imageOffsetY || 50;

    if (imgAspect > canvasAspect) { 
      dH = height; 
      dW = height * imgAspect; 
      dX = -((dW - width) * (imageOffset / 100)); 
      dY = 0; 
    } else { 
      dW = width; 
      dH = width / imgAspect; 
      dX = 0; 
      dY = -((dH - height) * (imageOffsetY / 100)); 
    }
    
    // Note: Node-canvas has limited filter support compared to browser
    // We skip complex filters here for stability and render raw image
    ctx.drawImage(img, dX, dY, dW, dH);
    
    // Basic overlay for grayscale/brightness simulation if needed
    if (slide.effects?.grayscale) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'black';
      ctx.fillRect(0,0,width,height);
      ctx.globalCompositeOperation = 'source-over';
    }

  } catch (err) {
    console.error("Failed to load image for slide " + slide.id, err);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Draw Text Layers
  const scale = width / 1000;
  const globalScale = (slide.settings.fontSize || 100) / 100;
  
  ctx.textBaseline = 'middle';
  const shadowOpacity = (slide.settings.shadowOpacity || 80) / 100;
  const blurBase = (slide.settings.shadowBlur || 0) * scale;

  // Font fallback
  const getFontString = (weight, size, family) => {
    // We assume system fonts or fallback to Arial since we can't easily register custom fonts without files
    return `${weight} ${size}px "${family}", "Arial", sans-serif`;
  };

  slide.layers.forEach(layer => {
    let baseSize = layer.fontSize || 60;
    const size = baseSize * globalScale * scale;
    const weight = layer.type === 'heading' ? 900 : 600;
    const fontFamily = layer.fontFamily || slide.settings.fontFamily;
    
    ctx.font = getFontString(weight, size, fontFamily);

    const text = layer.uppercase ? layer.content.toUpperCase() : layer.content;
    const lines = [];
    const maxWrapWidth = ((layer.width || 80) / 100) * width;

    // Text Wrapping
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
    const drawYStart = centerY - (layerH / 2);

    lines.forEach((line, i) => {
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

      // Shadow
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
      
      // Stroke
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
      
      // Fill
      ctx.fillStyle = slide.settings.color || '#ffffff';
      ctx.fillText(line, textX, ly);
    });
  });

  return canvas.toDataURL('image/png');
};

// --- MCP TOOLS IMPLEMENTATION ---

const tools = {
  list_slides: () => {
    return slides;
  },
  
  create_slide: ({ background_image_url }) => {
    const newSlide = {
      id: generateId(),
      image: background_image_url || 'https://placehold.co/1080x1920/101010/FFF?text=New+Slide',
      layers: [
        { 
          id: generateId(), 
          type: 'heading', 
          content: 'HEADLINE', 
          fontSize: 80, 
          fontFamily: 'TikTok Sans',
          x: 50, y: 50, selected: false, alignment: 'center', width: 80
        }
      ],
      template: 'none',
      settings: {
        fontSize: 100, fontFamily: 'TikTok Sans', color: '#ffffff', strokeColor: '#000000', strokeWidth: 1,
        shadow: false, shadowBlur: 20, shadowOpacity: 80, positionX: 50, positionY: 50, alignment: 'center', constrainToSlide: true
      },
      effects: { enabled: false, grayscale: false, brightness: 85, contrast: 105, saturation: 100, imageOffset: 50, imageOffsetY: 50 }
    };
    slides.push(newSlide);
    return { status: 'success', slide: newSlide };
  },

  duplicate_slide: ({ slide_id }) => {
    const original = slides.find(s => s.id === slide_id);
    if (!original) return { error: 'Slide not found' };

    // Deep copy and regenerate IDs
    const newSlide = JSON.parse(JSON.stringify(original));
    newSlide.id = generateId();
    newSlide.layers.forEach(l => l.id = generateId());
    
    slides.push(newSlide);
    return { status: 'success', slide: newSlide };
  },

  delete_slide: ({ slide_id }) => {
    const index = slides.findIndex(s => s.id === slide_id);
    if (index === -1) return { error: 'Slide not found' };
    
    const deleted = slides.splice(index, 1);
    return { status: 'success', deleted_id: slide_id };
  },

  reorder_slide: ({ slide_id, new_index }) => {
    const currentIndex = slides.findIndex(s => s.id === slide_id);
    if (currentIndex === -1) return { error: 'Slide not found' };
    
    if (new_index < 0 || new_index >= slides.length) return { error: 'Index out of bounds' };

    const [movedSlide] = slides.splice(currentIndex, 1);
    slides.splice(new_index, 0, movedSlide);
    
    return { status: 'success', slide_id, new_index };
  },

  clear_project: () => {
    const count = slides.length;
    slides = [];
    return { status: 'success', deleted_count: count };
  },

  set_background: ({ slide_id, image_url }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };
    slide.image = image_url;
    return { status: 'success', slide_id };
  },

  add_text_layer: ({ slide_id, text, type = 'body', y_position = 50 }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };
    const layer = {
      id: generateId(),
      type,
      content: text,
      fontSize: type === 'heading' ? 80 : 60,
      fontFamily: 'TikTok Sans',
      x: 50,
      y: y_position,
      selected: false,
      alignment: 'center',
      width: 80
    };
    slide.layers.push(layer);
    return { status: 'success', layer };
  },

  delete_layer: ({ slide_id, layer_id }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };

    const layerIndex = slide.layers.findIndex(l => l.id === layer_id);
    if (layerIndex === -1) return { error: 'Layer not found' };

    slide.layers.splice(layerIndex, 1);
    return { status: 'success', deleted_layer_id: layer_id };
  },

  update_text: ({ slide_id, layer_id, text }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };
    const layer = layer_id ? slide.layers.find(l => l.id === layer_id) : slide.layers[0];
    if (!layer) return { error: 'Layer not found' };
    if (text !== undefined) layer.content = text;
    return { status: 'success', layer };
  },

  update_layer_style: ({ slide_id, layer_id, fontSize, fontFamily, x, y, width, alignment, color }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };
    
    const layer = layer_id ? slide.layers.find(l => l.id === layer_id) : slide.layers[0];
    if (!layer) return { error: 'Layer not found' };

    if (fontSize !== undefined) layer.fontSize = Number(fontSize);
    if (fontFamily !== undefined) layer.fontFamily = fontFamily;
    if (x !== undefined) layer.x = Number(x);
    if (y !== undefined) layer.y = Number(y);
    if (width !== undefined) layer.width = Number(width);
    if (alignment !== undefined) layer.alignment = alignment;
    if (color !== undefined) slide.settings.color = color;

    return { status: 'success', layer };
  },

  apply_filter: ({ slide_id, brightness, contrast, grayscale }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };
    slide.effects.enabled = true;
    if (brightness !== undefined) slide.effects.brightness = Number(brightness);
    if (contrast !== undefined) slide.effects.contrast = Number(contrast);
    if (grayscale !== undefined) slide.effects.grayscale = Boolean(grayscale);
    return { status: 'success', effects: slide.effects };
  },

  // NEW TOOL: Render slide to base64
  render_slide: async ({ slide_id }) => {
    const slide = slides.find(s => s.id === slide_id);
    if (!slide) return { error: 'Slide not found' };
    
    try {
      const base64 = await renderSlideOnServer(slide);
      return { 
        status: 'success', 
        slide_id, 
        image_data_base64: base64.replace(/^data:image\/\w+;base64,/, "") 
      };
    } catch (e) {
      return { error: `Rendering failed: ${e.message}` };
    }
  },

  export_slides: () => {
    return { 
      status: 'success', 
      message: 'Slides exported as JSON data', 
      export_data: slides 
    };
  }
};

const toolDefinitions = [
  {
    name: 'list_slides',
    description: 'Get all slides in the current workspace',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'create_slide',
    description: 'Create a new slide',
    input_schema: {
      type: 'object',
      properties: {
        background_image_url: { type: 'string', description: 'URL for background' }
      }
    }
  },
  {
    name: 'duplicate_slide',
    description: 'Duplicate an existing slide',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' }
      },
      required: ['slide_id']
    }
  },
  {
    name: 'delete_slide',
    description: 'Delete a slide by ID',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' }
      },
      required: ['slide_id']
    }
  },
  {
    name: 'reorder_slide',
    description: 'Move a slide to a new index position (0-based)',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        new_index: { type: 'integer' }
      },
      required: ['slide_id', 'new_index']
    }
  },
  {
    name: 'clear_project',
    description: 'Delete all slides in the workspace',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'set_background',
    description: 'Change the background image of a slide',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        image_url: { type: 'string' }
      },
      required: ['slide_id', 'image_url']
    }
  },
  {
    name: 'add_text_layer',
    description: 'Add text to a slide',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        text: { type: 'string' },
        type: { type: 'string', enum: ['heading', 'body'] },
        y_position: { type: 'number' }
      },
      required: ['slide_id', 'text']
    }
  },
  {
    name: 'delete_layer',
    description: 'Remove a specific text layer from a slide',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        layer_id: { type: 'string' }
      },
      required: ['slide_id', 'layer_id']
    }
  },
  {
    name: 'update_text',
    description: 'Update text content of a layer',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        layer_id: { type: 'string', description: 'Optional. Defaults to first layer.' },
        text: { type: 'string' }
      },
      required: ['slide_id', 'text']
    }
  },
  {
    name: 'update_layer_style',
    description: 'Update visual properties of a layer',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        layer_id: { type: 'string', description: 'Optional. Defaults to first layer.' },
        fontSize: { type: 'number' },
        fontFamily: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        alignment: { type: 'string', enum: ['left', 'center', 'right'] },
        color: { type: 'string' }
      },
      required: ['slide_id']
    }
  },
  {
    name: 'apply_filter',
    description: 'Apply image effects',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' },
        brightness: { type: 'number' },
        contrast: { type: 'number' },
        grayscale: { type: 'boolean' }
      },
      required: ['slide_id']
    }
  },
  {
    name: 'render_slide',
    description: 'Render a slide to a PNG image (Base64 encoded)',
    input_schema: {
      type: 'object',
      properties: {
        slide_id: { type: 'string' }
      },
      required: ['slide_id']
    }
  },
  {
    name: 'export_slides',
    description: 'Export all slides data',
    input_schema: { type: 'object', properties: {} }
  }
];

// --- MCP ENDPOINTS ---

app.get('/mcp/tools', (req, res) => {
  res.json(toolDefinitions);
});

app.post('/mcp/execute', (req, res) => {
  const { name, arguments: args } = req.body;
  
  if (!tools[name]) {
    return res.status(404).json({ error: `Tool '${name}' not found` });
  }

  try {
    const result = tools[name](args || {});
    // Handle async results (like rendering)
    if (result instanceof Promise) {
      result.then(data => res.json(data)).catch(err => res.status(500).json({ error: err.message }));
    } else {
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve Static App
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TikTok Slides Maker Server running on port ${PORT}`);
  console.log(`MCP Tools available at http://localhost:${PORT}/mcp/tools`);
});