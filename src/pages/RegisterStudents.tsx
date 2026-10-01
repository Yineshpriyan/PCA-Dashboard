// File location: /src/pages/RegisterStudents.tsx
import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { 
  Video, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Download, 
  Trash2, 
  FileSpreadsheet, 
  Play, 
  Check, 
  Search,
  Plus,
  RotateCcw,
  Copy,
  Layers,
  CheckSquare,
  Square,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ZoomNavTabs } from "../components/NavTabs";
import { cleanStudentNameForZoom } from "../lib/utils";
import { supabase } from "../lib/supabase";

const BATCH_SIZE = 10; // how many students to send to Zoom per batch

interface Student {
  firstName: string;
  lastName: string;
  email: string;
}

interface SelectedWebinar {
  webinar_id: string;
  webinar_name: string;
}

interface SavedWebinar {
  id: number | string;
  webinar_name: string;
  webinar_id: string;
}

interface RegistrationResult {
  firstName?: string;
  lastName?: string;
  email: string;
  webinarId: string;
  webinarName: string;
  status: "Success" | "Failed";
  joinUrl?: string;
  error?: string;
}

interface CsvRow {
  [key: string]: string;
}

export default function RegisterStudents() {
  // Saved webinars from Supabase
  const [savedWebinars, setSavedWebinars] = useState<SavedWebinar[]>([]);
  const [loadingWebinars, setLoadingWebinars] = useState<boolean>(true);
  const [webinarSearchQuery, setWebinarSearchQuery] = useState<string>("");

  // Multiple selected webinars
  const [selectedWebinars, setSelectedWebinars] = useState<SelectedWebinar[]>(() => {
    try {
      const stored = localStorage.getItem("zoom_bulk_selected_webinars");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Custom webinar ID input
  const [customWebinarId, setCustomWebinarId] = useState<string>("");

  // CSV Students state
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<RegistrationResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ 
    done: number; 
    total: number; 
    currentWebinarName?: string;
    currentWebinarIndex?: number;
    totalWebinars?: number;
  }>({ done: 0, total: 0 });
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "success" | "failed">("all");
  const [filterWebinar, setFilterWebinar] = useState<string>("all");
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<{ [key: string]: boolean }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grid interactive spreadsheet state
  const [gridRows, setGridRows] = useState<Student[]>(() =>
    Array.from({ length: 10 }, () => ({ firstName: "", lastName: "", email: "" }))
  );
  const [gridResults, setGridResults] = useState<RegistrationResult[]>([]);
  const [isGridRunning, setIsGridRunning] = useState<boolean>(false);
  const [gridProgress, setGridProgress] = useState<{ 
    done: number; 
    total: number;
    currentWebinarName?: string;
  }>({ done: 0, total: 0 });

  // Fetch saved webinars
  useEffect(() => {
    fetchSavedWebinars();
  }, []);

  // Save selected webinars to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("zoom_bulk_selected_webinars", JSON.stringify(selectedWebinars));
    } catch (e) {
      console.warn("Failed to store bulk selected webinars", e);
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
    const nextList: SelectedWebinar[] = [...selectedWebinars];
    savedWebinars.forEach((sw) => {
      const cleanId = String(sw.webinar_id).trim();
      if (!nextList.some((w) => w.webinar_id === cleanId)) {
        nextList.push({ webinar_id: cleanId, webinar_name: sw.webinar_name });
      }
    });
    setSelectedWebinars(nextList);
    toast.success(`Selected all ${savedWebinars.length} saved webinars.`);
  };

  // Deselect all webinars
  const handleClearAllSelections = () => {
    setSelectedWebinars([]);
    toast.info("Cleared all webinar selections.");
  };

  // Add custom webinar ID (supports single or comma-separated)
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

  // Normalize column names to map standard fields
  const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");

  const processCsvData = (rawData: CsvRow[], headers: string[]) => {
    const firstNameHeader = headers.find(h => ["firstname", "first_name", "first", "fname"].includes(normalizeKey(h)));
    const lastNameHeader = headers.find(h => ["lastname", "last_name", "last", "lname"].includes(normalizeKey(h)));
    const emailHeader = headers.find(h => ["email", "emailaddress", "mail"].includes(normalizeKey(h)));

    if (!emailHeader) {
      toast.error("Could not find an 'Email' column in the CSV. Please ensure your CSV has email addresses.");
      return;
    }

    const parsedStudents: Student[] = rawData
      .map((row) => {
        const emailVal = (row[emailHeader] || "").trim();
        const firstVal = firstNameHeader ? (row[firstNameHeader] || "").trim() : "";
        const lastVal = lastNameHeader ? (row[lastNameHeader] || "").trim() : "";
        return {
          firstName: firstVal,
          lastName: cleanStudentNameForZoom(lastVal),
          email: emailVal,
        };
      })
      .filter((s) => s.email !== "");

    if (parsedStudents.length === 0) {
      toast.error("No valid student records found in the CSV.");
      return;
    }

    setStudents(parsedStudents);
    setResults([]);
    toast.success(`Successfully parsed ${parsedStudents.length} student(s) from CSV!`);
  };

  // Handle manual file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const parseFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (parsed.errors.length > 0) {
          console.warn("CSV Parsing warning:", parsed.errors);
        }
        processCsvData(parsed.data, parsed.meta.fields || []);
      },
      error: (error) => {
        toast.error(`Error parsing CSV file: ${error.message}`);
      }
    });
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        parseFile(file);
      } else {
        toast.error("Please upload a valid .csv file.");
      }
    }
  };

  const clearFile = () => {
    setFileName("");
    setStudents([]);
    setResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Split students into batches and register ACROSS ALL SELECTED WEBINARS
  async function runRegistrationPipeline(targetStudents: Student[], isGrid: boolean = false) {
    if (selectedWebinars.length === 0) {
      toast.error("Please select or add at least one Zoom Webinar or Meeting ID.");
      return;
    }
    if (targetStudents.length === 0) {
      toast.error("No student records found to register.");
      return;
    }

    const setRunningState = isGrid ? setIsGridRunning : setIsRunning;
    const setResultsState = isGrid ? setGridResults : setResults;
    const setProgressState = isGrid ? setGridProgress : setProgress;

    const totalRegistrations = targetStudents.length * selectedWebinars.length;

    setRunningState(true);
    setResultsState([]);
    setProgressState({ 
      done: 0, 
      total: totalRegistrations,
      currentWebinarName: selectedWebinars[0]?.webinar_name,
      currentWebinarIndex: 1,
      totalWebinars: selectedWebinars.length
    });

    const allResults: RegistrationResult[] = [];
    let processedTotal = 0;

    // Loop through each selected webinar
    for (let wIdx = 0; wIdx < selectedWebinars.length; wIdx++) {
      const targetWebinar = selectedWebinars[wIdx];
      const cleanWebinarId = targetWebinar.webinar_id.trim();

      // Batch students for this webinar
      for (let i = 0; i < targetStudents.length; i += BATCH_SIZE) {
        const batch = targetStudents.slice(i, i + BATCH_SIZE).map(s => ({
          ...s,
          lastName: cleanStudentNameForZoom(s.lastName)
        }));

        setProgressState({
          done: processedTotal,
          total: totalRegistrations,
          currentWebinarName: targetWebinar.webinar_name,
          currentWebinarIndex: wIdx + 1,
          totalWebinars: selectedWebinars.length
        });

        try {
          const response = await fetch("/api/register-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              students: batch, 
              webinarId: cleanWebinarId 
            }),
          });

          let data: any;
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = await response.json();
          } else {
            const text = await response.text();
            if (text.includes("<!DOCTYPE html") || response.status === 404) {
              throw new Error("API endpoint not active in local dev server. Check Zoom environment keys.");
            }
            throw new Error(`Invalid server response: ${response.statusText || response.status}`);
          }

          if (response.ok && data.results) {
            const mappedResults = (data.results as any[]).map((res) => {
              const matchedStudent = batch.find(s => s.email.toLowerCase() === res.email.toLowerCase());
              return {
                firstName: matchedStudent?.firstName || "",
                lastName: matchedStudent?.lastName || "",
                email: res.email,
                webinarId: cleanWebinarId,
                webinarName: targetWebinar.webinar_name,
                status: res.status as "Success" | "Failed",
                joinUrl: res.joinUrl,
                error: res.error,
              };
            });
            allResults.push(...mappedResults);
          } else {
            batch.forEach((s) =>
              allResults.push({ 
                firstName: s.firstName,
                lastName: s.lastName,
                email: s.email, 
                webinarId: cleanWebinarId,
                webinarName: targetWebinar.webinar_name,
                status: "Failed", 
                error: data?.error || data?.message || "Webinar registration batch failure" 
              })
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown batch request error";
          batch.forEach((s) =>
            allResults.push({ 
              firstName: s.firstName,
              lastName: s.lastName,
              email: s.email, 
              webinarId: cleanWebinarId,
              webinarName: targetWebinar.webinar_name,
              status: "Failed", 
              error: message 
            })
          );
        }

        processedTotal += batch.length;
        setResultsState([...allResults]);
        setProgressState({ 
          done: processedTotal, 
          total: totalRegistrations,
          currentWebinarName: targetWebinar.webinar_name,
          currentWebinarIndex: wIdx + 1,
          totalWebinars: selectedWebinars.length
        });
      }
    }

    setRunningState(false);
    const successCount = allResults.filter(r => r.status === "Success").length;
    const failCount = allResults.filter(r => r.status === "Failed").length;
    
    if (failCount === 0 && successCount > 0) {
      toast.success(`Finished! Successfully completed all ${successCount} registrations across ${selectedWebinars.length} webinar(s).`);
    } else if (successCount > 0) {
      toast.warning(`Finished: ${successCount} successful, ${failCount} failed across ${selectedWebinars.length} webinar(s).`);
    } else {
      const firstError = allResults.find(r => r.error)?.error;
      toast.error(firstError || `Registration failed for all ${failCount} entries across selected webinars.`);
    }
  }

  async function startRegistration() {
    if (students.length === 0) {
      toast.error("Please upload and load a student CSV file first.");
      return;
    }
    await runRegistrationPipeline(students, false);
  }

  // Grid management handlers
  const handleGridCellChange = (index: number, field: keyof Student, value: string) => {
    setGridRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const copyGridDataToClipboard = () => {
    const filledRows = gridRows.filter(
      (row) => row.firstName.trim() !== "" || row.lastName.trim() !== "" || row.email.trim() !== ""
    );

    if (filledRows.length === 0) {
      toast.error("Spreadsheet grid is currently empty. Nothing to copy.");
      return;
    }

    const headers = ["First Name", "Last Name", "Email"];
    const tsvLines = [
      headers.join("\t"),
      ...filledRows.map((row) => `${row.firstName.trim()}\t${row.lastName.trim()}\t${row.email.trim()}`)
    ];

    navigator.clipboard.writeText(tsvLines.join("\n"))
      .then(() => {
        toast.success(`Copied ${filledRows.length} rows to clipboard! Ready to paste into Excel/Sheets/CSV.`);
      })
      .catch(() => {
        toast.error("Failed to copy grid data to clipboard.");
      });
  };

  const handleGridPaste = (rowIndex: number, field: keyof Student, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const lines = pastedText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return;

    e.preventDefault();

    const startColIdx = field === "firstName" ? 0 : field === "lastName" ? 1 : 2;

    setGridRows((prev) => {
      const updated = [...prev];
      while (rowIndex + lines.length > updated.length) {
        updated.push({ firstName: "", lastName: "", email: "" });
      }

      lines.forEach((line, lineOffset) => {
        const targetRowIdx = rowIndex + lineOffset;
        if (targetRowIdx < updated.length) {
          const cells = line.split(/[\t,]/);
          const targetRowObj = { ...updated[targetRowIdx] };

          cells.forEach((cellVal, colOffset) => {
            const targetColIdx = startColIdx + colOffset;
            const cleanVal = cellVal.trim().replace(/^["']|["']$/g, "");
            if (targetColIdx === 0) {
              targetRowObj.firstName = cleanVal;
            } else if (targetColIdx === 1) {
              targetRowObj.lastName = cleanStudentNameForZoom(cleanVal);
            } else if (targetColIdx === 2) {
              targetRowObj.email = cleanVal;
            }
          });
          updated[targetRowIdx] = targetRowObj;
        }
      });
      return updated;
    });

    toast.success(`Successfully pasted spreadsheet data into the grid.`);
  };

  const handleClearGridRow = (index: number) => {
    const rowEmail = gridRows[index]?.email;
    setGridRows((prev) => {
      const updated = [...prev];
      updated[index] = { firstName: "", lastName: "", email: "" };
      return updated;
    });
    if (rowEmail) {
      setGridResults((prev) => prev.filter(r => r.email.toLowerCase().trim() !== rowEmail.toLowerCase().trim()));
    }
  };

  const handleClearAllGridRows = () => {
    setGridRows(Array.from({ length: 10 }, () => ({ firstName: "", lastName: "", email: "" })));
    setGridResults([]);
    toast.success("All spreadsheet rows and results have been cleared.");
  };

  const handleRegisterFromGrid = async () => {
    const activeGridStudents = gridRows
      .map((row) => ({
        firstName: row.firstName.trim(),
        lastName: cleanStudentNameForZoom(row.lastName.trim()),
        email: row.email.trim(),
      }))
      .filter((row) => row.email !== "");

    if (activeGridStudents.length === 0) {
      toast.error("Please fill in at least one student's Email in the spreadsheet grid.");
      return;
    }

    await runRegistrationPipeline(activeGridStudents, true);
  };

  // Download results as a CSV with webinar columns
  function downloadResults(targetResults: RegistrationResult[], prefix: string = "bulk") {
    if (targetResults.length === 0) {
      toast.error("No registration results to export.");
      return;
    }

    const csv = Papa.unparse(
      targetResults.map((r) => ({
        "First Name": r.firstName || "",
        "Last Name": r.lastName || "",
        Email: r.email,
        "Webinar Name": r.webinarName || "",
        "Webinar ID": r.webinarId || "",
        Status: r.status,
        "Join URL": r.joinUrl || "",
        Error: r.error || "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zoom_${prefix}_registration_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("Results CSV downloaded successfully!");
  }

  // Download template CSV with required columns
  function downloadTemplateCsv() {
    const headers = ["First Name", "Last Name", "Email"];
    const sampleRows = [
      ["John", "Doe", "john.doe@example.com"],
      ["Jane", "Smith", "jane.smith@example.com"]
    ];
    const csvContent = [headers.join(","), ...sampleRows.map(row => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "zoom_bulk_registration_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template CSV downloaded successfully!");
  }

  const handleCopyLink = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkIndex(prev => ({ ...prev, [key]: true }));
      toast.success("Zoom Join Link copied!");
      setTimeout(() => {
        setCopiedLinkIndex(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const successCount = results.filter((r) => r.status === "Success").length;
  const failCount = results.filter((r) => r.status === "Failed").length;

  const filteredResults = results.filter((r) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      r.email.toLowerCase().includes(query) || 
      (r.firstName && r.firstName.toLowerCase().includes(query)) ||
      (r.lastName && r.lastName.toLowerCase().includes(query)) ||
      (r.webinarName && r.webinarName.toLowerCase().includes(query)) ||
      (r.webinarId && r.webinarId.includes(query)) ||
      (r.error && r.error.toLowerCase().includes(query));
    
    if (filterWebinar !== "all" && r.webinarId !== filterWebinar) {
      return false;
    }

    if (filterTab === "success") return matchesSearch && r.status === "Success";
    if (filterTab === "failed") return matchesSearch && r.status === "Failed";
    return matchesSearch;
  });

  // Filter saved webinars by search query
  const filteredSavedWebinars = savedWebinars.filter((w) => {
    const q = webinarSearchQuery.toLowerCase();
    return (
      w.webinar_name.toLowerCase().includes(q) ||
      w.webinar_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Video className="text-teal-600 dark:text-teal-400" size={24} />
            Bulk Student Zoom Registration
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Register batches of students into <strong className="text-teal-700 dark:text-teal-300">multiple Zoom webinars or meetings simultaneously</strong> via CSV or spreadsheet grid.
          </p>
        </div>
        <ZoomNavTabs />
      </div>

      {/* Main Multi-Webinar Selection Card (Applied to both CSV and Grid) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-150 dark:border-gray-800">
          <div>
            <label className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Layers size={17} className="text-teal-600 dark:text-teal-400" />
              <span>Step 1: Select Target Zoom Webinars / Meetings</span>
              <span className="text-red-500">*</span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Multi-Webinar Supported
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Select one or multiple webinars below. Every student in your CSV or grid will be registered to each selected webinar.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {savedWebinars.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSelectAllSaved}
                  disabled={isRunning || isGridRunning}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 hover:underline cursor-pointer"
                >
                  Select All Saved ({savedWebinars.length})
                </button>
                <span className="text-gray-300 dark:text-gray-700">|</span>
              </>
            )}
            {selectedWebinars.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllSelections}
                disabled={isRunning || isGridRunning}
                className="text-[11px] font-bold text-red-500 hover:text-red-600 hover:underline cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Saved webinars list */}
        <div className="bg-gray-50/80 dark:bg-gray-850/60 rounded-xl p-3 border border-gray-200 dark:border-gray-750 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter saved academy webinars..."
                value={webinarSearchQuery}
                onChange={(e) => setWebinarSearchQuery(e.target.value)}
                disabled={isRunning || isGridRunning}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 shrink-0">
              {selectedWebinars.length} webinar(s) selected
            </span>
          </div>

          {loadingWebinars ? (
            <div className="py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin text-teal-600" />
              <span>Loading saved webinars...</span>
            </div>
          ) : filteredSavedWebinars.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredSavedWebinars.map((w) => {
                const isChecked = selectedWebinars.some((sw) => sw.webinar_id === w.webinar_id.trim());
                return (
                  <div
                    key={w.id}
                    onClick={() => !isRunning && !isGridRunning && toggleWebinarSelection(w)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isChecked
                        ? "bg-teal-50/90 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-950 dark:text-teal-200 shadow-2xs"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    } ${isRunning || isGridRunning ? "opacity-60 cursor-not-allowed" : ""}`}
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

        {/* Add custom webinar ID */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Or enter custom Webinar/Meeting ID (e.g. 84930219481, 86249455017)"
            value={customWebinarId}
            onChange={(e) => setCustomWebinarId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomWebinar();
              }
            }}
            disabled={isRunning || isGridRunning}
            className="flex-1 px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
          />
          <button
            type="button"
            onClick={() => handleAddCustomWebinar()}
            disabled={isRunning || isGridRunning || !customWebinarId.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Add ID</span>
          </button>
        </div>

        {/* Selected webinars chips */}
        {selectedWebinars.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
              <span>Selected Target Webinars ({selectedWebinars.length})</span>
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
                  {!isRunning && !isGridRunning && (
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

      {/* Option 1: CSV Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column - Form details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm">
            
            {/* Step 2: Drag and drop File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet size={16} className="text-teal-600" />
                  Step 2: Upload Student CSV <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-teal-600 font-semibold cursor-pointer hover:underline" onClick={downloadTemplateCsv}>
                  Download Sample CSV
                </span>
              </label>

              {!fileName ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    dragActive 
                      ? "border-teal-500 bg-teal-50/30 dark:bg-teal-950/20" 
                      : "border-gray-300 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-400 bg-gray-50 dark:bg-gray-800/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <UploadCloud size={40} className="text-gray-400 dark:text-gray-500 mb-3 animate-pulse" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                    Drag and drop your CSV file here, or <span className="text-teal-600 dark:text-teal-400 font-semibold underline">browse files</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Supports .csv files. Required columns: Email (First/Last Names recommended).
                  </p>
                </div>
              ) : (
                <div className="border border-teal-100 dark:border-teal-900/60 bg-teal-50/20 dark:bg-teal-950/10 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 rounded-lg">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs md:max-w-md">
                        {fileName}
                      </p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-0.5">
                        {students.length} student record(s) loaded
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    disabled={isRunning}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Run Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs text-gray-500 font-medium">
                {selectedWebinars.length === 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    ⚠ Please select at least 1 webinar in Step 1.
                  </span>
                ) : students.length > 0 ? (
                  <span>
                    Will execute <strong className="text-teal-600 dark:text-teal-400 font-black">{students.length * selectedWebinars.length}</strong> total registrations ({students.length} students × {selectedWebinars.length} webinars).
                  </span>
                ) : (
                  <span>Ready to register students across {selectedWebinars.length} selected webinar(s).</span>
                )}
              </div>

              <button
                type="button"
                onClick={startRegistration}
                disabled={isRunning || selectedWebinars.length === 0 || students.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registering Across Webinars...
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    Start Multi-Webinar Registration ({students.length})
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Progress Section */}
          {(isRunning || progress.done > 0) && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  {isRunning ? (
                    <Loader2 size={16} className="animate-spin text-teal-600" />
                  ) : (
                    <CheckCircle2 size={16} className="text-green-500" />
                  )}
                  {isRunning ? (
                    <span>
                      Processing: <strong className="text-teal-600 dark:text-teal-400">{progress.currentWebinarName}</strong> (Webinar {progress.currentWebinarIndex} of {progress.totalWebinars})
                    </span>
                  ) : (
                    "Multi-Webinar Registration Complete"
                  )}
                </span>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 font-mono">
                  {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}% ({progress.done}/{progress.total})
                </span>
              </div>
              
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>

              {results.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mt-4 text-center">
                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-2.5 border border-gray-100 dark:border-gray-800/60">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Total Attempts</p>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-200 mt-0.5">{progress.total}</p>
                  </div>
                  <div className="bg-teal-50/50 dark:bg-teal-950/20 rounded-xl p-2.5 border border-teal-100/40 dark:border-teal-900/20">
                    <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase">Webinars</p>
                    <p className="text-base font-bold text-teal-600 dark:text-teal-400 mt-0.5">{selectedWebinars.length}</p>
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-950/10 rounded-xl p-2.5 border border-green-100/40 dark:border-green-900/20">
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase">Success</p>
                    <p className="text-base font-bold text-green-600 dark:text-green-400 mt-0.5">{successCount}</p>
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-950/10 rounded-xl p-2.5 border border-red-100/40 dark:border-red-900/20">
                    <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold uppercase">Failed</p>
                    <p className="text-base font-bold text-red-500 dark:text-red-400 mt-0.5">{failCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Table Section */}
          {results.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>Registration Results Log</span>
                    <span className="text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-full font-mono">
                      {results.length} records
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Breakdown of student registrations per webinar
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadResults(filteredResults, "bulk")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  <Download size={14} />
                  <span>Export CSV Results</span>
                </button>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by student name, email, webinar..."
                    className="w-full pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* Filter by Webinar */}
                <select
                  value={filterWebinar}
                  onChange={(e) => setFilterWebinar(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Webinars ({selectedWebinars.length})</option>
                  {selectedWebinars.map(w => (
                    <option key={w.webinar_id} value={w.webinar_id}>
                      {w.webinar_name} ({w.webinar_id})
                    </option>
                  ))}
                </select>

                {/* Filter by Status */}
                <div className="flex gap-1 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-1 text-xs self-start">
                  <button
                    onClick={() => setFilterTab("all")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      filterTab === "all"
                        ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold shadow-xs"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    All ({results.length})
                  </button>
                  <button
                    onClick={() => setFilterTab("success")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      filterTab === "success"
                        ? "bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 font-semibold shadow-xs"
                        : "text-gray-500 hover:text-green-600 dark:hover:text-green-400"
                    }`}
                  >
                    Success ({successCount})
                  </button>
                  <button
                    onClick={() => setFilterTab("failed")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      filterTab === "failed"
                        ? "bg-white dark:bg-gray-700 text-red-500 dark:text-red-400 font-semibold shadow-xs"
                        : "text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                    }`}
                  >
                    Failed ({failCount})
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-850 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-150 dark:border-gray-800">
                      <th className="px-3 py-2.5">Student</th>
                      <th className="px-3 py-2.5">Email Address</th>
                      <th className="px-3 py-2.5">Target Webinar</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Join URL / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-xs">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                          No registration logs found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((r, idx) => {
                        const linkKey = `${r.webinarId}_${r.email}_${idx}`;
                        const isCopied = copiedLinkIndex[linkKey];

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                            <td className="px-3 py-2.5 font-medium text-gray-850 dark:text-gray-200 truncate max-w-[130px]">
                              {r.firstName || r.lastName ? `${r.firstName || ""} ${r.lastName || ""}`.trim() : "-"}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-[170px]" title={r.email}>
                              {r.email}
                            </td>
                            <td className="px-3 py-2.5 max-w-[160px]">
                              <div className="font-bold text-gray-800 dark:text-gray-200 truncate text-[11px]">
                                {r.webinarName}
                              </div>
                              <div className="font-mono text-[10px] text-gray-400">
                                {r.webinarId}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              {r.status === "Success" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full text-[10px] font-bold">
                                  <Check size={10} strokeWidth={3} /> Success
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-full text-[10px] font-bold">
                                  <XCircle size={10} /> Failed
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                              {r.status === "Success" && r.joinUrl ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(linkKey, r.joinUrl!)}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-200 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    {isCopied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                                    <span>{isCopied ? "Copied" : "Copy"}</span>
                                  </button>
                                  <a
                                    href={r.joinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-teal-600 hover:underline dark:text-teal-400"
                                    title="Open link"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-red-500 dark:text-red-400 text-[11px] truncate max-w-[200px] block" title={r.error}>
                                  {r.error || "Zoom registration failed"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Right column - Instructions & Previews */}
        <div className="space-y-6">
          
          {/* Instructions box */}
          <div className="bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
              <Sparkles size={16} className="text-teal-600" />
              Multi-Webinar Registration Guide
            </h3>
            <p className="text-xs text-teal-800/80 dark:text-teal-300/80 leading-relaxed">
              Upload a student CSV file to enroll candidates across <strong>multiple Zoom Webinars or Meetings simultaneously</strong>.
            </p>
            <ul className="space-y-2.5 text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
              <li>
                <strong>1. Multiple Webinars:</strong> Check all webinars in Step 1 (e.g., Theory + Revision + Paper Class).
              </li>
              <li>
                <strong>2. Required Columns:</strong> CSV must contain an <span className="underline font-bold">Email</span> column. First and Last Name columns are automatically matched.
              </li>
              <li>
                <strong>3. Automatic Batching:</strong> Sent in safe batches of 10 to Zoom with live progress updates.
              </li>
              <li>
                <strong>4. Full Reporting:</strong> Download a comprehensive CSV with direct join links generated for each webinar!
              </li>
            </ul>

            <div className="pt-3 border-t border-teal-200/50 dark:border-teal-900/40">
              <button
                type="button"
                onClick={downloadTemplateCsv}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer"
              >
                <Download size={13} />
                <span>Download Template CSV</span>
              </button>
            </div>
          </div>

          {/* Parsed Preview Card */}
          {students.length > 0 && !isRunning && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">CSV Students Preview</h3>
                <span className="px-2 py-0.5 bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 rounded text-[10px] font-bold border border-teal-100 dark:border-teal-900">
                  {students.length} record(s)
                </span>
              </div>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {students.slice(0, 5).map((student, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-850 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-xs">
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {student.firstName || "(No First)"} {student.lastName || "(No Last)"}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 font-mono text-[11px] truncate">{student.email}</p>
                  </div>
                ))}
                {students.length > 5 && (
                  <p className="text-[11px] text-gray-400 text-center italic pt-1">
                    ...and {students.length - 5} more student(s) loaded
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Option 2: Direct Spreadsheet Entry (Interactive Grid) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/20 text-teal-650 dark:text-teal-400 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-850 dark:text-gray-100 uppercase tracking-wider">
                Option 2: Direct Spreadsheet Entry Grid
              </h3>
              <p className="text-xs text-gray-450 dark:text-gray-500 mt-0.5">
                Type or copy/paste rows directly from Excel or Google Sheets into the cells below.
              </p>
            </div>
          </div>
          
          <div className="text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800 shrink-0">
            Targeting {selectedWebinars.length} selected webinar(s)
          </div>
        </div>

        {/* Grid Progress / Results Summary banner */}
        {(isGridRunning || gridResults.length > 0) && (
          <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-800 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <span className="text-xs font-bold text-gray-850 dark:text-gray-200 flex items-center gap-2">
                {isGridRunning ? (
                  <Loader2 size={14} className="animate-spin text-teal-600" />
                ) : (
                  <CheckCircle2 size={14} className="text-green-500" />
                )}
                {isGridRunning 
                  ? `Spreadsheet Registration: ${gridProgress.currentWebinarName || "Processing..."}` 
                  : "Spreadsheet Registration Completed"}
              </span>
              <span className="text-[11px] font-mono font-bold text-teal-650 dark:text-teal-400">
                {gridProgress.done}/{gridProgress.total} processed
              </span>
            </div>
            
            {/* Progress bar */}
            {isGridRunning && (
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-teal-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${gridProgress.total > 0 ? (gridProgress.done / gridProgress.total) * 100 : 0}%` }}
                />
              </div>
            )}

            {gridResults.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap gap-4 text-xs font-bold">
                  <span className="text-gray-400 dark:text-gray-550">Grid Summary:</span>
                  <span className="inline-flex items-center gap-1 text-green-650 dark:text-green-400">
                    <Check size={12} strokeWidth={3} /> {gridResults.filter((r) => r.status === "Success").length} Registered Successfully
                  </span>
                  {gridResults.filter((r) => r.status === "Failed").length > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-400">
                      <XCircle size={12} /> {gridResults.filter((r) => r.status === "Failed").length} Failed
                    </span>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => downloadResults(gridResults, "grid")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white dark:bg-gray-100 dark:hover:bg-gray-250 dark:text-gray-900 font-bold rounded-lg text-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download Grid CSV</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Excel-style spreadsheet grid table */}
        <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-850/50 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-550 font-black border-b border-gray-150 dark:border-gray-800">
                <th className="px-3 py-2.5 text-center w-12 border-r border-gray-150 dark:border-gray-800">#</th>
                <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800">First Name</th>
                <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800">Last Name</th>
                <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800">Email Address <span className="text-red-500">*</span></th>
                <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800 w-44">Status</th>
                <th className="px-3 py-2.5 text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
              {gridRows.map((row, index) => {
                const hasEmail = row.email.trim() !== "";
                const rowResults = hasEmail ? gridResults.filter(r => r.email.toLowerCase().trim() === row.email.toLowerCase().trim()) : [];
                const allSucceeded = rowResults.length > 0 && rowResults.every(r => r.status === "Success");
                const hasFailed = rowResults.some(r => r.status === "Failed");

                return (
                  <tr 
                    key={index} 
                    className={`transition-colors hover:bg-gray-50/30 dark:hover:bg-gray-850/10 ${hasEmail ? 'bg-teal-50/5 dark:bg-teal-950/5' : ''}`}
                  >
                    {/* Index */}
                    <td className="px-3 py-1.5 text-center text-xs font-mono text-gray-400 dark:text-gray-550 border-r border-gray-150 dark:border-gray-800 font-bold bg-gray-50/40 dark:bg-gray-850/5 select-none">
                      {index + 1}
                    </td>
                    
                    {/* First Name */}
                    <td className="px-2 py-1.5 border-r border-gray-150 dark:border-gray-800">
                      <input
                        type="text"
                        value={row.firstName}
                        onChange={(e) => handleGridCellChange(index, "firstName", e.target.value)}
                        onPaste={(e) => handleGridPaste(index, "firstName", e)}
                        placeholder="John"
                        disabled={isGridRunning}
                        className="w-full px-2 py-1.5 bg-transparent border-0 border-transparent focus:bg-teal-50/10 focus:ring-1 focus:ring-teal-500 rounded text-xs text-gray-800 dark:text-gray-200 font-medium placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50"
                      />
                    </td>

                    {/* Last Name */}
                    <td className="px-2 py-1.5 border-r border-gray-150 dark:border-gray-800">
                      <input
                        type="text"
                        value={row.lastName}
                        onChange={(e) => handleGridCellChange(index, "lastName", e.target.value)}
                        onPaste={(e) => handleGridPaste(index, "lastName", e)}
                        placeholder="Doe"
                        disabled={isGridRunning}
                        className="w-full px-2 py-1.5 bg-transparent border-0 border-transparent focus:bg-teal-50/10 focus:ring-1 focus:ring-teal-500 rounded text-xs text-gray-800 dark:text-gray-200 font-medium placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50"
                      />
                    </td>

                    {/* Email Address */}
                    <td className="px-2 py-1.5 border-r border-gray-150 dark:border-gray-800">
                      <input
                        type="email"
                        value={row.email}
                        onChange={(e) => handleGridCellChange(index, "email", e.target.value)}
                        onPaste={(e) => handleGridPaste(index, "email", e)}
                        placeholder="john.doe@gmail.com"
                        disabled={isGridRunning}
                        className="w-full px-2 py-1.5 bg-transparent border-0 border-transparent focus:bg-teal-50/10 focus:ring-1 focus:ring-teal-500 rounded text-xs text-gray-850 dark:text-gray-200 font-bold placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50"
                      />
                    </td>

                    {/* Status column */}
                    <td className="px-3 py-1.5 border-r border-gray-150 dark:border-gray-800 bg-gray-50/10 dark:bg-gray-850/5">
                      {hasEmail ? (
                        rowResults.length > 0 ? (
                          allSucceeded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-650 dark:text-green-400">
                              <CheckCircle2 size={12} className="text-green-500" />
                              Registered in {rowResults.length} webinars
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 dark:text-red-400">
                              <XCircle size={12} className="text-red-500" />
                              {rowResults.filter(r => r.status === "Success").length}/{rowResults.length} Succeeded
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold">
                            Ready to Register
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-600 italic">
                          -
                        </span>
                      )}
                    </td>

                    {/* Clear Action */}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleClearGridRow(index)}
                        disabled={isGridRunning || (!row.firstName && !row.lastName && !row.email)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent cursor-pointer"
                        title="Clear row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grid control actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAllGridRows}
              disabled={isGridRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-900/10 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={13} />
              Clear Grid
            </button>
            <button
              type="button"
              onClick={copyGridDataToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-200 border border-gray-200 dark:border-gray-750 rounded-lg text-xs font-bold transition-all cursor-pointer"
              title="Copy spreadsheet grid rows to clipboard"
            >
              <Copy size={13} />
              Copy Grid Data
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-550">
              {gridRows.filter((r) => r.email.trim() !== "").length} of 10 rows filled
            </span>

            <button
              type="button"
              onClick={handleRegisterFromGrid}
              disabled={isGridRunning || selectedWebinars.length === 0 || gridRows.filter((r) => r.email.trim() !== "").length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGridRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Registering Across Webinars...</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  <span>REGISTER FROM GRID ({selectedWebinars.length} WEBINARS)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
