// File location: /src/pages/RegisterStudents.tsx
import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Sparkles,
  Users,
  Filter,
  UserCheck,
  RefreshCw,
  Mail,
  GraduationCap,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cleanStudentNameForZoom } from "../lib/utils";
import { supabase } from "../lib/supabase";

const BATCH_SIZE = 10; // how many students to send to Zoom per batch

interface Student {
  firstName: string;
  lastName: string;
  email: string;
}

interface StudentDbRecord {
  id: string;
  pcaid: string;
  name: string;
  last_name?: string | null;
  mail?: string | null;
  proper_batch?: string | null;
  joined_batch?: string | null;
  district?: string | null;
  phone?: string | null;
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
  // Option source tabs: 01. Student Selection, 02. CSV Upload, 03. Direct Spreadsheet Entry Grid
  const [activeSourceOption, setActiveSourceOption] = useState<"selection" | "csv" | "grid">("selection");

  // Saved webinars from Supabase (COMMON FOR ALL 3 OPTIONS)
  const [savedWebinars, setSavedWebinars] = useState<SavedWebinar[]>([]);
  const [loadingWebinars, setLoadingWebinars] = useState<boolean>(true);
  const [webinarSearchQuery, setWebinarSearchQuery] = useState<string>("");

  // Multiple selected webinars (COMMON FOR ALL 3 OPTIONS)
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

  // Collapse/Expand state for Step 1 Multi-Webinar Selection
  const [isWebinarSectionCollapsed, setIsWebinarSectionCollapsed] = useState<boolean>(false);

  // ==========================================
  // OPTION 01: Student Selection State (Database)
  // ==========================================
  const [dbStudents, setDbStudents] = useState<StudentDbRecord[]>([]);
  const [loadingDbStudents, setLoadingDbStudents] = useState<boolean>(true);
  const [selectedDbStudentIds, setSelectedDbStudentIds] = useState<Set<string>>(new Set());
  const [dbSearchQuery, setDbSearchQuery] = useState<string>("");
  const [dbBatchFilter, setDbBatchFilter] = useState<string>("all");
  const [dbDistrictFilter, setDbDistrictFilter] = useState<string>("all");
  const [dbOnlyValidEmail, setDbOnlyValidEmail] = useState<boolean>(true);

  // ==========================================
  // OPTION 02: CSV Upload State
  // ==========================================
  const [students, setStudents] = useState<Student[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // OPTION 03: Direct Spreadsheet Entry State
  // ==========================================
  const [gridRows, setGridRows] = useState<Student[]>(() =>
    Array.from({ length: 10 }, () => ({ firstName: "", lastName: "", email: "" }))
  );

  // ==========================================
  // COMMON: Execution & Results State
  // ==========================================
  const [results, setResults] = useState<RegistrationResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ 
    done: number; 
    total: number; 
    currentWebinarName?: string;
    currentWebinarIndex?: number;
    totalWebinars?: number;
  }>({ done: 0, total: 0 });
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "success" | "failed">("all");
  const [filterWebinar, setFilterWebinar] = useState<string>("all");
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<{ [key: string]: boolean }>({});

