import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { Project, User } from '@/types/schema';
import { motion } from 'framer-motion';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, subMonths, startOfYear, subYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar, TrendingUp, Users, FolderOpen, Activity, Shield } from 'lucide-react';

interface AdminOverviewGraphsProps {
    projects: Project[];
    users: User[];
}

type TimeRange = 'Day' | 'Week' | 'Month' | 'Year';

export function AdminOverviewGraphs({ projects, users }: AdminOverviewGraphsProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('Week');

    const chartData = useMemo(() => {
        const now = new Date();
        let periods = 7;
        let getStartOfPeriod: (date: Date) => Date;
        let getFormatString: string;
        let getSubPeriod: (date: Date, amount: number) => Date;

        switch (timeRange) {
            case 'Day':
                periods = 24;
                getStartOfPeriod = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
                getFormatString = 'HH:00';
                getSubPeriod = (date, amount) => new Date(date.getTime() - amount * 60 * 60 * 1000);
                break;
            case 'Week':
                periods = 7;
                getStartOfPeriod = startOfDay;
                getFormatString = 'EEE';
                getSubPeriod = subDays;
                break;
            case 'Month':
                periods = 30;
                getStartOfPeriod = startOfDay;
                getFormatString = 'dd MMM';
                getSubPeriod = subDays;
                break;
            case 'Year':
                periods = 12;
                getStartOfPeriod = startOfMonth;
                getFormatString = 'MMM yyyy';
                getSubPeriod = subMonths;
                break;
        }

        const dataPoints = Array.from({ length: periods }).map((_, i) => {
            const date = getSubPeriod(now, periods - 1 - i);
            return {
                timestamp: getStartOfPeriod(date).getTime(),
                display: format(date, getFormatString),
                revenue: 0,
                completedProjects: 0,
                newClients: 0,
                newTeam: 0,
            };
        });

        // Fill Revenue & Projects
        projects.forEach(project => {
            if (!project.createdAt) return;
            const projectDate = new Date(project.createdAt);
            
            // Find appropriate bucket
            const bucket = dataPoints.find((dp, index) => {
                const nextDpTimestamp = index < dataPoints.length - 1 ? dataPoints[index + 1].timestamp : Infinity;
                return projectDate.getTime() >= dp.timestamp && projectDate.getTime() < nextDpTimestamp;
            });

            if (bucket) {
                bucket.revenue += (project.amountPaid || 0);
                if (project.status === 'completed') {
                    bucket.completedProjects += 1;
                }
            }
        });

        // Fill Clients & Team
        users.forEach(user => {
            if (!user.createdAt) return;
            const userDate = new Date(user.createdAt);
            
            const bucket = dataPoints.find((dp, index) => {
                const nextDpTimestamp = index < dataPoints.length - 1 ? dataPoints[index + 1].timestamp : Infinity;
                return userDate.getTime() >= dp.timestamp && userDate.getTime() < nextDpTimestamp;
            });

            if (bucket) {
                if (user.role === 'client') {
                    bucket.newClients += 1;
                } else if (['admin', 'project_manager', 'editor', 'sales_executive'].includes(user.role)) {
                    bucket.newTeam += 1;
                }
            }
        });

        return dataPoints;
    }, [projects, users, timeRange]);

    const totalRevenue = chartData.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalCompleted = chartData.reduce((acc, curr) => acc + curr.completedProjects, 0);
    const totalClients = chartData.reduce((acc, curr) => acc + curr.newClients, 0);
    const totalTeam = chartData.reduce((acc, curr) => acc + curr.newTeam, 0);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1a1d24]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl space-y-3">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-white/10 pb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-[10px] uppercase font-bold text-zinc-300 tracking-wider flex items-center gap-2">
                                    {entry.name}
                                </span>
                            </div>
                            <span className="text-[12px] font-bold tabular-nums text-white">
                                {entry.name === 'Revenue' ? `₹${entry.value.toLocaleString()}` : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-primary/10 border border-primary/20">
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Advanced Analytics</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Velocity & Growth Metrics</p>
                    </div>
                </div>
                
                <div className="flex bg-muted/50 border border-border rounded-lg p-1">
                    {(['Day', 'Week', 'Month', 'Year'] as TimeRange[]).map(r => (
                        <button
                            key={r}
                            onClick={() => setTimeRange(r)}
                            className={cn(
                                "px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded transition-all flex items-center gap-1.5",
                                timeRange === r 
                                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(255,255,255,0.1)]" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                            )}
                        >
                            <Calendar className="h-3 w-3" />
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 enterprise-card bg-[#161920]/60 p-6 flex flex-col h-[500px] relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-colors" />
                    
                    <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
                        <div>
                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <Activity className="h-3 w-3 text-primary" />
                                Revenue Trajectory
                            </div>
                            <div className="text-3xl font-heading font-black tracking-tighter text-white tabular-nums">
                                ₹{totalRevenue.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 relative z-10 w-full h-full -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fff" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="display" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={(val) => `₹${val}`}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    name="Revenue"
                                    stroke="#ffffff" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorRevenue)" 
                                    activeDot={{ r: 6, fill: '#fff', stroke: '#000', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <div className="flex flex-col gap-6 lg:h-[500px]">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex-1 enterprise-card bg-[#161920]/60 p-6 flex flex-col relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] rounded-full pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
                            <div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <FolderOpen className="h-3 w-3 text-emerald-500" />
                                    Completed Projects
                                </div>
                                <div className="text-2xl font-heading font-black tracking-tighter text-white tabular-nums">
                                    {totalCompleted}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 relative z-10 w-full h-full -ml-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="display" hide />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                    <Bar dataKey="completedProjects" name="Completed" fill="url(#colorProjects)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex-1 enterprise-card bg-[#161920]/60 p-6 flex flex-col relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
                        <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
                            <div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Users className="h-3 w-3 text-blue-500" />
                                    New Clients
                                </div>
                                <div className="text-2xl font-heading font-black tracking-tighter text-white tabular-nums">
                                    {totalClients}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 relative z-10 w-full h-full -ml-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="display" hide />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area type="monotone" dataKey="newClients" name="Clients" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorClients)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex-1 enterprise-card bg-[#161920]/60 p-6 flex flex-col relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[40px] rounded-full pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
                        <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
                            <div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Shield className="h-3 w-3 text-purple-500" />
                                    Team & Editors
                                </div>
                                <div className="text-2xl font-heading font-black tracking-tighter text-white tabular-nums">
                                    {totalTeam}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 relative z-10 w-full h-full -ml-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTeam" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="display" hide />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area type="monotone" dataKey="newTeam" name="Team Members" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorTeam)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

// Ensure you have an Activity icon imported if it isn't already.
// Note: I added Activity to the import at the top, but you need to make sure the lucide-react import holds it. 
