// File location: /src/pages/RegisterStudents.tsx
import React, { useState, useRef } from "react";
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
  Filter,
  Plus,
  RotateCcw,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const BATCH_SIZE = 10; // how many students to send to Zoom per batch

interface Student {
  firstName: string;
  lastName: string;
  email: string;
}

interface RegistrationResult {
  firstName?: string;
  lastName?: string;
  email: string;
  status: "Success" | "Failed";
  joinUrl?: string;
  error?: string;
}

interface CsvRow {
  [key: string]: string;
}

export default function RegisterStudents() {
  const [webinarId, setWebinarId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<RegistrationResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "success" | "failed">("all");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grid interactive spreadsheet state
  const [gridRows, setGridRows] = useState<Student[]>(() =>
    Array.from({ length: 10 }, () => ({ firstName: "", lastName: "", email: "" }))
  );
  const [gridResults, setGridResults] = useState<RegistrationResult[]>([]);
  const [isGridRunning, setIsGridRunning] = useState<boolean>(false);
  const [gridProgress, setGridProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // Normalize column names to map standard fields
  const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");

  const processCsvData = (rawData: CsvRow[], headers: string[]) => {
    // Find matching headers case-insensitively and ignoring punctuation
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
          lastName: lastVal,
          email: emailVal,
        };
      })
      .filter((s) => s.email !== ""); // Filter out empty email rows

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

  // Split students into batches and register
  async function runRegistrationPipeline(targetStudents: Student[], isGrid: boolean = false) {
    const cleanWebinarId = webinarId.trim();
    if (!cleanWebinarId) {
      toast.error("Please enter a valid Zoom Webinar ID.");
      return;
    }
    if (targetStudents.length === 0) {
      toast.error("No student records found to register.");
      return;
    }

    const setRunningState = isGrid ? setIsGridRunning : setIsRunning;
    const setResultsState = isGrid ? setGridResults : setResults;
    const setProgressState = isGrid ? setGridProgress : setProgress;

    setRunningState(true);
    setResultsState([]);
    setProgressState({ done: 0, total: targetStudents.length });

    const allResults: RegistrationResult[] = [];

    for (let i = 0; i < targetStudents.length; i += BATCH_SIZE) {
      const batch = targetStudents.slice(i, i + BATCH_SIZE);

      try {
        const response = await fetch("/api/register-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: batch, webinarId: cleanWebinarId }),
        });

        let data: any;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          if (text.includes("<!DOCTYPE html") || response.status === 404) {
            throw new Error("API endpoint not active in local dev server. Vercel Serverless Functions only run on Vercel deployments. Configure your Zoom environment variables in Vercel and deploy to test!");
          }
          throw new Error(`Invalid server response: ${response.statusText || response.status}`);
        }

        if (response.ok && data.results) {
          const mappedResults = (data.results as RegistrationResult[]).map((res) => {
            const matchedStudent = batch.find(s => s.email.toLowerCase() === res.email.toLowerCase());
            return {
              ...res,
              firstName: matchedStudent?.firstName || "",
              lastName: matchedStudent?.lastName || "",
            };
          });
          allResults.push(...mappedResults);
        } else {
          // If the whole batch API endpoint failed
          batch.forEach((s) =>
            allResults.push({ 
              firstName: s.firstName,
              lastName: s.lastName,
              email: s.email, 
              status: "Failed", 
              error: data.error || "Webinar registration batch failure" 
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
            status: "Failed", 
            error: message 
          })
        );
      }

      setResultsState([...allResults]);
      setProgressState({ done: Math.min(i + BATCH_SIZE, targetStudents.length), total: targetStudents.length });
    }

    setRunningState(false);
    toast.success("Webinar registration finished!");
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

  // Copy entire filled spreadsheet grid to clipboard in Excel-friendly format (TSV)
  const copyGridDataToClipboard = () => {
    const filledRows = gridRows.filter(
      (row) => row.firstName.trim() !== "" || row.lastName.trim() !== "" || row.email.trim() !== ""
    );

    if (filledRows.length === 0) {
      toast.error("Spreadsheet grid is currently empty. Nothing to copy.");
      return;
    }

    // Generate Tab-Separated Values (TSV) which Excel/Sheets recognizes as distinct cells
    const headers = ["First Name", "Last Name", "Email"];
    const tsvLines = [
      headers.join("\t"),
      ...filledRows.map((row) => `${row.firstName.trim()}\t${row.lastName.trim()}\t${row.email.trim()}`)
    ];

    const tsvString = tsvLines.join("\n");

    navigator.clipboard.writeText(tsvString)
      .then(() => {
        toast.success(`Copied ${filledRows.length} rows to clipboard! Ready to paste into Excel/Sheets/CSV.`);
      })
      .catch((err) => {
        console.error("Failed to copy grid data", err);
        toast.error("Failed to copy grid data to clipboard.");
      });
  };

  // Multi-cell paste handler for Excel-style clipboard injection
  const handleGridPaste = (rowIndex: number, field: keyof Student, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    // Split into lines
    const lines = pastedText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return;

    // Detect if paste format looks like tabular CSV or TSV, or single line multicell
    const parsedGrid: string[][] = lines.map((line) => {
      if (line.includes("\t")) {
        return line.split("\t");
      } else if (line.includes(",")) {
        // Simple CSV splitter
        return line.split(",");
      } else {
        return [line];
      }
    });

    // Check if the first row is a header row and skip it
    let hasHeader = false;
    if (parsedGrid.length > 0) {
      const firstRow = parsedGrid[0];
      const headerKeywords = ["email", "first name", "last name", "first_name", "last_name", "email address", "email_address"];
      
      if (firstRow.length > 1) {
        hasHeader = firstRow.some((cell) => {
          const val = cell.toLowerCase().trim();
          return headerKeywords.some((keyword) => val === keyword || val.includes("name") || val === "email");
        });
      } else if (parsedGrid.length > 1) {
        const val = firstRow[0].toLowerCase().trim();
        hasHeader = ["email", "first name", "last name", "name", "email address"].includes(val);
      }
    }

    const rowsToPaste = hasHeader ? parsedGrid.slice(1) : parsedGrid;
    if (rowsToPaste.length === 0) return;

    // Intercept default pasting as we will programmatic-populate cells
    e.preventDefault();

    // Mapping fields to columns: firstName=0, lastName=1, email=2
    const startColIndex = field === "firstName" ? 0 : field === "lastName" ? 1 : 2;

    setGridRows((prev) => {
      const updated = [...prev];
      rowsToPaste.forEach((rowCells, rOffset) => {
        const targetRowIdx = rowIndex + rOffset;
        if (targetRowIdx < updated.length) {
          const targetRowObj = { ...updated[targetRowIdx] };
          rowCells.forEach((cellVal, cOffset) => {
            const targetColIdx = startColIndex + cOffset;
            const cleanVal = cellVal.trim();
            if (targetColIdx === 0) {
              targetRowObj.firstName = cleanVal;
            } else if (targetColIdx === 1) {
              targetRowObj.lastName = cleanVal;
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
        lastName: row.lastName.trim(),
        email: row.email.trim(),
      }))
      .filter((row) => row.email !== "");

    if (activeGridStudents.length === 0) {
      toast.error("Please fill in at least one student's Email in the spreadsheet grid.");
      return;
    }

    await runRegistrationPipeline(activeGridStudents, true);
  };

  // Download results as a CSV
  function downloadResults() {
    const csv = Papa.unparse(
      results.map((r) => ({
        "First Name": r.firstName || "",
        "Last Name": r.lastName || "",
        Email: r.email,
        Status: r.status,
        "Join URL": r.joinUrl || "",
        Error: r.error || "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zoom_registration_results_${webinarId || "webinar"}.csv`;
    link.click();
    toast.success("Results CSV downloaded successfully");
  }

  // Download grid results as a CSV
  function downloadGridResults() {
    if (gridResults.length === 0) {
      toast.error("No spreadsheet grid registration results to download yet.");
      return;
    }
    const csv = Papa.unparse(
      gridResults.map((r) => ({
        "First Name": r.firstName || "",
        "Last Name": r.lastName || "",
        Email: r.email,
        Status: r.status,
        "Join URL": r.joinUrl || "",
        Error: r.error || "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zoom_spreadsheet_results_${webinarId || "webinar"}.csv`;
    link.click();
    toast.success("Spreadsheet results CSV downloaded successfully");
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

  const successCount = results.filter((r) => r.status === "Success").length;
  const failCount = results.filter((r) => r.status === "Failed").length;

  const filteredResults = results.filter((r) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = r.email.toLowerCase().includes(query) || 
      (r.firstName && r.firstName.toLowerCase().includes(query)) ||
      (r.lastName && r.lastName.toLowerCase().includes(query)) ||
      (r.error && r.error.toLowerCase().includes(query));
    
    if (filterTab === "success") return matchesSearch && r.status === "Success";
    if (filterTab === "failed") return matchesSearch && r.status === "Failed";
    return matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column - Form details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm">
            
            {/* Step 1: Webinar / Meeting ID Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Video size={16} className="text-teal-600" />
                Zoom Webinar / Meeting ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={webinarId}
                  onChange={(e) => setWebinarId(e.target.value)}
                  placeholder="e.g., 86249455017"
                  disabled={isRunning}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-gray-200 font-medium text-sm transition-all"
                />
              </div>
            </div>

            {/* Step 2: Drag and drop File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <FileSpreadsheet size={16} className="text-teal-600" />
                Upload Student CSV <span className="text-red-500">*</span>
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
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Run Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={startRegistration}
                disabled={isRunning || !webinarId || students.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registering Batch...
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    Start Registration ({students.length})
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Progress Section */}
          {(isRunning || progress.done > 0) && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  {isRunning ? (
                    <Loader2 size={16} className="animate-spin text-teal-600" />
                  ) : (
                    <CheckCircle2 size={16} className="text-green-500" />
                  )}
                  {isRunning ? "Processing Registration" : "Registration Complete"}
                </span>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                  {Math.round((progress.done / progress.total) * 100)}% ({progress.done}/{progress.total})
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>

              {results.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800/60">
                    <p className="text-xs text-gray-400 font-semibold uppercase">Total</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-1">{progress.total}</p>
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-950/10 rounded-xl p-3 border border-green-100/40 dark:border-green-900/20">
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase">Success</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">{successCount}</p>
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-950/10 rounded-xl p-3 border border-red-100/40 dark:border-red-900/20">
                    <p className="text-xs text-red-500 dark:text-red-400 font-semibold uppercase">Failed</p>
                    <p className="text-lg font-bold text-red-500 dark:text-red-400 mt-1">{failCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Table Section */}
          {results.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">Registration logs</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Details of Zoom webinar registrations</p>
                </div>
                <button
                  onClick={downloadResults}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900 font-semibold rounded-lg text-xs transition-colors self-start sm:self-auto"
                >
                  <Download size={14} />
                  Download CSV
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs by email..."
                    className="w-full pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="flex gap-1 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-1 text-xs self-start">
                  <button
                    onClick={() => setFilterTab("all")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterTab === "all"
                        ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold shadow-xs"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    All ({results.length})
                  </button>
                  <button
                    onClick={() => setFilterTab("success")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterTab === "success"
                        ? "bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 font-semibold shadow-xs"
                        : "text-gray-500 hover:text-green-600 dark:hover:text-green-400"
                    }`}
                  >
                    Success ({successCount})
                  </button>
                  <button
                    onClick={() => setFilterTab("failed")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterTab === "failed"
                        ? "bg-white dark:bg-gray-700 text-red-500 dark:text-red-400 font-semibold shadow-xs"
                        : "text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                    }`}
                  >
                    Failed ({failCount})
                  </button>
                </div>
              </div>

              {/* logs list */}
              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 dark:border-gray-800">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email Address</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reference / Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                          No registration logs found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 truncate max-w-[150px]">
                            {r.firstName || r.lastName ? `${r.firstName || ""} ${r.lastName || ""}`.trim() : "-"}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]" title={r.email}>
                            {r.email}
                          </td>
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={r.joinUrl || r.error}>
                            {r.status === "Success" ? (
                              <a
                                href={r.joinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-teal-600 hover:underline dark:text-teal-400 font-medium"
                              >
                                Join URL
                              </a>
                            ) : (
                              <span className="text-red-500 dark:text-red-450">{r.error || "Unknown Error"}</span>
                            )}
                          </td>
                        </tr>
                      ))
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
          <div className="bg-teal-50/30 dark:bg-teal-950/10 border border-teal-100/50 dark:border-teal-900/30 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mb-1.5">
              <AlertCircle size={16} />
              Setup Guide
            </h3>
            <p className="text-xs text-teal-700/80 dark:text-teal-400/80 mb-4 leading-relaxed">
              Upload a student list CSV to register candidates on Zoom Webinars or Meetings in controlled batches.
            </p>
            <ul className="space-y-2.5 text-xs text-teal-700/90 dark:text-teal-400/90 leading-relaxed">
              <li>
                <strong>1. Required Columns:</strong> Your CSV file must contain at least an <span className="underline">Email</span> column.
              </li>
              <li>
                <strong>2. Optional Columns:</strong> Columns like <span className="underline">First Name</span> and <span className="underline">Last Name</span> are automatically detected to enrich registrants.
              </li>
              <li>
                <strong>3. Rate limits:</strong> The process is bundled in batches of 10 students with real-time status updates to prevent request timeouts on Vercel.
              </li>
            </ul>

            <div className="mt-5 pt-4 border-t border-teal-200/45 dark:border-teal-900/30">
              <p className="text-xs text-teal-800 dark:text-teal-400 font-semibold mb-2 flex items-center gap-1">
                <FileSpreadsheet size={14} className="text-teal-600" />
                Template CSV File
              </p>
              <p className="text-[11px] text-teal-700/80 dark:text-teal-500/90 mb-3 leading-relaxed">
                Download our recommended template containing predefined columns for quick, trouble-free bulk importing.
              </p>
              <button
                type="button"
                onClick={downloadTemplateCsv}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-900/50 dark:hover:bg-teal-900/80 text-white dark:text-teal-300 font-semibold rounded-lg text-xs shadow-xs transition-all"
              >
                <Download size={13} />
                Download Template CSV
              </button>
            </div>
          </div>

          {/* Parsed Preview Card */}
          {students.length > 0 && !isRunning && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">CSV Data Preview</h3>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-650 dark:text-gray-300 rounded text-[10px] font-bold">
                  {students.length} record(s)
                </span>
              </div>
              <div className="space-y-3">
                {students.slice(0, 3).map((student, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-850 p-3 rounded-lg border border-gray-100 dark:border-gray-800 text-xs">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {student.firstName || "(No First)"} {student.lastName || "(No Last)"}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 mt-0.5 truncate">{student.email}</p>
                  </div>
                ))}
                {students.length > 3 && (
                  <p className="text-[11px] text-gray-400 text-center italic pt-1">
                    ...and {students.length - 3} more student(s) loaded
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Option 2: Direct Spreadsheet Entry (Excel-style, Full Width) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/20 text-teal-650 dark:text-teal-400 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-850 dark:text-gray-100 uppercase tracking-wider">Option 2: Direct Spreadsheet Entry</h3>
              <p className="text-xs text-gray-450 dark:text-gray-500 mt-1">
                Directly input student details. Exactly 10 rows. Rows with blank emails will be skipped.
              </p>
              <p className="text-[11px] text-teal-650 dark:text-teal-400 font-semibold mt-1 flex items-center gap-1">
                <span>💡</span> Copy/paste rows directly from Excel or Google Sheets (or any CSV text) into the cells below.
              </p>
            </div>
          </div>
          
          {/* Webinar / Meeting ID input right in Option 2 */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 min-w-[280px]">
            <Video size={16} className="text-teal-650" />
            <input
              type="text"
              value={webinarId}
              onChange={(e) => setWebinarId(e.target.value)}
              placeholder="Webinar / Meeting ID, e.g., 86249455017"
              disabled={isGridRunning}
              className="w-full bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Grid Progress / Results Summary banner */}
        {(isGridRunning || gridResults.length > 0) && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
              <span className="text-xs font-bold text-gray-850 dark:text-gray-200 flex items-center gap-2">
                {isGridRunning ? (
                  <Loader2 size={14} className="animate-spin text-teal-600" />
                ) : (
                  <CheckCircle2 size={14} className="text-green-500" />
                )}
                {isGridRunning ? "Spreadsheet Registration Progress" : "Spreadsheet Registration Completed"}
              </span>
              <span className="text-[11px] font-mono font-bold text-teal-650 dark:text-teal-400">
                {gridProgress.done}/{gridProgress.total} processed
              </span>
            </div>
            
            {/* Progress bar */}
            {isGridRunning && (
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden mb-3">
                <div 
                  className="bg-teal-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(gridProgress.done / gridProgress.total) * 100}%` }}
                />
              </div>
            )}

            {gridResults.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap gap-4 text-xs font-bold">
                  <span className="text-gray-400 dark:text-gray-500">Summary:</span>
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
                  onClick={downloadGridResults}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white dark:bg-gray-100 dark:hover:bg-gray-250 dark:text-gray-900 font-bold rounded-lg text-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Download size={13} />
                  Download CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* Excel-style spreadsheet grid table */}
        <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-xl mb-4">
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
                const rowResult = hasEmail ? gridResults.find(r => r.email.toLowerCase().trim() === row.email.toLowerCase().trim()) : null;
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
                        rowResult ? (
                          rowResult.status === "Success" ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-650 dark:text-green-400">
                                <CheckCircle2 size={12} className="text-green-500" /> Registered
                              </span>
                              {rowResult.joinUrl && (
                                <a
                                  href={rowResult.joinUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] text-teal-600 hover:underline font-bold mt-0.5 truncate max-w-[130px] inline-flex items-center gap-0.5"
                                  title={rowResult.joinUrl}
                                >
                                  Join URL
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 dark:text-red-400" title={rowResult.error}>
                                <XCircle size={12} className="text-red-500" /> Failed
                              </span>
                              {rowResult.error && (
                                <span className="text-[9px] text-red-400 truncate max-w-[130px] font-medium mt-0.5" title={rowResult.error}>
                                  {rowResult.error}
                                </span>
                              )}
                            </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 pt-2 border-t border-gray-100 dark:border-gray-800">
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
              title="Copy spreadsheet grid rows to clipboard for Excel/Sheets pasting"
            >
              <Copy size={13} />
              Copy Grid Data
            </button>
            {gridResults.length > 0 && (
              <button
                type="button"
                onClick={downloadGridResults}
                disabled={isGridRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border border-teal-100/50 dark:border-teal-900/10 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Download size={13} />
                Download Results CSV
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-550">
              {gridRows.filter((r) => r.email.trim() !== "").length} of 10 rows filled
            </span>

            <button
              type="button"
              onClick={handleRegisterFromGrid}
              disabled={isGridRunning || !webinarId || gridRows.filter((r) => r.email.trim() !== "").length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGridRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  <span>REGISTER FROM GRID</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
