'use client';

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { AdminProvider } from './AdminContext';
import { AdminShell, type ModuleId } from './AdminShell';
import { HomeModule } from './modules/HomeModule';
import { DashboardModule } from './modules/DashboardModule';
import { ReviewModule } from './modules/ReviewModule';
import { PersonnelModule } from './modules/PersonnelModule';
import { TasksModule } from './modules/TasksModule';
import { CourseModule } from './modules/CourseModule';
import { LogsModule } from './modules/LogsModule';
import { ConfigModule } from './modules/ConfigModule';
import { GalleryModule } from './modules/GalleryModule';
import { MonopolyModule } from './modules/MonopolyModule';

interface AdminDashboardProps {
    adminAuth: boolean;
    onAuth: (e: { preventDefault: () => void; currentTarget: HTMLFormElement }) => void;
    onClose: () => void;
    actorName?: string;
    lineVerifiedName?: string;
    showMessage: (text: string, type: 'info' | 'error' | 'success') => void;
}

export function AdminDashboard({
    adminAuth, onAuth, onClose,
    actorName, lineVerifiedName, showMessage,
}: AdminDashboardProps) {
    const [activeModule, setActiveModule] = useState<ModuleId>('home');

    // Auth gate
    if (!adminAuth) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 p-8 flex flex-col justify-center items-center animate-in fade-in">
                <div className="max-w-sm w-full space-y-8 text-center mx-auto">
                    <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center border border-slate-700 text-orange-500">
                        <Lock size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white text-center mx-auto">大會中樞驗證</h1>
                    {!lineVerifiedName ? (
                        <div className="space-y-4">
                            <a
                                href="/api/auth/line?action=login&redirect=admin"
                                className="block w-full py-5 bg-[#06C755] hover:bg-[#05b34d] text-white font-black text-center rounded-2xl transition-all active:scale-95 shadow-lg"
                            >
                                以 LINE 帳號驗證身份
                            </a>
                            <button type="button" onClick={onClose} className="w-full py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl">取消</button>
                        </div>
                    ) : (
                        <form onSubmit={onAuth} className="space-y-6">
                            <p className="text-sm text-green-400 font-bold">✓ LINE 已驗證：{lineVerifiedName}</p>
                            <input
                                name="password" type="password" required
                                className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white text-center text-xl outline-none focus:border-orange-500 font-bold"
                                placeholder="密令" autoFocus
                            />
                            <div className="flex gap-4">
                                <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl">取消</button>
                                <button className="flex-2 py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">驗證登入</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // Main dashboard
    return (
        <AdminProvider actorName={actorName || ''} showMessage={showMessage}>
            <AdminShell
                activeModule={activeModule}
                onModuleChange={setActiveModule}
                onClose={onClose}
                actorName={actorName}
            >
                {activeModule === 'home' && (
                    <HomeModule onNavigate={setActiveModule} />
                )}
                {activeModule === 'dashboard' && <DashboardModule />}
                {activeModule === 'review' && <ReviewModule />}
                {activeModule === 'personnel' && <PersonnelModule />}
                {activeModule === 'course' && <CourseModule />}
                {activeModule === 'tasks' && <TasksModule />}
                {activeModule === 'logs' && <LogsModule />}

                {activeModule === 'monopoly' && <MonopolyModule />}
                {activeModule === 'config' && <ConfigModule />}
                {activeModule === 'gallery' && <GalleryModule />}
            </AdminShell>
        </AdminProvider>
    );
}
