'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Upload, CheckCircle, AlertCircle, Loader, X, FileText } from 'lucide-react';

interface Marker {
  marker_code: string;
  marker_name: string;
  domain: string;
  unit: string;
  ref_min_male: number | null;
  ref_max_male: number | null;
  ref_min_female: number | null;
  ref_max_female: number | null;
}

interface ParsedRow {
  row: number;
  test_date: string;
  source: string;
  lab_name: string;
  marker_code: string;
  marker_name: string;
  domain: string;
  unit: string;
  value: string;
  notes: string;
  status: string;
  isValid: boolean;
  error?: string;
}

export default function BloodWorkUploadPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [userGender, setUserGender] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadMarkersAndProfile(user.id);
    }
  }, [user]);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadMarkersAndProfile(userId: string) {
    // Load markers
    const { data: markersData } = await supabase
      .from('health_markers_library')
      .select('marker_code, marker_name, domain, unit, ref_min_male, ref_max_male, ref_min_female, ref_max_female')
      .order('domain').order('display_order');

    if (markersData) setMarkers(markersData);

    // Load gender from profile
    const { data: profileData } = await supabase
      .from('user_preferences')
      .select('gender')
      .eq('user_id', userId)
      .single();

    if (profileData?.gender) setUserGender(profileData.gender);
  }

  // ─── DOWNLOAD TEMPLATE ───────────────────────────────────────────
  function downloadTemplate() {
    const headers = ['test_date', 'source', 'lab_name', 'marker_code', 'marker_name', 'domain', 'unit', 'value', 'notes'];
    
    const rows = markers.map(m => [
      '',                   // test_date — user fills
      '',                   // source — user fills
      '',                   // lab_name — optional
      m.marker_code,        // pre-filled
      m.marker_name,        // pre-filled
      m.domain,             // pre-filled
      m.unit || '',         // pre-filled
      '',                   // value — user fills
      '',                   // notes — optional
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // '\uFEFF' = UTF-8 BOM — tells Excel to read as UTF-8 (fixes × µ ² showing as garbage)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blood_work_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── PARSE CSV ────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
  }

  function processFile(file: File) {
    setFileName(file.name);
    setParsedRows([]);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    // Parse header
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);

    const rows: ParsedRow[] = [];

    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;

      // Handle quoted CSV properly
      const cells = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
      const get = (name: string) => (cells[idx(name)] || '').replace(/"/g, '').trim();

      const test_date = get('test_date');
      const marker_code = get('marker_code');
      const value = get('value');
      const marker_name = get('marker_name');
      const domain = get('domain');
      const unit = get('unit');
      const source = get('source');
      const lab_name = get('lab_name');
      const notes = get('notes');

      // Validate
      let isValid = true;
      let error = '';

      if (!test_date) { isValid = false; error = 'Missing test_date'; }
      else if (!marker_code) { isValid = false; error = 'Missing marker_code'; }
      else if (!value || isNaN(parseFloat(value))) { isValid = false; error = 'Invalid or missing value'; }

      // Calculate status
      const markerRef = markers.find(m => m.marker_code === marker_code);
      let status = 'Normal';
      if (isValid && markerRef && value) {
        const numVal = parseFloat(value);
        const refMin = userGender === 'F' ? markerRef.ref_min_female : markerRef.ref_min_male;
        const refMax = userGender === 'F' ? markerRef.ref_max_female : markerRef.ref_max_male;
        if (refMin !== null && refMax !== null) {
          if (numVal < refMin) status = 'Low';
          else if (numVal > refMax) status = 'High';
        }
      }

      rows.push({
        row: i + 2,
        test_date, source, lab_name, marker_code, marker_name,
        domain, unit, value, notes, status, isValid, error,
      });
    });

    setParsedRows(rows);
  }

  // ─── UPLOAD TO SUPABASE ───────────────────────────────────────────
  async function uploadData() {
    const validRows = parsedRows.filter(r => r.isValid);
    if (!validRows.length || !user) return;

    setUploading(true);
    let success = 0;
    let failed = 0;

    // Batch insert in chunks of 50
    const chunks = [];
    for (let i = 0; i < validRows.length; i += 50) {
      chunks.push(validRows.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const insertData = chunk.map(r => {
        const markerRef = markers.find(m => m.marker_code === r.marker_code);
        const refMin = userGender === 'F' ? markerRef?.ref_min_female : markerRef?.ref_min_male;
        const refMax = userGender === 'F' ? markerRef?.ref_max_female : markerRef?.ref_max_male;

        return {
          user_id: user.id,
          test_date: r.test_date,
          source: r.source || null,
          lab_name: r.lab_name || null,
          marker_code: r.marker_code,
          marker_name: r.marker_name || markerRef?.marker_name || r.marker_code,
          domain: r.domain || markerRef?.domain || '',
          value: parseFloat(r.value),
          unit: r.unit || markerRef?.unit || '',
          ref_range_min: refMin ?? null,
          ref_range_max: refMax ?? null,
          status: r.status,
          notes: r.notes || null,
        };
      });

      const { error } = await supabase.from('blood_work_entries').insert(insertData);
      if (error) { failed += chunk.length; console.error('Insert error:', error); }
      else { success += chunk.length; }
    }

    setUploading(false);
    setUploadResult({ success, failed });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'Normal': return 'bg-green-100 text-green-800';
      case 'Low': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold flex items-center gap-2">
          <Loader className="animate-spin" size={24} />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {/* Header */}
      <div className="bg-black/30 text-white">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/blood-work')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <h1 className="text-2xl md:text-3xl font-bold">📤 Bulk Upload Blood Work</h1>
          </div>
          <p className="text-white/80">
            Download the template, fill in your values, and upload to add multiple test results at once.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* STEP 1: DOWNLOAD TEMPLATE */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
            Download Template
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            The CSV template has all <strong>{markers.length} health markers</strong> pre-filled. Just add your test date, source, and values.
          </p>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Template columns:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {[
                { col: 'test_date', fill: '✏️ You fill', eg: '2024-01-15' },
                { col: 'source', fill: '✏️ You fill', eg: 'AHC / Independent / Home Test' },
                { col: 'lab_name', fill: '✏️ Optional', eg: 'Apollo Diagnostics' },
                { col: 'marker_code', fill: '✅ Pre-filled', eg: 'HGB, RBC, TSH...' },
                { col: 'marker_name', fill: '✅ Pre-filled', eg: 'Hemoglobin...' },
                { col: 'domain', fill: '✅ Pre-filled', eg: 'CBC, Liver...' },
                { col: 'unit', fill: '✅ Pre-filled', eg: 'g/dL, mg/dL...' },
                { col: 'value', fill: '✏️ You fill', eg: '14.5' },
                { col: 'notes', fill: '✏️ Optional', eg: 'Fasting sample' },
              ].map(({ col, fill, eg }) => (
                <div key={col} className="bg-white rounded-lg p-2 border border-blue-100">
                  <div className="font-mono text-xs text-blue-900 font-bold">{col}</div>
                  <div className="text-xs text-gray-600">{fill}</div>
                  <div className="text-xs text-gray-400 italic">{eg}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-3 mb-4 text-sm text-yellow-900">
            <strong>💡 Tips before filling:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Delete rows of markers you did <strong>not</strong> test (leave only markers with values)</li>
              <li>Use the same <strong>test_date</strong> for all markers from one test session</li>
              <li>Leave <strong>value</strong> blank for markers not tested — they will be skipped</li>
              <li>Date format must be <strong>YYYY-MM-DD</strong> (e.g., 2024-01-15)</li>
            </ul>
          </div>

          <button
            onClick={downloadTemplate}
            disabled={markers.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            <Download size={20} />
            Download Template ({markers.length} markers)
          </button>
        </div>

        {/* STEP 2: UPLOAD CSV */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
            Upload Filled CSV
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            After filling the template, upload it here. We'll preview the data before saving.
          </p>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-3 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
              dragOver
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload size={40} className="mx-auto text-gray-400 mb-3" />
            {fileName ? (
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <FileText size={20} className="text-purple-600" />
                  <span className="font-semibold text-gray-900">{fileName}</span>
                </div>
                <p className="text-sm text-gray-500">Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-700 mb-1">Drag & drop your CSV here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: PREVIEW */}
        {parsedRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Preview Data
            </h2>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2 bg-green-100 text-green-900 px-4 py-2 rounded-lg font-semibold">
                <CheckCircle size={18} />
                {validCount} valid rows
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2 bg-red-100 text-red-900 px-4 py-2 rounded-lg font-semibold">
                  <AlertCircle size={18} />
                  {invalidCount} errors
                </div>
              )}
              <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-semibold">
                {parsedRows.length} total rows
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Row</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Marker</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Domain</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Value</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Unit</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Source</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => (
                    <tr key={row.row} className={`border-b ${!row.isValid ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 text-gray-500">{row.row}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.test_date || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-gray-900">{row.marker_code}</div>
                        <div className="text-xs text-gray-500">{row.marker_name}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{row.domain}</td>
                      <td className="px-3 py-2 font-semibold text-blue-700">{row.value || '—'}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{row.unit}</td>
                      <td className="px-3 py-2">
                        {row.isValid && (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(row.status)}`}>
                            {row.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{row.source || '—'}</td>
                      <td className="px-3 py-2">
                        {row.isValid
                          ? <CheckCircle size={18} className="text-green-600" />
                          : (
                            <div className="flex items-center gap-1">
                              <X size={18} className="text-red-500" />
                              <span className="text-xs text-red-600">{row.error}</span>
                            </div>
                          )
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`mb-4 p-4 rounded-lg font-semibold ${
                uploadResult.failed === 0 ? 'bg-green-100 text-green-900' : 'bg-yellow-100 text-yellow-900'
              }`}>
                {uploadResult.failed === 0
                  ? `✅ All ${uploadResult.success} rows saved successfully!`
                  : `⚠️ ${uploadResult.success} saved, ${uploadResult.failed} failed.`}
              </div>
            )}

            {/* Upload Button */}
            {!uploadResult && (
              <div className="flex gap-3">
                <button
                  onClick={uploadData}
                  disabled={uploading || validCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {uploading
                    ? <><Loader className="animate-spin" size={20} /> Uploading {validCount} rows...</>
                    : <><Upload size={20} /> Save {validCount} Valid Rows to Database</>
                  }
                </button>
                <button
                  onClick={() => { setParsedRows([]); setFileName(''); setUploadResult(null); }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition"
                >
                  Clear
                </button>
              </div>
            )}

            {/* After upload */}
            {uploadResult && (
              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/blood-work')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  View Blood Work Dashboard →
                </button>
                <button
                  onClick={() => { setParsedRows([]); setFileName(''); setUploadResult(null); }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition"
                >
                  Upload Another
                </button>
              </div>
            )}
          </div>
        )}

        {/* HOW IT WORKS GUIDE */}
        {parsedRows.length === 0 && (
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 border-2 border-white/30">
            <h3 className="font-bold text-white mb-3">📖 How bulk upload works:</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: '1', icon: '⬇️', title: 'Download', desc: 'Get the CSV template with all 60 markers pre-filled' },
                { step: '2', icon: '✏️', title: 'Fill Values', desc: 'Add test date, source, and your result values' },
                { step: '3', icon: '⬆️', title: 'Upload', desc: 'Drop your filled CSV here for instant preview' },
                { step: '4', icon: '✅', title: 'Save', desc: 'Review and save all valid rows to your blood work history' },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} className="bg-white/20 rounded-lg p-4 text-center text-white">
                  <div className="text-3xl mb-2">{icon}</div>
                  <div className="font-bold mb-1">{title}</div>
                  <div className="text-sm text-white/80">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
