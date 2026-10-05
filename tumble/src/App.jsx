import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Skull, AlertTriangle, Calendar, PlusCircle, Activity, X, Clock, MapPin, Lock, Bike} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import defaultCrashes from './crashes.json';
import confetti from 'canvas-confetti';



const urlParams = new URLSearchParams(window.location.search);
const isViewingAuthorMode = urlParams.get('view') === 'apirso';

const SEVERITY_LEVELS = [
  { level: 1, name: 'Tip-over', desc: 'Minor spill, pride hurt only.' },
{ level: 2, name: 'Road Rash', desc: 'Scrapes and abrasions, rode home.' },
{ level: 3, name: 'Mechanical / Sprain', desc: 'Damaged bike or minor joint injury.' },
{ level: 4, name: 'Hospital / Urgent Care', desc: 'Required stitches, cast, or ER visit.' },
{ level: 5, name: 'Totaled', desc: 'Major accident, write-off.' },
];

const CULPRITS = [
 'Tram / Train tracks',
  'Wet leaves / Cobblestones / icey',
  'Pedestrian / Cyclist collision',
  'Braking / Cornering error',
  'Mechanical failure',
'Drinking & Driving',
  'Other'
];

export default function App() {
const [crashes, setCrashes] = useState(() => {
  // 1. If someone uses  special link, show my real crashes
  if (isViewingAuthorMode) {
    return defaultCrashes;
  }

  // 2. Otherwise, check if this visitor has logged crashes before
  const saved = localStorage.getItem('tumble_crashes');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { console.error(e); }
  }

  // 3. New visitor on the regular URL? Give them a clean, empty board!
  return [];
});

  // Live clock that ticks every single second
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState([52.3676, 4.9041]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '17:30',
    location: '',
    severity: 1,
    cause: CULPRITS[0],
    notes: ''
  });

  // Map DOM refs
  const mainMapContainerRef = useRef(null);
  const mainMapInstance = useRef(null);
  const modalMapContainerRef = useRef(null);
  const modalMapInstance = useRef(null);
  const modalMarkerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('tumble_crashes', JSON.stringify(crashes));
  }, [crashes]);

  // Main Dashboard Map setup
  useEffect(() => {
    if (!mainMapContainerRef.current) return;

    if (!mainMapInstance.current) {
      const defaultCenter = crashes[0]?.lat ? [crashes[0].lat, crashes[0].lng] : [52.3676, 4.9041];
      mainMapInstance.current = L.map(mainMapContainerRef.current).setView(defaultCenter, 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(mainMapInstance.current);
    }

    // Clear existing markers and re-add
    const map = mainMapInstance.current;
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    crashes.forEach(crash => {
      if (crash.lat && crash.lng) {
        const marker = L.circleMarker([crash.lat, crash.lng], {
          radius: crash.severity >= 3 ? 9 : 6,
          color: crash.severity >= 3 ? '#e11d48' : '#9333ea',
          fillColor: crash.severity >= 3 ? '#e11d48' : '#9333ea',
          fillOpacity: 0.85
        }).addTo(map);

        marker.bindPopup(`
          <div style="color: #0f172a; font-family: sans-serif; font-size: 12px;">
            <strong>${crash.location}</strong><br/>
            ${crash.date} at ${crash.time || 'Unknown'}<br/>
            <span style="color: #e11d48; font-weight: bold;">Lvl ${crash.severity}: ${crash.severityLabel}</span><br/>
            <em>"${crash.notes}"</em>
          </div>
        `);
      }
    });
  }, [crashes]);

  // Modal Mini-Map setup
  useEffect(() => {
    if (!isModalOpen || !modalMapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (!modalMapInstance.current && modalMapContainerRef.current) {
        const map = L.map(modalMapContainerRef.current).setView(modalPosition, 12);
        modalMapInstance.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        modalMarkerRef.current = L.circleMarker(modalPosition, {
          radius: 8,
          color: '#e11d48',
          fillColor: '#e11d48',
          fillOpacity: 0.9
        }).addTo(map);

        map.on('click', (e) => {
          setModalPosition([e.latlng.lat, e.latlng.lng]);
          if (modalMarkerRef.current) {
            modalMarkerRef.current.setLatLng(e.latlng);
          }
        });
      } else if (modalMapInstance.current) {
        modalMapInstance.current.invalidateSize();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (modalMapInstance.current) {
        modalMapInstance.current.remove();
        modalMapInstance.current = null;
      }
    };
  }, [isModalOpen]);

  // Sort crashes by datetime
  const sortedCrashes = useMemo(() => {
    return [...crashes].sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));
  }, [crashes]);

  // Live elapsed time since the most recent disaster
  const liveStreak = useMemo(() => {
    if (sortedCrashes.length === 0) return { days: 0, hours: '00', minutes: '00', seconds: '00' };

    const mostRecent = sortedCrashes[0];
    const lastCrashDateTime = new Date(`${mostRecent.date}T${mostRecent.time || '00:00:00'}`);
    const diffMs = Math.max(0, currentTime - lastCrashDateTime);

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = String(Math.floor((diffMs / (1000 * 60 * 60)) % 24)).padStart(2, '0');
    const minutes = String(Math.floor((diffMs / (1000 * 60)) % 60)).padStart(2, '0');
    const seconds = String(Math.floor((diffMs / 1000) % 60)).padStart(2, '0');

    return { days, hours, minutes, seconds };
  }, [sortedCrashes, currentTime]);

  // Time-of-Day Pattern
  const timePattern = useMemo(() => {
    if (crashes.length === 0) return 'Undetermined';
    const windows = {
      'Morning Commute': 0,
      'Midday Hubris': 0,
      'Twilight Danger': 0,
      'Witching Hour': 0
    };

    crashes.forEach(c => {
      if (!c.time) return;
      const hour = parseInt(c.time.split(':')[0], 10);
      if (hour >= 6 && hour < 10) windows['Morning Commute']++;
      else if (hour >= 10 && hour < 16) windows['Midday Hubris']++;
      else if (hour >= 16 && hour < 20) windows['Twilight Danger']++;
      else windows['Witching Hour']++;
    });

    let topWindow = 'Undetermined';
    let max = 0;
    Object.entries(windows).forEach(([name, count]) => {
      if (count > max) {
        max = count;
        topWindow = name;
      }
    });
    return topWindow;
  }, [crashes]);

  // Calculate tumbles for the CURRENT calendar month
  const crashesThisMonth = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return crashes.filter(crash => {
      const crashDate = new Date(crash.date);
      return crashDate.getFullYear() === currentYear && crashDate.getMonth() === currentMonth;
    }).length;
  }, [crashes]);

  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  // Calculate the exact 12 trailing months (e.g. Apr -> Mar)
