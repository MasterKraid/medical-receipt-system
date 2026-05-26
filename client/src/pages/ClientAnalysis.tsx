import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import PageHeader from '../components/PageHeader';

interface ClientStats {
  total_orders: number;
  total_spend: number;
  total_savings: number;
  wallet_balance: number;
}

interface TrendMonth {
  month: string;
  count: number;
  spend: number;
}

interface TopTest {
  package_name: string;
  count: number;
}

const ClientAnalysis: React.FC = () => {
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [trend, setTrend] = useState<TrendMonth[]>([]);
  const [topTests, setTopTests] = useState<TopTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const data = await apiService.getClientAnalysis();
        setStats(data.stats);
        setTrend(data.trend);
        setTopTests(data.topTests);
      } catch (err) {
        console.error('Failed to load B2B client analysis', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, []);

  const formatMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };

  // SVG Chart Dimensions & Computations
  const chartHeight = 160;
  const chartWidth = 500;
  const maxSpend = trend.length > 0 ? Math.max(...trend.map((t) => t.spend), 1000) : 1000;

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <PageHeader title="Performance Analysis" showActingAs={false} />

        {/* Period Information Bar */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
          <h3 className="m-0 text-sm font-bold text-slate-700 leading-tight">B2B Franchise Business Insights</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
            Refreshes in real-time on receipt generation
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <i className="fa-solid fa-chart-line fa-beat text-3xl text-indigo-650"></i>
            <span className="text-xs font-bold uppercase tracking-widest italic animate-pulse">
              Aggregating business volume metrics...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Wallet Balance */}
              <div className="bg-indigo-50 border border-indigo-150 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group shadow-sm hover:scale-[1.01] transition-transform duration-200">
                <div className="absolute right-3 top-3 opacity-15 text-indigo-600 group-hover:scale-110 transition-transform duration-200">
                  <i className="fa-solid fa-wallet text-3xl"></i>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none mb-2 block">
                  Wallet Balance
                </span>
                <span className="text-2xl font-black text-indigo-900 leading-tight">
                  ₹{(stats?.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <div className="text-[9px] font-semibold text-indigo-500 leading-none mt-3">
                  Outstanding account funds available
                </div>
              </div>

              {/* Card 2: Total Referral Spend */}
              <div className="bg-blue-50 border border-blue-150 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group shadow-sm hover:scale-[1.01] transition-transform duration-200">
                <div className="absolute right-3 top-3 opacity-15 text-blue-600 group-hover:scale-110 transition-transform duration-200">
                  <i className="fa-solid fa-cart-shopping text-3xl"></i>
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mb-2 block">
                  Referred Spend (Monthly)
                </span>
                <span className="text-2xl font-black text-blue-900 leading-tight">
                  ₹{(stats?.total_spend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <div className="text-[9px] font-semibold text-blue-500 leading-none mt-3">
                  Lifetime business volume spent
                </div>
              </div>

              {/* Card 3: Total Orders */}
              <div className="bg-emerald-50 border border-emerald-150 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group shadow-sm hover:scale-[1.01] transition-transform duration-200">
                <div className="absolute right-3 top-3 opacity-15 text-emerald-600 group-hover:scale-110 transition-transform duration-200">
                  <i className="fa-solid fa-receipt text-3xl"></i>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-2 block">
                  Referred Patients
                </span>
                <span className="text-2xl font-black text-emerald-900 leading-tight">
                  {stats?.total_orders || 0} Invoices
                </span>
                <div className="text-[9px] font-semibold text-emerald-500 leading-none mt-3">
                  Patient receipts created
                </div>
              </div>

              {/* Card 4: Net Savings */}
              <div className="bg-amber-50 border border-amber-150 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group shadow-sm hover:scale-[1.01] transition-transform duration-200">
                <div className="absolute right-3 top-3 opacity-15 text-amber-600 group-hover:scale-110 transition-transform duration-200">
                  <i className="fa-solid fa-piggy-bank text-3xl"></i>
                </div>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-none mb-2 block">
                  Earned Savings (B2B)
                </span>
                <span className="text-2xl font-black text-amber-900 leading-tight">
                  ₹{(stats?.total_savings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <div className="text-[9px] font-semibold text-amber-500 leading-none mt-3">
                  Saved vs Retail MRP
                </div>
              </div>
            </div>

            {/* Visual Charts & Top Tests Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
              {/* Left Column: Volume Trend Chart */}
              <div className="lg:col-span-7 bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
                <div>
                  <h3 className="m-0 text-sm font-bold text-slate-800 leading-tight">Order Spends & Volume Trend</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                    Monthly spend and invoice count trend for B2B portal
                  </span>
                </div>

                {trend.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 italic text-xs font-bold uppercase tracking-wider">
                    No volume trend details available.
                  </div>
                ) : (
                  <div className="w-full mt-6 overflow-x-auto">
                    <svg
                       viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
                       className="w-full min-w-[400px] h-auto overflow-visible select-none"
                    >
                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = 10 + chartHeight * (1 - ratio);
                        return (
                          <g key={idx}>
                            <line
                              x1="40"
                              y1={y}
                              x2={chartWidth - 10}
                              y2={y}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                            <text x="32" y={y + 3} className="text-[9px] font-bold text-slate-400 text-right font-mono" textAnchor="end">
                              ₹{Math.round(maxSpend * ratio)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Render Bars */}
                      {trend.map((t, idx) => {
                        const colWidth = (chartWidth - 50) / trend.length;
                        const x = 50 + idx * colWidth;
                        const barWidth = colWidth * 0.45;
                        const barHeight = (t.spend / maxSpend) * chartHeight;
                        const barY = 10 + chartHeight - barHeight;

                        return (
                          <g key={idx} className="group cursor-pointer">
                            <rect
                              x={x}
                              y={barY}
                              width={barWidth}
                              height={barHeight}
                              fill="url(#indigoGrad)"
                              rx="4"
                              className="transition-all duration-200 hover:brightness-95 hover:shadow"
                            />
                            <text
                              x={x + barWidth / 2}
                              y={barY - 5}
                              className="text-[9px] font-black text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity text-center font-mono"
                              textAnchor="middle"
                            >
                              ₹{t.spend}
                            </text>
                            {/* X-axis labels */}
                            <text
                              x={x + barWidth / 2}
                              y={15 + chartHeight + 10}
                              className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-wide"
                              textAnchor="middle"
                            >
                              {formatMonthName(t.month)}
                            </text>
                            <text
                              x={x + barWidth / 2}
                              y={15 + chartHeight + 24}
                              className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-1 rounded-full text-center font-mono"
                              textAnchor="middle"
                            >
                              {t.count} Invoices
                            </text>
                          </g>
                        );
                      })}

                      {/* Gradients */}
                      <defs>
                        <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                )}
              </div>

              {/* Right Column: Top Ordered Tests Leaderboard */}
              <div className="lg:col-span-5 bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
                <div>
                  <h3 className="m-0 text-sm font-bold text-slate-800 leading-tight">Test Referral Leaderboard</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                    Your top 5 most frequently ordered packages
                  </span>
                </div>

                {topTests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 italic text-xs font-bold uppercase tracking-wider flex-grow">
                    No package referrals recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3 mt-6 flex-grow flex flex-col justify-center">
                    {topTests.map((t, idx) => {
                      const colors = [
                        'bg-indigo-50 border-indigo-100 text-indigo-700',
                        'bg-blue-50 border-blue-100 text-blue-700',
                        'bg-emerald-50 border-emerald-100 text-emerald-700',
                        'bg-amber-50 border-amber-100 text-amber-700',
                        'bg-slate-50 border-slate-100 text-slate-700',
                      ];
                      const progressColors = [
                        'bg-indigo-600',
                        'bg-blue-600',
                        'bg-emerald-600',
                        'bg-amber-500',
                        'bg-slate-500',
                      ];

                      const maxCount = topTests[0]?.count || 1;
                      const progressWidth = `${(t.count / maxCount) * 100}%`;

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm relative group overflow-hidden"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg border font-black text-xs flex items-center justify-center shrink-0 ${
                              colors[idx] || colors[4]
                            }`}
                          >
                            #{idx + 1}
                          </div>

                          <div className="flex-grow min-w-0 z-10">
                            <span className="font-bold text-slate-700 truncate block text-xs group-hover:text-indigo-900 transition-colors">
                              {t.package_name}
                            </span>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div
                                style={{ width: progressWidth }}
                                className={`h-full rounded-full transition-all duration-300 ${
                                  progressColors[idx] || progressColors[4]
                                }`}
                              ></div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 z-10 pl-2">
                            <span className="text-xs font-black text-slate-800 leading-none block">
                              {t.count}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mt-0.5">
                              Orders
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientAnalysis;
