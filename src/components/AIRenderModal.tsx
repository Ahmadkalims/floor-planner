import React, { useState, useEffect } from 'react';
import { X, ScanLine, Loader2, Link2 } from 'lucide-react';

interface AIRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Provider = 'stability' | 'huggingface' | 'replicate';

const resizeImage = (dataUrl: string, maxDim: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      // Stability AI requires dimensions to be multiples of 64
      width = Math.max(64, Math.floor(width / 64) * 64);
      height = Math.max(64, Math.floor(height / 64) * 64);
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
};

export const AIRenderModal: React.FC<AIRenderModalProps> = ({ isOpen, onClose }) => {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState('Modern');
  const [provider, setProvider] = useState<Provider>('stability');
  
  const [apiKeys, setApiKeys] = useState({
    stability: import.meta.env.VITE_STABILITY_API_KEY || '',
    huggingface: import.meta.env.VITE_HUGGINGFACE_API_KEY || '',
    replicate: import.meta.env.VITE_REPLICATE_API_KEY || ''
  });

  const [status, setStatus] = useState<'idle' | 'capturing' | 'generating' | 'done' | 'error'>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
  
  const presets = ['Modern', 'Minimalistic', 'Vintage', 'Indian', 'Baroque', 'Industrial', 'Sci-Fi'];

  const providerLinks = {
    stability: 'https://platform.stability.ai/account/keys',
    huggingface: 'https://huggingface.co/settings/tokens',
    replicate: 'https://replicate.com/account/api-tokens'
  };

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
    const apiKey = apiKeys[provider];
    if (!apiKey) {
      alert("Please enter your API Key");
      return;
    }
    
    setStatus('generating');
    
    try {
      const prompt = `A photorealistic ${preset} style interior design room, architectural photography, cinematic lighting, 4k resolution, highly detailed`;

      if (provider === 'stability') {
        if (!screenshotUrl) throw new Error("No screenshot available");
        
        const resizedDataUrl = await resizeImage(screenshotUrl, 1024);
        const response = await fetch(resizedDataUrl);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('init_image', blob);
        formData.append('init_image_mode', 'IMAGE_STRENGTH');
        formData.append('image_strength', '0.45'); // 0.0 to 1.0 (Lower = more AI creativity)
        formData.append('text_prompts[0][text]', prompt);
        formData.append('cfg_scale', '7');
        formData.append('samples', '1');
        formData.append('steps', '30');

        const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v1-6/image-to-image', {
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
        // HF Inference
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
        const resizedDataUrl = await resizeImage(screenshotUrl!, 512);
        
        // Use a different proxy specifically handling large payloads better, or fallback to corsproxy if it was just a size issue.
        // We will try corsproxy first because the size is now much smaller (512x512 = ~100kb base64).
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
        
        // Polling loop
        while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
          await new Promise(r => setTimeout(r, 2500));
          const pollRes = await fetch(`https://corsproxy.io/?${prediction.urls.get}`, {
            headers: { 'Authorization': `Token ${apiKey}` }
          });
          prediction = await pollRes.json();
        }
        
        if (prediction.status === 'failed') throw new Error("Replicate generation failed");
        
        // ControlNet usually returns an array: [annotated_image, generated_image]
        const finalUrl = Array.isArray(prediction.output) ? prediction.output[prediction.output.length - 1] : prediction.output;
        setResultImage(finalUrl);
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
                <option value="stability" style={{color: 'black'}}>Stability AI (Image-to-Image)</option>
                <option value="huggingface" style={{color: 'black'}}>Hugging Face (Text-to-Image)</option>
                <option value="replicate" style={{color: 'black'}}>Replicate (ControlNet)</option>
              </select>
            </div>

            <div className="param-input">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                API Key
                <a href={providerLinks[provider]} target="_blank" rel="noreferrer" style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '2px', textDecoration: 'none' }}>
                  <Link2 size={12} /> Get Key
                </a>
              </label>
              <input 
                type="password" 
                value={apiKeys[provider]} 
                onChange={e => setApiKeys({ ...apiKeys, [provider]: e.target.value })} 
                placeholder="Enter API Key"
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} 
              />
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
              {provider === 'stability' && "Uses structural outlines from your 3D view to guide the generation."}
              {provider === 'huggingface' && "Free tier uses SDXL Text-to-Image (ignores 3D view shape)."}
              {provider === 'replicate' && "Uses advanced ControlNet to mathematically match your wall lines exactly."}
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
