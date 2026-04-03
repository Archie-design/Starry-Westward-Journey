'use client';

import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Folder, ArrowLeft, RefreshCw } from 'lucide-react';

const FOLDERS = ['achievements', 'artifacts', 'avatars', 'chests', 'map-sprites', 'monsters', 'quest-icons'];

interface ImageFile {
    name: string;
    path: string;
}

export function GalleryModule() {
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);
    const [images, setImages] = useState<ImageFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const loadFolder = async (folder: string) => {
        setCurrentFolder(folder);
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/local-images?folder=${encodeURIComponent(folder)}`);
            if (res.ok) {
                const data = await res.json();
                setImages(data.files || []);
            } else {
                setImages([]);
            }
        } catch {
            setImages([]);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">圖片庫</h2>

            {!currentFolder ? (
                <>
                    <p className="text-xs text-slate-400">瀏覽 public/images 下的圖片資源</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {FOLDERS.map(folder => (
                            <button key={folder} onClick={() => loadFolder(folder)}
                                className="bg-slate-900 border-2 border-slate-800 hover:border-teal-500/30 p-5 rounded-3xl text-left transition-all group shadow-xl">
                                <Folder size={24} className="text-teal-400 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-white text-sm">{folder}</p>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setCurrentFolder(null); setImages([]); setSelectedImage(null); }}
                            className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <p className="text-sm font-black text-teal-400">images/{currentFolder}</p>
                        <button onClick={() => loadFolder(currentFolder)} disabled={loading}
                            className="ml-auto p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-sm text-slate-500 text-center py-8">載入中...</p>
                    ) : images.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8 bg-slate-900 border-2 border-slate-800 rounded-3xl">此資料夾無圖片</p>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {images.map(img => (
                                <button key={img.name} onClick={() => setSelectedImage(img.path)}
                                    className={`bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] ${
                                        selectedImage === img.path ? 'border-teal-500' : 'border-slate-800 hover:border-slate-700'
                                    }`}>
                                    <div className="aspect-square relative bg-slate-800 flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img.path} alt={img.name}
                                            className="w-full h-full object-contain p-1"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    </div>
                                    <p className="text-[9px] text-slate-500 p-1.5 truncate text-center">{img.name}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Selected image preview */}
                    {selectedImage && (
                        <div className="bg-slate-900 border-2 border-teal-500/30 rounded-3xl p-4 shadow-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black text-teal-400">預覽</p>
                                <button onClick={() => setSelectedImage(null)} className="text-xs text-slate-500 hover:text-white">關閉</button>
                            </div>
                            <div className="flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={selectedImage} alt="preview" className="max-h-[300px] rounded-xl" />
                            </div>
                            <p className="text-[10px] text-slate-500 text-center font-mono break-all">{selectedImage}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
