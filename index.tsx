import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, Activity, Volume2, Plus, Trash2, Upload, RotateCcw, Zap, X, Play, Check } from 'lucide-react';

// --- Types ---

type AudioFile = {
  name: string;
  url: string; // Blob URL
};

type SchemeLevel = {
  files: AudioFile[];
};

type Scheme = {
  id: string;
  name: string;
  levels: {
    1: SchemeLevel; // 1-20
    2: SchemeLevel; // 21-60
    3: SchemeLevel; // 61-90
    4: SchemeLevel; // 91-100
    5: SchemeLevel; // Special / Dirty Talk Max
  };
};

// --- Constants ---

const LEVEL_DESCRIPTIONS = {
  1: "阶段 1: 微感 (快感度 1-20)",
  2: "阶段 2: 中感 (快感度 21-60)",
  3: "阶段 3: 高感 (快感度 61-90)",
  4: "阶段 4: 极乐 (快感度 91-100)",
  5: "阶段 5: 爆发 (骚话满值触发)",
};

const DEFAULT_SCHEME: Scheme = {
  id: 'default-1',
  name: '默认方案 1',
  levels: {
    1: { files: [] },
    2: { files: [] },
    3: { files: [] },
    4: { files: [] },
    5: { files: [] },
  },
};

// --- Main Component ---