  // Fetch initial data: Saved Webinars and Student Registry
  useEffect(() => {
    fetchSavedWebinars();
    fetchDbStudents();
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

  const fetchDbStudents = async () => {
    try {
      setLoadingDbStudents(true);
      if (!supabase) return;
      const { data, error } = await supabase
        .from("student")
        .select("id, pcaid, name, last_name, mail, proper_batch, joined_batch, district, phone")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not fetch students:", error.message);
      } else if (data) {
        setDbStudents(data as StudentDbRecord[]);
      }
    } catch (err) {
      console.warn("Error fetching students:", err);
    } finally {
      setLoadingDbStudents(false);
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

  const handleClearAllSelections = () => {
    setSelectedWebinars([]);
    toast.info("Cleared all webinar selections.");
  };

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

  // ==========================================
  // Student Selection (Database Registry) Handlers
  // ==========================================

  // Extract unique batches and districts for dropdown filters
  const uniqueBatches = useMemo(() => {
    const batches = new Set<string>();
    dbStudents.forEach((s) => {
      if (s.joined_batch) batches.add(s.joined_batch.trim());
      if (s.proper_batch) batches.add(s.proper_batch.trim());
    });
    return Array.from(batches).filter(Boolean).sort();
  }, [dbStudents]);

  const uniqueDistricts = useMemo(() => {
    const districts = new Set<string>();
    dbStudents.forEach((s) => {
      if (s.district) districts.add(s.district.trim());
    });
    return Array.from(districts).filter(Boolean).sort();
  }, [dbStudents]);

  // Filtered DB students
  const filteredDbStudents = useMemo(() => {
    const q = dbSearchQuery.toLowerCase().trim();
    return dbStudents.filter((s) => {
      // Email requirement check
      if (dbOnlyValidEmail && (!s.mail || !s.mail.trim())) {
        return false;
      }

      // Batch filter
      if (dbBatchFilter !== "all") {
        const batchMatch = s.joined_batch === dbBatchFilter || s.proper_batch === dbBatchFilter;
        if (!batchMatch) return false;
      }

      // District filter
      if (dbDistrictFilter !== "all") {
        if ((s.district || "").toLowerCase() !== dbDistrictFilter.toLowerCase()) return false;
      }

      // Search query
      if (q) {
        const pcaidMatch = (s.pcaid || "").toLowerCase().includes(q);
        const nameMatch = (s.name || "").toLowerCase().includes(q);
        const emailMatch = (s.mail || "").toLowerCase().includes(q);
        const phoneMatch = (s.phone || "").includes(q);
        const districtMatch = (s.district || "").toLowerCase().includes(q);
        return pcaidMatch || nameMatch || emailMatch || phoneMatch || districtMatch;
      }

      return true;
    });
  }, [dbStudents, dbSearchQuery, dbBatchFilter, dbDistrictFilter, dbOnlyValidEmail]);

  // Toggle single student selection
  const toggleStudentSelection = (student: StudentDbRecord) => {
    if (!student.mail || !student.mail.trim()) {
      toast.error(`Cannot select ${student.name || student.pcaid}: No email address on record.`);
      return;
    }

    setSelectedDbStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(student.id)) {
        next.delete(student.id);
      } else {
        next.add(student.id);
      }
      return next;
    });
  };

  // Eligible filtered students (with email)
  const eligibleFilteredStudents = useMemo(() => {
    return filteredDbStudents.filter((s) => s.mail && s.mail.trim());
  }, [filteredDbStudents]);

  // Are all eligible filtered students selected?
  const isAllFilteredSelected = useMemo(() => {
    return (
      eligibleFilteredStudents.length > 0 &&
      eligibleFilteredStudents.every((s) => selectedDbStudentIds.has(s.id))
    );
  }, [eligibleFilteredStudents, selectedDbStudentIds]);

