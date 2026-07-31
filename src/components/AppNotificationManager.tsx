import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Bell, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Copy, 
  Filter, 
  Layers, 
  Send, 
  Eye, 
  Clock, 
  Calendar,
  Target, 
  CheckCircle2, 
  MousePointerClick, 
  AlertCircle,
  Megaphone,
  Radio,
  Share2,
  Code,
  Search,
  Upload,
  Link,
  Folder,
  FolderOpen,
  Smartphone
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { AppNotification, NotificationDisplayType, AppFolder } from '../types';

const PRESET_SAMPLE_IMAGES = [
  { label: 'New Course Launch', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80' },
  { label: 'Science / Chemistry', url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80' },
  { label: 'Online Live Class', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80' },
  { label: 'Exam & Seminar', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80' }
];

export default function AppNotificationManager() {
  const [, setSearchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('app_notifications');
      if (saved) {
        const parsed: AppNotification[] = JSON.parse(saved);
        // Filter out legacy dummy sample records
        return parsed.filter(item => !['notif-1', 'notif-2', 'notif-3'].includes(item.id));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'banner' | 'push_bar'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [joinedBatches, setJoinedBatches] = useState<string[]>(['2024', '2025', '2026', '2027']);

  // Fetch Joined Batches from Supabase
  useEffect(() => {
    async function loadBatches() {
      try {
        const { data, error } = await supabase.from('joined_batch_item').select('joined_batch').order('joined_batch', { ascending: false });
        if (!error && data && data.length > 0) {
          const unique = Array.from(new Set(data.map(d => d.joined_batch).filter(Boolean)));
          if (unique.length > 0) {
            setJoinedBatches(unique);
          }
        }
      } catch (err) {
        console.error('Failed to load joined batches:', err);
      }
    }
    loadBatches();
  }, []);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'flutter' | 'reactnative' | 'kotlin' | 'curl' | 'sql'>('flutter');
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Fetch from Supabase on mount if available
  useEffect(() => {
    async function fetchFromSupabase() {
      if (!supabase) return;
      try {
        setIsDbLoading(true);
        const { data, error } = await supabase
          .from('app_notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Supabase app_notifications table fetch info:', error.message);
        } else if (data && data.length > 0) {
          setNotifications(data as AppNotification[]);
        }
      } catch (err) {
        console.error('Database fetch error:', err);
      } finally {
        setIsDbLoading(false);
      }
    }
    fetchFromSupabase();
  }, []);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formDisplayType, setFormDisplayType] = useState<NotificationDisplayType>('banner');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formActionUrl, setFormActionUrl] = useState('');
  const [formTargetBatch, setFormTargetBatch] = useState('ALL');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatForDateTimeInput = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  // Live App Folders State for Action URL Dropdown
  const [appFolders, setAppFolders] = useState<AppFolder[]>([]);
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Load App Folders from Supabase
  useEffect(() => {
    async function loadAppFolders() {
      try {
        const { data, error } = await supabase
          .from('app_folder')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          setAppFolders(data as AppFolder[]);
        } else {
          const cached = localStorage.getItem('app_folders_cache');
          if (cached) {
            try {
              setAppFolders(JSON.parse(cached));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error('Failed to load app folders for notifications:', err);
      }
    }
    loadAppFolders();
  }, []);

  // Format full folder path hierarchy (e.g., Parent ➔ Subfolder)
  const getFolderPath = (folder: AppFolder, allFolders: AppFolder[]): string => {
    const parts: string[] = [folder.name];
    let current = folder;
    let guard = 0;
    while (current.parent_id && guard < 10) {
      guard++;
      const parent = allFolders.find(f => f.id === current.parent_id);
      if (parent && parent.id !== current.id) {
        parts.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }
    return parts.join(' ➔ ');
  };

  // Handle clicking a thumbnail notification, banner card, or action URL link
  const handleNotificationClick = async (notif: AppNotification) => {
    // 1. Increment clicks count in local state & Supabase
    const updated = notifications.map(n => 
      n.id === notif.id ? { ...n, clicks_count: (n.clicks_count || 0) + 1 } : n
    );
    setNotifications(updated);

    try {
      await supabase
        .from('app_notifications')
        .update({ clicks_count: (notif.clicks_count || 0) + 1 })
        .eq('id', notif.id);
    } catch (err) {
      console.warn('Could not increment clicks count in DB:', err);
    }

    const url = notif.action_url || '';

    // 2. Extract folder ID from URL formats (app://folder/ID, folder://ID, or plain ID)
    let folderId = '';
    if (url.startsWith('app://folder/')) {
      folderId = url.replace('app://folder/', '');
    } else if (url.startsWith('folder://')) {
      folderId = url.replace('folder://', '');
    } else if (appFolders.some(f => f.id === url)) {
      folderId = url;
    }

    if (folderId) {
      folderId = folderId.split('/')[0].split('?')[0].trim();
    }

    const targetFolder = appFolders.find(f => f.id === folderId);

    if (targetFolder) {
      const fullPath = getFolderPath(targetFolder, appFolders);
      toast.success(`Directing to folder: "${fullPath}"`);
      setSearchParams({ tab: 'folders', folderId: targetFolder.id });
      return;
    }

    // 3. Handle fallback external links or app views
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank');
    } else if (url === 'app://courses' || url === 'app://folders') {
      toast.info('Directing to App Folders view...');
      setSearchParams({ tab: 'folders' });
    } else if (url === 'app://students' || url === 'app://student-access') {
      toast.info('Directing to Student Access...');
      setSearchParams({ tab: 'student-access' });
    } else if (url) {
      toast.info(`Clicked link: ${url}`);
    } else {
      toast.info(`Notification title: "${notif.title}"`);
    }
  };

  const filteredAppFolders = appFolders.filter(f => 
    f.name.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(folderSearchTerm.toLowerCase()))
  );

  const selectedFolderObj = appFolders.find(f => f.id === selectedFolderId);

  const handleImageFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setFormImageUrl(e.target.result as string);
        toast.success('Image loaded successfully!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFileUpload(e.target.files[0]);
    }
  };

  const handleDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFileUpload(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('app_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  const resetForm = () => {
    setFormTitle('');
    setFormMessage('');
    setFormDisplayType('banner');
    setFormImageUrl('');
    setFormScheduledAt('');
    setFormExpiresAt('');
    if (appFolders.length > 0) {
      setSelectedFolderId(appFolders[0].id);
      setFormActionUrl(`app://folder/${appFolders[0].id}`);
    } else {
      setSelectedFolderId('');
      setFormActionUrl('');
    }
    setFormTargetBatch('ALL');
    setFormIsActive(true);
    setEditingId(null);
    setFolderSearchTerm('');
  };

  const handleOpenNewModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleEdit = (item: AppNotification) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormMessage(item.message);
    setFormDisplayType(item.display_type);
    setFormImageUrl(item.image_url || '');
    setFormTargetBatch(item.target_batch || 'ALL');
    setFormIsActive(item.is_active);
    setFormScheduledAt(formatForDateTimeInput(item.scheduled_at));
    setFormExpiresAt(formatForDateTimeInput(item.expires_at));

    const url = item.action_url || '';
    
    let fId = '';
    if (url.startsWith('app://folder/')) {
      fId = url.replace('app://folder/', '');
    } else if (url.startsWith('folder://')) {
      fId = url.replace('folder://', '');
    } else {
      const matched = appFolders.find(f => f.id === url);
      if (matched) fId = matched.id;
    }

    if (fId && appFolders.some(f => f.id === fId)) {
      setSelectedFolderId(fId);
      setFormActionUrl(`app://folder/${fId}`);
    } else if (appFolders.length > 0) {
      setSelectedFolderId(appFolders[0].id);
      setFormActionUrl(`app://folder/${appFolders[0].id}`);
    } else {
      setSelectedFolderId('');
      setFormActionUrl(url);
    }

    setShowFormModal(true);
  };

  const handleSaveNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formMessage.trim()) {
      toast.error('Please fill in notification title and message');
      return;
    }

    const scheduledAtISO = formScheduledAt ? new Date(formScheduledAt).toISOString() : null;
    const expiresAtISO = formExpiresAt ? new Date(formExpiresAt).toISOString() : null;

    const notifData: Partial<AppNotification> = {
      title: formTitle,
      message: formMessage,
      display_type: formDisplayType,
      image_url: formDisplayType === 'banner' ? formImageUrl : null,
      action_url: formActionUrl || 'app://home',
      target_batch: formTargetBatch || 'ALL',
      is_active: formIsActive,
      scheduled_at: scheduledAtISO,
      expires_at: expiresAtISO,
    };

    if (editingId) {
      setNotifications(prev => prev.map(item => {
        if (item.id === editingId) {
          return { ...item, ...notifData } as AppNotification;
        }
        return item;
      }));

      // Sync to Supabase if available
      if (supabase) {
        try {
          const { error } = await supabase
            .from('app_notifications')
            .update(notifData)
            .eq('id', editingId);
          if (error) console.warn('Supabase update warning:', error.message);
        } catch (err) {
          console.error(err);
        }
      }

      toast.success('Notification updated successfully!');
    } else {
      const newNotif: AppNotification = {
        id: 'notif-' + Date.now(),
        ...notifData,
        clicks_count: 0,
        views_count: 1,
        created_at: new Date().toISOString()
      } as AppNotification;

      setNotifications(prev => [newNotif, ...prev]);

      // Insert to Supabase if available
      if (supabase) {
        try {
          const { error } = await supabase
            .from('app_notifications')
            .insert([{
              title: newNotif.title,
              message: newNotif.message,
              display_type: newNotif.display_type,
              image_url: newNotif.image_url,
              action_url: newNotif.action_url,
              target_batch: newNotif.target_batch,
              is_active: newNotif.is_active,
              scheduled_at: newNotif.scheduled_at,
              expires_at: newNotif.expires_at,
              clicks_count: 0,
              views_count: 1
            }]);
          if (error) console.warn('Supabase insert warning:', error.message);
        } catch (err) {
          console.error(err);
        }
      }

      toast.success('New notification broadcasted successfully!');
    }

    setShowFormModal(false);
    resetForm();
  };

  const handleToggleActive = async (id: string) => {
    let nextState = false;
    setNotifications(prev => prev.map(item => {
      if (item.id === id) {
        nextState = !item.is_active;
        toast.info(nextState ? 'Notification activated' : 'Notification deactivated');
        return { ...item, is_active: nextState };
      }
      return item;
    }));

    if (supabase) {
      try {
        await supabase
          .from('app_notifications')
          .update({ is_active: nextState })
          .eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this notification broadcast?')) {
      setNotifications(prev => prev.filter(item => item.id !== id));
      if (supabase) {
        try {
          await supabase
            .from('app_notifications')
            .delete()
            .eq('id', id);
        } catch (err) {
          console.error(err);
        }
      }
      toast.success('Notification removed');
    }
  };

  const filteredNotifications = notifications.filter(item => {
    const matchesFilter = activeFilter === 'all' || item.display_type === activeFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCount = notifications.filter(n => n.is_active).length;
  const totalClicks = notifications.reduce((acc, n) => acc + (n.clicks_count || 0), 0);
  const totalViews = notifications.reduce((acc, n) => acc + (n.views_count || 0), 0);

  // Generate live REST endpoint JSON representation
  const activeNotificationsPayload = {
    status: 'success',
    count: notifications.filter(n => n.is_active).length,
    data: notifications.filter(n => n.is_active).map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      display_type: n.display_type, // "banner" (In-App Image Banner) or "push_bar" (Top Notification Bar)
      image_url: n.image_url,
      action_url: n.action_url,
      button_label: n.button_label,
      audience: n.audience,
      created_at: n.created_at
    }))
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Analytics */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Bell size={18} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                App Notifications
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Create and manage mobile in-app banners and push notifications.
            </p>
          </div>

          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Create Notification Broadcast</span>
          </button>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-gray-500 dark:text-gray-400 font-medium">Active Broadcasts</div>
            <div className="text-base font-bold text-teal-600 dark:text-teal-400 mt-0.5">{activeCount} / {notifications.length}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-gray-500 dark:text-gray-400 font-medium">Total Student Views</div>
            <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{totalViews.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-gray-500 dark:text-gray-400 font-medium">Total Link Clicks</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{totalClicks.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-gray-500 dark:text-gray-400 font-medium">Click-Through Rate (CTR)</div>
            <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Controls & List */}
      <div className="space-y-4">
        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeFilter === 'all'
                  ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('banner')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeFilter === 'banner'
                  ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
            >
              <ImageIcon size={14} />
              <span>Thumbnail Banners</span>
            </button>
            <button
              onClick={() => setActiveFilter('push_bar')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeFilter === 'push_bar'
                  ? "bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              )}
            >
              <Bell size={14} />
              <span>Push Bar Alerts</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notification title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Notifications Card List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center space-y-3">
              <Bell size={32} className="mx-auto text-gray-400" />
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">No Notifications Found</div>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Click the "Create Notification Broadcast" button above to send a new course announcement or feature alert.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "bg-white dark:bg-gray-900 border rounded-2xl p-4 transition-all shadow-xs relative overflow-hidden group",
                  notif.is_active 
                    ? "border-gray-200 dark:border-gray-800 hover:border-teal-400 dark:hover:border-teal-600"
                    : "border-gray-100 dark:border-gray-800 opacity-60 bg-gray-50/50"
                )}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icon / Thumbnail Box (Clickable to navigate to target folder) */}
                    {notif.display_type === 'banner' && notif.image_url ? (
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className="w-16 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 border border-gray-200 dark:border-gray-700 relative group/thumb cursor-pointer hover:border-teal-500 hover:ring-2 hover:ring-teal-500/20 transition-all text-left"
                        title="Click thumbnail to direct to target app folder"
                      >
                        <img src={notif.image_url} alt={notif.title} className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105" />
                        <div className="absolute bottom-0 right-0 bg-teal-600 text-white p-0.5 rounded-tl-md">
                          <ImageIcon size={10} />
                        </div>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400 cursor-pointer hover:border-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
                        title="Click alert icon to test folder link"
                      >
                        <Bell size={20} />
                      </button>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type Badge */}
                        {notif.display_type === 'banner' ? (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-extrabold flex items-center gap-1">
                            <ImageIcon size={10} />
                            <span>Clickable Image Banner</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold flex items-center gap-1">
                            <Bell size={10} />
                            <span>Notification Bar Alert</span>
                          </span>
                        )}

                        {/* Target Audience / Batch Badge */}
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-semibold flex items-center gap-1">
                          <Target size={10} />
                          <span>
                            {!notif.target_batch || notif.target_batch === 'ALL'
                              ? 'All Batches'
                              : (notif.target_batch.toLowerCase().startsWith('batch') ? notif.target_batch : `Batch ${notif.target_batch}`)}
                          </span>
                        </span>

                        {/* Active Status Badge */}
                        {notif.is_active ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold">
                            Active Live
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            Disabled
                          </span>
                        )}

                        {/* Scheduled At Badge */}
                        {notif.scheduled_at && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60 text-[10px] font-bold flex items-center gap-1">
                            <Calendar size={10} />
                            <span>Sched: {new Date(notif.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        )}

                        {/* Expires At Badge */}
                        {notif.expires_at && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 text-[10px] font-bold flex items-center gap-1">
                            <Clock size={10} />
                            <span>Exp: {new Date(notif.expires_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        )}
                      </div>

                      <h3 
                        onClick={() => handleNotificationClick(notif)}
                        className="text-sm font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors flex items-center gap-1.5"
                        title="Click notification title to open target folder"
                      >
                        <span>{notif.title}</span>
                      </h3>

                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-4 pt-1 text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                        <span className="flex items-center gap-1">
                          <MousePointerClick size={12} className="text-teal-500" />
                          <strong className="text-gray-700 dark:text-gray-300">{notif.clicks_count || 0}</strong> clicks
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye size={12} className="text-indigo-500" />
                          <strong className="text-gray-700 dark:text-gray-300">{notif.views_count || 0}</strong> views
                        </span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notif)}
                          className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-bold truncate max-w-[220px] cursor-pointer"
                          title="Click to test direction to target folder"
                        >
                          <FolderOpen size={12} className="shrink-0" />
                          <span className="truncate">{notif.action_url || 'No action URL'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Control Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleNotificationClick(notif)}
                      className="p-2 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-gray-500 hover:text-teal-600 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                      title="Test Directing to Folder"
                    >
                      <FolderOpen size={15} />
                    </button>

                    <button
                      onClick={() => handleEdit(notif)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-teal-600 rounded-xl transition-all cursor-pointer"
                      title="Edit Notification"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      onClick={() => handleToggleActive(notif.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border",
                        notif.is_active
                          ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                          : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {notif.is_active ? 'Active' : 'Enable'}
                    </button>

                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/50 text-gray-400 hover:text-red-600 rounded-xl transition-all cursor-pointer"
                      title="Delete Broadcast"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL FORM */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-xl my-auto max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 shrink-0">
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {editingId ? 'Edit Broadcast' : 'New Broadcast'}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Set title, message, live folder link and schedule
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNotification} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Notification Format Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Format *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormDisplayType('banner')}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer",
                      formDisplayType === 'banner'
                        ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon size={15} className="text-teal-600" />
                      <span>Thumbnail Banner</span>
                    </div>
                    {formDisplayType === 'banner' && <Check size={14} className="text-teal-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormDisplayType('push_bar')}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer",
                      formDisplayType === 'push_bar'
                        ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-indigo-600" />
                      <span>Push Bar Alert</span>
                    </div>
                    {formDisplayType === 'push_bar' && <Check size={14} className="text-indigo-600" />}
                  </button>
                </div>
              </div>

              {/* Title & Message */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Headline or notice title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Message *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Short notification details..."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white leading-relaxed"
                  />
                </div>
              </div>

              {/* Thumbnail Image (for Banner type) */}
              {formDisplayType === 'banner' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Thumbnail Image *
                    </label>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-[10px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setImageInputMode('upload')}
                        className={cn(
                          "px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer",
                          imageInputMode === 'upload'
                            ? "bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-300 shadow-xs"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        )}
                      >
                        <Upload size={11} />
                        <span>Upload File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('url')}
                        className={cn(
                          "px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer",
                          imageInputMode === 'url'
                            ? "bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-300 shadow-xs"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        )}
                      >
                        <Link size={11} />
                        <span>Image URL / Presets</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {imageInputMode === 'upload' ? (
                    <div>
                      {formImageUrl ? (
                        <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                          <img
                            src={formImageUrl}
                            alt="Thumbnail preview"
                            className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                              {formImageUrl.startsWith('data:') ? 'Uploaded Local Image' : 'Selected Image'}
                            </p>
                            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">Ready for broadcast</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 text-[10px] font-bold text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer transition-all"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormImageUrl('')}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg cursor-pointer transition-all"
                              title="Remove image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDropImage}
                          className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-4 text-center cursor-pointer transition-all group"
                        >
                          <div className="w-8 h-8 mx-auto mb-1.5 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform">
                            <Upload size={16} />
                          </div>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            Click or drag & drop an image to upload
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            PNG, JPG, WebP, or GIF (Max 5MB)
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
                      />
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                        <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">Presets:</span>
                        {PRESET_SAMPLE_IMAGES.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setFormImageUrl(img.url)}
                            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-[10px] font-medium text-gray-700 dark:text-gray-300 rounded-md whitespace-nowrap cursor-pointer"
                          >
                            {img.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Click Action Destination & Target Audience */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-2 bg-gray-50/50 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Folder size={14} className="text-teal-600 dark:text-teal-400" />
                        <span>Click Action Target (App Folder)</span>
                      </label>
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-900/50 px-2 py-0.5 rounded-full">
                        {appFolders.length} Folders Available
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {appFolders.length > 4 && (
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search folders by name..."
                            value={folderSearchTerm}
                            onChange={(e) => setFolderSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800 dark:text-gray-200"
                          />
                        </div>
                      )}

                      <select
                        value={selectedFolderId}
                        onChange={(e) => {
                          const fId = e.target.value;
                          setSelectedFolderId(fId);
                          setFormActionUrl(fId ? `app://folder/${fId}` : '');
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
                      >
                        {filteredAppFolders.length === 0 ? (
                          <option value="">No matching folders found</option>
                        ) : (
                          filteredAppFolders.map((f) => (
                            <option key={f.id} value={f.id}>
                              📁 {getFolderPath(f, appFolders)} {f.payment_type ? `[${f.payment_type}]` : ''}
                            </option>
                          ))
                        )}
                      </select>

                      <div className="flex items-center justify-between text-[11px] px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 rounded-xl">
                        <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-200 font-medium truncate">
                          <FolderOpen size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                          <span className="truncate">
                            Target Folder: <strong className="font-bold">{selectedFolderObj?.name || 'Selected Folder'}</strong>
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-teal-700 dark:text-teal-300 font-bold shrink-0 bg-white dark:bg-teal-900/60 px-2 py-0.5 rounded-md border border-teal-200/80 dark:border-teal-700/60">
                          {formActionUrl || 'No folder selected'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Target Audience Batch */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Target Audience (Joined Batch)
                    </label>
                    <select
                      value={formTargetBatch}
                      onChange={(e) => setFormTargetBatch(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
                    >
                      <option value="ALL">All Batches / All Students</option>
                      {joinedBatches.map((jb) => (
                        <option key={jb} value={jb}>
                          {jb.toLowerCase().startsWith('batch') ? jb : `Batch ${jb}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule Date & Time and Expire Date & Time */}
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Calendar size={13} className="text-teal-600 dark:text-teal-400" />
                          <span>Schedule Date & Time</span>
                        </label>
                        {formScheduledAt && (
                          <button
                            type="button"
                            onClick={() => setFormScheduledAt('')}
                            className="text-[10px] font-bold text-teal-600 hover:text-red-500 underline cursor-pointer"
                          >
                            Publish Now
                          </button>
                        )}
                      </div>
                      <input
                        type="datetime-local"
                        value={formScheduledAt}
                        onChange={(e) => setFormScheduledAt(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
                      />
                      <p className="text-[10px] text-gray-400">
                        {formScheduledAt ? `Scheduled for: ${new Date(formScheduledAt).toLocaleString()}` : 'Leave empty to publish immediately.'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                          <span>Expire Date & Time</span>
                        </label>
                        {formExpiresAt && (
                          <button
                            type="button"
                            onClick={() => setFormExpiresAt('')}
                            className="text-[10px] font-bold text-amber-600 hover:text-red-500 underline cursor-pointer"
                          >
                            No Expiry
                          </button>
                        )}
                      </div>
                      <input
                        type="datetime-local"
                        value={formExpiresAt}
                        onChange={(e) => setFormExpiresAt(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
                      />
                      <p className="text-[10px] text-gray-400">
                        {formExpiresAt ? `Expires on: ${new Date(formExpiresAt).toLocaleString()}` : 'Leave empty for no expiration date.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              </div>

              {/* Sticky Modal Buttons Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Send size={13} />
                  <span>{editingId ? 'Save Changes' : 'Broadcast Now'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
