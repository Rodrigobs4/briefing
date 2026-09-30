import { useMemo, useState } from 'react';
import { getReportYears, MIN_REPORT_YEAR } from '../utils/reportYears';

const ADD_PREVIOUS_YEAR = 'add-previous-year';

type ReferenceYearSelectProps = {
    value: number;
    onChange: (year: number) => void;
    /** Anos que já possuem lançamento, para continuarem disponíveis na lista. */
    yearsWithData?: Array<number | null | undefined>;
    className?: string;
};

export default function ReferenceYearSelect({ value, onChange, yearsWithData = [], className }: ReferenceYearSelectProps) {
    const [addedYears, setAddedYears] = useState<number[]>([]);

    const years = useMemo(
        () => getReportYears([...yearsWithData, ...addedYears, value]).reverse(),
        [yearsWithData, addedYears, value]
    );
    const previousYear = years[years.length - 1] - 1;

    return (
        <select
            value={value}
            onChange={event => {
                if (event.target.value === ADD_PREVIOUS_YEAR) {
                    setAddedYears(current => [...current, previousYear]);
                    onChange(previousYear);
                    return;
                }
                onChange(Number(event.target.value));
            }}
            className={className}
        >
            {years.map(year => <option key={year} value={year}>{year}</option>)}
            {previousYear >= MIN_REPORT_YEAR && (
                <option value={ADD_PREVIOUS_YEAR}>+ Adicionar {previousYear}</option>
            )}
        </select>
    );
}
