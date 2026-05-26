import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type TrendItem = {
    label: string;
    indicadores: number;
    registros: number;
};

type CompositionItem = {
    name: string;
    value: number;
    color: string;
};

type UnitRankingItem = {
    name: string;
    indicadores: number;
    registros: number;
};

type CategoryItem = {
    category: string;
    records: number;
};

const tooltipStyle = {
    borderRadius: 14,
    border: '1px solid #E9E6E1',
    boxShadow: '0 10px 24px rgba(9,6,0,.08)',
};

export function GeneralTrendChart({ data }: { data: TrendItem[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 14, left: -18, bottom: 0 }}>
                <defs>
                    <linearGradient id="trendSnapshot" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#90846C" stopOpacity={0.34} />
                        <stop offset="95%" stopColor="#90846C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="trendCollection" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#172433" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#172433" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid stroke="#E9E6E1" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#7B7B6B', fontSize: 11, fontWeight: 700 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#7B7B6B', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="indicadores" name="Indicadores" stroke="#90846C" strokeWidth={3} fill="url(#trendSnapshot)" />
                <Area type="monotone" dataKey="registros" name="Registros" stroke="#172433" strokeWidth={3} fill="url(#trendCollection)" />
            </AreaChart>
        </ResponsiveContainer>
    );
}

export function GeneralCompositionChart({ data }: { data: CompositionItem[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={4}>
                    {data.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
        </ResponsiveContainer>
    );
}

export function GeneralRankingChart({ data }: { data: UnitRankingItem[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 2, right: 12 }}>
                <CartesianGrid stroke="#E9E6E1" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={124} tickLine={false} axisLine={false} tick={{ fill: '#1F1B14', fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="indicadores" name="Indicadores" stackId="records" fill="#90846C" />
                <Bar dataKey="registros" name="Registros" stackId="records" fill="#172433" radius={[0, 7, 7, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export function RegionalCategoryChart({ data }: { data: CategoryItem[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 22 }}>
                <CartesianGrid stroke="#E9E6E1" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="category" angle={-20} textAnchor="end" tickLine={false} axisLine={false} tick={{ fill: '#7B7B6B', fontSize: 10, fontWeight: 700 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#7B7B6B', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="records" name="Registros" fill="#90846C" radius={[8, 8, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export function RegionalCompositionChart({ data }: { data: CompositionItem[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={74} paddingAngle={4}>
                    {data.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
        </ResponsiveContainer>
    );
}
