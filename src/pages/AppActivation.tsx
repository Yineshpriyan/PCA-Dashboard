import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Folder, 
  FolderPlus, 
  FileText, 
  Video, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  X, 
  Search, 
  Smartphone, 
  Key, 
  Lock, 
  Unlock, 
  Eye, 
  ExternalLink, 
  Copy, 
  Info, 
  Sparkles, 
  Layers, 
  File, 
  Link as LinkIcon, 
  ShieldCheck, 
  ShieldAlert, 
  Download, 
  RefreshCw,
  Sliders,
  CheckSquare,
  Square,
  Users,
  Filter,
  Save,
  Loader2,
  Clock,
  Calendar,
  Timer
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppFolder, AppResource, StudentFolderAccess, Student } from '../types';
import { toast } from 'sonner';
import { logTransaction } from '../lib/transactions';
import { useAuth } from '../hooks/useAuth';

// Pre-populated initial seed data if DB/localStorage is empty
const INITIAL_FOLDERS: AppFolder[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Module 01: Physics Fundamentals',
    description: 'Core concepts including Kinematics, Dynamics, and Mechanics.',
    parent_id: null,
    created_at: new Date().toISOString(),
    is_active: true,
    order_index: 1
  },
  {
    id: '11111111-1111-1111-1111-111111111112',
    name: '1.1 Kinematics & Motion in 1D',
    description: 'Velocity, acceleration, and displacement graphs.',
    parent_id: '11111111-1111-1111-1111-111111111111',
    created_at: new Date().toISOString(),
    is_active: true,
    order_index: 1
  },
  {
    id: '11111111-1111-1111-1111-111111111113',
    name: '1.2 Newton Laws of Motion',
    description: 'Forces, friction, and free body diagrams.',
    parent_id: '11111111-1111-1111-1111-111111111111',
    created_at: new Date().toISOString(),
    is_active: true,
    order_index: 2
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Module 02: Chemistry Organic Reactions',
    description: 'Reaction mechanisms, aliphatic compounds, and synthesis.',
    parent_id: null,
    created_at: new Date().toISOString(),
    is_active: true,
    order_index: 2
  },
  {
    id: '22222222-2222-2222-2222-222222222221',
    name: '2.1 Hydrocarbons & Alkanes',
    description: 'Nomenclature, preparation methods, and stability.',
    parent_id: '22222222-2222-2222-2222-222222222222',
    created_at: new Date().toISOString(),
    is_active: true,
    order_index: 1
  }
];

const INITIAL_RESOURCES: AppResource[] = [
  {
    id: '33333333-3333-3333-3333-333333333331',
    folder_id: '11111111-1111-1111-1111-111111111112',
    title: 'Lecture 01: Introduction to 1D Motion',
    type: 'video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duration: '24:15',
    description: 'Detailed breakdown of velocity and acceleration vectors.',
    created_at: new Date().toISOString()
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    folder_id: '11111111-1111-1111-1111-111111111112',
    title: 'Formula Sheet & Worksheet - Kinematics PDF',
    type: 'pdf',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    file_size: '3.4 MB',
    description: 'Downloadable PDF problem set with step-by-step solutions.',
    created_at: new Date().toISOString()
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    folder_id: '11111111-1111-1111-1111-111111111113',
    title: 'Lecture 02: Solving Free Body Diagram Problems',
    type: 'video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duration: '38:50',
    description: 'Inclined planes and tension pulleys explained.',
    created_at: new Date().toISOString()
  }
];

export const DURATION_PRESETS = [
  { id: '1_day', label: '1 Day', days: 1 },
  { id: '2_days', label: '2 Days', days: 2 },
  { id: '1_week', label: '1 Week (7 Days)', days: 7 },
  { id: '1_month', label: '1 Month (30 Days)', days: 30 },
  { id: '2_months', label: '2 Months (60 Days)', days: 60 },
  { id: '3_months', label: '3 Months (90 Days)', days: 90 },
  { id: '6_months', label: '6 Months (180 Days)', days: 180 },
  { id: '1_year', label: '1 Year (365 Days)', days: 365 },
  { id: 'unlimited', label: 'Unlimited (No Expiration)', days: null },
];

export function computeExpiresAt(preset: string | null): string | null {
  if (!preset || preset === 'unlimited') return null;
  const opt = DURATION_PRESETS.find(o => o.id === preset);
  if (!opt) return null;
  if (opt.days === 0) return new Date().toISOString();
  if (!opt.days) return null;
  const target = new Date();
  target.setDate(target.getDate() + opt.days);
  return target.toISOString();
}

export function getAccessExpirationInfo(record?: StudentFolderAccess) {
  if (!record || !record.is_enabled) return { status: 'disabled', label: 'Disabled' };
  if (!record.expires_at) return { status: 'unlimited', label: 'Unlimited' };

  const expiresDate = new Date(record.expires_at);
  const now = new Date();

  if (expiresDate < now) {
    return { status: 'expired', label: `Expired (${expiresDate.toLocaleDateString()})`, expiresDate };
  }

  const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
  return {
    status: 'active',
    label: `${daysLeft}d left (${expiresDate.toLocaleDateString()})`,
    expiresDate,
    daysLeft
  };
}

export function syncParentFolderAccess(records: StudentFolderAccess[], folders: AppFolder[]): StudentFolderAccess[] {
  let updated = [...records];
  if (folders.length === 0) return updated;

  const folderMap = new Map<string, AppFolder>();
  folders.forEach(f => folderMap.set(f.id, f));

  const getDepth = (fId: string): number => {
    let d = 0;
    let curr = folderMap.get(fId);
    while (curr && curr.parent_id && folderMap.has(curr.parent_id)) {
      d++;
      curr = folderMap.get(curr.parent_id);
    }
    return d;
  };

  // Sort folders from deepest subfolders up to top-level root folders
  const sortedFolders = [...folders].sort((a, b) => getDepth(b.id) - getDepth(a.id));
  const studentPcaids = Array.from(new Set(updated.map(r => r.student_pcaid)));

  for (const pcaid of studentPcaids) {
    for (const parentFolder of sortedFolders) {
      const directChildren = folders.filter(f => f.parent_id === parentFolder.id);
      if (directChildren.length === 0) continue; // Skip leaf folders

      const activeChildRecords = directChildren
        .map(child => updated.find(r => r.student_pcaid === pcaid && r.folder_id === child.id))
        .filter((r): r is StudentFolderAccess => !!r && r.is_enabled);

      const parentIndex = updated.findIndex(r => r.student_pcaid === pcaid && r.folder_id === parentFolder.id);

      if (activeChildRecords.length > 0) {
        let isUnlimited = false;
        let maxExpiresAt: string | null = null;
        let chosenPreset = activeChildRecords[0].duration_preset || 'unlimited';

        for (const childRec of activeChildRecords) {
          if (!childRec.expires_at || childRec.duration_preset === 'unlimited') {
            isUnlimited = true;
            break;
          }
          if (!maxExpiresAt || new Date(childRec.expires_at) > new Date(maxExpiresAt)) {
            maxExpiresAt = childRec.expires_at;
            chosenPreset = childRec.duration_preset;
          }
        }

        const finalExpiresAt = isUnlimited ? null : maxExpiresAt;
        const finalPreset = isUnlimited ? 'unlimited' : chosenPreset;

        if (parentIndex >= 0) {
          updated[parentIndex] = {
            ...updated[parentIndex],
            is_enabled: true,
            duration_preset: finalPreset,
            expires_at: finalExpiresAt,
            updated_at: new Date().toISOString()
          };
        } else {
          updated.push({
            id: `acc-${parentFolder.id}-${pcaid}`,
            student_pcaid: pcaid,
            folder_id: parentFolder.id,
            is_enabled: true,
            duration_preset: finalPreset,
            expires_at: finalExpiresAt,
            updated_at: new Date().toISOString()
          });
        }
      } else {
        if (parentIndex >= 0) {
          updated[parentIndex] = {
            ...updated[parentIndex],
            is_enabled: false,
            duration_preset: '0',
            expires_at: null,
            updated_at: new Date().toISOString()
          };
        }
      }
    }
  }

  return updated;
}