const App = () => {
  // -- State: UI & Settings --
  const [masterSwitch, setMasterSwitch] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1.0); // 0.0 - 1.0
  const [sensitivity, setSensitivity] = useState(3); // 1 - 5

  // -- State: Logic Variables --
  const [pleasure, setPleasure] = useState(0); // 0 - 100
  const [dirtyTalk, setDirtyTalk] = useState(0); // 0 - 15
  const [currentMotion, setCurrentMotion] = useState(0); // Visual only

  // -- State: Data --
  const [schemes, setSchemes] = useState<Scheme[]>([DEFAULT_SCHEME]);
  const [activeSchemeId, setActiveSchemeId] = useState<string>('default-1');
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  // Temp state for the editor
  const [editorState, setEditorState] = useState<Scheme | null>(null);

  // -- Refs for Audio & Logic --
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const motionDetectedInCycle = useRef(false);
  const lastMotionTime = useRef(0);
  const pleasureRef = useRef(0); // Ref for sync access inside callbacks
  const dirtyTalkRef = useRef(0);
  const activeSchemeRef = useRef<Scheme>(DEFAULT_SCHEME);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Sync refs with state
  useEffect(() => { pleasureRef.current = pleasure; }, [pleasure]);
  useEffect(() => { dirtyTalkRef.current = dirtyTalk; }, [dirtyTalk]);
  useEffect(() => { 
    const s = schemes.find(s => s.id === activeSchemeId) || schemes[0];
    activeSchemeRef.current = s;
  }, [activeSchemeId, schemes]);

  // --- Master Switch with Audio Unlock ---
  const toggleMasterSwitch = () => {
    if (!masterSwitch) {
      // Compatibility: Unlock Web Audio Context on first user interaction (Touch/Click)
      // This fixes issues on iOS/Android where audio is blocked until interaction
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
      // Also helpful to prime the audio element if needed, though we create new Audio() later
      if (audioRef.current) {
        audioRef.current.load();
      }
    }
    setMasterSwitch(!masterSwitch);
  };

  // --- Audio Engine Logic ---

  const getFilesForLevel = (scheme: Scheme, level: number): AudioFile[] => {
    return scheme.levels[level as keyof typeof scheme.levels].files;
  };

  const playRandomClip = (files: AudioFile[]) => {
    if (!files || files.length === 0) return;
    if (!audioRef.current) return;

    const randomFile = files[Math.floor(Math.random() * files.length)];
    audioRef.current.src = randomFile.url;
    audioRef.current.volume = globalVolume;
    
    isPlayingRef.current = true;
    
    // Promise handling for better compatibility
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error("Playback prevented:", error);
        isPlayingRef.current = false;
      });
    }
  };

  const handleLogicAndPlay = () => {
    if (!masterSwitch) return;
    
    const p = pleasureRef.current;
    const dt = dirtyTalkRef.current;
    const scheme = activeSchemeRef.current;
    const motionChange = motionDetectedInCycle.current || (Date.now() - lastMotionTime.current < 2000);

    // Rule 1: Pleasure 0 OR No motion in 2s -> Don't play
    if (p === 0 || !motionChange) {
      isPlayingRef.current = false;
      return;
    }

    let nextFiles: AudioFile[] = [];
    let newDirtyTalk = dt;

    // Rule 2: 1-20
    if (p >= 1 && p <= 20) {
      nextFiles = getFilesForLevel(scheme, 1);
    }
    // Rule 3: 21-60
    else if (p >= 21 && p <= 60) {
      if (dt < 15) {
        // 3a
        nextFiles = getFilesForLevel(scheme, 2);
        newDirtyTalk++;
      } else {
        // dt == 15
        const lvl5 = getFilesForLevel(scheme, 5);
        if (lvl5.length > 0) {
          // 3b
          nextFiles = lvl5;
          newDirtyTalk = 0;
        } else {
          // 3c
          newDirtyTalk = 0;
        }
      }
    }
    // Rule 4: 61-90
    else if (p >= 61 && p <= 90) {
      if (dt < 15) {
        // 4a
        nextFiles = getFilesForLevel(scheme, 3);
        newDirtyTalk++;
      } else {
        // dt == 15
        const lvl5 = getFilesForLevel(scheme, 5);
        if (lvl5.length > 0) {
          // 4b
          nextFiles = lvl5;
          newDirtyTalk = 0;
        } else {
          // 4c
          newDirtyTalk = 0;
        }
      }
    }
    // Rule 5: 91-100
    else if (p >= 91 && p <= 100) {
      nextFiles = getFilesForLevel(scheme, 4);
    }

    // Update Dirty Talk State
    setDirtyTalk(newDirtyTalk);
    dirtyTalkRef.current = newDirtyTalk;

    if (nextFiles.length > 0) {
      playRandomClip(nextFiles);
    } else {
      isPlayingRef.current = false;
    }
  };

  // Setup Audio Element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    
    const onEnded = () => {
      isPlayingRef.current = false;
      // "每当音频完毕根据完毕时的音频播放逻辑决定下一个播放的音频"
      handleLogicAndPlay();
    };

    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [masterSwitch]); 

  // Update volume in real-time
  useEffect(() => {
    if(audioRef.current) audioRef.current.volume = globalVolume;
  }, [globalVolume]);


  // --- Motion Detection Engine ---

  useEffect(() => {
    let lastAcc = { x: 0, y: 0, z: 0 };
    const threshold = 2.0; 

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!event.accelerationIncludingGravity) return;
      const { x, y, z } = event.accelerationIncludingGravity;
      if (x === null || y === null || z === null) return;

      const deltaX = Math.abs(x - lastAcc.x);
      const deltaY = Math.abs(y - lastAcc.y);
      const deltaZ = Math.abs(z - lastAcc.z);

      // Visualizer
      const magnitude = Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ);
      // Optimize: Only update state if significant change to reduce reacts
      if (magnitude > 0.5) {
          setCurrentMotion(Math.min(magnitude * 5, 100)); 
      } else {
          // Decay visual slowly if needed, or just set 0
          if (Math.random() > 0.7) setCurrentMotion(0); // Stochastic decay to save renders
      }

      if (magnitude > threshold) {
        motionDetectedInCycle.current = true;
        lastMotionTime.current = Date.now();
        
        // Trigger play if currently idle and master switch is on
        if (masterSwitch && !isPlayingRef.current) {
          handleLogicAndPlay();
        }
      }

      lastAcc = { x, y, z };
    };

    if (masterSwitch) {
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            (DeviceMotionEvent as any).requestPermission()
                .then((response: string) => {
                    if (response === 'granted') {
                        window.addEventListener('devicemotion', handleMotion);
                    }
                })
                .catch(console.error);
        } else {
            window.addEventListener('devicemotion', handleMotion);
        }
    } else {
        window.removeEventListener('devicemotion', handleMotion);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [masterSwitch]);

  // --- The 2-Second Heartbeat Cycle ---
  useEffect(() => {
    if (!masterSwitch) return;

    const interval = setInterval(() => {
      // Logic: Update Pleasure Level
      if (motionDetectedInCycle.current) {
        setPleasure(prev => Math.min(prev + sensitivity, 100));
      } else {
        setPleasure(prev => Math.max(prev - 5, 0));
      }
      
      motionDetectedInCycle.current = false;
      
    }, 2000);

    return () => clearInterval(interval);
  }, [masterSwitch, sensitivity]);


  // --- Scheme Management Handlers ---

  const handleCreateScheme = () => {
    const newId = `scheme-${Date.now()}`;
    const newScheme: Scheme = {
      id: newId,
      name: `新方案 ${schemes.length + 1}`,
      levels: { 1: {files:[]}, 2: {files:[]}, 3: {files:[]}, 4: {files:[]}, 5: {files:[]} }
    };
    setSchemes([...schemes, newScheme]);
    setEditorState(JSON.parse(JSON.stringify(newScheme))); // Deep copy
    setEditingSchemeId(newId);
  };

  const handleEditScheme = (scheme: Scheme) => {
    setEditorState(JSON.parse(JSON.stringify(scheme)));
    setEditingSchemeId(scheme.id);
  };

  const handleDeleteScheme = (id: string) => {
    if (schemes.length <= 1) {
        alert("至少保留一个方案");
        return;
    }
    if (confirm("确定要删除这个音频方案吗？")) {
      const newSchemes = schemes.filter(s => s.id !== id);
      setSchemes(newSchemes);
      if (activeSchemeId === id) {
        setActiveSchemeId(newSchemes[0].id);
      }
    }
  };

  const handleSaveEditor = () => {
    if (!editorState) return;
    setSchemes(prev => prev.map(s => s.id === editorState.id ? editorState : s));
    if (activeSchemeId === editorState.id) {
        activeSchemeRef.current = editorState;
    }
    setEditingSchemeId(null);
    setEditorState(null);
  };

  const handleImportFiles = (level: number, files: FileList | null) => {
    if (!editorState || !files) return;
    
    const newFiles: AudioFile[] = Array.from(files).map(f => ({
      name: f.name,
      url: URL.createObjectURL(f)
    }));

    setEditorState({
      ...editorState,
      levels: {
        ...editorState.levels,
        [level]: {
          files: [...editorState.levels[level as 1|2|3|4|5].files, ...newFiles]
        }
      }
    });
  };

  const handleClearFiles = (level: number) => {
    if (!editorState) return;
    setEditorState({
        ...editorState,
        levels: {
          ...editorState.levels,
          [level]: { files: [] }
        }
      });
  };


  // --- UI Components ---

  // 1. Editor View
  if (editingSchemeId && editorState) {
    return (
      <div className="min-h-screen p-4 pb-24 bg-[#F3F1F6] select-none">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#F3F1F6]/90 backdrop-blur-md z-20 p-2 rounded-xl transition-all">
            <h2 className="text-2xl font-bold text-slate-800">编辑方案</h2>
            <div className="flex gap-3">
                <button onClick={() => setEditingSchemeId(null)} className="w-10 h-10 rounded-full bg-white text-slate-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                    <X size={20} />
                </button>
                <button onClick={handleSaveEditor} className="px-5 h-10 rounded-full bg-pink-300 text-slate-900 text-sm font-bold shadow-sm active:scale-95 transition-transform flex items-center gap-2">
                    <Check size={18} /> 保存
                </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm shadow-purple-100 mb-4">
             <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">方案名称</label>
             <input 
                type="text" 
                value={editorState.name} 
                onChange={(e) => setEditorState({...editorState, name: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-pink-200 focus:bg-white outline-none transition text-slate-800 font-medium"
             />
          </div>

          {[1, 2, 3, 4, 5].map((level) => (
            <div key={level} className="bg-white p-5 rounded-[2rem] shadow-sm shadow-purple-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-700 text-base">{LEVEL_DESCRIPTIONS[level as keyof typeof LEVEL_DESCRIPTIONS]}</h3>
                <span className="bg-purple-100 text-purple-600 text-[10px] px-2 py-1 rounded-full font-mono font-bold">
                    LV.{level}
                </span>
              </div>
              
              <div className="bg-slate-50 rounded-2xl p-3 mb-4 min-h-[60px] max-h-[120px] overflow-y-auto border border-slate-100">
                {editorState.levels[level as 1|2|3|4|5].files.length === 0 ? (
                  <span className="text-slate-400 text-sm flex items-center justify-center h-full">未导入音频</span>
                ) : (
                  <ul className="space-y-2">
                    {editorState.levels[level as 1|2|3|4|5].files.map((f, i) => (
                      <li key={i} className="text-xs text-slate-600 truncate flex items-center bg-white p-2 rounded-lg shadow-sm">
                        <Volume2 size={14} className="mr-2 text-pink-300" /> {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-3">
                <label className="flex-1 relative cursor-pointer group">
                   <input 
                     type="file" 
                     multiple 
                     accept="audio/*" 
                     className="hidden"
                     onChange={(e) => handleImportFiles(level, e.target.files)}
                   />
                   <div className="w-full py-3 bg-pink-300 text-slate-900 rounded-2xl flex items-center justify-center font-bold text-sm active:scale-95 transition-all group-hover:bg-pink-300/90">
                     <Upload size={18} className="mr-2" /> 导入音频
                   </div>
                </label>
                <button 
                    onClick={() => handleClearFiles(level)}
                    className="w-12 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 active:scale-95 transition flex items-center justify-center"
                >
                    <RotateCcw size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Main App View
  return (
    <div className="min-h-screen select-none pb-10">
      <div className="max-w-md mx-auto p-5 space-y-6">
        
        {/* Top Header & Master Switch */}
        <header className="flex justify-between items-center pt-2 pb-2">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Joysound</h1>
          <button 
            onClick={toggleMasterSwitch}
            className={`w-16 h-9 rounded-full transition-colors relative shadow-inner ${masterSwitch ? 'bg-pink-300' : 'bg-slate-200'}`}
          >
            <div className={`w-7 h-7 bg-white rounded-full absolute top-1 transition-all shadow-md duration-300 ease-out-back ${masterSwitch ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </header>

        {/* Main Dashboard Card */}
        <div className="bg-white rounded-[2.5rem] p-7 shadow-xl shadow-purple-100/50 space-y-7 relative overflow-hidden transform-gpu">
           {/* Vibration Visualizer Background effect */}
           <div 
                className="absolute right-0 top-0 w-full h-full pointer-events-none opacity-5 bg-purple-500 transition-transform duration-100 origin-bottom will-change-transform"
                style={{ transform: `scaleY(${currentMotion / 20})` }}
           />

          {/* Global Volume */}
          <div className="space-y-3 relative z-10">
             <div className="flex justify-between text-sm font-bold text-slate-500">
               <span className="flex items-center gap-2"><Volume2 size={18} className="text-pink-300"/> 全局音量</span>
               <span className="text-slate-800">{Math.round(globalVolume * 100)}%</span>
             </div>
             <input 
               type="range" 
               min="0" max="1" step="0.01" 
               value={globalVolume} 
               onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
               className="material-slider"
               style={{ backgroundSize: `${globalVolume*100}% 100%` }}
             />
          </div>

          {/* Sensitivity */}
          <div className="space-y-3 relative z-10">
             <div className="flex justify-between text-sm font-bold text-slate-500">
               <span className="flex items-center gap-2"><Activity size={18} className="text-pink-300"/> 敏感度</span>
               <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-xs">LV.{sensitivity}</span>
             </div>
             <input 
               type="range" 
               min="1" max="5" step="1" 
               value={sensitivity} 
               onChange={(e) => setSensitivity(parseInt(e.target.value))}
               className="material-slider"
             />
             <div className="flex justify-between text-[10px] font-bold text-slate-300 px-1 mt-1">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
             </div>
          </div>

          {/* Meters */}
          <div className="grid grid-cols-2 gap-4 relative z-10">
             {/* Pleasure Meter */}
             <div className="bg-[#F9F8FC] rounded-3xl p-4 flex flex-col items-center justify-center space-y-3 border border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">快感度</span>
                <div className="relative w-full h-32 bg-slate-200 rounded-full overflow-hidden transform-gpu">
                   <div 
                     className="absolute bottom-0 left-0 w-full bg-pink-300 transition-all duration-500 ease-out will-change-transform"
                     style={{ height: `${pleasure}%` }}
                   />
                </div>
                <span className="text-3xl font-black text-slate-700">{pleasure}</span>
             </div>

             {/* Dirty Talk Meter */}
             <div className="bg-[#F9F8FC] rounded-3xl p-4 flex flex-col items-center justify-center space-y-3 border border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">骚话值</span>
                <div className="relative w-24 h-24 transform-gpu">
                   <svg className="w-full h-full -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="#E2E8F0" strokeWidth="10" fill="none"/>
                      <circle 
                        cx="48" cy="48" r="40" 
                        stroke="#F9A8D4" strokeWidth="10" fill="none"
                        strokeLinecap="round"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * dirtyTalk / 15)}
                        className="transition-all duration-300 ease-linear will-change-transform"
                      />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-slate-700">{dirtyTalk}</span>
                   </div>
                </div>
             </div>
          </div>

          {/* Vibration Monitor */}
           <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-inner">
              <div className="flex items-center gap-2 z-10">
                <Zap size={18} className={`transition-colors duration-200 ${currentMotion > 5 ? "text-yellow-300" : "text-slate-600"}`} />
                <span className="text-xs font-bold tracking-wider text-slate-400">震动监控</span>
              </div>
              <div className="flex gap-1 items-end h-6 z-10">
                {[...Array(10)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1.5 rounded-full transition-all duration-75 will-change-transform ${i < (currentMotion/10) ? 'bg-pink-400' : 'bg-slate-800'}`}
                        style={{ height: i < (currentMotion/10) ? '100%' : '20%'}}
                    />
                ))}
              </div>
           </div>
        </div>

        {/* Schemes Section */}
        <div>
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-bold text-slate-800">音频方案</h2>
                <button 
                    onClick={handleCreateScheme}
                    className="flex items-center gap-1 bg-white text-slate-800 px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition shadow-sm"
                >
                    <Plus size={16} /> 新增
                </button>
            </div>

            <div className="space-y-3 pb-8">
                {schemes.map(scheme => (
                    <div 
                        key={scheme.id} 
                        className={`p-4 pl-5 rounded-[1.5rem] flex items-center justify-between transition-all ${
                            activeSchemeId === scheme.id 
                            ? 'bg-pink-300 text-slate-900 shadow-lg shadow-pink-200 scale-[1.02]' 
                            : 'bg-white text-slate-500 hover:bg-white/80'
                        }`}
                    >
                        <div 
                            className="flex-1 cursor-pointer" 
                            onClick={() => setActiveSchemeId(scheme.id)}
                        >
                            <div className="font-bold text-lg">{scheme.name}</div>
                            <div className={`text-xs mt-0.5 font-medium ${activeSchemeId === scheme.id ? 'text-slate-800/70' : 'text-slate-400'}`}>
                                {activeSchemeId === scheme.id ? '当前生效' : '点击启用'}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleEditScheme(scheme)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                                    activeSchemeId === scheme.id ? 'bg-white/30 text-slate-900' : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                <Settings size={18} />
                            </button>
                            <button 
                                onClick={() => handleDeleteScheme(scheme.id)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                                    activeSchemeId === scheme.id ? 'bg-white/30 text-slate-900' : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);