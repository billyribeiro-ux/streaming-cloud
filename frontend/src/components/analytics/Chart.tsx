/**
 * Chart Component - Simple chart using CSS/SVG
 *
 * Features:
 * - Bar, line, and pie chart types
 * - Horizontal bars with labels and values
 * - Dark mode support via Tailwind
 * - No heavy chart library dependencies
 */

import { useMemo } from 'react';
import { cn } from '../../utils/cn';

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChartProps {
  data: ChartDataPoint[];
  type?: 'bar' | 'line' | 'pie';
  title?: string;
  height?: number;
  className?: string;
}

// ============================================================================
// BAR CHART
// ============================================================================

function BarChart({ data, height }: { data: ChartDataPoint[]; height: number }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      {data.map((item, index) => {
        const percentage = (item.value / maxValue) * 100;

        return (
          <div key={`${item.label}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 truncate mr-3">{item.label}</span>
              <span className="text-gray-400 font-mono tabular-nums flex-shrink-0">
                {item.value.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// LINE CHART (SVG)
// ============================================================================

function LineChart({ data, height }: { data: ChartDataPoint[]; height: number }) {
  const svgWidth = 600;
  const svgHeight = height;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const points = useMemo(() => {
    if (data.length === 0) return '';

    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const minValue = Math.min(...data.map((d) => d.value), 0);
    const range = maxValue - minValue || 1;

    return data
      .map((d, i) => {
        const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
        const y = padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, chartWidth, chartHeight, padding]);

  const areaPath = useMemo(() => {
    if (data.length === 0) return '';

    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const minValue = Math.min(...data.map((d) => d.value), 0);
    const range = maxValue - minValue || 1;

    const pts = data.map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight;
      return { x, y };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const bottomRight = `L${pts[pts.length - 1].x},${padding.top + chartHeight}`;
    const bottomLeft = `L${pts[0].x},${padding.top + chartHeight}`;

    return `${linePath} ${bottomRight} ${bottomLeft} Z`;
  }, [data, chartWidth, chartHeight, padding]);

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      style={{ height }}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = padding.top + chartHeight * (1 - fraction);
        return (
          <line
            key={fraction}
            x1={padding.left}
            y1={y}
            x2={svgWidth - padding.right}
            y2={y}
            stroke="#374151"
            strokeDasharray="4,4"
          />
        );
      })}

      {/* Area fill */}
      {areaPath && (
        <path d={areaPath} fill="url(#lineGradient)" opacity={0.3} />
      )}

      {/* Line */}
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {data.map((d, i) => {
        const maxValue = Math.max(...data.map((p) => p.value), 1);
        const minValue = Math.min(...data.map((p) => p.value), 0);
        const range = maxValue - minValue || 1;
        const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
        const y = padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight;

        return (
          <circle
            key={`${d.label}-${i}`}
            cx={x}
            cy={y}
            r={3}
            fill="#3B82F6"
            stroke="#1E293B"
            strokeWidth={2}
          />
        );
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
        // Show every Nth label to avoid overlap
        const step = Math.ceil(data.length / 8);
        if (i % step !== 0 && i !== data.length - 1) return null;

        return (
          <text
            key={`label-${i}`}
            x={x}
            y={svgHeight - 8}
            textAnchor="middle"
            className="fill-gray-500 text-[11px]"
          >
            {d.label}
          </text>
        );
      })}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// PIE CHART (SVG)
// ============================================================================

const PIE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

function PieChart({ data, height }: { data: ChartDataPoint[]; height: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const size = Math.min(height, 300);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 10;

  const slices = useMemo(() => {
    let currentAngle = -90; // Start from top

    return data.map((d, i) => {
      const angle = (d.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return {
        path,
        color: PIE_COLORS[i % PIE_COLORS.length],
        label: d.label,
        value: d.value,
        percentage: ((d.value / total) * 100).toFixed(1),
      };
    });
  }, [data, total, cx, cy, radius]);

  return (
    <div className="flex items-center gap-6 flex-wrap justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path
            key={i}
            d={slice.path}
            fill={slice.color}
            stroke="#111827"
            strokeWidth={2}
            className="transition-opacity hover:opacity-80"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="space-y-2">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-gray-300">{slice.label}</span>
            <span className="text-gray-500 ml-auto tabular-nums">
              {slice.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CHART COMPONENT
// ============================================================================

export default function Chart({
  data,
  type = 'bar',
  title,
  height = 300,
  className,
}: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn('bg-gray-900 rounded-xl border border-gray-800 p-6', className)}
        style={{ minHeight: height }}
      >
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900 rounded-xl border border-gray-800 p-6', className)}>
      {title && (
        <h3 className="text-base font-semibold text-white mb-4">{title}</h3>
      )}

      {type === 'bar' && <BarChart data={data} height={height} />}
      {type === 'line' && <LineChart data={data} height={height} />}
      {type === 'pie' && <PieChart data={data} height={height} />}
    </div>
  );
}
