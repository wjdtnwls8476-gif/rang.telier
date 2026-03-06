import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Settings, Trash2, Plus, RotateCcw, Share2, Instagram, MessageCircle, Heart } from 'lucide-react';

interface NailElement {
  id: number;
  category: string;
  name: string;
  value: string;
  image_url?: string;
}

interface RandomResult {
  color: NailElement;
  parts: NailElement;
  style: NailElement;
  shape: NailElement;
  length: NailElement;
}

interface CategoryTrigger {
  id: number;
  trigger_category: string;
  trigger_value: string;
  target_category: string;
}

const CATEGORIES = [
  { id: 'length', name: '길이' },
  { id: 'shape', name: '쉐입' },
  { id: 'color_tone', name: '컬러톤' },
  { id: 'mood', name: '무드' },
  { id: 'concept', name: '컨셉' },
  { id: 'base_color', name: '베이스 컬러' },
  { id: 'base_color_right', name: '베이스 컬러 (추가)', conditional: true },
  { id: 'point_color', name: '포인트 컬러' },
  { id: 'point_color_right', name: '포인트 컬러 (추가)', conditional: true },
  { id: 'design', name: '디자인' },
  { id: 'design_right', name: '디자인 (추가)', conditional: true },
  { id: 'magnet_pattern', name: '자석젤 패턴', conditional: true },
  { id: 'parts_yn', name: '파츠 유무' },
  { id: 'parts_detail', name: '파츠 종류', conditional: true },
  { id: 'point_placement', name: '포인트 배치' },
  { id: 'finish', name: '마감' },
  { id: 'art_style', name: '아트스타일' },
  { id: 'lr_style', name: '좌우스타일' },
  { id: 'character', name: '캐릭터', conditional: true },
  { id: 'brand', name: '브랜드', hidden: true },
];

const FIXED_CATEGORY_IDS = ['length', 'shape', 'design', 'base_color', 'finish'];

