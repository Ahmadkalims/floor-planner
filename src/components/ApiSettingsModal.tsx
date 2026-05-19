import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Save, KeyRound } from 'lucide-react';

export const ApiSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { 
    userGeminiLanguageKey, setUserGeminiLanguageKey,
    userGeminiImageKey, setUserGeminiImageKey,
    userHuggingFaceKey, setUserHuggingFaceKey,
    userStabilityKey, setUserStabilityKey,
    userReplicateKey, setUserReplicateKey,
    userTogetherKey, setUserTogetherKey,
    userMagnificKey, setUserMagnificKey
  } = useStore();

  const [imgKey, setImgKey] = useState(userGeminiImageKey);
  const [hfKey, setHfKey] = useState(userHuggingFaceKey);
  const [stabKey, setStabKey] = useState(userStabilityKey);
  const [repKey, setRepKey] = useState(userReplicateKey);
  const [togKey, setTogKey] = useState(userTogetherKey);
  const [magKey, setMagKey] = useState(userMagnificKey);

  const handleSave = () => {
    setUserGeminiImageKey(imgKey);
    setUserHuggingFaceKey(hfKey);
    setUserStabilityKey(stabKey);
    setUserReplicateKey(repKey);
    setUserTogetherKey(togKey);
    setUserMagnificKey(magKey);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel" style={{
        width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', position: 'relative',
        display: 'flex', flexDirection: 'column', gap: '20px',
        backdropFilter: 'blur(30px) saturate(200%)', WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: '16px'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}
        >
          <X size={24} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <KeyRound size={28} color="var(--accent-color)" />
          <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '24px' }}>API Settings</h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
          Enter your personal API keys below. They will be securely saved in your local browser storage and never sent to our servers.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="param-input">
            <label>Gemini Vision API Key</label>
            <input type="password" placeholder="AIzaSy..." value={imgKey} onChange={e => setImgKey(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Get Key</a>
          </div>
          <div className="param-input">
            <label>Hugging Face Token</label>
            <input type="password" placeholder="hf_..." value={hfKey} onChange={e => setHfKey(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Get Key</a>
          </div>
          <div className="param-input">
            <label>Stability AI Key</label>
            <input type="password" placeholder="sk-..." value={stabKey} onChange={e => setStabKey(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
            <a href="https://platform.stability.ai/account/keys" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Get Key</a>
          </div>
          <div className="param-input">
            <label>Replicate Token</label>
            <input type="password" placeholder="r8_..." value={repKey} onChange={e => setRepKey(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
            <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Get Key</a>
          </div>
          <div className="param-input">
            <label>Together AI Key</label>
            <input type="password" placeholder="..." value={togKey} onChange={e => setTogKey(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
            <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Get Key</a>
          </div>
          <div className="param-input">
            <label>Magnific AI Key</label>
            <input type="password" placeholder="..." value={magKey} onChange={e => setMagKey(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
            <a href="https://magnific.ai" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Get Key</a>
          </div>
        </div>

        <button className="action-btn primary" onClick={handleSave} style={{ alignSelf: 'flex-end', marginTop: '10px' }}>
          <Save size={18} />
          Save Keys
        </button>
      </div>
    </div>
  );
};
