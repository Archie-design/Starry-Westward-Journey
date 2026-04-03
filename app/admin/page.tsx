"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

import { AdminDashboard } from '@/components/Admin/AdminDashboard';
import { ADMIN_PASSWORD } from '@/lib/constants';
import { getGMUserByUID } from '@/app/actions/admin';

const MessageBox = ({ message, onClose, type = 'info' }: { message: string; onClose: () => void; type?: 'info' | 'error' | 'success' }) => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300 mx-auto text-center">
        <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center space-y-6 mx-auto flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${type === 'error' ? 'bg-red-500/20 text-red-500' : type === 'success' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {type === 'error' ? <AlertTriangle size={40} /> : type === 'success' ? <CheckCircle2 size={40} /> : <Sparkles size={40} />}
            </div>
            <p className="text-xl font-bold text-white leading-relaxed text-center mx-auto">{message}</p>
            <button onClick={onClose} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg text-center mx-auto">確認領旨</button>
        </div>
    </div>
);

export default function AdminPage() {
    const router = useRouter();
    const [adminAuth, setAdminAuth] = useState(false);
    const [adminActorName, setAdminActorName] = useState('');
    const [lineVerifiedName, setLineVerifiedName] = useState('');
    const [modalMessage, setModalMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

    // Read ?line_uid= from URL after LINE OAuth redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const lineUid = params.get('line_uid');
        const lineError = params.get('line_error');
        if (lineError) {
            setModalMessage({ text: `LINE 驗證失敗：${lineError}`, type: 'error' });
            window.history.replaceState({}, '', '/admin');
        } else if (lineUid) {
            getGMUserByUID(decodeURIComponent(lineUid)).then(res => {
                if (res.success && res.name) {
                    setLineVerifiedName(res.name);
                } else {
                    setModalMessage({ text: res.error || 'LINE 驗證失敗', type: 'error' });
                }
            });
            window.history.replaceState({}, '', '/admin');
        }
    }, []);

    const handleAdminAuth = async (e: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (String(fd.get('password')) !== ADMIN_PASSWORD) {
            setModalMessage({ text: '密令錯誤，大會禁地不可擅闖。', type: 'error' });
            return;
        }
        setAdminActorName(lineVerifiedName);
        setAdminAuth(true);
    };

    const showMessage = (text: string, type: 'info' | 'error' | 'success') => {
        setModalMessage({ text, type });
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {modalMessage && (
                <MessageBox
                    message={modalMessage.text}
                    type={modalMessage.type}
                    onClose={() => setModalMessage(null)}
                />
            )}
            <AdminDashboard
                adminAuth={adminAuth}
                onAuth={handleAdminAuth}
                onClose={() => router.push('/')}
                actorName={adminActorName}
                lineVerifiedName={lineVerifiedName}
                showMessage={showMessage}
            />
        </div>
    );
}
