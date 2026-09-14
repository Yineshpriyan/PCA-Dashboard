import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Student, StudentAppCredentials } from '../types';

interface StudentAuthContextType {
  student: Student | null;
  credentials: StudentAppCredentials | null;
  isLoading: boolean;
  loginStudent: (pcaid: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutStudent: () => void;
  refreshStudentProfile: () => Promise<void>;
  updateStudentPersonalDetails: (updatedData: Partial<Student>) => Promise<{ success: boolean; error?: string }>;
  updateStudentPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

const STUDENT_SESSION_KEY = 'pca_student_auth_session';

export const StudentAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [credentials, setCredentials] = useState<StudentAppCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudentData = async (pcaid: string) => {
    try {
      const cleanPcaid = pcaid.trim().toUpperCase();

      // Fetch credentials
      const { data: credsData, error: credsErr } = await supabase
        .from('student_app_credentials')
        .select('*')
        .ilike('pcaid', cleanPcaid)
        .maybeSingle();

      if (credsErr) {
        console.error('Error loading student credentials:', credsErr);
      }

      // Fetch student profile
      const { data: studentData, error: studentErr } = await supabase
        .from('student')
        .select('*')
        .ilike('pcaid', cleanPcaid)
        .is('deleted_at', null)
        .maybeSingle();

      if (studentErr) {
        console.error('Error loading student details:', studentErr);
      }

      if (studentData) {
        setStudent(studentData as Student);
        setCredentials(credsData as StudentAppCredentials || null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to fetch student data:', err);
      return false;
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const stored = localStorage.getItem(STUDENT_SESSION_KEY);
        if (stored) {
          const { pcaid } = JSON.parse(stored);
          if (pcaid) {
            await fetchStudentData(pcaid);
          }
        }
      } catch (err) {
        console.error('Error restoring student session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  const loginStudent = async (pcaid: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanPcaid = pcaid.trim().toUpperCase();
      const cleanPassword = password.trim();

      if (!cleanPcaid || !cleanPassword) {
        return { success: false, error: 'Please enter both PCA ID and password' };
      }

      // Query student_app_credentials
      const { data: creds, error: credsError } = await supabase
        .from('student_app_credentials')
        .select('*')
        .ilike('pcaid', cleanPcaid)
        .maybeSingle();

      if (credsError) {
        return { success: false, error: 'Database lookup error. Please try again.' };
      }

      if (!creds) {
        // Fallback: If no credentials record exists yet, check if student exists with this PCA ID
        const { data: rawStudent } = await supabase
          .from('student')
          .select('*')
          .ilike('pcaid', cleanPcaid)
          .is('deleted_at', null)
          .maybeSingle();

        if (rawStudent && cleanPassword.toUpperCase() === cleanPcaid) {
          // Auto-create credentials entry on first matching login
          await supabase.from('student_app_credentials').insert({
            pcaid: rawStudent.pcaid,
            student_name: rawStudent.name,
            password_hash: rawStudent.pcaid,
            status: 'Active',
            last_login_at: new Date().toISOString()
          });

          setStudent(rawStudent as Student);
          setCredentials({
            id: 'generated',
            pcaid: rawStudent.pcaid,
            student_name: rawStudent.name,
            password_hash: rawStudent.pcaid,
            status: 'Active',
            last_login_at: new Date().toISOString()
          });

          localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ pcaid: rawStudent.pcaid }));
          return { success: true };
        }

        return { success: false, error: 'Invalid PCA ID or password. Please check your credentials.' };
      }

      if (creds.status !== 'Active') {
        return { success: false, error: 'Your account is currently inactive. Please contact administration.' };
      }

      // Check password matching
      const storedHash = (creds.password_hash || '').trim();
      const isMatch = storedHash === cleanPassword || storedHash === cleanPassword.toUpperCase();

      if (!isMatch) {
        return { success: false, error: 'Invalid password. Note: Default password is your PCA ID.' };
      }

      // Update last login timestamp
      await supabase
        .from('student_app_credentials')
        .update({ last_login_at: new Date().toISOString() })
        .eq('pcaid', creds.pcaid);

      // Fetch student profile
      const { data: studentProfile, error: profileErr } = await supabase
        .from('student')
        .select('*')
        .ilike('pcaid', creds.pcaid)
        .is('deleted_at', null)
        .maybeSingle();

      if (profileErr || !studentProfile) {
        return { success: false, error: 'Student record not found or has been disabled.' };
      }

      setStudent(studentProfile as Student);
      setCredentials(creds as StudentAppCredentials);
      localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ pcaid: creds.pcaid }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'An unexpected error occurred during login' };
    }
  };

  const logoutStudent = () => {
    setStudent(null);
    setCredentials(null);
    localStorage.removeItem(STUDENT_SESSION_KEY);
  };

  const refreshStudentProfile = async () => {
    if (student?.pcaid) {
      await fetchStudentData(student.pcaid);
    }
  };

  const updateStudentPersonalDetails = async (updatedData: Partial<Student>): Promise<{ success: boolean; error?: string }> => {
    if (!student?.pcaid) {
      return { success: false, error: 'No active student session' };
    }

    try {
      // Allowed personal fields only (prevent touching admin fields like proper_batch, joined_batch, stream, district, etc.)
      const allowedUpdates: Partial<Student> = {
        name: updatedData.name,
        last_name: updatedData.last_name,
        phone: updatedData.phone,
        mail: updatedData.mail,
        address: updatedData.address,
        school: updatedData.school,
        nic: updatedData.nic,
        gender: updatedData.gender,
        dob: updatedData.dob || null,
        father_job: updatedData.father_job,
        mother_job: updatedData.mother_job,
        updated_at: new Date().toISOString()
      };

      // Clean undefined/empty values
      const payload = Object.fromEntries(
        Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
      );

      let { error: updateErr } = await supabase
        .from('student')
        .update(payload)
        .eq('pcaid', student.pcaid);

      // Graceful fallback if database column (e.g. 'gender', 'dob', 'last_name', 'father_job', 'mother_job') is missing in Postgres
      if (updateErr && (updateErr.message?.includes('column') || updateErr.hint?.includes('column') || updateErr.message?.includes('schema'))) {
        console.warn('DB schema mismatch during student update, retrying without missing columns:', updateErr);
        const slimPayload = { ...payload };

        // Dynamically strip the missing column reported by PostgREST
        const colMatch = updateErr.message?.match(/Could not find the '([^']+)' column/i);
        if (colMatch && colMatch[1]) {
          delete (slimPayload as any)[colMatch[1]];
        }
        if (updateErr.message?.includes('gender') || updateErr.hint?.includes('gender')) delete (slimPayload as any).gender;
        if (updateErr.message?.includes('dob') || updateErr.hint?.includes('dob')) delete (slimPayload as any).dob;
        if (updateErr.message?.includes('last_name') || updateErr.hint?.includes('last_name')) delete (slimPayload as any).last_name;
        if (updateErr.message?.includes('father_job') || updateErr.hint?.includes('father_job')) delete (slimPayload as any).father_job;
        if (updateErr.message?.includes('mother_job') || updateErr.hint?.includes('mother_job')) delete (slimPayload as any).mother_job;

        let retry = await supabase
          .from('student')
          .update(slimPayload)
          .eq('pcaid', student.pcaid);

        // If another optional column is also missing, strip it and retry once more
        if (retry.error && (retry.error.message?.includes('column') || retry.error.hint?.includes('column') || retry.error.message?.includes('schema'))) {
          const secondMatch = retry.error.message?.match(/Could not find the '([^']+)' column/i);
          if (secondMatch && secondMatch[1]) {
            delete (slimPayload as any)[secondMatch[1]];
          }
          if (retry.error.message?.includes('gender') || retry.error.hint?.includes('gender')) delete (slimPayload as any).gender;
          if (retry.error.message?.includes('dob') || retry.error.hint?.includes('dob')) delete (slimPayload as any).dob;
          if (retry.error.message?.includes('last_name') || retry.error.hint?.includes('last_name')) delete (slimPayload as any).last_name;
          if (retry.error.message?.includes('father_job') || retry.error.hint?.includes('father_job')) delete (slimPayload as any).father_job;
          if (retry.error.message?.includes('mother_job') || retry.error.hint?.includes('mother_job')) delete (slimPayload as any).mother_job;

          retry = await supabase
            .from('student')
            .update(slimPayload)
            .eq('pcaid', student.pcaid);
        }

        updateErr = retry.error;
      }

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Also update student_name in student_app_credentials
      if (payload.name || payload.last_name) {
        const updatedFullName = [payload.name || student.name, payload.last_name || student.last_name].filter(Boolean).join(' ');
        await supabase
          .from('student_app_credentials')
          .update({
            student_name: updatedFullName,
            updated_at: new Date().toISOString()
          })
          .eq('pcaid', student.pcaid);
      }

      await refreshStudentProfile();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update personal details' };
    }
  };

  const updateStudentPassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!student?.pcaid) {
      return { success: false, error: 'No active student session' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long' };
    }

    try {
      const cleanPass = newPassword.trim();
      const { error: passErr } = await supabase
        .from('student_app_credentials')
        .update({
          password_hash: cleanPass,
          updated_at: new Date().toISOString()
        })
        .eq('pcaid', student.pcaid);

      if (passErr) {
        return { success: false, error: passErr.message };
      }

      await refreshStudentProfile();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to change password' };
    }
  };

  return (
    <StudentAuthContext.Provider
      value={{
        student,
        credentials,
        isLoading,
        loginStudent,
        logoutStudent,
        refreshStudentProfile,
        updateStudentPersonalDetails,
        updateStudentPassword
      }}
    >
      {children}
    </StudentAuthContext.Provider>
  );
};

export const useStudentAuth = () => {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
};
