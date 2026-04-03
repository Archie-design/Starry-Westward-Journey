'use client';

import React, { createContext, useContext } from 'react';

interface AdminContextValue {
    actorName: string;
    showMessage: (text: string, type: 'info' | 'error' | 'success') => void;
}

const AdminContext = createContext<AdminContextValue>({
    actorName: '',
    showMessage: () => {},
});

export function AdminProvider({
    actorName,
    showMessage,
    children,
}: AdminContextValue & { children: React.ReactNode }) {
    return (
        <AdminContext.Provider value={{ actorName, showMessage }}>
            {children}
        </AdminContext.Provider>
    );
}

export function useAdmin() {
    return useContext(AdminContext);
}
