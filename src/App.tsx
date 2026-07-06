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
import { FixingView, ItemsView, SignupView, AdminsView } from './pages/SuperAdminDashboard';
import TransactionHistory from './pages/TransactionHistory';
import { supabase } from './lib/supabase';

function SeedCheck() {
  useEffect(() => {
    const initSeed = async () => {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        return;
      }
      
      try {
        const superAdmins = [
          { username: 'yinesh', password: 'Super_yin', admin_type: 'super_admin' },
          { username: 'vidusan', password: 'Super_vid', admin_type: 'super_admin' }
        ];

        for (const admin of superAdmins) {
          const { data, error } = await supabase
            .from('user')
            .select('id')
            .eq('username', admin.username)
            .maybeSingle();

          if (error) {
            console.warn(`Seed check failed for ${admin.username}:`, error.message);
            continue;
          }

          if (!data) {
            console.log(`Seeding super admin: ${admin.username}`);
            await supabase.from('user').insert({
              ...admin,
              joined_date: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.warn('Seed initialization skipped or failed:', err);
      }
    };

    initSeed();
  }, []);

  return null;
}

function Root() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.admin_type === 'super_admin' ? '/super-admin' : '/admin'} />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <Shell>
            <Navigate to="/admin/new" replace />
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
        <SeedCheck />
        <Root />
        <Toaster position="top-right" expand={false} richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}