const trailingMonths = useMemo(() => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString('default', { month: 'short' }));
  }
  return months;
}, []);

  // 12-Month Matrix (364 Days / 52 Weeks)
  const fullYearDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 363; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const crashOnDay = crashes.find(c => c.date === dateStr);
      days.push({
        date: dateStr,
        crash: crashOnDay
      });
    }
    return days;
  }, [crashes]);

  const handleSave = (e) => {
    e.preventDefault();
    const severityObj = SEVERITY_LEVELS.find(s => s.level === Number(formData.severity));
    
    const newCrash = {
      id: Date.now(),
      date: formData.date,
      time: formData.time,
      lat: modalPosition[0],
      lng: modalPosition[1],
      location: formData.location || 'Undisclosed Scene',
      severity: Number(formData.severity),
      severityLabel: severityObj ? severityObj.name : 'Unknown',
      cause: formData.cause,
      notes: formData.notes || 'No statement given.'
    };

    setCrashes([newCrash, ...crashes]);
    setIsModalOpen(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: '17:30',
      location: '',
      severity: 1,
      cause: CULPRITS[0],
      notes: ''
    });
  };

  return (
    <div className="min-h-screen bg-tumble-bg text-tumble-gauze p-4 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-tumble-border pb-6 mb-8">
     
        <div className="group flex items-center gap-3 cursor-pointer">
  <div className="w-10 h-10 rounded-xl bg-tumble-card border border-tumble-border flex items-center justify-center">
    <Bike className="w-6 h-6 text-tumble-blood transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:translate-y-1" />
  </div>
  <div>
    <h1 className="text-2xl font-black text-white tracking-tight">TUMBLE</h1>
    <p className="text-xs text-tumble-muted">A log of every time the bike stopped and I didn’t</p>
  </div>
</div>
        {isViewingAuthorMode ? (
  <button 
    disabled
    title="Logging is disabled in spectator mode."
    className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 text-slate-500 font-semibold px-4 py-2 rounded-lg cursor-not-allowed select-none text-sm"
  >
    <Lock className="w-4 h-4 text-slate-500" />
    Log Incident (Locked)
  </button>
) : (
  <button 
    onClick={() => setIsModalOpen(true)}
    className="flex items-center gap-2 bg-tumble-blood hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-rose-950/40 text-sm"
  >
    <PlusCircle className="w-5 h-5" />
    Log Incident
  </button>
)}
      </header>

      {/* Spectator Mode Banner (only shows when ?view=apirso) */}
      {isViewingAuthorMode && (
        <div className="mb-6 p-3 rounded-lg bg-rose-950/40 border border-tumble-blood/40 text-xs flex justify-between items-center text-rose-200">
          <span>
            <strong className="text-white">Spectator Mode:</strong> You are viewing Anais's verified crash archive.
          </span>
          <span className="font-mono text-[10px] text-rose-400 uppercase tracking-widest border border-rose-800/60 px-2 py-0.5 rounded">
            Read-Only
          </span>
        </div>
      )}

      {/* Full-Width Survival Chronometer Banner */}
      <section className="mb-4">
        <div className="bg-tumble-card border border-tumble-border p-6 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 font-semibold">
                  Consecutive Survival Clock
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Crash-Free Streak
              </h2>
              <p className="text-xs text-tumble-muted mt-0.5">
                Time elapsed since last recorded fall.
              </p>
            </div>

            {/* Big Digital Readout */}
            <div className="flex items-baseline gap-2 font-mono text-white bg-tumble-bg/60 border border-tumble-border/60 px-5 py-3 rounded-xl self-start md:self-auto">
              <div className="text-4xl md:text-5xl font-black text-white">{liveStreak.days}</div>
              <span className="text-xs text-tumble-muted uppercase font-bold mr-1">d</span>

              <span className="text-emerald-500/70 text-2xl font-bold animate-pulse">:</span>

              <div className="text-3xl md:text-4xl font-bold text-slate-200">{liveStreak.hours}</div>
              <span className="text-xs text-tumble-muted uppercase font-bold mr-1">h</span>

              <span className="text-emerald-500/70 text-2xl font-bold animate-pulse">:</span>

              <div className="text-3xl md:text-4xl font-bold text-slate-200">{liveStreak.minutes}</div>
              <span className="text-xs text-tumble-muted uppercase font-bold mr-1">m</span>

              <span className="text-emerald-500/70 text-2xl font-bold animate-pulse">:</span>

              <div className="text-3xl md:text-4xl font-bold text-emerald-400 w-12">{liveStreak.seconds}</div>
              <span className="text-xs text-tumble-muted uppercase font-bold">s</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Secondary Metric Cards Below */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Card 1: Total Crashes */}
        <div className="bg-tumble-card border border-tumble-border p-5 rounded-xl">
          <div className="flex items-center gap-2 text-tumble-muted text-xs uppercase tracking-wider font-semibold mb-2">
            <AlertTriangle className="w-4 h-4 text-tumble-blood" />
            Total Crashes
          </div>
          <div className="text-3xl font-black text-white">{crashes.length}</div>
          <p className="text-xs text-tumble-muted mt-2">Documented lifetime losses against physics.</p>
        </div>

        {/* Card 2: This Month's Carnage */}
        <div className="bg-tumble-card border border-tumble-border p-5 rounded-xl">
          <div className="flex items-center gap-2 text-tumble-muted text-xs uppercase tracking-wider font-semibold mb-2">
            <Calendar className="w-4 h-4 text-rose-400" />
            Tumbles in {currentMonthName}
          </div>
          <div className="text-3xl font-black text-white">
            {crashesThisMonth}
            <span className="text-xs font-normal text-tumble-muted ml-2">
              {crashesThisMonth === 0 ? "(Suspiciously safe)" : "(Active skin donor)"}
            </span>
          </div>
          <p className="text-xs text-tumble-muted mt-2">Incidents recorded during this calendar month.</p>
        </div>

        {/* Card 3: Peak Hazard Window */}
        <div className="bg-tumble-card border border-tumble-border p-5 rounded-xl">
          <div className="flex items-center gap-2 text-tumble-muted text-xs uppercase tracking-wider font-semibold mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Peak Hazard Window
          </div>
          <div className="text-2xl font-bold text-white truncate">{timePattern}</div>
          <p className="text-xs text-tumble-muted mt-2">When you're statistically most dangerous to yourself.</p>
        </div>
      </section>