export default function App() {
  const [view, setView] = useState<'home' | 'admin'>('home');
  const [elements, setElements] = useState<NailElement[]>([]);
  const [triggers, setTriggers] = useState<CategoryTrigger[]>([]);
  const [randomResult, setRandomResult] = useState<Record<string, NailElement> | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['parts', 'mood', 'concept']);
  const [history, setHistory] = useState<Record<string, NailElement>[]>([]);
  const [resultImages, setResultImages] = useState<{id: number, combination_json: string, image_url: string}[]>([]);

  // Admin Form State
  const [newElement, setNewElement] = useState({ category: 'length', name: '', value: '', image_url: '' });
  const [editingElement, setEditingElement] = useState<NailElement | null>(null);
  const [newTrigger, setNewTrigger] = useState({ trigger_category: 'design', trigger_value: '', target_category: 'character' });
  const [newResultImage, setNewResultImage] = useState({ combination_json: '', image_url: '' });

  useEffect(() => {
    fetchElements();
    fetchTriggers();
    fetchResultImages();
  }, []);

  const fetchResultImages = async () => {
    try {
      const res = await fetch('/api/result-images');
      const data = await res.json();
      setResultImages(data);
    } catch (err) {
      console.error('Failed to fetch result images', err);
    }
  };

  const fetchElements = async () => {
    try {
      const res = await fetch('/api/elements');
      const data = await res.json();
      setElements(data);
    } catch (err) {
      console.error('Failed to fetch elements', err);
    }
  };

  const fetchTriggers = async () => {
    try {
      const res = await fetch('/api/triggers');
      const data = await res.json();
      setTriggers(data);
    } catch (err) {
      console.error('Failed to fetch triggers', err);
    }
  };

  const addTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrigger),
      });
      setNewTrigger({ ...newTrigger, trigger_value: '' });
      fetchTriggers();
    } catch (err) {
      console.error('Failed to add trigger', err);
    }
  };

  const deleteTrigger = async (id: number) => {
    try {
      await fetch(`/api/triggers/${id}`, { method: 'DELETE' });
      fetchTriggers();
    } catch (err) {
      console.error('Failed to delete trigger', err);
    }
  };

  const addResultImage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/result-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResultImage),
      });
      setNewResultImage({ combination_json: '', image_url: '' });
      fetchResultImages();
    } catch (err) {
      console.error('Failed to add result image', err);
    }
  };

  const deleteResultImage = async (id: number) => {
    try {
      await fetch(`/api/result-images/${id}`, { method: 'DELETE' });
      fetchResultImages();
    } catch (err) {
      console.error('Failed to delete result image', err);
    }
  };

  const handleSpin = async () => {
    setIsSpinning(true);
    setRandomResult(null);
    
    setTimeout(async () => {
      try {
        const allCategories = [...FIXED_CATEGORY_IDS, ...selectedCategories];
        const query = allCategories.join(',');
        const res = await fetch(`/api/random?categories=${query}`);
        const data = await res.json();
        setRandomResult(data);
        setHistory(prev => [data, ...prev].slice(0, 10));
      } catch (err) {
        console.error('Failed to spin', err);
      } finally {
        setIsSpinning(false);
      }
    }, 1500);
  };

  const rerollCategory = async (catId: string) => {
    if (!randomResult) return;
    try {
      const res = await fetch(`/api/random?categories=${catId}`);
      const data = await res.json();
      if (data[catId]) {
        setRandomResult(prev => ({ ...prev!, [catId]: data[catId] }));
      }
    } catch (err) {
      console.error('Failed to reroll', err);
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllCategories = () => {
    const allIds = CATEGORIES.filter(c => !c.conditional && !c.hidden && !FIXED_CATEGORY_IDS.includes(c.id)).map(c => c.id);
    if (selectedCategories.length === allIds.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(allIds);
    }
  };

  const addElement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingElement) {
        await fetch(`/api/elements/${editingElement.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newElement),
        });
        setEditingElement(null);
      } else {
        await fetch('/api/elements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newElement),
        });
      }
      setNewElement({ category: 'length', name: '', value: '', image_url: '' });
      fetchElements();
    } catch (err) {
      console.error('Failed to save element', err);
    }
  };

  const startEdit = (element: NailElement) => {
    setEditingElement(element);
    setNewElement({
      category: element.category,
      name: element.name,
      value: element.value || '',
      image_url: element.image_url || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingElement(null);
    setNewElement({ category: 'length', name: '', value: '', image_url: '' });
  };

  const deleteElement = async (id: number) => {
    try {
      await fetch(`/api/elements/${id}`, { method: 'DELETE' });
      fetchElements();
    } catch (err) {
      console.error('Failed to delete element', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div 
          className="text-3xl font-black text-cherry cursor-pointer flex items-center gap-2"
          onClick={() => setView('home')}
        >
          <Heart className="fill-cherry" />
          RANGTELIER
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setView(view === 'home' ? 'admin' : 'home')}
            className="p-2 rounded-full hover:bg-cherry/10 transition-colors text-cherry"
          >
            {view === 'home' ? <Settings size={24} /> : <Sparkles size={24} />}
          </button>
        </div>
      </nav>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {view === 'home' ? (
          <div className="space-y-12">
            {/* Hero Section */}
            <section className="text-center space-y-4">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-5xl md:text-7xl font-black text-cherry tracking-tighter"
              >
                오늘의 네일은?<br/>랑뜰리에가 골라줄게요!
              </motion.h1>
              <p className="text-stone-600 font-medium">키치하고 러블리한 나만의 네일 조합 찾기 🍒</p>
            </section>

            {/* Category Selection */}
            <section className="bg-white/80 kitsch-border p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-cherry flex items-center gap-2">
                  <Plus size={20} /> 조합할 요소를 선택하세요
                </h3>
                <button 
                  onClick={selectAllCategories}
                  className="text-xs font-bold text-cherry hover:underline"
                >
                  {selectedCategories.length === CATEGORIES.filter(c => !c.conditional && !c.hidden).length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter(c => !c.conditional && !c.hidden && !FIXED_CATEGORY_IDS.includes(c.id)).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                      selectedCategories.includes(cat.id)
                        ? 'bg-cherry text-white shadow-md'
                        : 'bg-butter/30 text-stone-400 hover:bg-butter/50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Roulette Section */}
            <section className="flex flex-col items-center gap-8">
              <div className="relative w-full max-w-md kitsch-border bg-white p-8 flex flex-col items-center justify-center min-h-[320px] overflow-hidden">
                <AnimatePresence mode="wait">
                  {isSpinning ? (
                    <motion.div
                      key="spinning"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                      className="text-cherry"
                    >
                      <RotateCcw size={80} />
                    </motion.div>
                  ) : randomResult ? (
                    <motion.div
                      key="result"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-full space-y-4"
                    >
                      <div className="text-4xl font-black text-cherry text-center mb-6">PICK!</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {CATEGORIES.map(cat => {
                          const element = randomResult[cat.id];
                          if (!element || cat.hidden) return null;
                          
                          const el = element as NailElement;
                          const isColor = cat.id.includes('color');
                          const colorValue = isColor ? el.value : null;
                          const isTransparent = colorValue === 'transparent';

                          return (
                            <div 
                              key={cat.id} 
                              className={`p-3 rounded-xl border-2 transition-all group relative ${
                                cat.id === 'magnet_pattern' ? 'bg-cherry/5 border-cherry/30' : 'bg-butter/20 border-cherry/10'
                              }`}
                              style={isColor && !isTransparent ? { backgroundColor: colorValue + '22', borderColor: colorValue + '44' } : {}}
                            >
                              <div className="text-[10px] text-cherry/60 uppercase font-black mb-1 flex justify-between items-center">
                                <span>{cat.name}</span>
                                <div className="flex items-center gap-1">
                                  {isColor && (
                                    <div 
                                      className="w-3 h-3 rounded-full border border-stone-300" 
                                      style={{ backgroundColor: isTransparent ? 'white' : colorValue, backgroundImage: isTransparent ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : 'none', backgroundSize: '4px 4px', backgroundPosition: '0 0, 2px 2px' }}
                                    />
                                  )}
                                  <button 
                                    onClick={() => rerollCategory(cat.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-cherry hover:scale-110"
                                    title="다시 돌리기"
                                  >
                                    <RotateCcw size={10} />
                                  </button>
                                </div>
                              </div>
                              <div className="font-black text-sm text-stone-800 flex items-center gap-2">
                                {el.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Result Image if available */}
                      {(() => {
                        const currentCombination = JSON.stringify(
                          Object.entries(randomResult)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([k, v]) => ({ [k]: (v as any).name }))
                        );
                        const matchedImage = resultImages.find(ri => ri.combination_json === currentCombination);
                        
                        return (
                          <div className="mt-6 space-y-4">
                            {matchedImage && (
                              <div className="p-4 kitsch-border bg-butter/10">
                                <div className="text-xs font-black text-cherry mb-2 text-center">MATCHED DESIGN!</div>
                                <img 
                                  src={matchedImage.image_url} 
                                  alt="Matched Result" 
                                  className="w-full h-auto rounded-lg shadow-md"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(currentCombination);
                                alert('조합 JSON이 복사되었습니다! 관리자 페이지에서 이미지 매칭 시 사용하세요.');
                              }}
                              className="w-full py-2 text-[10px] font-bold text-stone-400 hover:text-cherry transition-colors border border-dashed border-stone-200 rounded-lg"
                            >
                              조합 데이터 복사하기 (관리자용)
                            </button>
                          </div>
                        );
                      })()}
                    </motion.div>
                  ) : (
                    <motion.div key="idle" className="text-stone-300 flex flex-col items-center gap-4">
                      <Sparkles size={80} />
                      <p className="font-bold">버튼을 눌러 조합을 시작하세요!</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={handleSpin}
                disabled={isSpinning || selectedCategories.length === 0}
                className="kitsch-button w-full max-w-xs"
              >
                {isSpinning ? '조합하는 중...' : '랜덤 네일 뽑기!'}
              </button>
            </section>

            {/* Share Section */}
            <section className="flex justify-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-shadow">
                <Instagram size={18} className="text-pink-600" /> 인스타그램 공유
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#FEE500] rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-shadow">
                <MessageCircle size={18} className="text-stone-800" /> 카카오톡 공유
              </button>
            </section>
            {/* History Section */}
            {history.length > 0 && (
              <section className="space-y-4 mt-12">
                <h3 className="font-black text-cherry flex items-center gap-2 text-xl">
                  <RotateCcw size={24} /> 최근 내역
                </h3>
                <div className="space-y-3">
                  {history.map((item, idx) => {
                    const baseColor = item['base_color']?.value || '#ffffff';
                    const isTransparent = baseColor === 'transparent';
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="p-4 rounded-2xl border-2 border-cherry/10 shadow-sm flex flex-wrap gap-2 items-center"
                        style={{ 
                          backgroundColor: isTransparent ? '#f8f8f8' : baseColor + '33',
                          borderColor: isTransparent ? '#eee' : baseColor + '66'
                        }}
                      >
                        {CATEGORIES.map(cat => {
                          const el = item[cat.id];
                          if (!el || cat.hidden) return null;
                          return (
                            <span 
                              key={cat.id} 
                              className="px-2 py-1 bg-white/60 rounded-lg text-xs font-black text-stone-700 border border-white/40"
                            >
                              {el.name}
                            </span>
                          );
                        })}
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <h2 className="text-4xl font-black text-cherry">관리자 대시보드</h2>
            
            {/* Add/Edit Element Form */}
            <form onSubmit={addElement} className="kitsch-border bg-white p-6 space-y-4">
              <h3 className="font-bold text-lg">{editingElement ? '요소 수정하기' : '새로운 요소 추가'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                  value={newElement.category}
                  onChange={e => setNewElement({...newElement, category: e.target.value})}
                  className="p-2 border rounded-lg bg-stone-50"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.id})</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="이름 (예: 체리 레드)"
                  value={newElement.name}
                  onChange={e => setNewElement({...newElement, name: e.target.value})}
                  className="p-2 border rounded-lg"
                  required
                />
                <input 
                  type="text" 
                  placeholder="값 (예: #D2042D)"
                  value={newElement.value}
                  onChange={e => setNewElement({...newElement, value: e.target.value})}
                  className="p-2 border rounded-lg"
                />
                <input 
                  type="text" 
                  placeholder="이미지 URL (선택 사항)"
                  value={newElement.image_url}
                  onChange={e => setNewElement({...newElement, image_url: e.target.value})}
                  className="p-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 kitsch-button py-2 text-base">
                  {editingElement ? '수정 완료' : '추가하기'}
                </button>
                {editingElement && (
                  <button 
                    type="button" 
                    onClick={cancelEdit}
                    className="px-6 py-2 border-2 border-stone-200 rounded-xl font-bold text-stone-400 hover:bg-stone-50 transition-all"
                  >
                    취소
                  </button>
                )}
              </div>
            </form>

            {/* Elements List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CATEGORIES.map(cat => (
                <div key={cat.id} className="space-y-2">
                  <h4 className="font-black text-cherry uppercase text-sm">{cat.name}</h4>
                  <div className="bg-white rounded-xl shadow-sm divide-y">
                    {elements.filter(e => e.category === cat.id).map(element => (
                      <div key={element.id} className="p-3 flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="font-bold">{element.name}</span>
                          <span className="text-[10px] text-stone-400">{element.value}</span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => startEdit(element)}
                            className="text-stone-300 hover:text-blue-500 transition-colors"
                          >
                            <Settings size={18} />
                          </button>
                          <button 
                            onClick={() => deleteElement(element.id)}
                            className="text-stone-300 hover:text-cherry transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <hr className="border-cherry/10" />

            {/* Trigger Management Section */}
            <div className="space-y-8">
              <h2 className="text-3xl font-black text-cherry">자동 선택 로직 (Triggers)</h2>
              
              <form onSubmit={addTrigger} className="kitsch-border bg-white p-6 space-y-4">
                <h3 className="font-bold text-lg">새로운 자동 선택 로직 추가</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400">만약 이 카테고리에서...</label>
                    <select 
                      value={newTrigger.trigger_category}
                      onChange={e => setNewTrigger({...newTrigger, trigger_category: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-stone-50"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400">이 항목이 선택되면...</label>
                    <select 
                      value={newTrigger.trigger_value}
                      onChange={e => setNewTrigger({...newTrigger, trigger_value: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-stone-50"
                      required
                    >
                      <option value="">항목 선택</option>
                      {elements.filter(e => e.category === newTrigger.trigger_category).map(e => (
                        <option key={e.id} value={e.name}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400">이 카테고리를 자동 추가!</label>
                    <select 
                      value={newTrigger.target_category}
                      onChange={e => setNewTrigger({...newTrigger, target_category: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-stone-50"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full kitsch-button py-2 text-base">
                  로직 추가하기
                </button>
              </form>

              <div className="bg-white rounded-xl shadow-sm divide-y kitsch-border overflow-hidden">
                {triggers.length === 0 && <div className="p-8 text-center text-stone-400">설정된 자동 선택 로직이 없습니다.</div>}
                {triggers.map(trigger => {
                  const triggerCat = CATEGORIES.find(c => c.id === trigger.trigger_category);
                  const targetCat = CATEGORIES.find(c => c.id === trigger.target_category);
                  return (
                    <div key={trigger.id} className="p-4 flex justify-between items-center group bg-white">
                      <div className="flex items-center gap-3">
                        <div className="px-2 py-1 bg-cherry/10 rounded text-cherry text-xs font-bold">{triggerCat?.name}</div>
                        <div className="font-black text-stone-800">"{trigger.trigger_value}"</div>
                        <div className="text-stone-400">→</div>
                        <div className="px-2 py-1 bg-butter/30 rounded text-stone-600 text-xs font-bold">{targetCat?.name}</div>
                        <div className="text-stone-400 text-xs">자동 선택</div>
                      </div>
                      <button 
                        onClick={() => deleteTrigger(trigger.id)}
                        className="text-stone-300 hover:text-cherry transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <hr className="border-cherry/10" />

              {/* Result Image Management */}
              <div className="space-y-8">
                <h2 className="text-3xl font-black text-cherry">결과 이미지 매칭 (Result Images)</h2>
                
                <form onSubmit={addResultImage} className="kitsch-border bg-white p-6 space-y-4">
                  <h3 className="font-bold text-lg text-stone-800">특정 조합에 결과 이미지 연결</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-400">조합 JSON (결과 화면에서 복사하거나 직접 작성)</label>
                      <textarea 
                        value={newResultImage.combination_json}
                        onChange={e => setNewResultImage({...newResultImage, combination_json: e.target.value})}
                        placeholder='[{"base_color":"밀키 화이트"},{"design":"자석젤"},...]'
                        className="w-full p-3 border rounded-lg bg-stone-50 font-mono text-xs"
                        rows={3}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-400">결과 이미지 URL</label>
                      <input 
                        type="url"
                        value={newResultImage.image_url}
                        onChange={e => setNewResultImage({...newResultImage, image_url: e.target.value})}
                        placeholder="https://..."
                        className="w-full p-2 border rounded-lg bg-stone-50"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full kitsch-button py-2 text-base">
                    이미지 매칭 추가하기
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resultImages.map(ri => (
                    <div key={ri.id} className="bg-white kitsch-border p-4 flex flex-col gap-3 group relative">
                      <div className="text-[10px] font-mono text-stone-400 break-all bg-stone-50 p-2 rounded">
                        {ri.combination_json}
                      </div>
                      <img src={ri.image_url} alt="Result" className="w-full h-32 object-cover rounded shadow-inner" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => deleteResultImage(ri.id)}
                        className="absolute top-2 right-2 p-2 bg-white/80 rounded-full text-cherry shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-8 text-center text-stone-400 text-sm">
        <p>© 2024 RANGTELIER. All rights reserved.</p>
        <p className="mt-2">Lovely & Kitsch Nail Curation Service</p>
      </footer>
    </div>
  );
}
