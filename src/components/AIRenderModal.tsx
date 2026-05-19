import React, { useState, useEffect } from 'react';
import { X, ScanLine, Loader2, Link2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface AIRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Provider = 'stability' | 'huggingface' | 'replicate' | 'together' | 'magnific';
type ViewMode = 'interior' | 'exterior';

const resizeImage = (dataUrl: string, targetWidth: number, targetHeight: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        
        const ratio = Math.min(targetWidth / img.width, targetHeight / img.height);
        const drawWidth = img.width * ratio;
        const drawHeight = img.height * ratio;
        const offsetX = (targetWidth - drawWidth) / 2;
        const offsetY = (targetHeight - drawHeight) / 2;
        
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
};

export const AIRenderModal: React.FC<AIRenderModalProps> = ({ isOpen, onClose }) => {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState('Modern');
  const [provider, setProvider] = useState<Provider>('stability');
  const [viewMode, setViewMode] = useState<ViewMode>('interior');
  
  const store = useStore();

  const [status, setStatus] = useState<'idle' | 'capturing' | 'generating' | 'done' | 'error'>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
  
  const presets = ['Modern', 'Minimalistic', 'Vintage', 'Indian', 'Baroque', 'Industrial', 'Sci-Fi'];

  useEffect(() => {
    if (isOpen) {
      setStatus('capturing');
      setScreenshotUrl(null);
      setResultImage(null);
      
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          try {
            const url = canvas.toDataURL('image/png');
            setScreenshotUrl(url);
            setStatus('idle');
          } catch (e) {
            console.error(e);
            setStatus('error');
          }
        }
      }, 500);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    let apiKey = '';
    if (provider === 'stability') apiKey = store.userStabilityKey || import.meta.env.VITE_STABILITY_API_KEY;
    if (provider === 'huggingface') apiKey = store.userHuggingFaceKey || import.meta.env.VITE_HUGGINGFACE_API_KEY;
    if (provider === 'replicate') apiKey = store.userReplicateKey || import.meta.env.VITE_REPLICATE_API_KEY;
    if (provider === 'together') apiKey = store.userTogetherKey || import.meta.env.VITE_TOGETHER_API_KEY;
    if (provider === 'magnific') apiKey = store.userMagnificKey || import.meta.env.VITE_MAGNIFIC_API_KEY;

    if (!apiKey) {
      alert(`Please enter your ${provider} API Key in Settings`);
      return;
    }
    
    setStatus('generating');
    
    try {
      let prompt = '';
      if (viewMode === 'interior') {
        prompt = `photorealistic ${preset} style interior architecture, highly detailed, cinematic lighting, lush indoor foliage, vibrant potted plants, soft natural light through windows, 4k resolution, Unreal Engine 5 render, interior design magazine quality.`;
      } else {
        prompt = `photorealistic ${preset} style exterior architecture, stunning architectural rendering, lush outdoor foliage, paved roads, clear beautiful skies, dummy people walking with motion blur, vibrant landscaping, cinematic sunlight, highly detailed, 4k resolution, hyper-realistic environment.`;
      }

      if (provider === 'stability') {
        if (!screenshotUrl) throw new Error("No screenshot available");
        // SDXL requires strict dimensions, 1024x1024 is the standard
        const resizedDataUrl = await resizeImage(screenshotUrl, 1024, 1024);
        const response = await fetch(resizedDataUrl);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('init_image', blob);
        formData.append('init_image_mode', 'IMAGE_STRENGTH');
        formData.append('image_strength', '0.40');
        formData.append('text_prompts[0][text]', prompt);
        formData.append('cfg_scale', '7');
        formData.append('samples', '1');
        formData.append('steps', '30');

        const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
          body: formData
        });
        
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setResultImage(`data:image/png;base64,${data.artifacts[0].base64}`);

      } else if (provider === 'huggingface') {
        const res = await fetch('https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: prompt })
        });
        
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        setResultImage(URL.createObjectURL(blob));

      } else if (provider === 'replicate') {
        const resizedDataUrl = await resizeImage(screenshotUrl!, 512, 512);
        
        const startRes = await fetch('https://corsproxy.io/?https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            version: "854e87270c1a1f2c024dd432a51f2bc8b1933e14fb5af10a6a422a59a9446f2c",
            input: {
              image: resizedDataUrl,
              prompt: prompt,
              num_samples: "1",
              image_resolution: "512"
            }
          })
        });
        
        if (!startRes.ok) throw new Error(await startRes.text());
        let prediction = await startRes.json();
        
        while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
          await new Promise(r => setTimeout(r, 2500));
          const pollRes = await fetch(`https://corsproxy.io/?${prediction.urls.get}`, {
            headers: { 'Authorization': `Token ${apiKey}` }
          });
          prediction = await pollRes.json();
        }
        
        if (prediction.status === 'failed') throw new Error("Replicate generation failed");
        
        const finalUrl = Array.isArray(prediction.output) ? prediction.output[prediction.output.length - 1] : prediction.output;
        setResultImage(finalUrl);

      } else if (provider === 'together') {
        // Together AI uses text-to-image mostly for free tier
        const res = await fetch('https://api.together.xyz/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            prompt: prompt,
            n: 1,
            steps: 20
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setResultImage(data.data[0].url || `data:image/png;base64,${data.data[0].b64_json}`);
        
      } else if (provider === 'magnific') {
        alert("Magnific AI API is not fully integrated yet, falling back to HuggingFace for demo");
        throw new Error("Magnific AI requires a paid subscription endpoint.");
      }
      
      setStatus('done');
    } catch (e: any) {
      console.error(e);
      alert("Generation Error: " + (e.message || "Unknown error occurred"));
      setStatus('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex',
      alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'
    }}>
      <div className="glass-panel" style={{ width: '900px', height: '600px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10 }}>
          <X size={24} />
        </button>

        <h2 style={{ margin: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ScanLine className="text-pink-500" /> AI Interior Generator
        </h2>

        <div style={{ display: 'flex', flex: 1, gap: '20px', padding: '20px', overflow: 'hidden' }}>
          
          {/* Left Column: Image Preview */}
          <div style={{ flex: 2, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {status === 'capturing' && <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Loader2 className="animate-spin" /> Capturing 3D View...</div>}
            
            {screenshotUrl && !resultImage && (
              <img src={screenshotUrl} alt="3D View" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
            
            {resultImage && (
              <img src={resultImage} alt="Generated Interior" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            )}

            {/* Scanning Overlay Animation */}
            {status === 'generating' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(139, 92, 246, 0.1)', overflow: 'hidden' }}>
                <div style={{ 
                  width: '100%', height: '4px', background: '#ec4899',
                  boxShadow: '0 0 20px 5px rgba(236, 72, 153, 0.5)',
                  position: 'absolute', top: '50%',
                  animation: 'scan 2s linear infinite'
                }} />
                <style>{`
                  @keyframes scan {
                    0% { top: -10%; }
                    100% { top: 110%; }
                  }
                  .animate-spin { animation: spin 1s linear infinite; }
                  @keyframes spin { 100% { transform: rotate(360deg); } }
                `}</style>
                <div style={{ position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: 'white', fontWeight: 'bold', textShadow: '0 2px 4px black', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <Loader2 className="animate-spin" size={18} /> Processing with {provider}...
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Controls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '5px' }}>
            
            <div className="param-input">
              <label>API Provider</label>
              <select 
                value={provider} 
                onChange={e => setProvider(e.target.value as Provider)}
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
              >
                <option value="stability" style={{color: 'black'}}>Stability AI</option>
                <option value="huggingface" style={{color: 'black'}}>Hugging Face</option>
                <option value="replicate" style={{color: 'black'}}>Replicate</option>
                <option value="together" style={{color: 'black'}}>Together AI</option>
                <option value="magnific" style={{color: 'black'}}>Magnific AI</option>
              </select>
            </div>

            <div className="param-input">
              <label>View Mode</label>
              <select 
                value={viewMode} 
                onChange={e => setViewMode(e.target.value as ViewMode)}
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
              >
                <option value="interior" style={{color: 'black'}}>Interior (Indoor Foliage, Soft Lighting)</option>
                <option value="exterior" style={{color: 'black'}}>Exterior (Roads, Skies, Motion Blurred People)</option>
              </select>
            </div>

            <div className="param-input">
              <label>Design Style Preset</label>
              <select 
                value={preset} 
                onChange={e => setPreset(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
              >
                {presets.map(p => <option key={p} value={p} style={{color: 'black'}}>{p}</option>)}
              </select>
            </div>
            
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '10px' }}>
              Ensure your API key is set in the main Settings (Gear Icon) before generating.
            </div>

            <button 
              className="action-btn"
              style={{ marginTop: 'auto', padding: '15px', background: 'linear-gradient(to right, #8b5cf6, #ec4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: status === 'generating' ? 'not-allowed' : 'pointer', opacity: status === 'generating' ? 0.7 : 1 }}
              onClick={handleGenerate}
              disabled={status === 'generating'}
            >
              {status === 'generating' ? 'Generating...' : 'Generate AI Render'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