export default function AppActivation() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'folders' | 'student-access' | 'api-docs'>('folders');

  // Duration preset state
  const [selectedDurationPreset, setSelectedDurationPreset] = useState<string>('unlimited');

  // Folders & Resources State
  const [folders, setFolders] = useState<AppFolder[]>([]);
  const [resources, setResources] = useState<AppResource[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>('11111111-1111-1111-1111-111111111111');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '11111111-1111-1111-1111-111111111111': true,
    '22222222-2222-2222-2222-222222222222': true
  });

  // Student Access State
  const [students, setStudents] = useState<Student[]>([]);
  const [accessRecords, setAccessRecords] = useState<StudentFolderAccess[]>([]);
  const [selectedStudentPcaids, setSelectedStudentPcaids] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [savingAccess, setSavingAccess] = useState<boolean>(false);
  const [savingFolder, setSavingFolder] = useState<boolean>(false);
  const [savingResource, setSavingResource] = useState<boolean>(false);

  // Modals
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [folderModalMode, setFolderModalMode] = useState<'create' | 'edit'>('create');
  const [folderFormData, setFolderFormData] = useState<{ id?: string; name: string; description: string; parent_id: string | null; is_active: boolean }>({
    name: '',
    description: '',
    parent_id: null,
    is_active: true
  });

  const [showResourceModal, setShowResourceModal] = useState<boolean>(false);
  const [resourceModalMode, setResourceModalMode] = useState<'create' | 'edit'>('create');
  const [resourceFormData, setResourceFormData] = useState<{ id?: string; title: string; type: 'video' | 'pdf' | 'link' | 'note'; url: string; description: string }>({
    title: '',
    type: 'video',
    url: '',
    description: ''
  });

  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // 1. Load Initial Data
  useEffect(() => {
    loadData();
  }, []);

  // Reset filters and selected students whenever coming back from other menus, switching tabs, or mounting
  useEffect(() => {
    setStudentSearch('');
    setBatchFilter('ALL');
    setDistrictFilter('ALL');
    setSelectedStudentPcaids([]);
  }, [location.pathname, location.key, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Folders
      const { data: dbFolders, error: folderErr } = await supabase.from('app_folder').select('*').order('created_at', { ascending: true });
      if (!folderErr && dbFolders) {
        setFolders(dbFolders);
      } else {
        const stored = localStorage.getItem('app_folders_cache');
        if (stored) {
          setFolders(JSON.parse(stored));
        } else {
          setFolders(INITIAL_FOLDERS);
          localStorage.setItem('app_folders_cache', JSON.stringify(INITIAL_FOLDERS));
        }
      }

      // Load Resources
      const { data: dbResources, error: resErr } = await supabase.from('app_resource').select('*').order('created_at', { ascending: true });
      if (!resErr && dbResources) {
        setResources(dbResources);
      } else {
        const storedRes = localStorage.getItem('app_resources_cache');
        if (storedRes) {
          setResources(JSON.parse(storedRes));
        } else {
          setResources(INITIAL_RESOURCES);
          localStorage.setItem('app_resources_cache', JSON.stringify(INITIAL_RESOURCES));
        }
      }

      // Load Students
      const { data: dbStudents } = await supabase.from('student').select('*').order('name', { ascending: true });
      if (dbStudents && dbStudents.length > 0) {
        setStudents(dbStudents);
      }

      // Load Student Access Records
      const { data: dbAccess } = await supabase.from('student_folder_access').select('*');
      if (dbAccess && dbAccess.length > 0) {
        setAccessRecords(dbAccess);
      } else {
        const storedAccess = localStorage.getItem('student_folder_access_cache');
        if (storedAccess) {
          setAccessRecords(JSON.parse(storedAccess));
        }
      }
    } catch (err) {
      console.warn('Error loading app activation data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync helpers to keep local cache updated
  const syncFoldersState = (updated: AppFolder[]) => {
    setFolders(updated);
    localStorage.setItem('app_folders_cache', JSON.stringify(updated));
  };

  const syncResourcesState = (updated: AppResource[]) => {
    setResources(updated);
    localStorage.setItem('app_resources_cache', JSON.stringify(updated));
  };

  const syncAccessState = (updated: StudentFolderAccess[]) => {
    setAccessRecords(updated);
    localStorage.setItem('student_folder_access_cache', JSON.stringify(updated));
  };

  // Internal refresh helper to revert unsaved edits and restore official saved access records from DB/cache
  const reloadSavedAccessRecords = async () => {
    try {
      const { data: dbAccess, error } = await supabase.from('student_folder_access').select('*');
      if (!error && dbAccess && dbAccess.length > 0) {
        setAccessRecords(dbAccess);
        localStorage.setItem('student_folder_access_cache', JSON.stringify(dbAccess));
      } else {
        const storedAccess = localStorage.getItem('student_folder_access_cache');
        if (storedAccess) {
          setAccessRecords(JSON.parse(storedAccess));
        }
      }
    } catch (err) {
      const storedAccess = localStorage.getItem('student_folder_access_cache');
      if (storedAccess) {
        setAccessRecords(JSON.parse(storedAccess));
      }
    }
  };

  // Re-sync saved access permissions from DB/cache whenever student selection changes (discarding unsaved changes)
  useEffect(() => {
    reloadSavedAccessRecords();
  }, [selectedStudentPcaids]);

  // Folder CRUD
  const handleOpenCreateFolder = (parentId: string | null = null) => {
    setFolderModalMode('create');
    setFolderFormData({
      name: '',
      description: '',
      parent_id: parentId,
      is_active: true
    });
    setShowFolderModal(true);
  };

  const handleOpenEditFolder = (f: AppFolder) => {
    setFolderModalMode('edit');
    setFolderFormData({
      id: f.id,
      name: f.name,
      description: f.description || '',
      parent_id: f.parent_id,
      is_active: f.is_active
    });
    setShowFolderModal(true);
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFormData.name.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    setSavingFolder(true);
    try {
      if (folderModalMode === 'create') {
        const newF: AppFolder = {
          id: crypto.randomUUID(),
          name: folderFormData.name.trim(),
          description: folderFormData.description.trim() || undefined,
          parent_id: folderFormData.parent_id || null,
          created_at: new Date().toISOString(),
          is_active: folderFormData.is_active
        };

        const insertPayload: Record<string, any> = {
          id: newF.id,
          name: newF.name,
          description: newF.description || null,
          parent_id: newF.parent_id,
          created_at: newF.created_at,
          is_active: newF.is_active
        };

        let { error } = await supabase.from('app_folder').insert(insertPayload);

        // Fallback if 'is_active' column is missing in the database table schema
        if (error && error.message && error.message.includes('is_active')) {
          delete insertPayload.is_active;
          const retry = await supabase.from('app_folder').insert(insertPayload);
          error = retry.error;
        }

        if (error) {
          console.error('Error creating folder in database:', error);
          toast.error(`Database error: ${error.message}`);
          return;
        }

        const updated = [...folders, newF];
        syncFoldersState(updated);

        if (user) {
          logTransaction({
            admin_username: user.username,
            action_type: 'CREATE_APP_FOLDER',
            entity_type: 'app_folder',
            entity_id: newF.id,
            details: `Created folder "${newF.name}"`
          });
        }

        toast.success('Folder created successfully in database!');
        setSelectedFolderId(newF.id);
        if (newF.parent_id) {
          setExpandedFolders(prev => ({ ...prev, [newF.parent_id!]: true }));
        }
      } else if (folderFormData.id) {
        const updatePayload: Record<string, any> = {
          name: folderFormData.name.trim(),
          description: folderFormData.description.trim() || null,
          parent_id: folderFormData.parent_id || null,
          is_active: folderFormData.is_active
        };

        let { error } = await supabase.from('app_folder').update(updatePayload).eq('id', folderFormData.id);

        if (error && error.message && error.message.includes('is_active')) {
          delete updatePayload.is_active;
          const retry = await supabase.from('app_folder').update(updatePayload).eq('id', folderFormData.id);
          error = retry.error;
        }

        if (error) {
          console.error('Error updating folder in database:', error);
          toast.error(`Database error: ${error.message}`);
          return;
        }

        const updated = folders.map(f => f.id === folderFormData.id ? {
          ...f,
          name: folderFormData.name.trim(),
          description: folderFormData.description.trim() || undefined,
          parent_id: folderFormData.parent_id || null,
          is_active: folderFormData.is_active
        } : f);

        syncFoldersState(updated);

        if (user) {
          logTransaction({
            admin_username: user.username,
            action_type: 'UPDATE_APP_FOLDER',
            entity_type: 'app_folder',
            entity_id: folderFormData.id,
            details: `Updated folder "${folderFormData.name.trim()}"`
          });
        }

        toast.success('Folder updated in database!');
      }

      setShowFolderModal(false);
    } catch (err: any) {
      toast.error('Failed to save folder: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingFolder(false);
    }
  };

  const getAllDescendantFolderIds = (id: string, all: AppFolder[]): string[] => {
    const children = all.filter(f => f.parent_id === id);
    let ids = [id];
    for (const child of children) {
      ids = ids.concat(getAllDescendantFolderIds(child.id, all));
    }
    return ids;
  };

  const handleDeleteFolder = async (folderId: string) => {
    const targetFolder = folders.find(f => f.id === folderId);
    if (!targetFolder) return;

    const folderIdsToDelete = getAllDescendantFolderIds(folderId, folders);

    try {
      // 1. Delete nested resources first
      const { error: errRes } = await supabase.from('app_resource').delete().in('folder_id', folderIdsToDelete);
      if (errRes) console.warn('Error deleting nested resources:', errRes);

      // 2. Delete folders
      const { error: errFold } = await supabase.from('app_folder').delete().in('id', folderIdsToDelete);
      if (errFold) {
        toast.error(`Database error deleting folder: ${errFold.message}`);
        return;
      }

      const remainingFolders = folders.filter(f => !folderIdsToDelete.includes(f.id));
      const remainingResources = resources.filter(r => !folderIdsToDelete.includes(r.folder_id));

      syncFoldersState(remainingFolders);
      syncResourcesState(remainingResources);

      if (user) {
        logTransaction({
          admin_username: user.username,
          action_type: 'DELETE_APP_FOLDER',
          entity_type: 'app_folder',
          entity_id: folderId,
          details: `Deleted folder "${targetFolder.name}" and nested contents`
        });
      }

      toast.success(`Folder "${targetFolder.name}" deleted from database`);
      setConfirmDeleteFolderId(null);
      if (selectedFolderId && folderIdsToDelete.includes(selectedFolderId)) {
        setSelectedFolderId(remainingFolders[0]?.id || null);
      }
    } catch (err: any) {
      toast.error('Error deleting folder: ' + (err.message || 'Unknown error'));
    }
  };

  const renderFolderItem = (folder: AppFolder, depth = 0) => {
    const subfolders = getSubfoldersOf(folder.id);
    const hasSubfolders = subfolders.length > 0;
    const isExpanded = !!expandedFolders[folder.id];
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id} className="space-y-1">
        <div
          onClick={() => setSelectedFolderId(folder.id)}
          className={`group flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
            isSelected
              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold border border-teal-200 dark:border-teal-800/60 shadow-xs'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300 font-medium'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasSubfolders ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(folder.id, e)}
                className="p-1 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded transition-colors text-gray-400 hover:text-teal-600 shrink-0"
                title={isExpanded ? 'Collapse Folder' : 'Expand Folder'}
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-teal-600 dark:text-teal-400" />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            <Folder
              size={16}
              className={isSelected ? 'text-teal-600 dark:text-teal-400 shrink-0' : 'text-amber-500 shrink-0'}
            />
            <span className={`truncate ${depth === 0 ? 'font-bold' : 'font-semibold'}`}>
              {folder.name}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCreateFolder(folder.id);
              }}
              className="p-1 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded"
              title="Add Subfolder"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditFolder(folder);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded"
              title="Edit Folder"
            >
              <Edit3 size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteFolderId(folder.id);
              }}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 rounded"
              title="Delete Folder"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Nested Subfolders recursively */}
        {isExpanded && hasSubfolders && (
          <div className="pl-4 space-y-1 border-l-2 border-teal-100 dark:border-teal-900/40 ml-3.5 my-1">
            {subfolders.map(sub => renderFolderItem(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const buildFolderTreeOptions = (parentId: string | null = null, depth = 0): { id: string; name: string }[] => {
    const children = folders.filter(f => (f.parent_id || null) === parentId);
    let options: { id: string; name: string }[] = [];
    for (const child of children) {
      if (child.id === folderFormData.id) continue;
      const prefix = depth > 0 ? '— '.repeat(depth) : '';
      options.push({
        id: child.id,
        name: `${prefix}📁 ${child.name}`
      });
      options = options.concat(buildFolderTreeOptions(child.id, depth + 1));
    }
    return options;
  };

  // Resource CRUD
  const handleOpenCreateResource = () => {
    setResourceModalMode('create');
    setResourceFormData({
      title: '',
      type: 'video',
      url: '',
      description: ''
    });
    setShowResourceModal(true);
  };

  const handleOpenEditResource = (res: AppResource) => {
    setResourceModalMode('edit');
    setResourceFormData({
      id: res.id,
      title: res.title,
      type: res.type,
      url: res.url,
      description: res.description || ''
    });
    setShowResourceModal(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId && resourceModalMode === 'create') {
      toast.error('Please select a folder first');
      return;
    }
    if (!resourceFormData.title.trim() || !resourceFormData.url.trim()) {
      toast.error('Please enter title and content URL');
      return;
    }

    setSavingResource(true);
    try {
      if (resourceModalMode === 'create') {
        const newRes: AppResource = {
          id: crypto.randomUUID(),
          folder_id: selectedFolderId!,
          title: resourceFormData.title.trim(),
          type: resourceFormData.type,
          url: resourceFormData.url.trim(),
          description: resourceFormData.description.trim() || undefined,
          created_at: new Date().toISOString()
        };

        const insertPayload: Record<string, any> = {
          id: newRes.id,
          folder_id: newRes.folder_id,
          title: newRes.title,
          type: newRes.type,
          url: newRes.url,
          description: newRes.description || null,
          created_at: newRes.created_at
        };

        let { error } = await supabase.from('app_resource').insert(insertPayload);

        // Fallback retry if optional description column doesn't exist in Supabase table
        if (error && error.message && error.message.includes('description')) {
          delete insertPayload.description;
          const retry = await supabase.from('app_resource').insert(insertPayload);
          error = retry.error;
        }

        if (error) {
          console.error('Error inserting app_resource:', error);
          toast.error(`Database error: ${error.message}`);
          return;
        }

        const updated = [...resources, newRes];
        syncResourcesState(updated);

        if (user) {
          logTransaction({
            admin_username: user.username,
            action_type: 'ADD_APP_RESOURCE',
            entity_type: 'app_resource',
            entity_id: newRes.id,
            details: `Added ${newRes.type} "${newRes.title}" to folder ID ${selectedFolderId}`
          });
        }

        toast.success(`New ${resourceFormData.type.toUpperCase()} saved to database!`);
      } else if (resourceFormData.id) {
        const updatePayload: Record<string, any> = {
          title: resourceFormData.title.trim(),
          type: resourceFormData.type,
          url: resourceFormData.url.trim(),
          description: resourceFormData.description.trim() || null
        };

        let { error } = await supabase.from('app_resource').update(updatePayload).eq('id', resourceFormData.id);

        if (error && error.message && error.message.includes('description')) {
          delete updatePayload.description;
          const retry = await supabase.from('app_resource').update(updatePayload).eq('id', resourceFormData.id);
          error = retry.error;
        }

        if (error) {
          console.error('Error updating app_resource:', error);
          toast.error(`Database error: ${error.message}`);
          return;
        }

        const updated = resources.map(r => r.id === resourceFormData.id ? {
          ...r,
          title: resourceFormData.title.trim(),
          type: resourceFormData.type,
          url: resourceFormData.url.trim(),
          description: resourceFormData.description.trim() || undefined
        } : r);

        syncResourcesState(updated);

        if (user) {
          logTransaction({
            admin_username: user.username,
            action_type: 'UPDATE_APP_RESOURCE',
            entity_type: 'app_resource',
            entity_id: resourceFormData.id,
            details: `Updated ${resourceFormData.type} "${resourceFormData.title}"`
          });
        }

        toast.success(`Updated ${resourceFormData.type.toUpperCase()} in database!`);
      }

      setShowResourceModal(false);
      setResourceFormData({
        title: '',
        type: 'video',
        url: '',
        description: ''
      });
    } catch (err: any) {
      toast.error('Failed to save resource: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingResource(false);
    }
  };

  const handleDeleteResource = async (resId: string) => {
    const target = resources.find(r => r.id === resId);
    try {
      const { error } = await supabase.from('app_resource').delete().eq('id', resId);
      if (error) {
        toast.error(`Database error deleting resource: ${error.message}`);
        return;
      }

      const updated = resources.filter(r => r.id !== resId);
      syncResourcesState(updated);

      if (user) {
        logTransaction({
          admin_username: user.username,
          action_type: 'DELETE_APP_RESOURCE',
          entity_type: 'app_resource',
          entity_id: resId,
          details: `Deleted resource "${target?.title || resId}"`
        });
      }

      toast.success(`Removed "${target?.title || 'Resource'}" from database`);
    } catch (err: any) {
      toast.error('Failed to delete resource: ' + (err.message || 'Unknown error'));
    }
  };

  // Student Access Controls
  const isFolderEnabledForStudent = (studentPcaid: string, folderId: string) => {
    const record = accessRecords.find(a => a.student_pcaid === studentPcaid && a.folder_id === folderId);
    if (!record) return false; // Default disabled if no record in database
    return record.is_enabled;
  };

  const toggleStudentFolderAccess = (studentPcaid: string, folderId: string, cascade = true) => {
    const targetFolderIds = cascade ? getAllDescendantFolderIds(folderId, folders) : [folderId];
    const currentStatus = isFolderEnabledForStudent(studentPcaid, folderId);
    const newStatus = !currentStatus;
    const computedExpires = newStatus ? computeExpiresAt(selectedDurationPreset) : null;

    let updated = [...accessRecords];

    for (const fId of targetFolderIds) {
      const existingIndex = updated.findIndex(a => a.student_pcaid === studentPcaid && a.folder_id === fId);
      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          is_enabled: newStatus,
          duration_preset: newStatus ? selectedDurationPreset : '0',
          expires_at: newStatus ? computedExpires : null,
          updated_at: new Date().toISOString()
        };
      } else {
        updated.push({
          id: `acc-${fId}-${studentPcaid}`,
          student_pcaid: studentPcaid,
          folder_id: fId,
          is_enabled: newStatus,
          duration_preset: newStatus ? selectedDurationPreset : '0',
          expires_at: newStatus ? computedExpires : null,
          updated_at: new Date().toISOString()
        });
      }
    }

    syncAccessState(syncParentFolderAccess(updated, folders));
  };

  const setAllFoldersAccessForStudent = (studentPcaid: string, enable: boolean) => {
    const otherRecords = accessRecords.filter(a => a.student_pcaid !== studentPcaid);
    const computedExpires = enable ? computeExpiresAt(selectedDurationPreset) : null;

    const newStudentRecords: StudentFolderAccess[] = folders.map(f => {
      const existing = accessRecords.find(a => a.student_pcaid === studentPcaid && a.folder_id === f.id);
      return {
        id: existing?.id || crypto.randomUUID(),
        student_pcaid: studentPcaid,
        folder_id: f.id,
        is_enabled: enable,
        duration_preset: enable ? selectedDurationPreset : '0',
        expires_at: enable ? computedExpires : null,
        updated_at: new Date().toISOString()
      };
    });

    const updated = [...otherRecords, ...newStudentRecords];
    syncAccessState(syncParentFolderAccess(updated, folders));
  };

  const areAllFoldersDisabledForStudent = (studentPcaid: string) => {
    if (folders.length === 0) return true;
    return folders.every(f => !isFolderEnabledForStudent(studentPcaid, f.id));
  };

  // Selected folder and breadcrumb resolution
  const selectedFolder = useMemo(() => folders.find(f => f.id === selectedFolderId), [folders, selectedFolderId]);

  const currentFolderResources = useMemo(() => resources.filter(r => r.folder_id === selectedFolderId), [resources, selectedFolderId]);

  const currentFolderSubfolders = useMemo(() => folders.filter(f => f.parent_id === selectedFolderId), [folders, selectedFolderId]);

  const breadcrumbs = useMemo(() => {
    const list: AppFolder[] = [];
    let curr = selectedFolder;
    while (curr) {
      list.unshift(curr);
      curr = folders.find(f => f.id === curr?.parent_id);
    }
    return list;
  }, [folders, selectedFolder]);

  // Tree helper
  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id || !folders.some(p => p.id === f.parent_id)), [folders]);

  const getSubfoldersOf = (parentId: string) => folders.filter(f => f.parent_id === parentId);

  const toggleExpand = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Bulk status calculation for a folder
  const getBulkFolderStatus = (folderId: string): 'all' | 'none' | 'mixed' => {
    if (selectedStudentPcaids.length === 0) return 'none';
    const targetFolderIds = getAllDescendantFolderIds(folderId, folders);
    let enabledSlots = 0;
    const totalSlots = selectedStudentPcaids.length * targetFolderIds.length;

    for (const pcaid of selectedStudentPcaids) {
      for (const fId of targetFolderIds) {
        if (isFolderEnabledForStudent(pcaid, fId)) {
          enabledSlots++;
        }
      }
    }

    if (enabledSlots === totalSlots) return 'all';
    if (enabledSlots === 0) return 'none';
    return 'mixed';
  };

  const toggleBulkFolderAccess = (folderId: string) => {
    if (selectedStudentPcaids.length === 0) return;
    const targetFolderIds = getAllDescendantFolderIds(folderId, folders);
    const currentStatus = getBulkFolderStatus(folderId);
    const newStatus = currentStatus !== 'all';
    const computedExpires = newStatus ? computeExpiresAt(selectedDurationPreset) : null;

    let updated = [...accessRecords];

    for (const pcaid of selectedStudentPcaids) {
      for (const fId of targetFolderIds) {
        const existingIndex = updated.findIndex(a => a.student_pcaid === pcaid && a.folder_id === fId);
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            is_enabled: newStatus,
            duration_preset: newStatus ? selectedDurationPreset : '0',
            expires_at: newStatus ? computedExpires : null,
            updated_at: new Date().toISOString()
          };
        } else {
          updated.push({
            id: `acc-${fId}-${pcaid}`,
            student_pcaid: pcaid,
            folder_id: fId,
            is_enabled: newStatus,
            duration_preset: newStatus ? selectedDurationPreset : '0',
            expires_at: newStatus ? computedExpires : null,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    syncAccessState(syncParentFolderAccess(updated, folders));
  };

  const bulkSetAllFoldersAccess = (enable: boolean) => {
    if (selectedStudentPcaids.length === 0) return;

    const pcaidSet = new Set(selectedStudentPcaids);
    const otherRecords = accessRecords.filter(a => !pcaidSet.has(a.student_pcaid));
    const computedExpires = enable ? computeExpiresAt(selectedDurationPreset) : null;

    const newRecords: StudentFolderAccess[] = [];

    for (const pcaid of selectedStudentPcaids) {
      for (const f of folders) {
        const existing = accessRecords.find(a => a.student_pcaid === pcaid && a.folder_id === f.id);
        newRecords.push({
          id: existing?.id || crypto.randomUUID(),
          student_pcaid: pcaid,
          folder_id: f.id,
          is_enabled: enable,
          duration_preset: enable ? selectedDurationPreset : '0',
          expires_at: enable ? computedExpires : null,
          updated_at: new Date().toISOString()
        });
      }
    }

    const updated = [...otherRecords, ...newRecords];
    syncAccessState(syncParentFolderAccess(updated, folders));
  };

  const areAllFoldersDisabledForBulk = () => {
    if (selectedStudentPcaids.length === 0 || folders.length === 0) return true;
    return selectedStudentPcaids.every(pcaid =>
      folders.every(f => !isFolderEnabledForStudent(pcaid, f.id))
    );
  };

  const handleSaveIndividualAccess = async () => {
    if (selectedStudents.length !== 1) return;
    const student = selectedStudents[0];
    setSavingAccess(true);

    try {
      const currentSynced = syncParentFolderAccess(accessRecords, folders);
      const studentRecords = currentSynced.filter(a => a.student_pcaid === student.pcaid);
      const upsertRows = folders.map(f => {
        const existing = studentRecords.find(a => a.folder_id === f.id);
        const isEnabled = existing ? existing.is_enabled : false;
        const preset = isEnabled ? (existing?.duration_preset && existing.duration_preset !== '0' ? existing.duration_preset : selectedDurationPreset) : '0';
        const expiresAt = isEnabled ? (existing?.expires_at !== undefined ? existing.expires_at : computeExpiresAt(preset)) : null;

        return {
          id: existing?.id || crypto.randomUUID(),
          student_pcaid: student.pcaid,
          folder_id: f.id,
          is_enabled: isEnabled,
          duration_preset: preset,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        };
      });

      if (upsertRows.length > 0) {
        let { error } = await supabase.from('student_folder_access').upsert(upsertRows, { onConflict: 'student_pcaid,folder_id' });
        if (error) {
          console.warn('Upsert onConflict failed on save, fallback delete+insert:', error.message);
          await supabase.from('student_folder_access').delete().eq('student_pcaid', student.pcaid);
          const retry = await supabase.from('student_folder_access').insert(upsertRows);
          if (retry.error) throw retry.error;
        }

        const otherRecords = currentSynced.filter(a => a.student_pcaid !== student.pcaid);
        syncAccessState(syncParentFolderAccess([...otherRecords, ...upsertRows], folders));
      }

      if (user) {
        logTransaction({
          admin_username: user.username,
          action_type: 'APP_ACCESS_UPDATE',
          entity_type: 'student_folder_access',
          entity_id: student.pcaid,
          details: `Saved module access permissions for student ${student.name} (${student.pcaid})`
        });
      }

      toast.success(`Access permissions saved successfully for ${student.name}!`);
    } catch (err: any) {
      toast.error('Failed to save access changes: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSaveBulkAccess = async () => {
    if (selectedStudents.length === 0) return;
    setSavingAccess(true);

    try {
      const currentSynced = syncParentFolderAccess(accessRecords, folders);
      const pcaidSet = new Set(selectedStudentPcaids);
      const upsertRows: any[] = [];
      for (const pcaid of selectedStudentPcaids) {
        for (const f of folders) {
          const existing = currentSynced.find(a => a.student_pcaid === pcaid && a.folder_id === f.id);
          const isEnabled = existing ? existing.is_enabled : false;
          const preset = isEnabled ? (existing?.duration_preset && existing.duration_preset !== '0' ? existing.duration_preset : selectedDurationPreset) : '0';
          const expiresAt = isEnabled ? (existing?.expires_at !== undefined ? existing.expires_at : computeExpiresAt(preset)) : null;

          upsertRows.push({
            id: existing?.id || crypto.randomUUID(),
            student_pcaid: pcaid,
            folder_id: f.id,
            is_enabled: isEnabled,
            duration_preset: preset,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (upsertRows.length > 0) {
        let { error } = await supabase.from('student_folder_access').upsert(upsertRows, { onConflict: 'student_pcaid,folder_id' });
        if (error) {
          console.warn('Bulk upsert onConflict failed, fallback delete+insert:', error.message);
          await supabase.from('student_folder_access').delete().in('student_pcaid', Array.from(pcaidSet));
          const retry = await supabase.from('student_folder_access').insert(upsertRows);
          if (retry.error) throw retry.error;
        }

        const otherRecords = currentSynced.filter(a => !pcaidSet.has(a.student_pcaid));
        syncAccessState(syncParentFolderAccess([...otherRecords, ...upsertRows], folders));
      }

      if (user) {
        logTransaction({
          admin_username: user.username,
          action_type: 'BULK_APP_ACCESS_UPDATE',
          entity_type: 'student_folder_access',
          entity_id: `bulk-save-${Date.now()}`,
          details: `Saved bulk app module access permissions for ${selectedStudents.length} students`
        });
      }

      toast.success(`Bulk access permissions saved successfully for ${selectedStudents.length} students!`);
    } catch (err: any) {
      toast.error('Failed to save bulk access changes: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingAccess(false);
    }
  };

  // Selected students list derivation
  const selectedStudents = useMemo(() => {
    return students.filter(s => selectedStudentPcaids.includes(s.pcaid));
  }, [students, selectedStudentPcaids]);

  const renderAccessFolderTreeItem = (f: AppFolder, depth = 0): React.ReactNode => {
    const isSingle = selectedStudents.length === 1;
    const isBulk = selectedStudents.length > 1;
    if (!isSingle && !isBulk) return null;

    const subfolders = getSubfoldersOf(f.id);
    const hasSubfolders = subfolders.length > 0;
    const isExpanded = expandedFolders[f.id] !== false;
    const folderResCount = resources.filter(r => r.folder_id === f.id).length;

    let isEnabled = false;
    let bulkStatus: 'all' | 'none' | 'mixed' = 'none';
    let singleRecord: StudentFolderAccess | undefined;
    let expInfo: ReturnType<typeof getAccessExpirationInfo> = { status: 'disabled', label: 'Disabled' };

    if (isSingle) {
      singleRecord = accessRecords.find(a => a.student_pcaid === selectedStudents[0].pcaid && a.folder_id === f.id);
      isEnabled = isFolderEnabledForStudent(selectedStudents[0].pcaid, f.id);
      if (isEnabled) {
        expInfo = getAccessExpirationInfo(singleRecord);
      }
    } else if (isBulk) {
      bulkStatus = getBulkFolderStatus(f.id);
      isEnabled = bulkStatus === 'all';
    }

    return (
      <div key={f.id} className="space-y-2">
        <div
          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
            isSingle
              ? isEnabled
                ? expInfo.status === 'expired'
                  ? 'bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 shadow-2xs'
                  : 'bg-white dark:bg-gray-800/90 border-gray-200 dark:border-gray-700 shadow-2xs'
                : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800/80 opacity-70'
              : bulkStatus === 'all'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 shadow-2xs'
                : bulkStatus === 'mixed'
                  ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 shadow-2xs'
                  : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800/80 opacity-70'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            {hasSubfolders ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(f.id, e)}
                className="p-1 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded transition-colors text-gray-500 hover:text-teal-600 shrink-0"
                title={isExpanded ? 'Collapse Subfolders' : 'Expand Subfolders'}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-teal-600 dark:text-teal-400" />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}

            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isSingle
                  ? isEnabled 
                    ? expInfo.status === 'expired'
                      ? 'bg-red-100 text-red-600 dark:bg-red-950/60'
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60' 
                    : 'bg-gray-200 text-gray-400 dark:bg-gray-800'
                  : bulkStatus === 'all'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70'
                    : bulkStatus === 'mixed'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70'
                      : 'bg-gray-200 text-gray-400 dark:bg-gray-800'
              }`}
            >
              <Folder size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={`text-xs text-gray-900 dark:text-white truncate ${depth === 0 ? 'font-bold text-sm' : 'font-semibold'}`}>
                  {f.name}
                </h4>

                {isSingle && isEnabled && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    expInfo.status === 'expired'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200'
                      : expInfo.status === 'active'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                  }`}>
                    <Clock size={10} />
                    <span>{expInfo.label}</span>
                  </span>
                )}

                {isBulk && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    bulkStatus === 'all'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-300'
                      : bulkStatus === 'mixed'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-300'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {bulkStatus === 'all' ? 'All Enabled' : bulkStatus === 'mixed' ? 'Mixed Access' : 'All Disabled'}
                  </span>
                )}

                {hasSubfolders && (
                  <span className="text-[10px] bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-md font-bold border border-teal-200/50 dark:border-teal-800/50">
                    {subfolders.length} subfolder{subfolders.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                {f.description || `${folderResCount} content items`}
              </p>
            </div>
          </div>

          {/* Controls: Duration Selector & Toggle Switch */}
          <div className="flex items-center gap-2 shrink-0">
            {isSingle && isEnabled && (
              <select
                value={singleRecord?.duration_preset || 'unlimited'}
                onChange={(e) => {
                  e.stopPropagation();
                  const preset = e.target.value;
                  const targetFolderIds = getAllDescendantFolderIds(f.id, folders);
                  const newExpiresAt = computeExpiresAt(preset);
                  const studentPcaid = selectedStudents[0].pcaid;

                  let updated = [...accessRecords];
                  for (const targetId of targetFolderIds) {
                    const idx = updated.findIndex(a => a.student_pcaid === studentPcaid && a.folder_id === targetId);
                    if (idx >= 0) {
                      updated[idx] = {
                        ...updated[idx],
                        is_enabled: true,
                        duration_preset: preset,
                        expires_at: newExpiresAt,
                        updated_at: new Date().toISOString()
                      };
                    } else {
                      updated.push({
                        id: `acc-${targetId}-${studentPcaid}`,
                        student_pcaid: studentPcaid,
                        folder_id: targetId,
                        is_enabled: true,
                        duration_preset: preset,
                        expires_at: newExpiresAt,
                        updated_at: new Date().toISOString()
                      });
                    }
                  }
                  syncAccessState(syncParentFolderAccess(updated, folders));
                }}
                className="text-[11px] font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                title="Change activation duration for this folder"
              >
                {DURATION_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            )}

            {isBulk && bulkStatus !== 'none' && (
              <select
                onChange={(e) => {
                  e.stopPropagation();
                  const preset = e.target.value;
                  const targetFolderIds = getAllDescendantFolderIds(f.id, folders);
                  const newExpiresAt = computeExpiresAt(preset);

                  let updated = [...accessRecords];
                  for (const pcaid of selectedStudentPcaids) {
                    for (const targetId of targetFolderIds) {
                      const idx = updated.findIndex(a => a.student_pcaid === pcaid && a.folder_id === targetId);
                      if (idx >= 0) {
                        updated[idx] = {
                          ...updated[idx],
                          duration_preset: preset,
                          expires_at: newExpiresAt,
                          updated_at: new Date().toISOString()
                        };
                      }
                    }
                  }
                  syncAccessState(syncParentFolderAccess(updated, folders));
                  toast.info(`Updated duration preset to "${DURATION_PRESETS.find(p=>p.id===preset)?.label}" for selected folder.`);
                }}
                defaultValue=""
                className="text-[11px] font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                title="Set duration preset across selected students for this folder"
              >
                <option value="" disabled>Set Duration...</option>
                {DURATION_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                if (isSingle) {
                  toggleStudentFolderAccess(selectedStudents[0].pcaid, f.id, true);
                } else if (isBulk) {
                  toggleBulkFolderAccess(f.id);
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isSingle
                  ? isEnabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-700'
                  : bulkStatus === 'all' ? 'bg-emerald-600' : bulkStatus === 'mixed' ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              title={
                isSingle
                  ? isEnabled ? 'Click to disable access' : 'Click to enable access'
                  : `Click to toggle for all ${selectedStudents.length} selected students`
              }
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  (isSingle ? isEnabled : bulkStatus === 'all') ? 'translate-x-5' : bulkStatus === 'mixed' ? 'translate-x-2.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Nested Subfolders recursively */}
        {isExpanded && hasSubfolders && (
          <div className="pl-4 space-y-2 border-l-2 border-teal-100 dark:border-teal-900/40 ml-4 my-1">
            {subfolders.map(sub => renderAccessFolderTreeItem(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Filter helpers
  const uniqueBatches = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.joined_batch) set.add(s.joined_batch); });
    return Array.from(set).sort();
  }, [students]);

  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.district) set.add(s.district); });
    return Array.from(set).sort();
  }, [students]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (batchFilter !== 'ALL' && s.joined_batch !== batchFilter) return false;
      if (districtFilter !== 'ALL' && s.district !== districtFilter) return false;
      if (studentSearch.trim()) {
        const query = studentSearch.toLowerCase();
        const match = 
          s.pcaid.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          (s.phone && s.phone.includes(query)) ||
          (s.mail && s.mail.toLowerCase().includes(query));
        if (!match) return false;
      }
      return true;
    });
  }, [students, studentSearch, batchFilter, districtFilter]);

  const selectedStudentPcaid = selectedStudents.length > 0 ? selectedStudents[0].pcaid : '';
  const selectedStudent = selectedStudents.length === 1 ? selectedStudents[0] : null;

  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedStudentPcaids.includes(s.pcaid));
  }, [filteredStudents, selectedStudentPcaids]);

  const handleToggleStudentSelect = (pcaid: string) => {
    setSelectedStudentPcaids(prev => 
      prev.includes(pcaid) ? prev.filter(id => id !== pcaid) : [...prev, pcaid]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredPcaids = filteredStudents.map(s => s.pcaid);
    if (isAllFilteredSelected) {
      setSelectedStudentPcaids(prev => prev.filter(id => !filteredPcaids.includes(id)));
    } else {
      setSelectedStudentPcaids(prev => Array.from(new Set([...prev, ...filteredPcaids])));
    }
  };

  // Generated Mobile Access Payload simulation
  const mobileApiSimulatedPayload = useMemo(() => {
    if (!selectedStudentPcaid) return null;
    const student = selectedStudent;
    const enabledFolderIds = folders
      .filter(f => f.is_active && isFolderEnabledForStudent(selectedStudentPcaid, f.id))
      .map(f => f.id);

    const activeFolders = folders.filter(f => enabledFolderIds.includes(f.id));
    const activeResources = resources.filter(r => enabledFolderIds.includes(r.folder_id));

    return {
      status: 'success',
      mobile_app_version: 'v2.4.0',
      student: {
        pcaid: student?.pcaid || selectedStudentPcaid,
        name: student?.name || 'Student Account',
        package_type: student?.asked_package_type || 'Full Course',
        app_activated: true,
        access_token: `PCA-MOBILE-TOK-${student?.pcaid || 'GUEST'}-SECURE`
      },
      authorized_modules: activeFolders.map(f => ({
        folder_id: f.id,
        title: f.name,
        description: f.description,
        parent_id: f.parent_id,
        contents: activeResources.filter(r => r.folder_id === f.id).map(r => ({
          resource_id: r.id,
          title: r.title,
          type: r.type,
          media_url: r.url
        }))
      }))
    };
  }, [selectedStudentPcaid, selectedStudent, folders, resources, accessRecords]);

  return (
    <div className="space-y-6">
      {/* Top Tab Navigation Only */}
      <div className="bg-slate-900 dark:bg-slate-900/95 text-white rounded-2xl p-1.5 shadow-md border border-slate-800/80 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('folders')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'folders' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Folder size={15} />
          <span>Folders & Files</span>
        </button>
        <button
          onClick={() => setActiveTab('student-access')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'student-access' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Key size={15} />
          <span>Student Access</span>
        </button>
        <button
          onClick={() => setActiveTab('api-docs')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'api-docs' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Layers size={15} />
          <span>App API Live Sync</span>
        </button>
      </div>

      {/* TAB 1: FOLDERS & CONTENT MANAGEMENT */}
      {activeTab === 'folders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Folder Tree Explorer */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col h-[680px]">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Course Modules & Folders
                </h2>
              </div>
              <button
                onClick={() => handleOpenCreateFolder(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Create Root Module Folder"
              >
                <Plus size={14} />
                <span>New Module</span>
              </button>
            </div>

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {rootFolders.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Folder className="mx-auto text-gray-300 dark:text-gray-700 mb-2" size={32} />
                  <p className="text-xs text-gray-500 font-medium">No folders created yet.</p>
                  <button
                    onClick={() => handleOpenCreateFolder(null)}
                    className="mt-3 text-xs text-teal-600 font-bold hover:underline"
                  >
                    + Add First Folder
                  </button>
                </div>
              ) : (
                rootFolders.map(folder => renderFolderItem(folder, 0))
              )}
            </div>
          </div>

          {/* Right Column: Active Folder Contents & Management */}
          <div className="lg:col-span-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col h-[680px]">
            {selectedFolder ? (
              <>
                {/* Header & Breadcrumb */}
                <div className="pb-5 border-b border-gray-100 dark:border-gray-800 mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                    <span>Root</span>
                    {breadcrumbs.map((b, idx) => (
                      <React.Fragment key={b.id}>
                        <ChevronRight size={12} />
                        <span className={idx === breadcrumbs.length - 1 ? 'text-teal-600 dark:text-teal-400' : 'text-gray-600 dark:text-gray-300'}>
                          {b.name}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Folder className="text-amber-500 shrink-0" size={22} />
                        <span>{selectedFolder.name}</span>
                      </h2>
                      {selectedFolder.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {selectedFolder.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenCreateFolder(selectedFolder.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all"
                      >
                        <FolderPlus size={14} />
                        <span>Add Subfolder</span>
                      </button>

                      <button
                        onClick={handleOpenCreateResource}
                        className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                      >
                        <Plus size={15} />
                        <span>Add Video / PDF</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Contents List */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                  {/* Nested Subfolders in Grid */}
                  {currentFolderSubfolders.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                        <Folder size={14} />
                        <span>Subfolders ({currentFolderSubfolders.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentFolderSubfolders.map(sub => (
                          <div
                            key={sub.id}
                            onClick={() => setSelectedFolderId(sub.id)}
                            className="p-3.5 bg-gray-50 dark:bg-gray-800/40 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 border border-gray-100 dark:border-gray-800 hover:border-teal-200 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                <Folder size={18} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                  {sub.name}
                                </h4>
                                <p className="text-[11px] text-gray-400 truncate">
                                  {resources.filter(r => r.folder_id === sub.id).length} items
                                </p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files & Media Resources */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                      <FileText size={14} />
                      <span>Folder Resources ({currentFolderResources.length})</span>
                    </h3>

                    {currentFolderResources.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center bg-gray-50/50 dark:bg-gray-800/20">
                        <Video size={36} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                        <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400">No videos or files added yet</h4>
                        <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                          Click "Add Video / PDF" above to link YouTube videos, Vimeo streams, MP4 files, or PDF notes into this folder.
                        </p>
                        <button
                          onClick={handleOpenCreateResource}
                          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Plus size={14} />
                          <span>Add Content Now</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {currentFolderResources.map(res => (
                          <div
                            key={res.id}
                            className="p-4 bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 rounded-2xl hover:shadow-xs transition-all flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                res.type === 'video' ? 'bg-red-50 dark:bg-red-950/40 text-red-600' :
                                res.type === 'pdf' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' :
                                'bg-teal-50 dark:bg-teal-950/40 text-teal-600'
                              }`}>
                                {res.type === 'video' ? <Video size={20} /> :
                                 res.type === 'pdf' ? <FileText size={20} /> : <LinkIcon size={20} />}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                    {res.title}
                                  </h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    res.type === 'video' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' :
                                    res.type === 'pdf' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                                    'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                                  }`}>
                                    {res.type}
                                  </span>
                                </div>

                                {res.description && (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                    {res.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                                  <span className="truncate max-w-xs">{res.url}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition-colors"
                                title="Open Media Link"
                              >
                                <ExternalLink size={16} />
                              </a>
                              <button
                                onClick={() => handleOpenEditResource(res)}
                                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition-colors"
                                title="Edit Resource"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteResource(res.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                title="Delete Resource"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Folder size={48} className="text-gray-300 dark:text-gray-700 mb-3" />
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Select a folder from the left pane</h3>
                <p className="text-xs text-gray-400 mt-1">Choose a module folder to add videos, PDFs, or subfolders.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT ACCESS & ACTIVATION */}
      {activeTab === 'student-access' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Student Selector Panel */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col h-[720px]">
            <div className="pb-3 border-b border-gray-100 dark:border-gray-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-teal-600" />
                  <span>Students ({students.length})</span>
                </h2>
                {selectedStudentPcaids.length > 0 && (
                  <span className="text-[10px] bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 font-extrabold px-2 py-0.5 rounded-full border border-teal-200/60">
                    {selectedStudentPcaids.length} Selected
                  </span>
                )}
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by PCA ID, name, phone..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-full"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns Row */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="ALL">All Batches</option>
                  {uniqueBatches.map(b => (
                    <option key={b} value={b}>Batch {b}</option>
                  ))}
                </select>

                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="ALL">All Districts</option>
                  {uniqueDistricts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Clear Filters Button when any filter is active */}
              {(batchFilter !== 'ALL' || districtFilter !== 'ALL' || studentSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    setBatchFilter('ALL');
                    setDistrictFilter('ALL');
                  }}
                  className="w-full py-1 px-2 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/60 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X size={12} />
                  <span>Clear All Filters</span>
                </button>
              )}

              {/* SELECTED STUDENTS DISPLAY CONTAINER (BELOW SEARCH BAR & FILTERS) */}
              {selectedStudentPcaids.length > 0 && (
                <div className="p-2.5 bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                      <Users size={12} className="text-teal-600" />
                      <span>Selected Students ({selectedStudentPcaids.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentPcaids([])}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      <X size={12} />
                      Clear
                    </button>
                  </div>

                  {/* Scrollable list of selected student tags/chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                    {selectedStudents.map(s => (
                      <span
                        key={s.pcaid}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-white dark:bg-gray-800 text-teal-900 dark:text-teal-200 text-[10px] font-bold rounded-md border border-teal-200 dark:border-teal-700/60 shadow-2xs"
                      >
                        <span className="font-mono text-teal-700 dark:text-teal-400">{s.pcaid}</span>
                        <span className="truncate max-w-[85px]">{s.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentPcaids(prev => prev.filter(id => id !== s.pcaid))}
                          className="p-0.5 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded text-gray-400 hover:text-red-500"
                          title={`Remove ${s.name}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Select All Filtered Checkbox */}
              <div className="flex items-center justify-between pt-1 text-[11px] font-bold text-gray-600 dark:text-gray-400">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 hover:underline"
                >
                  {isAllFilteredSelected ? (
                    <CheckSquare size={14} className="text-teal-600" />
                  ) : (
                    <Square size={14} className="text-gray-400" />
                  )}
                  <span>Select All Filtered ({filteredStudents.length})</span>
                </button>

                <span className="text-[10px] text-gray-400 font-normal">
                  {filteredStudents.length} of {students.length}
                </span>
              </div>
            </div>

            {/* Students List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pr-1 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  No students found matching current search/filters.
                </div>
              ) : (
                filteredStudents.map(student => {
                  const isChecked = selectedStudentPcaids.includes(student.pcaid);
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleToggleStudentSelect(student.pcaid)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border flex items-center justify-between gap-2 ${
                        isChecked
                          ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 shadow-2xs'
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 shrink-0 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-extrabold text-teal-700 dark:text-teal-400 font-mono">
                              {student.pcaid}
                            </span>
                            <span className="text-[9px] bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                              {student.asked_package_type || 'Active'}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                            {student.name}
                          </h4>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            Batch: {student.joined_batch || 'N/A'} | {student.district || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Student Access & Module Permissions Panel */}
          <div className="lg:col-span-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col h-[720px]">
            {selectedStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users size={48} className="text-gray-300 dark:text-gray-700 mb-3" />
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Select Students to Configure Access</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Select one student on the left for individual access control, or choose multiple students to enable bulk activation across module folders.
                </p>
              </div>
            ) : selectedStudents.length === 1 ? (
              /* SINGLE STUDENT ACCESS MODE */
              <>
                <div className="pb-4 border-b border-gray-100 dark:border-gray-800 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 text-xs font-black font-mono rounded-lg">
                        {selectedStudents[0].pcaid}
                      </span>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedStudents[0].name}
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Batch: {selectedStudents[0].joined_batch || 'General'} | District: {selectedStudents[0].district || 'N/A'} | Email: {selectedStudents[0].mail || 'N/A'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {areAllFoldersDisabledForStudent(selectedStudents[0].pcaid) ? (
                      <button
                        type="button"
                        onClick={() => setAllFoldersAccessForStudent(selectedStudents[0].pcaid, true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 rounded-xl text-xs font-bold transition-all border border-teal-200/60 cursor-pointer"
                      >
                        <CheckSquare size={14} />
                        <span>Enable All</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAllFoldersAccessForStudent(selectedStudents[0].pcaid, false)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 rounded-xl text-xs font-bold transition-all border border-red-200/60 cursor-pointer"
                      >
                        <Square size={14} />
                        <span>Disable All</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveIndividualAccess}
                      disabled={savingAccess}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      {savingAccess ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      <span>{savingAccess ? 'Saving...' : 'Save Access'}</span>
                    </button>
                  </div>
                </div>



                {/* Folder Permissions Tree */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">


                  {rootFolders.length === 0 ? (
                    <div className="text-center py-10 text-xs text-gray-400">
                      No modules or folders created yet.
                    </div>
                  ) : (
                    rootFolders.map(f => renderAccessFolderTreeItem(f, 0))
                  )}
                </div>

                {/* Footer Save Action Bar */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 mt-3 shrink-0">
                  <span className="text-xs text-gray-500 font-medium truncate">
                    Configuring access for <strong>{selectedStudents[0].name}</strong> ({selectedStudents[0].pcaid})
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveIndividualAccess}
                    disabled={savingAccess}
                    className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                  >
                    {savingAccess ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    <span>{savingAccess ? 'Saving Changes...' : 'Save Access Changes'}</span>
                  </button>
                </div>
              </>
            ) : (
              /* BULK ACTIVATION MODE FOR MULTIPLE STUDENTS */
              <>
                <div className="pb-4 border-b border-gray-100 dark:border-gray-800 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-2xs">
                        BULK ACTIVATION MODE
                      </span>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {selectedStudents.length} Students Selected
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Applying module permissions simultaneously across {selectedStudents.length} selected accounts.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {areAllFoldersDisabledForBulk() ? (
                      <button
                        type="button"
                        onClick={() => bulkSetAllFoldersAccess(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 rounded-xl text-xs font-bold transition-all border border-teal-200/60 cursor-pointer"
                      >
                        <CheckSquare size={14} />
                        <span>Enable All ({selectedStudents.length})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bulkSetAllFoldersAccess(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 rounded-xl text-xs font-bold transition-all border border-red-200/60 cursor-pointer"
                      >
                        <Square size={14} />
                        <span>Disable All ({selectedStudents.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveBulkAccess}
                      disabled={savingAccess}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      {savingAccess ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      <span>{savingAccess ? 'Saving Bulk...' : 'Save Bulk Access'}</span>
                    </button>
                  </div>
                </div>

                {/* Info Notice */}
                <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl p-3 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2 mb-3">
                  <Sparkles size={16} className="shrink-0 mt-0.5 text-teal-600" />
                  <span>
                    <strong>Bulk Management Active:</strong> Toggling any folder in the tree structure below will grant or revoke access for all <strong>{selectedStudents.length} selected students</strong> at once.
                  </span>
                </div>



                {/* Folder Permissions Tree in Bulk Mode */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  {rootFolders.length === 0 ? (
                    <div className="text-center py-10 text-xs text-gray-400">
                      No modules or folders created yet.
                    </div>
                  ) : (
                    rootFolders.map(f => renderAccessFolderTreeItem(f, 0))
                  )}
                </div>

                {/* Footer Bulk Save Action Bar */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 mt-3 shrink-0">
                  <span className="text-xs text-gray-500 font-medium truncate">
                    Bulk activation active for <strong>{selectedStudents.length} selected students</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveBulkAccess}
                    disabled={savingAccess}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                  >
                    {savingAccess ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    <span>{savingAccess ? 'Saving Bulk Permissions...' : 'Save Bulk Access Changes'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: APP API LIVE SYNC & DOCS */}
      {activeTab === 'api-docs' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Smartphone className="text-teal-600" size={20} />
                <span>Mobile App Integration REST Endpoint</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Your Udemy-style mobile app calls this endpoint with the student's activation token to fetch authorized video folders.
              </p>
            </div>

            <button
              onClick={() => {
                if (mobileApiSimulatedPayload) {
                  navigator.clipboard.writeText(JSON.stringify(mobileApiSimulatedPayload, null, 2));
                  toast.success('API JSON Payload copied to clipboard!');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
            >
              <Copy size={14} />
              <span>Copy API JSON</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">
                  1. Mobile Request URL
                </h3>
                <div className="p-3 bg-slate-950 text-teal-400 font-mono text-xs rounded-lg overflow-x-auto">
                  GET https://api.pca-academy.com/v1/mobile/modules?student_pcaid={selectedStudentPcaid || 'PCA1001'}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">
                  2. Authentication Header
                </h3>
                <div className="p-3 bg-slate-950 text-amber-300 font-mono text-xs rounded-lg overflow-x-auto">
                  Authorization: Bearer PCA-MOBILE-TOK-{selectedStudentPcaid || 'PCA1001'}-SECURE
                </div>
              </div>

              <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-900/50 text-xs text-teal-900 dark:text-teal-200 leading-relaxed">
                <h4 className="font-bold flex items-center gap-1.5 mb-1 text-teal-800 dark:text-teal-300">
                  <Sparkles size={14} />
                  <span>How Mobile Activation Works</span>
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Student opens mobile app and enters PCA ID + Activation Code.</li>
                  <li>App sends request to dashboard API with student credentials.</li>
                  <li>Dashboard verifies enabled folders in database and returns authorized videos.</li>
                  <li>When you toggle off a folder in this dashboard, access is immediately revoked on their app.</li>
                </ol>
              </div>
            </div>

            {/* Live Payload Preview */}
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Live API JSON Response</span>
                <span className="text-[10px] text-teal-600 font-mono">200 OK</span>
              </h3>
              <div className="flex-1 bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-y-auto max-h-[380px] custom-scrollbar border border-slate-800">
                <pre>{JSON.stringify(mobileApiSimulatedPayload, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Folder className="text-amber-500" size={20} />
                <span>{folderModalMode === 'create' ? 'Create New Folder' : 'Edit Folder'}</span>
              </h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Folder / Module Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Module 03: Quantum Physics"
                  value={folderFormData.name}
                  onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Description / Subtitle
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description for mobile app students..."
                  value={folderFormData.description}
                  onChange={(e) => setFolderFormData({ ...folderFormData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Parent Location
                </label>
                <select
                  value={folderFormData.parent_id || ''}
                  onChange={(e) => setFolderFormData({ ...folderFormData, parent_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Root Level (Main Module)</option>
                  {buildFolderTreeOptions().map(fOpt => (
                    <option key={fOpt.id} value={fOpt.id}>
                      {fOpt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFolder}
                  className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 cursor-pointer"
                >
                  {savingFolder && <Loader2 size={14} className="animate-spin" />}
                  <span>{savingFolder ? 'Saving...' : 'Save Folder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Resource / File */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 border border-gray-100 dark:border-gray-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Video className="text-teal-600" size={20} />
                <span>{resourceModalMode === 'create' ? 'Add Video or PDF File' : 'Edit Resource'}</span>
              </h3>
              <button
                onClick={() => setShowResourceModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lecture 01: Kinematics Basics"
                  value={resourceFormData.title}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Media Stream / File Link URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://vimeo.com/... or https://youtube.com/... or https://...pdf"
                  value={resourceFormData.url}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Resource Type
                </label>
                <select
                  value={resourceFormData.type}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="video">🎥 Video Stream</option>
                  <option value="pdf">📄 PDF Document</option>
                  <option value="link">🔗 Web Link</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes for students..."
                  value={resourceFormData.description}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResource}
                  className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 cursor-pointer"
                >
                  {savingResource && <Loader2 size={14} className="animate-spin" />}
                  <span>{savingResource ? 'Saving...' : (resourceModalMode === 'create' ? 'Add Resource' : 'Save Changes')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG FOR FOLDER DELETION */}
      {confirmDeleteFolderId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-800 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Folder?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Are you sure? This will remove the folder and all its nested subfolders and video files.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteFolderId(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteFolder(confirmDeleteFolderId)}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