{/* 12-Month Matrix with Month Labels & Legend */}
<section className="bg-tumble-card border border-tumble-border p-5 rounded-xl mb-8">
  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
    <div>
      <h3 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
        <Calendar className="w-4 h-4 text-tumble-blood" />
        365-Day Incident Heatmap
      </h3>
      <p className="text-[11px] text-tumble-muted">
        Every square represents one calendar day over the past 52 weeks.
      </p>
    </div>

    {/* Legend */}
    <div className="flex items-center gap-3 text-[11px] text-tumble-muted">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-800/80 border border-slate-700"></span>
        <span>Upright</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[2px] bg-tumble-bruise"></span>
        <span>Minor Spill</span>
      </div>
      <div className="flex items-center gap-1.5">
<span className="w-2.5 h-2.5 rounded-[2px] bg-tumble-blood border border-rose-500"></span>
        <span>Severe Crash</span>
      </div>
    </div>
  </div>
  
  {/* The 52-week calendar container */}
  <div className="overflow-x-auto pb-2">
    <div className="min-w-[720px]">
      
      {/* Month Labels Across the Top */}
      <div className="flex justify-between text-[11px] text-slate-400 font-mono font-semibold mb-2 px-1">
        {trailingMonths.map((m, idx) => (
          <span key={idx} className="w-12 text-left">
            {m}
          </span>
        ))}
      </div>

      {/* The 52-Week Grid */}
