// File location: /src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { 
  Home as HomeIcon, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Award,
  Sparkles,
  ArrowRight,
  Loader2,
  PieChart as PieIcon,
  Activity,
  UserCheck,
  Calendar,
  Wallet
} from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  PieChart as RechartsPieChart,
  Pie
} from "recharts";

interface DashboardStats {
  totalStudents: number;
  totalIncome: number;
  classIncome: number;
  packageIncome: number;
  activePaymentsCount: number;
  unresolvedIssues: number;
  studentsThisYear: number;
  studentsNextYear: number;
  studentsYearAfterNext: number;
}

interface MonthlyData {
  month: string;
  income: number;
  registrations: number;
}

interface StreamData {
  name: string;
  value: number;
}

interface DistrictData {
  name: string;
  value: number;
}

export default function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalIncome: 0,
    classIncome: 0,
    packageIncome: 0,
    activePaymentsCount: 0,
    unresolvedIssues: 0,
    studentsThisYear: 0,
    studentsNextYear: 0,
    studentsYearAfterNext: 0
  });

  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyData[]>([]);
  const [streamDistribution, setStreamDistribution] = useState<StreamData[]>([]);
  const [districtDistribution, setDistrictDistribution] = useState<DistrictData[]>([]);

  // Load real-time stats from Supabase using database-side aggregations and light client-side processing
  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        // 1. Get total students count
        const { count: studentCount, error: studentErr } = await supabase
          .from("student")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null);

        // 2. Get payments data to calculate total income and group by month
        const { data: payments, error: paymentErr } = await supabase
          .from("payment")
          .select("payment, paid_date, type")
          .is("deleted_at", null);

        // 3. Get unresolved issue tokens count
        const { count: issueCount, error: issueErr } = await supabase
          .from("issue")
          .select("*", { count: "exact", head: true })
          .eq("status", "Pending");

        // 4. Get student details for stream distribution (light query for streams and batches)
        const { data: studentDetails } = await supabase
          .from("student")
          .select("stream, created_at, joined_batch, district")
          .is("deleted_at", null);

        if (studentErr) console.warn("Error fetching students:", studentErr.message);
        if (paymentErr) console.warn("Error fetching payments:", paymentErr.message);

        // Process payments to get total income and monthly trend
        let totalIncome = 0;
        let classIncome = 0;
        let packageIncome = 0;
        const monthlyMap: Record<string, { income: number; regs: number }> = {};

        // Prepopulate past 5 months to ensure chart looks beautiful even with low data
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentYear = new Date().getFullYear();
        for (let i = 4; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthlyMap[key] = { income: 0, regs: 0 };
        }

        if (payments) {
          payments.forEach((p) => {
            const amt = Number(p.payment) || 0;
            totalIncome += amt;

            if (p.type === "package") {
              packageIncome += amt;
            } else if (p.type === "class") {
              classIncome += amt;
            }

            if (p.paid_date) {
              const dateObj = new Date(p.paid_date);
              if (!isNaN(dateObj.getTime())) {
                const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
                if (!monthlyMap[key]) {
                  monthlyMap[key] = { income: 0, regs: 0 };
                }
                monthlyMap[key].income += amt;
              }
            }
          });
        }

        // Process student registrations monthly trend
        if (studentDetails) {
          studentDetails.forEach((s) => {
            if (s.created_at) {
              const dateObj = new Date(s.created_at);
              if (!isNaN(dateObj.getTime())) {
                const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
                if (monthlyMap[key]) {
                  monthlyMap[key].regs += 1;
                }
              }
            }
          });
        }

        // Map monthly data to array sorted chronologically
        const sortedMonthlyData: MonthlyData[] = Object.keys(monthlyMap)
          .sort()
          .map((key) => {
            const [year, monthNum] = key.split("-");
            const label = `${monthNames[parseInt(monthNum, 10) - 1]} ${year.slice(-2)}`;
            return {
              month: label,
              income: monthlyMap[key].income,
              registrations: monthlyMap[key].regs
            };
          });

        setMonthlyTrend(sortedMonthlyData);

        // Process stream distribution
        const streamMap: Record<string, number> = {};
        if (studentDetails) {
          studentDetails.forEach((s) => {
            const stream = s.stream?.trim() || "Unassigned";
            streamMap[stream] = (streamMap[stream] || 0) + 1;
          });
        }

        const streamArr = Object.keys(streamMap).map((name) => ({
          name,
          value: streamMap[name]
        }));
        setStreamDistribution(streamArr.length > 0 ? streamArr : [{ name: "No Data", value: 0 }]);

        // Process district distribution
        const districtMap: Record<string, number> = {};
        if (studentDetails) {
          studentDetails.forEach((s) => {
            const dist = s.district?.trim() || "Unassigned";
            districtMap[dist] = (districtMap[dist] || 0) + 1;
          });
        }

        const districtArr = Object.keys(districtMap)
          .map((name) => ({
            name,
            value: districtMap[name]
          }))
          .sort((a, b) => b.value - a.value);
        setDistrictDistribution(districtArr.length > 0 ? districtArr : [{ name: "No Data", value: 0 }]);

        // Process batch calculations for 3 years based on current local time's year (2026)
        let studentsThisYear = 0;
        let studentsNextYear = 0;
        let studentsYearAfterNext = 0;

        const currentYearNum = new Date().getFullYear(); // 2026
        const thisYearStr = String(currentYearNum);
        const nextYearStr = String(currentYearNum + 1);
        const yearAfterNextStr = String(currentYearNum + 2);

        if (studentDetails) {
          studentDetails.forEach((s) => {
            const batch = s.joined_batch?.trim();
            if (batch === thisYearStr) {
              studentsThisYear++;
            } else if (batch === nextYearStr) {
              studentsNextYear++;
            } else if (batch === yearAfterNextStr) {
              studentsYearAfterNext++;
            }
          });
        }

        setStats({
          totalStudents: studentCount || 0,
          totalIncome: totalIncome,
          classIncome: classIncome,
          packageIncome: packageIncome,
          activePaymentsCount: payments?.length || 0,
          unresolvedIssues: issueCount || 0,
          studentsThisYear,
          studentsNextYear,
          studentsYearAfterNext
        });

      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "LKR",
      maximumFractionDigits: 0
    }).format(value);
  };

  const statCards = [
    {
      title: "Total Students",
      value: loading ? "..." : stats.totalStudents,
      description: "Registered portal students",
      icon: <Users size={18} className="text-teal-600 dark:text-teal-400" />,
      color: "from-teal-500/10 to-teal-500/5 dark:from-teal-500/20 dark:to-teal-500/5",
      border: "border-teal-100 dark:border-teal-900/40",
      badge: `${stats.totalStudents} Active`
    },
    {
      title: "Total Revenue",
      value: loading ? "..." : formatCurrency(stats.totalIncome),
      description: "Total payments collection",
      icon: <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />,
      color: "from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5",
      border: "border-emerald-100 dark:border-emerald-900/40",
      badge: `${stats.activePaymentsCount} Receipts`
    }
  ];

  const STREAM_COLORS = ["#0d9488", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];
  const DISTRICT_COLORS = [
    "#0d9488", // teal-600
    "#0ea5e9", // sky-500
    "#2563eb", // blue-600
    "#4f46e5", // indigo-600
    "#7c3aed", // violet-600
    "#c084fc", // purple-400
    "#db2777", // pink-600
    "#e11d48", // rose-600
    "#ea580c", // orange-600
    "#d97706", // amber-600
    "#16a34a", // green-600
    "#65a30d"  // lime-600
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Greeting */}
      <div className="mb-8 font-sans">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Welcome back{user?.username ? `, ${user.username}` : ''}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            className={`bg-white dark:bg-gray-900 rounded-2xl border ${stat.border} p-6 shadow-xs relative overflow-hidden group hover:shadow-md transition-all`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-30 dark:opacity-20 transition-opacity group-hover:opacity-40`} />

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest">
                    {stat.title}
                  </span>
                  <div className="p-2 bg-white dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-800 shadow-3xs">
                    {stat.icon}
                  </div>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    {stat.value}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {stat.badge}
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-450 mt-2.5 leading-relaxed">
                  {stat.description}
                </p>
              </div>

              {stat.title === "Total Students" && !loading && (
                <div className="mt-5 p-3.5 rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-850/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-2.5">
                    Batch Enrollment Breakdown
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900/40 rounded-lg p-2.5 shadow-3xs hover:shadow-2xs transition-all flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-teal-650 dark:text-teal-400 uppercase font-black tracking-wider block mb-1">{new Date().getFullYear()} Batch</span>
                      <span className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono leading-none">{stats.studentsThisYear}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-sky-100 dark:border-sky-900/40 rounded-lg p-2.5 shadow-3xs hover:shadow-2xs transition-all flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-sky-650 dark:text-sky-400 uppercase font-black tracking-wider block mb-1">{new Date().getFullYear() + 1} Batch</span>
                      <span className="text-xl font-black text-sky-600 dark:text-sky-400 font-mono leading-none">{stats.studentsNextYear}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/40 rounded-lg p-2.5 shadow-3xs hover:shadow-2xs transition-all flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-indigo-650 dark:text-indigo-400 uppercase font-black tracking-wider block mb-1">{new Date().getFullYear() + 2} Batch</span>
                      <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono leading-none">{stats.studentsYearAfterNext}</span>
                    </div>
                  </div>
                </div>
              )}

              {stat.title === "Total Revenue" && !loading && (
                <div className="mt-5 p-3.5 rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-850/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-2.5">
                    Revenue Stream Breakdown
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900/40 rounded-lg p-2.5 shadow-3xs hover:shadow-2xs transition-all flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-teal-650 dark:text-teal-400 uppercase font-black tracking-wider block mb-1">Class Fees</span>
                      <span className="text-sm sm:text-[15px] font-black text-teal-600 dark:text-teal-400 font-mono leading-none">{formatCurrency(stats.classIncome)}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-sky-100 dark:border-sky-900/40 rounded-lg p-2.5 shadow-3xs hover:shadow-2xs transition-all flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-sky-650 dark:text-sky-400 uppercase font-black tracking-wider block mb-1">Package Sales</span>
                      <span className="text-sm sm:text-[15px] font-black text-sky-600 dark:text-sky-400 font-mono leading-none">{formatCurrency(stats.packageIncome)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Income & Enrolment Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Revenue & Enrolment Trends
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Comparative analysis of payments received and student registrations.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-teal-600 rounded-xs inline-block"></span>Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-500 rounded-xs inline-block"></span>Registrations</span>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading charts...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="regColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px'
                    }} 
                  />
                  <Area type="monotone" name="Revenue (LKR)" dataKey="income" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#incomeColor)" />
                  <Area type="monotone" name="New Students" dataKey="registrations" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#regColor)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Stream Breakdown Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              Stream Distribution
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
              Distribution of enrolled students across different study streams.
            </p>
          </div>

          <div className="h-48 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading streams...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={streamDistribution} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#94a3b8', fontSize: 9 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 9 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px'
                    }} 
                  />
                  <Bar dataKey="value" name="Students">
                    {streamDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STREAM_COLORS[index % STREAM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            {streamDistribution.slice(0, 4).map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: STREAM_COLORS[index % STREAM_COLORS.length] }}></span>
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate max-w-[100px]" title={item.name}>
                  {item.name}: <strong>{item.value}</strong>
                </span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              District Distribution
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
              Geographical distribution of registered students across Sri Lankan districts.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16 py-6">
            <div className="h-80 w-80 relative flex-shrink-0">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  <Loader2 size={18} className="animate-spin mr-2" /> Loading districts...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={districtDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {districtDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DISTRICT_COLORS[index % DISTRICT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '11px'
                      }}
                      formatter={(value, name) => [`${value} students`, name]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
              {!loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalStudents}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Students</span>
                </div>
              )}
            </div>

            {/* Responsive, Scrollable Custom Legend Outside the Pie Chart */}
            {!loading && districtDistribution.length > 0 && (
              <div className="flex-1 max-w-xl w-full">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-x-6 gap-y-3 max-h-[280px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                  {districtDistribution.map((entry, index) => (
                    <div 
                      key={entry.name} 
                      className="flex items-center gap-2.5 text-xs py-1.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                    >
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                        style={{ backgroundColor: DISTRICT_COLORS[index % DISTRICT_COLORS.length] }} 
                      />
                      <span className="font-semibold text-gray-650 dark:text-gray-400 truncate" title={entry.name}>
                        {entry.name}
                      </span>
                      <span className="font-extrabold text-gray-900 dark:text-white ml-auto font-mono bg-gray-50 dark:bg-gray-850 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-800/60 text-[11px]">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
