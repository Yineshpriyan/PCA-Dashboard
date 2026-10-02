// File location: /src/pages/RegisterIndividualStudent.tsx
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Video, 
  User, 
  Mail, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  Search,
  CheckSquare,
  Square,
  ExternalLink,
  Layers,
  RotateCcw,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cleanStudentNameForZoom } from "../lib/utils";
import { supabase } from "../lib/supabase";

interface SelectedWebinar {
  webinar_id: string;
  webinar_name: string;
}

interface SavedWebinar {
  id: number | string;
  webinar_name: string;
  webinar_id: string;
}

interface RegistrationItemResult {
  webinarId: string;
  webinarName: string;
  email: string;
  status: "Success" | "Failed";
  joinUrl?: string;
  error?: string;
}

export default function RegisterIndividualStudent() {
  // Saved webinars from DB
  const [savedWebinars, setSavedWebinars] = useState<SavedWebinar[]>([]);
  const [loadingWebinars, setLoadingWebinars] = useState<boolean>(true);
  const [webinarSearchQuery, setWebinarSearchQuery] = useState<string>("");
  
  // Selected webinars (can be multiple)
  const [selectedWebinars, setSelectedWebinars] = useState<SelectedWebinar[]>(() => {
    try {
      const stored = localStorage.getItem("zoom_individual_selected_webinars");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Custom webinar ID input
  const [customWebinarId, setCustomWebinarId] = useState<string>("");

  // Student details
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  
  // Student quick search from student database
  const [dbStudentSearch, setDbStudentSearch] = useState<string>("");
  const [dbStudentResults, setDbStudentResults] = useState<any[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState<boolean>(false);
  const [showDbSearchDropdown, setShowDbSearchDropdown] = useState<boolean>(false);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentProgressText, setCurrentProgressText] = useState<string>("");
  const [results, setResults] = useState<RegistrationItemResult[]>([]);
  const [copiedLinks, setCopiedLinks] = useState<{ [key: string]: boolean }>({});
  const [allCopied, setAllCopied] = useState<boolean>(false);

  // Fetch saved webinars from Supabase
  useEffect(() => {
    fetchSavedWebinars();
  }, []);

  // Save selected webinars to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("zoom_individual_selected_webinars", JSON.stringify(selectedWebinars));
    } catch (e) {
      console.warn("Failed to store selected webinars", e);
    }
  }, [selectedWebinars]);

  const fetchSavedWebinars = async () => {
    try {
      setLoadingWebinars(true);
      if (!supabase) return;
      const { data, error } = await supabase
        .from("webinar_id")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not fetch webinar_id table:", error.message);
      } else if (data) {
        setSavedWebinars(data);
      }
    } catch (err) {
      console.warn("Error fetching webinars:", err);
    } finally {
      setLoadingWebinars(false);
    }
  };

  // Quick search students from Supabase database
  const handleSearchStudents = async (query: string) => {
    setDbStudentSearch(query);
    const cleanQ = query.trim();
    if (!cleanQ || cleanQ.length < 2 || !supabase) {
      setDbStudentResults([]);
      setShowDbSearchDropdown(false);
      return;
    }

    try {
      setIsSearchingDb(true);
      const { data } = await supabase
        .from("students")
        .select("id, pcaid, name, mail")
        .or(`pcaid.ilike.%${cleanQ}%,name.ilike.%${cleanQ}%,mail.ilike.%${cleanQ}%`)
        .limit(5);

      if (data && data.length > 0) {
        setDbStudentResults(data);
        setShowDbSearchDropdown(true);
      } else {
        setDbStudentResults([]);
      }
    } catch (err) {
      console.warn("Student search error", err);
    } finally {
      setIsSearchingDb(false);
    }
  };

  const handleSelectDbStudent = (student: any) => {
    const cleanName = cleanStudentNameForZoom(student.name || "");
    setFirstName(student.pcaid || student.name?.split(" ")[0] || "");
    setLastName(cleanName || student.name || "");
    setEmail(student.mail || "");
    setShowDbSearchDropdown(false);
    setDbStudentSearch(`${student.pcaid || ''} - ${student.name || ''}`);
    toast.success(`Loaded details for ${student.name || student.pcaid}`);
  };

  // Toggle webinar selection
  const toggleWebinarSelection = (webinar: { webinar_id: string; webinar_name: string }) => {
    const cleanId = String(webinar.webinar_id).trim();
    const exists = selectedWebinars.some((w) => w.webinar_id === cleanId);

    if (exists) {
      setSelectedWebinars((prev) => prev.filter((w) => w.webinar_id !== cleanId));
    } else {
      setSelectedWebinars((prev) => [
        ...prev,
        { webinar_id: cleanId, webinar_name: webinar.webinar_name || `Webinar ${cleanId}` }
      ]);
    }
  };

  // Select all saved webinars
  const handleSelectAllSaved = () => {
    const newItems: SelectedWebinar[] = [...selectedWebinars];
    savedWebinars.forEach((sw) => {
      const cleanId = String(sw.webinar_id).trim();
      if (!newItems.some((w) => w.webinar_id === cleanId)) {
        newItems.push({ webinar_id: cleanId, webinar_name: sw.webinar_name });
      }
    });
    setSelectedWebinars(newItems);
    toast.success(`Selected all ${savedWebinars.length} saved webinars.`);
  };

  // Deselect all
  const handleClearAllSelections = () => {
    setSelectedWebinars([]);
    toast.info("Cleared all webinar selections.");
  };

  // Add custom webinar ID (supports comma-separated)
  const handleAddCustomWebinar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = customWebinarId.trim();
    if (!raw) return;

    const ids = raw.split(/[\s,]+/).map((s) => s.trim().replace(/[-\s]/g, "")).filter(Boolean);
    if (ids.length === 0) return;

    let addedCount = 0;
    const nextList = [...selectedWebinars];

    ids.forEach((id) => {
      if (!nextList.some((w) => w.webinar_id === id)) {
        // Check if ID matches a saved webinar name
        const matchSaved = savedWebinars.find((sw) => sw.webinar_id.trim() === id);
        nextList.push({
          webinar_id: id,
          webinar_name: matchSaved ? matchSaved.webinar_name : `Meeting/Webinar ${id}`
        });
        addedCount++;
      }
    });

    setSelectedWebinars(nextList);
    setCustomWebinarId("");
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} webinar ID(s) to selection.`);
    } else {
      toast.info("Webinar ID is already selected.");
    }
  };

  const handleRemoveSelectedWebinar = (webinarId: string) => {
    setSelectedWebinars((prev) => prev.filter((w) => w.webinar_id !== webinarId));
  };

  // Copy single link
  const handleCopyLink = async (webinarId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinks((prev) => ({ ...prev, [webinarId]: true }));
      toast.success("Zoom Join Link copied!");
      setTimeout(() => {
        setCopiedLinks((prev) => ({ ...prev, [webinarId]: false }));
      }, 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  // Copy all links formatted
  const handleCopyAllLinks = async () => {
    const successItems = results.filter((r) => r.status === "Success" && r.joinUrl);
    if (successItems.length === 0) {
      toast.error("No successful registration links to copy.");
      return;
    }

    const textLines = [
      `Physics Cube Academy - Zoom Registration Links for ${firstName} ${lastName}:`,
      ...successItems.map(
        (item, idx) => `${idx + 1}. ${item.webinarName} (ID: ${item.webinarId})\n   Join URL: ${item.joinUrl}`
      )
    ];

    try {
      await navigator.clipboard.writeText(textLines.join("\n\n"));
      setAllCopied(true);
      toast.success(`Copied all ${successItems.length} Zoom links to clipboard!`);
      setTimeout(() => setAllCopied(false), 2500);
    } catch {
      toast.error("Failed to copy links.");
    }
  };

  // Submit registration across all selected webinars
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedWebinars.length === 0) {
      toast.error("Please select or add at least one Zoom Webinar or Meeting ID.");
      return;
    }

    const cleanEmail = email.trim();
    const cleanFirstName = firstName.trim();
    const rawLastName = lastName.trim();
    const cleanLastName = cleanStudentNameForZoom(rawLastName);

    if (!cleanFirstName || !cleanLastName) {
      toast.error("Please enter first and last names.");
      return;
    }
    if (!cleanEmail) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (cleanLastName !== lastName) {
      setLastName(cleanLastName);
    }

    setIsRunning(true);
    setResults([]);
    setCurrentProgressText(`Preparing registration across ${selectedWebinars.length} webinar(s)...`);

    const accumulatedResults: RegistrationItemResult[] = [];

    // Register sequentially across each webinar for high-fidelity progress tracking
    for (let i = 0; i < selectedWebinars.length; i++) {
      const targetWebinar = selectedWebinars[i];
      setCurrentProgressText(
        `Registering in ${i + 1} of ${selectedWebinars.length}: ${targetWebinar.webinar_name}...`
      );

      try {
        const response = await fetch("/api/register-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webinarId: targetWebinar.webinar_id,
            students: [
              {
                firstName: cleanFirstName,
                lastName: cleanLastName,
                email: cleanEmail
              }
            ]
          })
        });

        let data: any;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          if (text.includes("<!DOCTYPE html") || response.status === 404) {
            throw new Error(
              "API endpoint not active in local dev server or Vercel config missing. Check your Zoom environment keys."
            );
          }
          throw new Error(`Invalid server response: ${response.statusText || response.status}`);
        }

        if (response.ok && data.results && data.results.length > 0) {
          const resObj = data.results[0];
          accumulatedResults.push({
            webinarId: targetWebinar.webinar_id,
            webinarName: targetWebinar.webinar_name,
            email: cleanEmail,
            status: resObj.status,
            joinUrl: resObj.joinUrl,
            error: resObj.error
          });
        } else {
          accumulatedResults.push({
            webinarId: targetWebinar.webinar_id,
            webinarName: targetWebinar.webinar_name,
            email: cleanEmail,
            status: "Failed",
            error: data.error || "Zoom registration rejected request"
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown registration error";
        accumulatedResults.push({
          webinarId: targetWebinar.webinar_id,
          webinarName: targetWebinar.webinar_name,
          email: cleanEmail,
          status: "Failed",
          error: message
        });
      }

      setResults([...accumulatedResults]);
    }

    setIsRunning(false);
    setCurrentProgressText("");

    const successCount = accumulatedResults.filter((r) => r.status === "Success").length;
    const failCount = accumulatedResults.filter((r) => r.status === "Failed").length;

    if (failCount === 0 && successCount > 0) {
      toast.success(`Student successfully registered in all ${successCount} webinar(s)!`);
    } else if (successCount > 0) {
      toast.warning(`Registered in ${successCount} webinar(s), but ${failCount} failed.`);
    } else {
      const firstErrorMessage = accumulatedResults.find((r) => r.error)?.error;
      toast.error(firstErrorMessage || "Registration failed across the selected webinars.");
    }
  };

  const handleResetForNextStudent = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setDbStudentSearch("");
    setResults([]);
    toast.info("Cleared student fields. Webinars remain selected for the next student.");
  };

  // Filter saved webinars by search query
  const filteredSavedWebinars = savedWebinars.filter((w) => {
    const q = webinarSearchQuery.toLowerCase();
    return (
      w.webinar_name.toLowerCase().includes(q) ||
      w.webinar_id.toLowerCase().includes(q)
    );
  });

  const successCount = results.filter((r) => r.status === "Success").length;
  const failCount = results.filter((r) => r.status === "Failed").length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Video className="text-teal-600 dark:text-teal-400" size={24} />
          Individual Student Zoom Registration
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Register a single student into <strong className="text-teal-700 dark:text-teal-300">multiple Zoom webinars or meetings at the same time</strong> with 1-click batching.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm space-y-6"
          >
            {/* Step 1: Multiple Webinars Selection */}
            <div className="space-y-4 pb-6 border-b border-gray-150 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Layers size={17} className="text-teal-600 dark:text-teal-400" />
                    <span>Select Zoom Webinars / Meetings</span>
                    <span className="text-red-500">*</span>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      Multi-Select Supported
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Check all webinars or meetings this student should be registered for.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {savedWebinars.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleSelectAllSaved}
                        disabled={isRunning}
                        className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 hover:underline cursor-pointer"
                      >
                        Select All Saved
                      </button>
                      <span className="text-gray-300 dark:text-gray-700">|</span>
                    </>
                  )}
                  {selectedWebinars.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSelections}
                      disabled={isRunning}
                      className="text-[11px] font-bold text-red-500 hover:text-red-600 hover:underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Saved Webinars Checkbox List */}
              <div className="bg-gray-50/80 dark:bg-gray-850/60 rounded-xl p-3 border border-gray-200 dark:border-gray-750 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search saved academy webinars..."
                      value={webinarSearchQuery}
                      onChange={(e) => setWebinarSearchQuery(e.target.value)}
                      disabled={isRunning}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 shrink-0">
                    {selectedWebinars.length} selected
                  </span>
                </div>

                {loadingWebinars ? (
                  <div className="py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 size={15} className="animate-spin text-teal-600" />
                    <span>Loading saved webinars...</span>
                  </div>
                ) : filteredSavedWebinars.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredSavedWebinars.map((w) => {
                      const isChecked = selectedWebinars.some((sw) => sw.webinar_id === w.webinar_id.trim());
                      return (
                        <div
                          key={w.id}
                          onClick={() => !isRunning && toggleWebinarSelection(w)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                            isChecked
                              ? "bg-teal-50/90 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-950 dark:text-teal-200 shadow-2xs"
                              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                          } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <div className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400">
                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate leading-tight">
                              {w.webinar_name}
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                              ID: {w.webinar_id}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-3 text-center text-xs text-gray-400">
                    {savedWebinars.length === 0
                      ? "No saved webinars found in database. Enter a custom Webinar/Meeting ID below."
                      : "No webinars matched your search filter."}
                  </div>
                )}
              </div>

              {/* Add Custom Webinar ID input */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Or enter custom Webinar/Meeting ID (e.g. 84930219481)"
                  value={customWebinarId}
                  onChange={(e) => setCustomWebinarId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomWebinar();
                    }
                  }}
                  disabled={isRunning}
                  className="flex-1 px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomWebinar()}
                  disabled={isRunning || !customWebinarId.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Add ID</span>
                </button>
              </div>

              {/* Selected Webinars Chips */}
              {selectedWebinars.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                    <span>Selected for Registration ({selectedWebinars.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedWebinars.map((item) => (
                      <span
                        key={item.webinar_id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-100/90 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 rounded-lg text-xs font-medium border border-teal-300 dark:border-teal-700 shadow-2xs"
                      >
                        <Video size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        <span className="font-bold truncate max-w-[200px]" title={item.webinar_name}>
                          {item.webinar_name}
                        </span>
                        <span className="text-[10px] font-mono text-teal-700 dark:text-teal-300">
                          ({item.webinar_id})
                        </span>
                        {!isRunning && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedWebinar(item.webinar_id)}
                            className="hover:bg-teal-200 dark:hover:bg-teal-800 p-0.5 rounded-full text-teal-700 dark:text-teal-300 cursor-pointer ml-0.5"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Student Details Form */}
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="flex items-center justify-between pb-1">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <User size={16} className="text-teal-600" />
                  <span>Student Details</span>
                </div>

                {/* Quick search student registry */}
                <div className="relative">
                  <div className="flex items-center gap-1.5">
                    <Search size={13} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Autofill from PCA ID / Name..."
                      value={dbStudentSearch}
                      onChange={(e) => handleSearchStudents(e.target.value)}
                      onFocus={() => dbStudentResults.length > 0 && setShowDbSearchDropdown(true)}
                      className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 w-44 sm:w-56 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                    />
                    {isSearchingDb && <Loader2 size={13} className="animate-spin text-teal-600" />}
                  </div>

                  {showDbSearchDropdown && dbStudentResults.length > 0 && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto">
                      <div className="px-3 py-1 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                        Matching Students in Registry
                      </div>
                      {dbStudentResults.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectDbStudent(s)}
                          className="px-3 py-2 text-left hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-none transition-colors"
                        >
                          <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            {s.pcaid} - {s.name}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {s.mail || "No email"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Name Fields (Grid layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                    <span>First Name (on Zoom) <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-gray-400 font-medium">e.g. PCA ID or First Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="PCA1001 or John"
                    disabled={isRunning}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-850 dark:text-gray-200 font-medium text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                    <span>Last Name (on Zoom) <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">Auto initials removed</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={() => {
                      const cleaned = cleanStudentNameForZoom(lastName);
                      if (cleaned && cleaned !== lastName) {
                        setLastName(cleaned);
                      }
                    }}
                    placeholder="e.g. Chamara / Sutha Perera"
                    disabled={isRunning}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-855 dark:text-gray-200 font-medium text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} className="text-teal-600" />
                  <span>Email Address <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student.email@example.com"
                  disabled={isRunning}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-850 dark:text-gray-200 font-medium text-sm transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-gray-500 font-medium">
                  {selectedWebinars.length === 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      ⚠ Please select at least 1 webinar above.
                    </span>
                  ) : (
                    <span>
                      Will register student for <strong className="text-teal-600 dark:text-teal-400 font-black">{selectedWebinars.length}</strong> webinar(s).
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {results.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetForNextStudent}
                      disabled={isRunning}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Next Student</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isRunning || selectedWebinars.length === 0 || !firstName || !lastName || !email}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Registering Across Webinars...</span>
                      </>
                    ) : (
                      <>
                        <span>Register Now ({selectedWebinars.length} Webinars)</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Running Status Banner */}
              {isRunning && (
                <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center gap-3 animate-pulse">
                  <Loader2 size={18} className="animate-spin text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                    {currentProgressText || "Registering student with Zoom..."}
                  </span>
                </div>
              )}
            </form>
          </motion.div>

          {/* Registration Results Cards */}
          <AnimatePresence mode="wait">
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm overflow-hidden space-y-4"
              >
                {/* Overall Summary Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-150 dark:border-gray-800">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {failCount === 0 ? (
                        <>
                          <CheckCircle2 size={20} className="text-green-500" />
                          <span>All {successCount} Webinars Registered Successfully!</span>
                          <Sparkles size={16} className="text-amber-500" />
                        </>
                      ) : successCount > 0 ? (
                        <>
                          <AlertCircle size={20} className="text-amber-500" />
                          <span>Registration Partially Completed: {successCount} Succeeded, {failCount} Failed</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={20} className="text-red-500" />
                          <span>Registration Failed for All Selected Webinars</span>
                        </>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Student: <strong className="text-gray-800 dark:text-gray-200">{firstName} {lastName}</strong> ({email})
                    </p>
                  </div>

                  {successCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyAllLinks}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                    >
                      {allCopied ? <Check size={14} /> : <Share2 size={14} />}
                      <span>{allCopied ? "Copied All Links!" : "Copy All Join Links"}</span>
                    </button>
                  )}
                </div>

                {/* Per-Webinar Result Cards */}
                <div className="space-y-3">
                  {results.map((res) => {
                    const isSuccess = res.status === "Success";
                    const isCopied = copiedLinks[res.webinarId];

                    return (
                      <div
                        key={res.webinarId}
                        className={`p-4 rounded-xl border transition-all ${
                          isSuccess
                            ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/80 dark:border-green-800/60"
                            : "bg-red-50/50 dark:bg-red-950/20 border-red-200/80 dark:border-red-800/60"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isSuccess ? (
                              <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                            ) : (
                              <XCircle size={16} className="text-red-500 dark:text-red-400 shrink-0" />
                            )}
                            <div>
                              <span className="text-xs font-bold text-gray-900 dark:text-white">
                                {res.webinarName}
                              </span>
                              <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 ml-2">
                                (ID: {res.webinarId})
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
                              isSuccess
                                ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>

                        {/* Join URL or Error message */}
                        {isSuccess && res.joinUrl ? (
                          <div className="mt-3 flex items-center justify-between gap-2 bg-white dark:bg-gray-850 p-2.5 rounded-lg border border-green-200/60 dark:border-gray-750">
                            <span className="text-xs font-mono text-teal-700 dark:text-teal-400 truncate flex-1 select-all">
                              {res.joinUrl}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(res.webinarId, res.joinUrl!)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                {isCopied ? <Check size={13} /> : <Copy size={13} />}
                                <span>{isCopied ? "Copied" : "Copy Link"}</span>
                              </button>
                              <a
                                href={res.joinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                title="Open Link"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                            <strong>Reason:</strong> {res.error || "Zoom registration failed for this webinar."}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Info Column */}
        <div className="space-y-6">
          <div className="bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
              <Sparkles size={16} className="text-teal-600" />
              Multi-Webinar Registration Guide
            </h3>
            <p className="text-xs text-teal-800/80 dark:text-teal-300/80 leading-relaxed">
              You can now register a single student into <strong>multiple Zoom webinars or meetings at the same time</strong>.
            </p>

            <ul className="space-y-3 text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="font-bold text-teal-600 dark:text-teal-400">1.</span>
                <span>
                  <strong>Select Webinars:</strong> Check one or more saved academy webinars (e.g. Theory Class + Paper Class) or type custom IDs.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-teal-600 dark:text-teal-400">2.</span>
                <span>
                  <strong>Student Details:</strong> Enter the student's First Name, Last Name, and Email (or search their PCA ID to auto-fill).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-teal-600 dark:text-teal-400">3.</span>
                <span>
                  <strong>1-Click Multi-Registration:</strong> Click "Register Now". The system creates personalized join links for each webinar simultaneously.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-teal-600 dark:text-teal-400">4.</span>
                <span>
                  <strong>Copy All Links:</strong> Click "Copy All Join Links" to copy a cleanly formatted message with all webinar links ready to WhatsApp to the student.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Layers size={14} className="text-teal-600" />
              <span>Need to register multiple students?</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Switch to the <strong>Bulk Register</strong> tab to upload a CSV file or enter rows in the interactive grid to register many students across multiple webinars at once!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