<div className="grid grid-flow-col grid-rows-7 gap-1 py-2 px-1">
        {fullYearDays.map((day, idx) => {
          let bg = "bg-slate-800/40 border border-slate-800/60";
          let title = `${day.date}: Upright and alive`;

          if (day.crash) {
            bg = day.crash.severity >= 3 
              ? "bg-tumble-blood border border-rose-500" 
              : "bg-tumble-bruise border border-purple-500";
            title = `${day.date} at ${day.crash.time || 'unknown'}: Lvl ${day.crash.severity} (${day.crash.location})`;
          }

          return (
             <div 
  key={idx} 
  title={title}
  className={`w-3 h-3 rounded-[2px] ${bg} 
    relative transform origin-center
    transition-all duration-150 ease-out 
    hover:scale-[2] hover:z-50 hover:ring-2 hover:ring-white hover:shadow-xl hover:shadow-black
    cursor-pointer`}
/>
          );
        })}
      </div>

      {/* Month Labels Across the Bottom (for easy reference) */}
      <div className="flex justify-between text-[10px] text-tumble-muted font-mono mt-2 px-1">
        {trailingMonths.map((m, idx) => (
          <span key={idx} className="w-12 text-left">
            {m}
          </span>
        ))}
      </div>

    </div>
  </div>
</section>

      {/* Interactive Crash Map */}
      <section className="bg-tumble-card border border-tumble-border p-5 rounded-xl mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-white mb-3">
          <MapPin className="w-4 h-4 text-tumble-blood" />
          The Impact Map
        </div>
        <div 
          ref={mainMapContainerRef} 
          className="h-72 w-full rounded-lg overflow-hidden border border-tumble-border z-0" 
        />
      </section>

      {/* Incident Log Feed */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-white">The Autopsy Log</h2>
        <div className="space-y-4">
          {sortedCrashes.map((crash) => (
            <div key={crash.id} className="bg-tumble-card border border-tumble-border p-5 rounded-xl hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs font-mono text-tumble-muted">{crash.date} {crash.time && `• ${crash.time}`}</span>
                  <h3 className="font-bold text-lg text-white">{crash.location}</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-tumble-border text-tumble-blood border border-rose-900/30">
                  Lvl {crash.severity}: {crash.severityLabel}
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-3 italic">"{crash.notes}"</p>
              <div className="text-xs text-tumble-muted border-t border-tumble-border/50 pt-2 flex justify-between">
                <span><strong className="text-slate-400">Culprit:</strong> {crash.cause}</span>
                {crash.lat && <span className="font-mono text-[11px] text-slate-500">[{crash.lat.toFixed(3)}, {crash.lng.toFixed(3)}]</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-tumble-card border border-tumble-border rounded-2xl w-full max-w-lg p-6 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-tumble-blood" />
                Audit Previous Wipeout
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-tumble-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-tumble-bg border border-tumble-border rounded-lg p-2 text-white text-sm focus:outline-none focus:border-tumble-blood"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Time of Impact</label>
                  <input 
                    type="time" 
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full bg-tumble-bg border border-tumble-border rounded-lg p-2 text-white text-sm focus:outline-none focus:border-tumble-blood"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Scene Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Corner of Elm & 5th, Gravel Descent"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full bg-tumble-bg border border-tumble-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-tumble-blood"
                />
              </div>

              {/* Clickable Map in Modal */}
              <div>
                <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Click Map to Pin Location</label>
                <div 
                  ref={modalMapContainerRef} 
                  className="h-36 w-full rounded-lg overflow-hidden border border-tumble-border z-0" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Darwin Index</label>
                <select 
                  value={formData.severity}
                  onChange={(e) => setFormData({...formData, severity: e.target.value})}
                  className="w-full bg-tumble-bg border border-tumble-border rounded-lg p-2 text-white text-sm focus:outline-none focus:border-tumble-blood"
                >
                  {SEVERITY_LEVELS.map(s => (
                    <option key={s.level} value={s.level}>
                      Level {s.level}: {s.name} ({s.desc})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Primary Culprit</label>
                <select 
                  value={formData.cause}
                  onChange={(e) => setFormData({...formData, cause: e.target.value})}
                  className="w-full bg-tumble-bg border border-tumble-border rounded-lg p-2 text-white text-sm focus:outline-none focus:border-tumble-blood"
                >
                  {CULPRITS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-tumble-muted uppercase mb-1">Notes / Humiliation</label>
                <textarea 
                  rows="2"
                  placeholder="Details of the wipeout..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-tumble-bg border border-tumble-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-tumble-blood"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-tumble-muted hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-tumble-blood hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Save Sacrifice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}