  // Toggle select/deselect all eligible filtered students
  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedDbStudentIds((prev) => {
        const next = new Set(prev);
        eligibleFilteredStudents.forEach((s) => next.delete(s.id));
        return next;
      });
      toast.info("Deselected filtered students.");
    } else {
      if (eligibleFilteredStudents.length === 0) {
        toast.error("No eligible students with valid email in current filter.");
        return;
      }
      setSelectedDbStudentIds((prev) => {
        const next = new Set(prev);
        eligibleFilteredStudents.forEach((s) => next.add(s.id));
        return next;
      });
      toast.success(`Selected ${eligibleFilteredStudents.length} student(s) from current list.`);
    }
  };

  // Select all currently filtered students (that have valid emails)
  const handleSelectAllFilteredStudents = () => {
    const eligibleStudents = filteredDbStudents.filter((s) => s.mail && s.mail.trim());
    if (eligibleStudents.length === 0) {
      toast.error("No eligible students with valid email in current filter.");
      return;
    }

    setSelectedDbStudentIds((prev) => {
      const next = new Set(prev);
      eligibleStudents.forEach((s) => next.add(s.id));
      return next;
    });
    toast.success(`Selected ${eligibleStudents.length} student(s) from current list.`);
  };

  // Deselect all students
  const handleDeselectAllStudents = () => {
    setSelectedDbStudentIds(new Set());
    toast.info("Cleared student selection.");
  };

  // Start registration from Student Selection
  const handleRegisterFromSelection = async () => {
    if (selectedDbStudentIds.size === 0) {
      toast.error("Please select at least one student from the table.");
      return;
    }

    const targetStudents: Student[] = Array.from(selectedDbStudentIds)
      .map((id) => dbStudents.find((s) => s.id === id))
      .filter((s): s is StudentDbRecord => Boolean(s && s.mail && s.mail.trim()))
      .map((s) => ({
        firstName: (s.pcaid || s.name?.split(" ")[0] || "").trim(),
        lastName: cleanStudentNameForZoom(s.name || ""),
        email: (s.mail || "").trim(),
      }));

    if (targetStudents.length === 0) {
      toast.error("Selected students have missing email addresses.");
      return;
    }

    await runRegistrationPipeline(targetStudents);
  };

  // ==========================================
  // CSV Import Handlers
  // ==========================================
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
    toast.success(`Successfully parsed ${parsedStudents.length} student(s) from CSV!`);
  };

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRegisterFromCsv = async () => {
    if (students.length === 0) {
      toast.error("Please upload and load a student CSV file first.");
      return;
    }
    await runRegistrationPipeline(students);
  };

  // ==========================================
  // Direct Spreadsheet Grid Handlers
  // ==========================================
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
    setGridRows((prev) => {
      const updated = [...prev];
      updated[index] = { firstName: "", lastName: "", email: "" };
      return updated;
    });
  };

  const handleClearAllGridRows = () => {
    setGridRows(Array.from({ length: 10 }, () => ({ firstName: "", lastName: "", email: "" })));
    toast.success("All spreadsheet rows have been cleared.");
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

    await runRegistrationPipeline(activeGridStudents);
  };

  // ==========================================
  // COMMON Registration Pipeline Across Multiple Webinars
  // ==========================================
  async function runRegistrationPipeline(targetStudents: Student[]) {
    if (selectedWebinars.length === 0) {
      toast.error("Please select or add at least one Zoom Webinar or Meeting ID in Step 1.");
      return;
    }
    if (targetStudents.length === 0) {
      toast.error("No student records found to register.");
      return;
    }

    const totalRegistrations = targetStudents.length * selectedWebinars.length;

    setIsRunning(true);
    setResults([]);
    setProgress({ 
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

        setProgress({
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
        setResults([...allResults]);
        setProgress({ 
          done: processedTotal, 
          total: totalRegistrations,
          currentWebinarName: targetWebinar.webinar_name,
          currentWebinarIndex: wIdx + 1,
          totalWebinars: selectedWebinars.length
        });
      }
    }

    setIsRunning(false);
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

  // Export results to CSV
  function downloadResults(targetResults: RegistrationResult[]) {
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
    link.download = `zoom_bulk_registration_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("Results CSV downloaded successfully!");
  }

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

  const filteredSavedWebinars = savedWebinars.filter((w) => {
    const q = webinarSearchQuery.toLowerCase();
    return (
      w.webinar_name.toLowerCase().includes(q) ||
      w.webinar_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Video className="text-teal-600 dark:text-teal-400" size={24} />
          Bulk Student Zoom Registration
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Register students into <strong className="text-teal-700 dark:text-teal-300">multiple Zoom webinars/meetings at once</strong> via Student Selection, CSV Upload, or Spreadsheet Grid.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* COMMON SECTION: Multi-Webinar Selection (Shared across all 3 options) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-150 dark:border-gray-800">
          <div>
            <label className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Layers size={17} className="text-teal-600 dark:text-teal-400" />
              <span>Step 1: Select Target Zoom Webinars / Meetings (Common)</span>
              <span className="text-red-500">*</span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Multi-Webinar Supported
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Check all webinars/meetings below. All selected students from any of the 3 options will be registered across these events.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {!isWebinarSectionCollapsed && savedWebinars.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSelectAllSaved}
                  disabled={isRunning}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 hover:underline cursor-pointer"
                >
                  Select All Saved ({savedWebinars.length})
                </button>
                <span className="text-gray-300 dark:text-gray-700">|</span>
              </>
            )}
            {!isWebinarSectionCollapsed && selectedWebinars.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleClearAllSelections}
                  disabled={isRunning}
                  className="text-[11px] font-bold text-red-500 hover:text-red-600 hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
                <span className="text-gray-300 dark:text-gray-700">|</span>
              </>
            )}
            {/* Collapse / Expand Icon Button */}
            <button
              type="button"
              onClick={() => setIsWebinarSectionCollapsed((prev) => !prev)}
              title={isWebinarSectionCollapsed ? "Show / Expand Webinars" : "Collapse Section"}
              aria-label={isWebinarSectionCollapsed ? "Show / Expand Webinars" : "Collapse Section"}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer shadow-2xs"
            >
              {isWebinarSectionCollapsed ? (
                <ChevronDown size={17} className="text-teal-600 dark:text-teal-400" />
              ) : (
                <ChevronUp size={17} className="text-teal-600 dark:text-teal-400" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsed State Quick Preview Bar */}
        {isWebinarSectionCollapsed && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-xl border border-teal-100 dark:border-teal-900/40 text-xs">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Video size={13} className="text-teal-600" />
                Target Webinars:
              </span>
              {selectedWebinars.length === 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  None selected yet. Click "Show / Expand" to choose webinars.
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedWebinars.map((item) => (
                    <span
                      key={item.webinar_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-gray-800 text-teal-800 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800 text-[11px] font-bold shadow-2xs"
                    >
                      <span className="truncate max-w-[200px]">{item.webinar_name}</span>
                      <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">({item.webinar_id})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsWebinarSectionCollapsed(false)}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer shrink-0 ml-auto"
            >
              Modify Webinars
            </button>
          </div>
        )}

        {/* Expanded State Full Selection Controls */}
        {!isWebinarSectionCollapsed && (
          <div className="space-y-4 animate-in fade-in duration-200">
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
                    disabled={isRunning}
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
        )}
      </div>

      {/* ========================================================================= */}
      {/* STEP 2: OPTION SELECTOR (USER'S REQUESTED ORDER 01, 02, 03) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <span>Step 2: Choose Student Input Source</span>
            <span className="text-red-500">*</span>
          </label>
        </div>

        {/* Segmented Option Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Option 01: Student Selection */}
          <button
            type="button"
            onClick={() => setActiveSourceOption("selection")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 relative overflow-hidden ${
              activeSourceOption === "selection"
                ? "bg-white dark:bg-gray-900 border-teal-500 shadow-md ring-2 ring-teal-500/20"
                : "bg-gray-50/80 dark:bg-gray-850/60 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            <div className={`p-2.5 rounded-xl ${
              activeSourceOption === "selection"
                ? "bg-teal-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}>
              <Users size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Option 01
                </span>
                {selectedDbStudentIds.size > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                    {selectedDbStudentIds.size} Selected
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                Student Selection
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                Select registered students from database registry
              </p>
            </div>
          </button>

          {/* Option 02: CSV Upload */}
          <button
            type="button"
            onClick={() => setActiveSourceOption("csv")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 relative overflow-hidden ${
              activeSourceOption === "csv"
                ? "bg-white dark:bg-gray-900 border-teal-500 shadow-md ring-2 ring-teal-500/20"
                : "bg-gray-50/80 dark:bg-gray-850/60 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            <div className={`p-2.5 rounded-xl ${
              activeSourceOption === "csv"
                ? "bg-teal-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}>
              <UploadCloud size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Option 02
                </span>
                {students.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                    {students.length} Loaded
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                CSV Upload
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                Upload student candidate list from a .csv file
              </p>
            </div>
          </button>

          {/* Option 03: Direct Spreadsheet Entry */}
          <button
            type="button"
            onClick={() => setActiveSourceOption("grid")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 relative overflow-hidden ${
              activeSourceOption === "grid"
                ? "bg-white dark:bg-gray-900 border-teal-500 shadow-md ring-2 ring-teal-500/20"
                : "bg-gray-50/80 dark:bg-gray-850/60 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            <div className={`p-2.5 rounded-xl ${
              activeSourceOption === "grid"
                ? "bg-teal-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}>
              <FileSpreadsheet size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Option 03
                </span>
                {gridRows.filter(r => r.email.trim()).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                    {gridRows.filter(r => r.email.trim()).length} Rows
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                Direct Spreadsheet Grid
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                Copy & paste directly from Excel or Google Sheets
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPTION 01 VIEW: Student Selection (From Database Registry) */}
      {/* ========================================================================= */}
      {activeSourceOption === "selection" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-150 dark:border-gray-800">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-teal-600" />
                <span>Option 01: Select Students from Database Registry</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Search, filter by batch or district, and select multiple students to register into all chosen Zoom webinars.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={fetchDbStudents}
                disabled={loadingDbStudents || isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                title="Refresh student list"
              >
                <RefreshCw size={13} className={loadingDbStudents ? "animate-spin text-teal-600" : ""} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleSelectAllFilteredStudents}
                disabled={isRunning || filteredDbStudents.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-lg transition-colors border border-teal-200 dark:border-teal-800 cursor-pointer"
              >
                <CheckSquare size={14} />
                <span>Select Filtered ({filteredDbStudents.filter(s => s.mail?.trim()).length})</span>
              </button>

              {selectedDbStudentIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAllStudents}
                  disabled={isRunning}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Square size={13} />
                  <span>Deselect All</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50/80 dark:bg-gray-850/60 p-3 rounded-xl border border-gray-200 dark:border-gray-750">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by PCA ID, Student Name, Email, Phone..."
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                disabled={isRunning}
                className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
              />
            </div>

            {/* Batch Filter */}
            <div>
              <select
                value={dbBatchFilter}
                onChange={(e) => setDbBatchFilter(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
              >
                <option value="all">All Batches ({uniqueBatches.length})</option>
                {uniqueBatches.map((b) => (
                  <option key={b} value={b}>
                    Batch: {b}
                  </option>
                ))}
              </select>
            </div>

            {/* District Filter */}
            <div>
              <select
                value={dbDistrictFilter}
                onChange={(e) => setDbDistrictFilter(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
              >
                <option value="all">All Districts ({uniqueDistricts.length})</option>
                {uniqueDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Valid email toggle */}
            <div className="md:col-span-4 flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={dbOnlyValidEmail}
                  onChange={(e) => setDbOnlyValidEmail(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold">Only show students with valid email address</span>
                <span className="text-[11px] text-gray-400">(Zoom requires email to register)</span>
              </label>

              <span className="font-bold text-teal-700 dark:text-teal-400">
                Showing {filteredDbStudents.length} of {dbStudents.length} student records
              </span>
            </div>
          </div>

          {/* Student Table */}
          <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-xl max-h-[420px] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-850 text-[10px] uppercase tracking-wider text-gray-500 font-black border-b border-gray-150 dark:border-gray-800 shadow-2xs">
                <tr>
                  <th className="p-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={handleToggleSelectAllFiltered}
                      disabled={loadingDbStudents || eligibleFilteredStudents.length === 0 || isRunning}
                      title={isAllFilteredSelected ? "Deselect all visible students" : "Select all visible students"}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600 disabled:opacity-40"
                    />
                  </th>
                  <th className="px-3 py-3">PCA ID</th>
                  <th className="px-3 py-3">Student Name</th>
                  <th className="px-3 py-3">Email Address (for Zoom)</th>
                  <th className="px-3 py-3">Batch</th>
                  <th className="px-3 py-3">District</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-xs">
                {loadingDbStudents ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin text-teal-600" />
                        <span>Loading students from registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDbStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      No students found matching your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredDbStudents.map((s) => {
                    const isSelected = selectedDbStudentIds.has(s.id);
                    const hasEmail = Boolean(s.mail && s.mail.trim());

                    return (
                      <tr
                        key={s.id}
                        onClick={() => hasEmail && !isRunning && toggleStudentSelection(s)}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-teal-50/80 dark:bg-teal-950/40"
                            : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                        } ${hasEmail ? "cursor-pointer" : "opacity-60 cursor-not-allowed bg-gray-50/20"}`}
                      >
                        <td className="p-3 text-center w-12" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!hasEmail || isRunning}
                            onChange={() => hasEmail && toggleStudentSelection(s)}
                            className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                          {s.pcaid || "-"}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                          <div className="font-bold">{s.name}</div>
                          {s.last_name && (
                            <div className="text-[10px] text-gray-400">{s.last_name}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          {hasEmail ? (
                            <span className="text-gray-800 dark:text-gray-200">{s.mail}</span>
                          ) : (
                            <span className="text-red-500 font-sans font-bold text-[10px] flex items-center gap-1">
                              <AlertCircle size={11} /> Missing Email
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                          {s.joined_batch || s.proper_batch || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                          {s.district || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Action Bar for Student Selection */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-150 dark:border-gray-800">
            <div className="text-xs text-gray-500 font-medium">
              {selectedDbStudentIds.size === 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  ⚠ Check students in the table above to proceed.
                </span>
              ) : selectedWebinars.length === 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  ⚠ Select at least 1 webinar in Step 1.
                </span>
              ) : (
                <span>
                  Will register <strong className="text-teal-600 dark:text-teal-400 font-black">{selectedDbStudentIds.size}</strong> student(s) across <strong className="text-teal-600 dark:text-teal-400 font-black">{selectedWebinars.length}</strong> webinar(s) (<strong className="text-teal-700 dark:text-teal-300">{selectedDbStudentIds.size * selectedWebinars.length}</strong> total registrations).
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleRegisterFromSelection}
              disabled={isRunning || selectedDbStudentIds.size === 0 || selectedWebinars.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Registering Selected Students...</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>REGISTER {selectedDbStudentIds.size} SELECTED STUDENTS ({selectedWebinars.length} WEBINARS)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION 02 VIEW: CSV Upload */}
      {/* ========================================================================= */}
      {activeSourceOption === "csv" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet size={16} className="text-teal-600" />
                    Option 02: Upload Student CSV File <span className="text-red-500">*</span>
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
                      Will register <strong className="text-teal-600 dark:text-teal-400 font-black">{students.length}</strong> students across <strong className="text-teal-600 dark:text-teal-400 font-black">{selectedWebinars.length}</strong> webinars (<strong className="text-teal-700 dark:text-teal-300">{students.length * selectedWebinars.length}</strong> total registrations).
                    </span>
                  ) : (
                    <span>Upload CSV to register students across {selectedWebinars.length} selected webinar(s).</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRegisterFromCsv}
                  disabled={isRunning || selectedWebinars.length === 0 || students.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Registering Across Webinars...
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      START CSV REGISTRATION ({students.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Info Column */}
          <div className="space-y-6">
            <div className="bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                <Sparkles size={16} className="text-teal-600" />
                CSV Bulk Import Tips
              </h3>
              <p className="text-xs text-teal-800/80 dark:text-teal-300/80 leading-relaxed">
                Upload student candidate CSVs to register them simultaneously across all webinars selected in Step 1.
              </p>
              <ul className="space-y-2 text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
                <li>• <strong>Email:</strong> Required column.</li>
                <li>• <strong>First & Last Name:</strong> Auto-matched to personalize Zoom invitations.</li>
                <li>• <strong>Batching:</strong> Processed in safe batches of 10 to prevent timeouts.</li>
              </ul>
              <button
                type="button"
                onClick={downloadTemplateCsv}
                className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer"
              >
                <Download size={13} />
                <span>Download Sample CSV Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION 03 VIEW: Direct Spreadsheet Entry Grid */}
      {/* ========================================================================= */}
      {activeSourceOption === "grid" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 dark:bg-teal-950/20 text-teal-650 dark:text-teal-400 rounded-xl">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-850 dark:text-gray-100 uppercase tracking-wider">
                  Option 03: Direct Spreadsheet Entry Grid
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

          {/* Excel-style spreadsheet grid table */}
          <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-850/50 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-550 font-black border-b border-gray-150 dark:border-gray-800">
                  <th className="px-3 py-2.5 text-center w-12 border-r border-gray-150 dark:border-gray-800">#</th>
                  <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800">First Name</th>
                  <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800">Last Name</th>
                  <th className="px-4 py-2.5 border-r border-gray-150 dark:border-gray-800">Email Address <span className="text-red-500">*</span></th>
                  <th className="px-3 py-2.5 text-center w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                {gridRows.map((row, index) => {
                  const hasEmail = row.email.trim() !== "";

                  return (
                    <tr 
                      key={index} 
                      className={`transition-colors hover:bg-gray-50/30 dark:hover:bg-gray-850/10 ${hasEmail ? 'bg-teal-50/5 dark:bg-teal-950/5' : ''}`}
                    >
                      <td className="px-3 py-1.5 text-center text-xs font-mono text-gray-400 dark:text-gray-550 border-r border-gray-150 dark:border-gray-800 font-bold bg-gray-50/40 dark:bg-gray-850/5 select-none">
                        {index + 1}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-150 dark:border-gray-800">
                        <input
                          type="text"
                          value={row.firstName}
                          onChange={(e) => handleGridCellChange(index, "firstName", e.target.value)}
                          onPaste={(e) => handleGridPaste(index, "firstName", e)}
                          placeholder="John"
                          disabled={isRunning}
                          className="w-full px-2 py-1.5 bg-transparent border-0 border-transparent focus:bg-teal-50/10 focus:ring-1 focus:ring-teal-500 rounded text-xs text-gray-800 dark:text-gray-200 font-medium placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-150 dark:border-gray-800">
                        <input
                          type="text"
                          value={row.lastName}
                          onChange={(e) => handleGridCellChange(index, "lastName", e.target.value)}
                          onPaste={(e) => handleGridPaste(index, "lastName", e)}
                          placeholder="Doe"
                          disabled={isRunning}
                          className="w-full px-2 py-1.5 bg-transparent border-0 border-transparent focus:bg-teal-50/10 focus:ring-1 focus:ring-teal-500 rounded text-xs text-gray-800 dark:text-gray-200 font-medium placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-150 dark:border-gray-800">
                        <input
                          type="email"
                          value={row.email}
                          onChange={(e) => handleGridCellChange(index, "email", e.target.value)}
                          onPaste={(e) => handleGridPaste(index, "email", e)}
                          placeholder="john.doe@gmail.com"
                          disabled={isRunning}
                          className="w-full px-2 py-1.5 bg-transparent border-0 border-transparent focus:bg-teal-50/10 focus:ring-1 focus:ring-teal-500 rounded text-xs text-gray-850 dark:text-gray-200 font-bold placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none transition-all disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleClearGridRow(index)}
                          disabled={isRunning || (!row.firstName && !row.lastName && !row.email)}
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
                disabled={isRunning}
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
                disabled={isRunning || selectedWebinars.length === 0 || gridRows.filter((r) => r.email.trim() !== "").length === 0}
                className="flex items-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Registering Grid...</span>
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
      )}

      {/* ========================================================================= */}
      {/* COMMON SECTION: Live Progress & Results (Applies to whichever option ran) */}
      {/* ========================================================================= */}
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
              onClick={() => downloadResults(filteredResults)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
            >
              <Download size={14} />
              <span>Export CSV Results</span>
            </button>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
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
  );
}
