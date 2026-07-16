/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Shell } from './components/Shell';
import Login from './pages/Login';
import { IssueTokenForm, DisplayTokens } from './pages/AdminDashboard';
import { CallTaskForm, CallTaskDisplay } from './pages/CallTaskManagement';
import { StudentForm, StudentExplorer } from './pages/StudentManagement';
import { FreeClassForm } from './pages/FreeClassManagement';
import RegisterStudents from './pages/RegisterStudents';
import RegisterIndividualStudent from './pages/RegisterIndividualStudent';
import Home from './pages/Home';
import { FixingView, ItemsView, SignupView, AdminsView } from './pages/SuperAdminDashboard';
import TransactionHistory from './pages/TransactionHistory';
import RecycleBin from './pages/RecycleBin';
import { supabase } from './lib/supabase';

function Root() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center max-w-sm p-6 text-center">
          <div className="relative mb-6">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Initializing Session</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Please wait while we establish a secure connection to the database. This may take a moment during system cold starts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/admin/home" />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <Navigate to="/admin/home" replace />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/home" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <Home />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/new" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <IssueTokenForm />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/display" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <DisplayTokens />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/call-task/new" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <CallTaskForm />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/call-task/display" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <CallTaskDisplay />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/student-form" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <StudentForm />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/free-class-form" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <FreeClassForm />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/student-explorer" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <StudentExplorer />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/zoom-register" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <RegisterStudents />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/zoom-register-individual" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <RegisterIndividualStudent />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/transactions" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Shell>
            <TransactionHistory />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/admin/recycle-bin" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <RecycleBin />
          </Shell>
        </ProtectedRoute>
      } />

      {/* Super Admin Routes */}
      <Route path="/super-admin" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Shell>
            <Navigate to="/super-admin/fixing" replace />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/super-admin/fixing" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Shell>
            <FixingView />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/super-admin/items" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Shell>
            <ItemsView />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/super-admin/signup" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Shell>
            <SignupView />
          </Shell>
        </ProtectedRoute>
      } />
      <Route path="/super-admin/admins" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Shell>
            <AdminsView />
          </Shell>
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Root />
        <Toaster position="top-right" expand={false} richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}
