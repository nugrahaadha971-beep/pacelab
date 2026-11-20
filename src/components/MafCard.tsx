import { fmtPace } from '../plans/pace';
import { MAF_ADJUSTMENTS, mafTrend, mafZone, normalizeMafAdj } from '../plans/maf';
import type { MafAdjustment, MafPoint } from '../plans/maf';
import { fmtDate } from './format';
import { SelectField } from './ui';

const dec = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

interface Props {
  age: number;
  adj: MafAdjustment;
  onAdj: (a: MafAdjustment) => void;
  maf: number | null;
  /** Sesi aerobik ≥ 3 km yang HR rata-ratanya di sekitar HR MAF, urut dari terlama. */
  points: MafPoint[];
}

/** Zona MAF: HR MAF (180 − usia ± kondisi), rentang latihan, dan perkembangan pace di zona itu. */
export default function MafCard({ age, adj, onAdj, maf, points }: Props) {
  const zone = maf != null ? mafZone(maf) : null;
  const trend = mafTrend(points);
  const recent = [...points].reverse().slice(0, 4);
  return (
    <section className="sport-card border-l-[3px] border-l-sky-400 p-4" aria-labelledby="maf-judul">
      <h3 id="maf-judul" className="font-display text-base font-bold">Zona MAF Anda</h3>
      {maf == null || zone == null ? (
        <p className="mt-2 rounded-xl border border-dashed border-coral/60 bg-coral/10 p-3 text-sm">
          Isi usia di tab Profil untuk menghitung detak jantung MAF (180 − usia).
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Batas detak jantung MAF</div>
              <div className="font-display text-3xl font-extrabold tabular-nums text-sky-300">{maf}<span className="ml-1 text-sm font-bold text-slate-400">bpm</span></div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Zona latihan</div>
              <div className="font-display text-xl font-extrabold tabular-nums">{zone[0]}–{zone[1]}<span className="ml-1 text-sm font-bold text-slate-400">bpm</span></div>
            </div>
          </div>
          <p className="mt-1 text-xs tabular-nums text-slate-400">
            180 − {Math.round(age)}{adj !== 0 ? ` ${adj > 0 ? '+' : '−'} ${Math.abs(adj)}` : ''} = {maf}. Semua lari dijaga di zona ini.
          </p>
        </>
      )}

      <div className="mt-3">
        <SelectField label="Kondisi Anda" term="penyesuaian MAF" value={String(adj)} onChange={(e) => onAdj(normalizeMafAdj(Number(e.target.value)))}>
          {MAF_ADJUSTMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </SelectField>
      </div>

      <div className="mt-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pace di zona MAF (ukuran kemajuan)</h4>
        {recent.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">
            Belum ada lari ≥ 3 km dengan detak jantung rata-rata di zona MAF. Hasil MAF Test (minggu 4 dan 8) dan lari biasa di zona ini akan muncul di sini.
          </p>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-navy-700 text-sm tabular-nums">
              {recent.map((p) => (
                <li key={p.date} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-400">{fmtDate(p.date)}</span>
                  <span><strong>{fmtPace(p.paceSecPerKm)}</strong> /km · {Math.round(p.avgHr)} bpm{p.driftPct != null ? ` · drift ${dec(p.driftPct)}%` : ''}</span>
                </li>
              ))}
            </ul>
            {trend ? (
              <p className={`mt-2 text-sm font-medium ${trend.deltaSec < -1 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {Math.abs(trend.deltaSec) < 1
                  ? `Pace di zona MAF stabil sejak tes pertama (${trend.count} catatan).`
                  : `Pace di zona MAF ${trend.deltaSec < 0 ? 'lebih cepat' : 'lebih lambat'} ${Math.abs(Math.round(trend.deltaSec))} dtk/km sejak catatan pertama.`}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Butuh minimal 2 catatan untuk melihat perkembangan.</p>
            )}
          </>
        )}
      </div>

      <details className="mt-3 rounded-xl bg-navy-900">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-slate-300">Apa itu metode MAF?</summary>
        <div className="space-y-2 px-3 pb-3 text-sm text-slate-300">
          <p><strong>MAF</strong> (Maximum Aerobic Function, metode Phil Maffetone): membangun mesin aerobik dengan berlatih di bawah batas detak jantung tertentu, yaitu 180 dikurangi usia, disesuaikan dengan kondisi Anda.</p>
          <p>Pace mengikuti detak jantung. Awalnya pace bisa sangat pelan, bahkan perlu jalan. Itu normal; ukuran kemajuannya adalah pace yang makin cepat <em>pada detak jantung yang sama</em>.</p>
          <p><strong>MAF Test</strong> (minggu 4 dan 8): lari 5 km di detak jantung MAF, catat waktu tiap km. Bandingkan antar-tes.</p>
          <p className="text-xs text-slate-400">MAF paling efektif sebagai fondasi 3–6 bulan. Untuk target PB dalam waktu lebih singkat, hasil lomba bisa belum maksimal. Ini panduan umum, bukan nasihat medis; bila ada penyakit jantung atau keluhan, konsultasikan dengan dokter.</p>
        </div>
      </details>
    </section>
  );
}
