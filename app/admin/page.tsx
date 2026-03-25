"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

import { AdminDashboard } from '@/components/Admin/AdminDashboard';
import { SystemSettings, CharacterStats, TopicHistory, TemporaryQuest, W4Application, AdminLog, Testimony } from '@/types';
import { ADMIN_PASSWORD } from '@/lib/constants';
import {
  triggerWeeklySnapshot,
  importRostersData,
  logAdminAction,
  updateSystemSetting,
  deleteTestimony,
  getGMUserByUID,
} from '@/app/actions/admin';
import { autoDrawAllSquads } from '@/app/actions/team';
import { reviewW4ByAdmin, getW4Applications, getAdminActivityLog } from '@/app/actions/w4';
import { getTestimonies } from '@/app/actions/testimonies_admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminActorName, setAdminActorName] = useState('');
  const [lineVerifiedName, setLineVerifiedName] = useState('');
  const [modalMessage, setModalMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ TopicQuestTitle: '載入中...' });
  const [leaderboard, setLeaderboard] = useState<CharacterStats[]>([]);
  const [topicHistory, setTopicHistory] = useState<TopicHistory[]>([]);
  const [temporaryQuests, setTemporaryQuests] = useState<TemporaryQuest[]>([]);
  const [squadApprovedW4Apps, setSquadApprovedW4Apps] = useState<W4Application[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);

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

  // Load static data on mount
  useEffect(() => {
    const loadData = async () => {
      const [settingsRes, leaderboardRes, historyRes, tempQuestsRes, testimoniesRes] = await Promise.all([
        supabase.from('SystemSettings').select('*'),
        supabase.from('CharacterStats').select('*').order('Exp', { ascending: false }),
        supabase.from('TopicHistory').select('*').order('created_at', { ascending: false }),
        supabase.from('temporaryquests').select('*').order('created_at', { ascending: false }),
        getTestimonies(),
      ]);

      if (settingsRes.data) {
        const sObj = settingsRes.data.reduce((acc: any, curr: any) => ({ ...acc, [curr.SettingName]: curr.Value }), {});
        setSystemSettings({
          TopicQuestTitle: sObj.TopicQuestTitle || '修行主題載入中',
          RegistrationMode: (sObj.RegistrationMode as 'open' | 'roster') || 'open',
          WorldState: sObj.WorldState,
          WorldStateMsg: sObj.WorldStateMsg,
          VolunteerPassword: sObj.VolunteerPassword,
        });
      }
      if (leaderboardRes.data) setLeaderboard(leaderboardRes.data as CharacterStats[]);
      if (historyRes.data) setTopicHistory(historyRes.data as TopicHistory[]);
      if (tempQuestsRes.data) {
        setTemporaryQuests(tempQuestsRes.data.map((t: any) => ({ ...t, limit: t.limit_count })) as TemporaryQuest[]);
      }
      if (testimoniesRes) setTestimonies(testimoniesRes as Testimony[]);
    };
    loadData();
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
    const [w4Res, logsRes] = await Promise.all([
      getW4Applications({ status: 'squad_approved' }),
      getAdminActivityLog(30),
    ]);
    if (w4Res.success) setSquadApprovedW4Apps(w4Res.applications);
    if (logsRes.success) setAdminLogs(logsRes.logs as AdminLog[]);
  };

  const updateGlobalSetting = async (key: string, value: string) => {
    setIsSyncing(true);
    try {
      const result = await updateSystemSetting(key, value);
      if (!result.success) throw new Error(result.error);
      setSystemSettings(prev => ({ ...prev, [key]: value }));

      if (key === 'TopicQuestTitle') {
        const { data: newHistory, error: historyErr } = await supabase.from('TopicHistory').insert([{ TopicTitle: value }]).select();
        if (!historyErr && newHistory) {
          setTopicHistory(prev => [newHistory[0] as TopicHistory, ...prev]);
        }
      }

      setModalMessage({ text: '設定已同步雲端，諸位修行者將即時感應。', type: 'success' });
    } catch {
      setModalMessage({ text: '同步失敗，法陣連線異常。', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerSnapshot = async () => {
    if (!confirm('確定要執行『每週業力結算』(Weekly Snapshot)？\n這將重新計算所有活躍使用者的完成率，並變更全服動態難度 (WorldState)。')) return;
    setIsSyncing(true);
    try {
      const res = await triggerWeeklySnapshot(adminActorName);
      if (res.success) {
        setSystemSettings(prev => ({ ...prev, WorldState: res.worldState, WorldStateMsg: res.message }));
        setModalMessage({ text: `結算完成！目前的共業狀態為：${res.message}`, type: 'success' });
      } else {
        setModalMessage({ text: '結算失敗: ' + res.error, type: 'error' });
      }
    } catch (e: any) {
      setModalMessage({ text: '系統異常：' + e.message, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAutoDrawAllSquads = async () => {
    if (!confirm('確定要為所有本週尚未抽籤的小隊自動抽選推薦定課？')) return;
    setIsSyncing(true);
    try {
      const res = await autoDrawAllSquads(adminActorName);
      if (res.success) {
        const summary = res.drawn?.map((d: { squadName: string; questName: string }) => `${d.squadName}→${d.questName}`).join('、') || '（無）';
        setModalMessage({ text: `自動抽籤完成！${res.drawnCount} 個小隊已抽選，${res.skippedCount} 個已跳過。\n${summary}`, type: 'success' });
      } else {
        setModalMessage({ text: '自動抽籤失敗：' + res.error, type: 'error' });
      }
    } catch (e: any) {
      setModalMessage({ text: '系統異常：' + e.message, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportRoster = async (csvData: string) => {
    setIsSyncing(true);
    try {
      const res = await importRostersData(csvData, adminActorName);
      if (res.success) {
        setModalMessage({ text: `成功匯入！共新增/更新了 ${res.count} 筆名冊資料。`, type: 'success' });
      } else {
        setModalMessage({ text: `匯入失敗：${res.error}`, type: 'error' });
      }
    } catch (err: any) {
      setModalMessage({ text: `系統異常：${err.message}`, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddTempQuest = async (title: string, sub: string, desc: string, reward: number) => {
    setIsSyncing(true);
    try {
      const id = `temp_${Date.now()}`;
      const dbRow = { id, title, sub, desc, reward, limit_count: 1, active: true };
      const { error } = await supabase.from('temporaryquests').insert([dbRow]);
      if (error) throw error;
      const newQuest: TemporaryQuest = { id, title, sub, desc, reward, limit: 1, active: true };
      setTemporaryQuests(prev => [newQuest, ...prev]);
      await logAdminAction('temp_quest_add', adminActorName, id, title, { reward });
    } catch {
      setModalMessage({ text: '新增臨時任務失敗。', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleTempQuest = async (id: string, active: boolean) => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('temporaryquests').update({ active }).eq('id', id);
      if (error) throw error;
      setTemporaryQuests(prev => prev.map(q => q.id === id ? { ...q, active } : q));
      await logAdminAction('temp_quest_toggle', adminActorName, id, undefined, { active });
    } catch {
      setModalMessage({ text: '更新臨時任務狀態失敗。', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTempQuest = async (id: string) => {
    if (!confirm('確定要刪除此臨時任務嗎？刪除後無法恢復。')) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('temporaryquests').delete().eq('id', id);
      if (error) throw error;
      setTemporaryQuests(prev => prev.filter(q => q.id !== id));
      await logAdminAction('temp_quest_delete', adminActorName, id);
    } catch {
      setModalMessage({ text: '刪除臨時任務失敗。', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFinalReviewW4 = async (appId: string, approve: boolean, notes: string) => {
    const res = await reviewW4ByAdmin(appId, approve ? 'approve' : 'reject', notes);
    if (res.success) {
      setSquadApprovedW4Apps(prev => prev.filter(a => a.id !== appId));
      setModalMessage({ text: approve ? '已核准入帳！修為已發放。' : '已駁回申請。', type: approve ? 'success' : 'info' });
      const logsRes = await getAdminActivityLog(30);
      if (logsRes.success) setAdminLogs(logsRes.logs as AdminLog[]);
    } else {
      setModalMessage({ text: (res as any).error || '審核失敗', type: 'error' });
    }
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
        systemSettings={systemSettings}
        updateGlobalSetting={updateGlobalSetting}
        leaderboard={leaderboard}
        topicHistory={topicHistory}
        temporaryQuests={temporaryQuests}
        squadApprovedW4Apps={squadApprovedW4Apps}
        adminLogs={adminLogs}
        testimonies={testimonies}
        onAddTempQuest={handleAddTempQuest}
        onToggleTempQuest={handleToggleTempQuest}
        onDeleteTempQuest={handleDeleteTempQuest}
        onTriggerSnapshot={handleTriggerSnapshot}
        onAutoDrawAllSquads={handleAutoDrawAllSquads}
        onImportRoster={handleImportRoster}
        onFinalReviewW4={handleFinalReviewW4}
        onDeleteTestimony={async (id) => {
          await deleteTestimony(id);
          setTestimonies(prev => prev.filter(t => t.id !== id));
        }}
        onClose={() => router.push('/')}
        actorName={adminActorName}
        lineVerifiedName={lineVerifiedName}
      />
    </div>
  );
}
