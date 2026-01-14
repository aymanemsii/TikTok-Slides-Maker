import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, 
  Settings, 
  Play, 
  Download, 
  Layers, 
  Trash2, 
  RefreshCw,
  Undo2,
  Redo2,
  CheckSquare,
  Square,
  Sparkles,
  ChevronDown,
  BookOpen,
  X,
  Keyboard,
  Wand2,
  MousePointer2,
  Server,
  ArrowLeft,
  Menu,
  Hash,
  Terminal,
  Copy,
  Check,
  Cpu,
  Layout,
  Type,
  Image as ImageIcon,
  Palette,
  Lightbulb,
  Zap,
  Box,
  Plus,
  FileText,
  Archive,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { AspectRatio, SlideData, TemplateType, TextSettings, ImageEffects, SlideTextLayer } from './types';
import SlidePreview from './components/SlidePreview';
import Controls from './components/Controls';
import { generateSlideImage } from './services/imageService';

const MAX_HISTORY = 50;

// --- UTILS FOR DOCS ---
const CodeBlock = ({ children, label }: { children?: React.ReactNode, label?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(String(children || ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0c0c0e] shadow-lg group">
      {(label) && (
        <div className="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">{label}</span>
          <button onClick={copyToClipboard} className="text-zinc-500 hover:text-white transition-colors">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <div className="p-4 overflow-x-auto relative">
        {!label && (
           <button onClick={copyToClipboard} className="absolute top-3 right-3 text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
             {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
           </button>
        )}
        <pre className="text-[11px] font-mono text-zinc-300 leading-relaxed whitespace-pre font-medium">
          {children}
        </pre>
      </div>
    </div>
  );
};

const DocSection = ({ id, title, icon, children }: { id: string, title: string, icon?: React.ReactNode, children?: React.ReactNode }) => (
  <section id={id} className="scroll-mt-32 mb-20 border-b border-white/5 pb-16 last:border-0 relative">
    <div className="flex items-center gap-4 mb-8">
      {icon && (
        <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/10 rounded-xl text-purple-400 shadow-inner ring-1 ring-white/5">
          {icon}
        </div>
      )}
      <h2 className="text-3xl font-black text-white tracking-tight">{title}</h2>
    </div>
    <div className="space-y-6 text-zinc-400 leading-7 text-sm md:text-base">
      {children}
    </div>
  </section>
);

const DocSubHeader = ({ children }: { children?: React.ReactNode }) => (
  <h3 className="text-lg font-bold text-white mt-10 mb-4 flex items-center gap-2 border-l-2 border-purple-500 pl-3">
    {children}
  </h3>
);

const InfoBox = ({ children, type = 'info' }: { children?: React.ReactNode, type?: 'info' | 'warn' | 'tip' }) => {
  const styles = {
    info: 'bg-blue-500/5 border-blue-500/20 text-blue-200',
    warn: 'bg-orange-500/5 border-orange-500/20 text-orange-200',
    tip: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
  };
  const icons = {
    info: <Lightbulb size={16} className="text-blue-400 shrink-0" />,
    warn: <Zap size={16} className="text-orange-400 shrink-0" />,
    tip: <Sparkles size={16} className="text-emerald-400 shrink-0" />
  };
  
  return (
    <div className={`p-4 rounded-lg border flex gap-3 text-sm my-6 ${styles[type]}`}>
      {icons[type]}
      <div className="leading-relaxed opacity-90">{children}</div>
    </div>
  );
};

// --- DEDICATED DOCS PAGE COMPONENT ---
interface DocsPageProps {
  onBack: () => void;
}

const DocsPage: React.FC<DocsPageProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('intro');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Poll for server status in Docs view
  useEffect(() => {
    const pollServer = async () => {
      try {
        const response = await fetch('/api/slides');
        if (response.ok) setIsConnected(true);
      } catch (e) {
        setIsConnected(false);
      }
    };
    const interval = setInterval(pollServer, 2000);
    pollServer();
    return () => clearInterval(interval);
  }, []);

  // Navigation Data
  const navItems = [
    { id: 'intro', label: 'Introduction', icon: <Sparkles size={16} /> },
    { id: 'getting-started', label: 'Getting Started', icon: <Play size={16} /> },
    { id: 'editor-guide', label: 'Editor Guide', icon: <Layout size={16} /> },
    { id: 'templates', label: 'Templates & Styles', icon: <Palette size={16} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} /> },
    { id: 'mcp-server', label: 'MCP Server', icon: <Server size={16} /> },
    { id: 'best-practices', label: 'Best Practices', icon: <Lightbulb size={16} /> },
    { id: 'faq', label: 'Troubleshooting', icon: <Wand2 size={16} /> },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Temporarily unobserve to avoid flickering active state during scroll
      setActiveSection(id);
      setMobileMenuOpen(false);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Improved Scroll Spy with proper margins
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { 
      // Adjusted rootMargin to better detect headers when they scroll under sticky header
      // Top margin accounts for the header height (~100px)
      rootMargin: '-100px 0px -70% 0px',
      threshold: 0
    });

    navItems.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] text-slate-200 font-sans flex flex-col md:flex-row overflow-hidden">
      {/* BACKGROUND ATMOSPHERE */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/5 blur-[100px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]"></div>
      </div>

      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-[#050505]/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-purple-400" />
          <span className="font-bold text-white tracking-tight">Documentation</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X size={20} /></button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-white/5 rounded-lg text-white">
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#08080a] border-r border-white/5 flex flex-col transition-transform duration-300 md:translate-x-0 md:relative ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <div className="p-6 border-b border-white/5 flex flex-col gap-6 bg-gradient-to-b from-purple-900/5 to-transparent">
           <div className="flex items-center gap-3">
             <div className="p-2.5 bg-purple-500 rounded-xl shadow-lg shadow-purple-500/20 text-white">
               <BookOpen size={20} />
             </div>
             <div>
               <h1 className="font-bold text-white leading-none tracking-tight text-lg">TikTok Slides</h1>
               <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1 block">Studio Docs v2.2</span>
             </div>
           </div>
           <button 
             onClick={onBack}
             className="w-full py-2.5 px-3 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 rounded-xl text-xs font-bold text-zinc-400 flex items-center justify-center gap-2 transition-all group"
           >
             <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Return to App
           </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
          {navItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold transition-all duration-300 group overflow-hidden ${
                  isActive 
                    ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-white' 
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                {/* Active Indicator Line */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-purple-500 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 -translate-x-2'}`} />
                
                <span className={`relative z-10 transition-colors ${isActive ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
                  {item.icon}
                </span>
                <span className="relative z-10 tracking-wide">{item.label}</span>
                
                {/* Subtle Hover Glow */}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#050505]">
           <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isConnected ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="relative">
                 <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                 {isConnected && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-50"></div>}
              </div>
              <div>
                <div className={`text-[10px] font-black uppercase tracking-widest ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  System {isConnected ? 'Online' : 'Offline'}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Localhost:3000</div>
              </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto scroll-smooth md:p-0 relative">
        <div className="max-w-4xl mx-auto p-8 md:p-12 lg:p-20 min-h-screen pb-40">
          
          {/* 1. INTRO */}
          <DocSection id="intro" title="Introduction" icon={<Sparkles size={24} />}>
            <p className="text-lg text-zinc-300 font-medium leading-relaxed">
              TikTok Slides Maker is a specialized studio environment for high-volume content creators. 
              Designed to bridge the gap between simple design tools and programmatic generation, it allows you to produce 
              viral "photo swipe" carousels for TikTok, Instagram Reels, and YouTube Shorts with unprecedented speed.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
               <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all group">
                 <h4 className="text-white font-bold mb-3 flex items-center gap-2 text-lg"><Layout size={20} className="text-cyan-400 group-hover:scale-110 transition-transform"/> Visual Studio</h4>
                 <p className="text-sm text-zinc-500 leading-relaxed">
                   A reactive, drag-and-drop editor with snap-to-grid, real-time font rendering, and bulk styling tools designed for rapid iteration.
                 </p>
               </div>
               <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all group">
                 <h4 className="text-white font-bold mb-3 flex items-center gap-2 text-lg"><Cpu size={20} className="text-purple-400 group-hover:scale-110 transition-transform"/> MCP Agent Core</h4>
                 <p className="text-sm text-zinc-500 leading-relaxed">
                   Built-in local API server implementing the Model Context Protocol, enabling AI agents like Claude to programmatically build slides.
                 </p>
               </div>
            </div>
          </DocSection>

          {/* 2. GETTING STARTED */}
          <DocSection id="getting-started" title="Getting Started" icon={<Play size={24} />}>
            <DocSubHeader>Importing Visuals</DocSubHeader>
            <p>
              Begin by navigating to the <strong className="text-white">Sources</strong> tab. The application supports two primary workflows:
            </p>
            <ul className="space-y-4 mt-4">
              <li className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="p-2 bg-black rounded-lg h-fit"><ImageIcon size={16} className="text-zinc-400" /></div>
                <div>
                   <strong className="text-white block mb-1">Direct Image Upload</strong>
                   <span className="text-sm">Drag and drop JPG, PNG, or WebP files. Multi-select is supported. Ideal for photo dumps or visual storytelling.</span>
                </div>
              </li>
              <li className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="p-2 bg-black rounded-lg h-fit"><Box size={16} className="text-zinc-400" /></div>
                <div>
                   <strong className="text-white block mb-1">CSV Batch Import</strong>
                   <span className="text-sm">Upload a CSV file to automatically generate text layers. The first column is used as the main text content.</span>
                </div>
              </li>
            </ul>

            <DocSubHeader>CSV Data Structure</DocSubHeader>
            <p>
              Your CSV file should be UTF-8 encoded. The parser automatically detects the first column for text content. 
              Extra columns are currently ignored but preserved in the internal state for future template expansion.
            </p>
            <CodeBlock label="quotes.csv">{`Content, Author, Year
"Discipline is doing what you hate to do, but doing it like you love it.", "Mike Tyson", 2000
"The only easy day was yesterday.", "Navy SEALs", 1990`}</CodeBlock>
          </DocSection>

          {/* 3. EDITOR GUIDE */}
          <DocSection id="editor-guide" title="Editor Guide" icon={<Layout size={24} />}>
             <p>
               The <strong className="text-white">Design</strong> tab contains the interactive canvas. Changes made here can be applied to a single slide 
               or broadcast to the entire deck using the "Apply Styles to All" button.
             </p>

             <div className="mt-8 space-y-12">
                <div>
                   <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Type size={20} className="text-pink-400"/> Typography Engine</h4>
                   <p className="mb-4">
                     The text engine supports multi-line wrapping, per-line auto-centering, and dynamic resizing.
                   </p>
                   <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <li className="bg-zinc-900/50 p-4 rounded-lg border border-white/5">
                         <strong className="text-zinc-200 block mb-1">Stroke & Outline</strong>
                         <span className="text-xs">Add a colored stroke to text layers to improve legibility on complex backgrounds.</span>
                      </li>
                      <li className="bg-zinc-900/50 p-4 rounded-lg border border-white/5">
                         <strong className="text-zinc-200 block mb-1">Drop Shadows</strong>
                         <span className="text-xs">Configurable blur, opacity, and vertical offset for depth effects.</span>
                      </li>
                      <li className="bg-zinc-900/50 p-4 rounded-lg border border-white/5">
                         <strong className="text-zinc-200 block mb-1">Font Stack</strong>
                         <span className="text-xs">Includes TikTok Sans, Anton, and Montserrat for that native social media look.</span>
                      </li>
                      <li className="bg-zinc-900/50 p-4 rounded-lg border border-white/5">
                         <strong className="text-zinc-200 block mb-1">Constraints</strong>
                         <span className="text-xs">Toggle "Constrain to Slide" to prevent text from overflowing the safe zone.</span>
                      </li>
                   </ul>
                </div>
             </div>
          </DocSection>
          
          {/* 4. TEMPLATES & STYLES (NEW) */}
          <DocSection id="templates" title="Templates & Styles" icon={<Palette size={24} />}>
            <p className="mb-6">
              While you can customize every aspect manually, following established style patterns often yields better engagement.
            </p>
            
            <DocSubHeader>Popular Configurations</DocSubHeader>
            <div className="space-y-4">
              <div className="p-4 border border-white/10 rounded-xl bg-gradient-to-r from-black to-zinc-900">
                 <h4 className="font-bold text-white mb-2">The "Viral Quote" Look</h4>
                 <div className="flex flex-wrap gap-2 text-xs font-mono text-zinc-400 mb-3">
                    <span className="bg-white/10 px-2 py-1 rounded">Font: TikTok Sans</span>
                    <span className="bg-white/10 px-2 py-1 rounded">Size: 80px</span>
                    <span className="bg-white/10 px-2 py-1 rounded">Shadow: On</span>
                 </div>
                 <p className="text-sm">
                   Use a dark, moody background image. Decrease brightness to 60%. Set text color to white with a heavy drop shadow (Opacity 90%, Blur 10px).
                   This maximizes contrast and readability, essential for quick scrolling.
                 </p>
              </div>

              <div className="p-4 border border-white/10 rounded-xl bg-gradient-to-r from-black to-zinc-900">
                 <h4 className="font-bold text-white mb-2">The "Facts" Overlay</h4>
                 <div className="flex flex-wrap gap-2 text-xs font-mono text-zinc-400 mb-3">
                    <span className="bg-white/10 px-2 py-1 rounded">Font: Anton</span>
                    <span className="bg-white/10 px-2 py-1 rounded">Stroke: Black (4px)</span>
                    <span className="bg-white/10 px-2 py-1 rounded">Color: Yellow/White</span>
                 </div>
                 <p className="text-sm">
                   Use bright, high-saturation backgrounds. Apply a thick black stroke to the text. Use yellow (#FFE600) for emphasis keywords if managing layers manually.
                 </p>
              </div>
            </div>
            
            <InfoBox type="tip">
              <strong>Pro Tip:</strong> Use the "Apply Styles to All" button in the Controls panel to instantly synchronize your chosen aesthetic across 50+ slides.
            </InfoBox>
          </DocSection>

          {/* 5. SHORTCUTS */}
          <DocSection id="shortcuts" title="Keyboard Shortcuts" icon={<Keyboard size={24} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {[
                 { keys: ['Ctrl', 'Z'], desc: 'Undo last action' },
                 { keys: ['Ctrl', 'Y'], desc: 'Redo action' },
                 { keys: ['Delete'], desc: 'Delete selected layer' },
                 { keys: ['Arrows'], desc: 'Nudge layer (0.2%)' },
                 { keys: ['Shift', 'Arrows'], desc: 'Fast nudge (2.0%)' },
               ].map((sc, i) => (
                 <div key={i} className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-white/5 hover:border-purple-500/20 transition-colors">
                    <span className="text-sm text-zinc-300 font-bold">{sc.desc}</span>
                    <div className="flex gap-1">
                      {sc.keys.map(k => (
                        <kbd key={k} className="px-2.5 py-1.5 bg-black rounded-lg text-[10px] font-bold text-zinc-400 min-w-[32px] text-center border-b-2 border-zinc-700 shadow-sm">{k}</kbd>
                      ))}
                    </div>
                 </div>
               ))}
            </div>
          </DocSection>

          {/* 6. MCP SERVER */}
          <DocSection id="mcp-server" title="MCP Server Integration" icon={<Server size={24} />}>
            <div className="p-6 bg-purple-500/5 border border-purple-500/20 rounded-2xl mb-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Cpu size={100} /></div>
               <h4 className="text-lg font-bold text-purple-300 mb-2">AI-Powered Automation</h4>
               <p className="text-sm text-purple-200/80 max-w-2xl leading-relaxed">
                 The <strong>Model Context Protocol (MCP)</strong> allows local LLMs (like Claude Desktop) to connect directly to this application state. 
                 This means you can prompt Claude to "Create 5 slides about space facts" and it will execute the tools to build them in real-time.
               </p>
            </div>

            <DocSubHeader>Setup & Configuration</DocSubHeader>
            <p className="mb-4">
              To enable server-side rendering for AI previews, you must install the node-canvas dependency. 
              Without this, the AI can manipulate state but cannot "see" the generated output.
            </p>
            <CodeBlock label="Terminal">npm install canvas</CodeBlock>

            <DocSubHeader>Claude Desktop Config</DocSubHeader>
            <p className="mb-4">
              Add the following to your Claude Desktop configuration file. Ensure the path points to the <code>server.js</code> file in your project root.
            </p>
            <CodeBlock label="claude_desktop_config.json">{`{
  "mcpServers": {
    "tiktok-slides": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/tiktok-slides/server.js"]
    }
  }
}`}</CodeBlock>

            <DocSubHeader>Example Automation Script (Python)</DocSubHeader>
            <p className="mb-4">
              You aren't limited to Claude. You can write Python scripts to interact with the API directly via HTTP.
            </p>
            <CodeBlock label="generate_deck.py">{`import requests
import time

API_URL = "http://localhost:3000/mcp/execute"

def run_tool(name, args={}):
    res = requests.post(API_URL, json={"name": name, "arguments": args})
    return res.json()

# 1. Clear Workspace
run_tool("clear_project")

# 2. Create Content Loop
topics = ["Nebulas", "Black Holes", "Supernovas"]
for topic in topics:
    # Create slide
    bg_url = f"https://source.unsplash.com/800x1400/?{topic}"
    slide = run_tool("create_slide", {"background_image_url": bg_url})
    sid = slide['slide']['id']
    
    # Add text
    run_tool("add_text_layer", {
        "slide_id": sid,
        "text": topic.upper(),
        "type": "heading",
        "y_position": 50
    })

print("Deck generation complete!")`}</CodeBlock>

            <DocSubHeader>Available Tools API Reference</DocSubHeader>
            <p className="mb-6">The following tools are exposed via the MCP server and can be called by AI agents or external scripts.</p>
            
            <div className="space-y-4">
              {[
                {
                   name: 'create_slide',
                   desc: 'Create a new slide with an optional background image.',
                   args: '{ background_image_url: string }'
                },
                {
                   name: 'add_text_layer',
                   desc: 'Add a new text layer to a specific slide.',
                   args: "{ slide_id: string, text: string, type: 'heading' | 'body', y_position: number }"
                },
                {
                   name: 'update_layer_style',
                   desc: 'Modify visual properties of a text layer.',
                   args: "{ slide_id: string, layer_id?: string, fontSize?: number, fontFamily?: string, x?: number, y?: number, width?: number, alignment?: 'left'|'center'|'right', color?: string }"
                },
                {
                   name: 'apply_filter',
                   desc: 'Apply image processing effects to a slide background.',
                   args: "{ slide_id: string, brightness?: number, contrast?: number, grayscale?: boolean }"
                },
                {
                   name: 'list_slides',
                   desc: 'Retrieve all slides in the current workspace.',
                   args: '{}'
                },
                {
                   name: 'duplicate_slide',
                   desc: 'Clone an existing slide completely.',
                   args: '{ slide_id: string }'
                },
                {
                   name: 'delete_slide',
                   desc: 'Remove a slide from the deck.',
                   args: '{ slide_id: string }'
                },
                {
                   name: 'reorder_slide',
                   desc: 'Change the position of a slide in the deck.',
                   args: '{ slide_id: string, new_index: number }'
                },
                {
                   name: 'set_background',
                   desc: 'Update the background image URL.',
                   args: '{ slide_id: string, image_url: string }'
                },
                {
                   name: 'delete_layer',
                   desc: 'Remove a specific text layer.',
                   args: '{ slide_id: string, layer_id: string }'
                },
                {
                   name: 'update_text',
                   desc: 'Update the text content of a layer.',
                   args: '{ slide_id: string, layer_id: string, text: string }'
                },
                {
                   name: 'render_slide',
                   desc: 'Generate a base64 PNG preview of the slide (requires node-canvas).',
                   args: '{ slide_id: string }'
                },
                {
                   name: 'export_slides',
                   desc: 'Get full JSON dump of project state.',
                   args: '{}'
                },
                {
                   name: 'clear_project',
                   desc: 'Wipe all slides.',
                   args: '{}'
                }
              ].map(tool => (
                <div key={tool.name} className="border border-white/10 rounded-lg overflow-hidden bg-[#0c0c0e]">
                   <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <code className="text-purple-400 font-bold font-mono text-sm">{tool.name}</code>
                      <span className="text-xs text-zinc-400">{tool.desc}</span>
                   </div>
                   <div className="p-3 bg-black/30">
                      <div className="text-[10px] uppercase font-bold text-zinc-600 mb-1">Arguments</div>
                      <code className="text-xs text-zinc-300 font-mono break-all">{tool.args}</code>
                   </div>
                </div>
              ))}
            </div>

          </DocSection>

          {/* 7. BEST PRACTICES (NEW) */}
          <DocSection id="best-practices" title="Best Practices" icon={<Lightbulb size={24} />}>
            <div className="grid grid-cols-1 gap-6">
               <div className="flex gap-4">
                 <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 font-bold">1</div>
                 <div>
                   <h4 className="text-white font-bold text-lg mb-2">Safe Zones</h4>
                   <p className="text-sm">TikTok and Reels have UI elements (likes, captions, music info) covering the bottom and right edges. Keep your text within the center 80% width and center-vertical area. Use the "Constrain to Slide" setting to enforce this automatically.</p>
                 </div>
               </div>

               <div className="flex gap-4">
                 <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 font-bold">2</div>
                 <div>
                   <h4 className="text-white font-bold text-lg mb-2">Contrast is King</h4>
                   <p className="text-sm">Never rely on the background image alone for contrast. Always use a stroke or a heavy drop shadow. White text with a black outline is universally readable on any video background.</p>
                 </div>
               </div>

               <div className="flex gap-4">
                 <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 font-bold">3</div>
                 <div>
                   <h4 className="text-white font-bold text-lg mb-2">Batch Processing</h4>
                   <p className="text-sm">For maximum efficiency, prepare a CSV with 50-100 quotes. Import it, then design just the <strong>first</strong> slide perfectly. Click "Apply Styles to All" to format the entire deck instantly, then just scroll through and tweak background image offsets if faces are covered.</p>
                 </div>
               </div>
            </div>
          </DocSection>

          {/* 8. FAQ */}
          <DocSection id="faq" title="Troubleshooting" icon={<Wand2 size={24} />}>
            <div className="space-y-4">
              <details className="group bg-zinc-900/30 rounded-xl border border-white/5 open:bg-zinc-900/50 open:border-purple-500/20 transition-all">
                <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-zinc-300 group-hover:text-white">
                  Why are my images exporting blank?
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-zinc-400 pt-2 border-t border-white/5 mt-2">
                  This usually happens due to browser security restrictions on "tainted" canvases. If you load images from a URL that doesn't support CORS (Cross-Origin Resource Sharing), the browser will block the export. Ensure your image URLs allow CORS, or use local file uploads which are always safe.
                </div>
              </details>

              <details className="group bg-zinc-900/30 rounded-xl border border-white/5 open:bg-zinc-900/50 open:border-purple-500/20 transition-all">
                <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-zinc-300 group-hover:text-white">
                  Can I use custom fonts?
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-zinc-400 pt-2 border-t border-white/5 mt-2">
                  Currently, the app supports a curated list of Google Fonts (TikTok Sans, Anton, Oswald, etc.) optimized for social media. We plan to add a font uploader in version 2.3. For now, you must use the provided list to ensure render consistency between the editor and the export engine.
                </div>
              </details>

              <details className="group bg-zinc-900/30 rounded-xl border border-white/5 open:bg-zinc-900/50 open:border-purple-500/20 transition-all">
                <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-zinc-300 group-hover:text-white">
                  MCP Server connection failed?
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-zinc-400 pt-2 border-t border-white/5 mt-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure the server is actually running. You should see "System Online" in the sidebar.</li>
                    <li>Check that the port 3000 is not blocked by a firewall.</li>
                    <li>If using Claude Desktop, verify the absolute path in the JSON config file is correct and uses forward slashes (/) or escaped backslashes (\\).</li>
                  </ul>
                </div>
              </details>
            </div>
          </DocSection>
          
          <div className="mt-32 pt-10 border-t border-white/5 flex flex-col items-center justify-center text-zinc-600 gap-2">
            <div className="p-3 bg-white/5 rounded-full mb-2">
              <Sparkles size={20} className="text-zinc-500" />
            </div>
            <p className="text-xs uppercase tracking-widest font-bold">TikTok Slides Maker Studio</p>
            <p className="text-[10px] font-mono opacity-50">Build v2.2.0 • Local Environment</p>
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'editor' | 'docs'>('editor');
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [textQueue, setTextQueue] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [zoom, setZoom] = useState(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [globalSettings, setGlobalSettings] = useState<TextSettings>({
    fontSize: 100, fontFamily: 'TikTok Sans', color: '#ffffff', strokeColor: '#000000', strokeWidth: 1,
    shadow: false, shadowBlur: 20, shadowOpacity: 80, positionX: 50, positionY: 50, alignment: 'center', constrainToSlide: true
  });
  const [globalEffects, setGlobalEffects] = useState<ImageEffects>({
    enabled: false, grayscale: false, brightness: 85, contrast: 105, saturation: 100, imageOffset: 50, imageOffsetY: 50
  });

  const activeSlide = useMemo(() => slides.find(s => s.id === activeSlideId) || slides[0], [slides, activeSlideId]);

  // --- UPLOAD HANDLERS ---
  const readFileAsBase64 = (file: Blob): Promise<string> => {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
    });
  };

  const createSlideObject = (image: string, text: string): SlideData => ({
    id: Math.random().toString(36).substr(2, 9),
    image,
    layers: [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'heading',
        content: text,
        fontSize: 80,
        fontFamily: globalSettings.fontFamily || 'TikTok Sans',
        x: 50, y: 50,
        selected: false,
        alignment: 'center',
        width: 80,
        uppercase: true // Default to all caps for new slides from queue
    }],
    template: 'none',
    settings: { ...globalSettings },
    effects: { ...globalEffects }
  });

  const processImages = async (files: File[]) => {
    setIsProcessing(true);
    const newSlides: SlideData[] = [];
    const startIndex = slides.length;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await readFileAsBase64(file);
        const text = textQueue[startIndex + i] || 'Double click to edit';
        newSlides.push(createSlideObject(base64, text));
    }
    
    setSlides(prev => [...prev, ...newSlides]);
    if (newSlides.length > 0 && slides.length === 0) {
        setActiveSlideId(newSlides[0].id);
    }
    setIsProcessing(false);
  };

  const processZip = async (file: File) => {
    setIsProcessing(true);
    try {
        const zip = await JSZip.loadAsync(file);
        const images: {name: string, data: string}[] = [];
        
        // Extract images from zip
        const entries = Object.entries(zip.files).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [name, file] of entries) {
            if (file.dir) continue;
            if (name.match(/\.(jpg|jpeg|png|webp)$/i)) {
                const blob = await file.async('blob');
                const base64 = await readFileAsBase64(blob);
                images.push({ name, data: base64 });
            }
        }

        const newSlides: SlideData[] = [];
        const startIndex = slides.length;

        images.forEach((img, i) => {
            const text = textQueue[startIndex + i] || 'Double click to edit';
            newSlides.push(createSlideObject(img.data, text));
        });

        setSlides(prev => [...prev, ...newSlides]);
        if (newSlides.length > 0 && slides.length === 0) {
            setActiveSlideId(newSlides[0].id);
        }

    } catch (err) {
        console.error(err);
        alert("Error reading zip file. Ensure it contains images.");
    }
    setIsProcessing(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    e.target.value = ''; // Reset input

    // Check if user uploaded a zip
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
        await processZip(zipFile);
        return;
    }

    // Otherwise process as images
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
        await processImages(imageFiles);
    }
  };

  const applyTextToSlides = (texts: string[]) => {
      setSlides(prev => prev.map((slide, index) => {
          if (index < texts.length) {
              const newLayers = [...slide.layers];
              if (newLayers.length > 0) {
                  newLayers[0] = { ...newLayers[0], content: texts[index] };
              }
              return { ...slide, layers: newLayers };
          }
          return slide;
      }));
  };

  const handleTextSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = '';

    const name = file.name.toLowerCase();
    
    if (name.endsWith('.csv') || name.endsWith('.xlsx')) {
         Papa.parse(file, {
            complete: (results) => {
                const texts = results.data.map((row: any) => {
                    if (Array.isArray(row)) return row[0]; 
                    return Object.values(row)[0];
                }).filter(t => t && typeof t === 'string' && t.trim() !== '');
                
                setTextQueue(texts as string[]);
                if (slides.length > 0) applyTextToSlides(texts as string[]);
            },
            header: false 
         });
    } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target?.result as string;
            const lines = content.split('\n').map(l => l.trim()).filter(l => l);
            setTextQueue(lines);
            if (slides.length > 0) applyTextToSlides(lines);
        };
        reader.readAsText(file);
    }
  };

  // --- ACTIONS ---

  const updateSlide = useCallback((updates: Partial<SlideData>) => {
     if (!activeSlide) return;
     setSlides(prev => prev.map(s => s.id === activeSlide.id ? { ...s, ...updates } : s));
  }, [activeSlide]);

  const applyToAll = useCallback(() => {
     if (!activeSlide) return;
     setSlides(prev => prev.map(s => ({
        ...s,
        settings: activeSlide.settings,
        effects: activeSlide.effects
     })));
  }, [activeSlide]);

  const deleteSlide = useCallback(() => {
     if (slides.length <= 1) {
         setSlides([]);
         setActiveSlideId(null);
         return;
     }
     const idx = slides.findIndex(s => s.id === activeSlideId);
     const newSlides = slides.filter(s => s.id !== activeSlideId);
     setSlides(newSlides);
     setActiveSlideId(newSlides[Math.max(0, idx - 1)].id);
  }, [slides, activeSlideId]);

  const addSlide = useCallback(() => {
      // Trigger file upload instead of stock image
      fileInputRef.current?.click();
  }, []);

  const handleDownload = async () => {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
          const dataUrl = await generateSlideImage(slides[i], aspectRatio);
          const base64 = dataUrl.split(',')[1];
          zip.file(`slide-${i + 1}.png`, base64, { base64: true });
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tiktok-slides.zip';
      a.click();
  };
  
  if (view === 'docs') return <DocsPage onBack={() => setView('editor')} />;

  // --- EMPTY STATE (INITIAL LOAD) ---
  if (slides.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#050505] text-white space-y-8 p-10 font-sans overflow-hidden relative">
            {/* BG ATMOSPHERE */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="z-10 text-center space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">TikTok Slides</span> Studio
                </h1>
                <p className="text-zinc-500 font-medium max-w-lg mx-auto">Import your visuals and text to generate viral carousels in seconds.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl z-10 animate-in fade-in zoom-in-95 duration-700 delay-100">
                {/* IMAGE UPLOAD CARD */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex flex-col items-center justify-center p-12 border border-white/10 bg-zinc-900/50 hover:bg-zinc-900 hover:border-purple-500/50 rounded-3xl cursor-pointer transition-all hover:scale-[1.02] shadow-2xl backdrop-blur-sm"
                >
                    <div className="p-5 rounded-full bg-purple-500/10 text-purple-400 mb-6 group-hover:bg-purple-500 group-hover:text-white transition-colors shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                    {isProcessing ? <RefreshCw className="animate-spin" size={40} /> : <Upload size={40} />}
                    </div>
                    <h3 className="text-xl font-bold uppercase tracking-widest mb-2 text-white">Upload Visuals</h3>
                    <p className="text-zinc-500 text-center text-sm">Drag & Drop Images or ZIP archive</p>
                    <div className="flex gap-2 mt-4">
                        <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded text-zinc-500">JPG</span>
                        <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded text-zinc-500">PNG</span>
                        <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded text-zinc-500">ZIP</span>
                    </div>
                </div>

                {/* TEXT UPLOAD CARD */}
                <div 
                    onClick={() => textInputRef.current?.click()}
                    className={`group flex flex-col items-center justify-center p-12 border bg-zinc-900/50 hover:bg-zinc-900 rounded-3xl cursor-pointer transition-all hover:scale-[1.02] shadow-2xl backdrop-blur-sm ${textQueue.length > 0 ? 'border-green-500/50 bg-green-900/10' : 'border-white/10 hover:border-cyan-500/50'}`}
                >
                    <div className={`p-5 rounded-full mb-6 transition-colors shadow-[0_0_20px_rgba(6,182,212,0.2)] ${textQueue.length > 0 ? 'bg-green-500 text-white' : 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white'}`}>
                    {textQueue.length > 0 ? <Check size={40} /> : <FileText size={40} />}
                    </div>
                    <h3 className="text-xl font-bold uppercase tracking-widest mb-2 text-white">
                        {textQueue.length > 0 ? `${textQueue.length} Lines Loaded` : "Import Text"}
                    </h3>
                    <p className="text-zinc-500 text-center text-sm">Upload CSV or TXT file</p>
                    <p className="text-zinc-600 text-xs mt-4 font-mono">{textQueue.length > 0 ? 'Ready to sync with images' : 'Auto-syncs with next upload'}</p>
                </div>
            </div>

            {/* HIDDEN INPUTS */}
            <input type="file" multiple accept="image/*,.zip,application/zip,application/x-zip-compressed" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <input type="file" accept=".csv,.txt,text/plain,text/csv" ref={textInputRef} className="hidden" onChange={handleTextSelect} />
            
            <div className="absolute bottom-6 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                v2.2.0 • Studio Edition
            </div>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* HIDDEN INPUTS */}
      <input type="file" multiple accept="image/*,.zip,application/zip,application/x-zip-compressed" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
      <input type="file" accept=".csv,.txt,text/plain,text/csv" ref={textInputRef} className="hidden" onChange={handleTextSelect} />
      
      {/* LEFT SIDEBAR - CONTROLS */}
      <div className="w-[400px] flex flex-col border-r border-white/10 bg-[#09090b] z-20 shadow-2xl">
         <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-2">
               <div className="p-2 bg-purple-600 rounded-lg"><Layout size={18} className="text-white"/></div>
               <span className="font-bold tracking-tight">TikTok Studio</span>
            </div>
            <button onClick={() => setView('docs')} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
               <BookOpen size={20} />
            </button>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            <Controls 
               slide={activeSlide}
               globalSettings={globalSettings}
               globalEffects={globalEffects}
               setGlobalSettings={setGlobalSettings}
               setGlobalEffects={setGlobalEffects}
               onUpdate={updateSlide}
               onApplyAll={applyToAll}
               onDelete={deleteSlide}
            />
         </div>
      </div>

      {/* CENTER - PREVIEW */}
      <div className="flex-1 flex flex-col relative bg-[#050505]">
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
         
         {/* TOOLBAR */}
         <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md z-10">
            {/* Left Side: Aspect Ratio */}
            <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-white/5">
               {(['9:16', '1:1', '16:9'] as AspectRatio[]).map(ratio => (
                  <button 
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aspectRatio === ratio ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                  >
                    {ratio}
                  </button>
               ))}
            </div>

            {/* Right Side: Actions + Zoom */}
            <div className="flex items-center gap-3">
               <button onClick={addSlide} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-white transition-all border border-white/5">
                  <Plus size={14} /> Add Images
               </button>
               <button onClick={() => textInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-white transition-all border border-white/5">
                  <FileText size={14} /> Add Text
               </button>
               <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-purple-400 hover:text-white rounded-lg text-xs font-bold transition-all shadow-lg hover:shadow-purple-500/20">
                  <Download size={14} /> Export Deck
               </button>

               <div className="w-px h-8 bg-white/10 mx-2"></div>

               {/* Zoom Controls */}
               <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-white/5 px-2">
                  <ZoomOut size={14} className="text-zinc-500" />
                  <input 
                    type="range" 
                    min="0.25" 
                    max="2" 
                    step="0.05" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-24 h-1 bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3"
                  />
                  <ZoomIn size={14} className="text-zinc-500" />
                  <span className="text-[10px] font-mono w-8 text-center text-zinc-400">{Math.round(zoom * 100)}%</span>
               </div>
            </div>
         </div>

         {/* CANVAS AREA */}
         <div className="flex-1 overflow-hidden relative flex flex-col">
            <SlidePreview 
               slide={activeSlide} 
               aspectRatio={aspectRatio}
               zoom={zoom}
               onPositionChange={(layers) => updateSlide({ layers })} 
            />
            
            {/* FILMSTRIP */}
            <div className="h-32 border-t border-white/10 bg-[#09090b] flex items-center gap-4 px-6 overflow-x-auto z-10 custom-scrollbar">
               {slides.map((s, i) => (
                  <div 
                     key={s.id}
                     onClick={() => setActiveSlideId(s.id)}
                     className={`relative h-24 aspect-[9/16] rounded-md overflow-hidden cursor-pointer border-2 transition-all shrink-0 group ${s.id === activeSlideId ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-105' : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'}`}
                  >
                     <img src={s.image} className="w-full h-full object-cover" alt={`Slide ${i+1}`} />
                     <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[8px] font-mono text-center text-white backdrop-blur-sm">
                        #{i+1}
                     </div>
                  </div>
               ))}
               <button onClick={addSlide} className="h-24 aspect-[9/16] rounded-md border-2 border-dashed border-zinc-800 hover:border-purple-500/50 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-purple-400 transition-all shrink-0 bg-zinc-900/50 group">
                  <Plus size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-bold uppercase">Add</span>
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default App;