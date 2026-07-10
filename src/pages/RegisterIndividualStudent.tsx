// File location: /src/pages/RegisterIndividualStudent.tsx
import React, { useState } from "react";
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
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RegistrationResult {
  email: string;
  status: "Success" | "Failed";
  joinUrl?: string;
  error?: string;
}

export default function RegisterIndividualStudent() {
  const [webinarId, setWebinarId] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Join URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy URL");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanWebinarId = webinarId.trim();
    const cleanEmail = email.trim();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanWebinarId) {
      toast.error("Please enter a valid Zoom Webinar ID.");
      return;
    }
    if (!cleanFirstName || !cleanLastName) {
      toast.error("Please enter first and last names.");
      return;
    }
    if (!cleanEmail) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/register-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          webinarId: cleanWebinarId,
          students: [
            {
              firstName: cleanFirstName,
              lastName: cleanLastName,
              email: cleanEmail
            }
          ] 
        }),
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

      if (response.ok && data.results && data.results.length > 0) {
        const resObj = data.results[0] as RegistrationResult;
        setResult(resObj);
        if (resObj.status === "Success") {
          toast.success("Student successfully registered on Zoom!");
          // Optional: clear inputs except Webinar ID
          setFirstName("");
          setLastName("");
          setEmail("");
        } else {
          toast.error(resObj.error || "Zoom registration failed.");
        }
      } else {
        throw new Error(data.error || "Webinar registration failure");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown registration error";
      setResult({
        email: cleanEmail,
        status: "Failed",
        error: message
      });
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-sm"
          >
            <form onSubmit={handleRegister} className="space-y-6">
              
              {/* Webinar ID Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Video size={16} className="text-teal-600" />
                  Zoom Webinar ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={webinarId}
                  onChange={(e) => setWebinarId(e.target.value)}
                  placeholder="e.g., 86249455017"
                  disabled={isRunning}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-850 dark:text-gray-200 font-medium text-sm transition-all"
                />
              </div>

              {/* Name Fields (Grid layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <User size={16} className="text-teal-600" />
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    disabled={isRunning}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-850 dark:text-gray-200 font-medium text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <User size={16} className="text-teal-600" />
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    disabled={isRunning}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-855 dark:text-gray-200 font-medium text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Mail size={16} className="text-teal-600" />
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                  disabled={isRunning}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-850 dark:text-gray-200 font-medium text-sm transition-all"
                />
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isRunning || !webinarId || !firstName || !lastName || !email}
                  className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Registering student...
                    </>
                  ) : (
                    <>
                      <span>Register Now</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

            </form>
          </motion.div>

          {/* Registration Result Card */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  {result.status === "Success" ? (
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-xl">
                      <CheckCircle2 size={24} />
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-xl">
                      <XCircle size={24} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      {result.status === "Success" ? "Registration Successful" : "Registration Failed"}
                      {result.status === "Success" && (
                        <Sparkles size={16} className="text-amber-500 animate-pulse" />
                      )}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Result log for student: <span className="font-semibold text-gray-750 dark:text-gray-300">{result.email}</span>
                    </p>

                    {result.status === "Success" && result.joinUrl ? (
                      <div className="mt-5 space-y-3">
                        <p className="text-xs font-semibold text-gray-655 dark:text-gray-400">
                          Student Join URL:
                        </p>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-lg border border-gray-150 dark:border-gray-800">
                          <span className="text-xs font-mono text-teal-600 dark:text-teal-400 truncate flex-1 select-all">
                            {result.joinUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => result.joinUrl && handleCopy(result.joinUrl)}
                            className="p-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-md border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                            title="Copy link"
                          >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400 italic">
                          Share this unique link with the student so they can directly join the webinar.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 bg-red-50/50 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/10 rounded-lg p-3 text-xs text-red-600 dark:text-red-400">
                        <strong>Error details:</strong> {result.error || "Unknown Error Response from Zoom"}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Info Column */}
        <div className="space-y-6">
          <div className="bg-teal-50/30 dark:bg-teal-950/10 border border-teal-100/50 dark:border-teal-900/30 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mb-1.5">
              <AlertCircle size={16} />
              Setup Info
            </h3>
            <p className="text-xs text-teal-700/80 dark:text-teal-400/80 mb-4 leading-relaxed">
              Quickly register an individual student for a specific Zoom Webinar.
            </p>
            <ul className="space-y-3 text-xs text-teal-700/90 dark:text-teal-400/90 leading-relaxed">
              <li>
                <strong>Webinar ID:</strong> Find this ID in your Zoom Web portal under the list of scheduled Webinars.
              </li>
              <li>
                <strong>Verification:</strong> Zoom requires first name, last name, and a valid email structure for student candidate creation.
              </li>
              <li>
                <strong>Immediate Link:</strong> Successful individual registration yields the distinct Join Link instantly. You can copy and send it directly to the student!
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
