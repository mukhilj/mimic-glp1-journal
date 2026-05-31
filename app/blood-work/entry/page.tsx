'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ChevronLeft, AlertCircle, Loader, Search, X, Upload } from 'lucide-react';

interface Marker {
  id: number;
  marker_code: string;
  marker_name: string;
  domain: string;
  unit: string;
  ref_min_male: number | null;
  ref_max_male: number | null;
  ref_min_female: number | null;
  ref_max_female: number | null;
  ref_min_other: number | null;
  ref_max_other: number | null;
  borderline_low: number | null;
  borderline_high: number | null;
  critical_low: number | null;
  critical_high: number | null;
  is_critical: boolean;
}

interface UserProfile {
  gender?: string;
}

type DuplicateAction = 'skip' | 'overwrite' | 'save_new' | null;

export default function BloodWorkEntryPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allMarkers, setAllMarkers] = useState<Marker[]>([]);
  const [markersLoading, setMarkersLoading] = useState(false);

  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState('');
  const [labName, setLabName] = useState('');

  const [markerSearch, setMarkerSearch] = useState('');
  const [filteredMarkers, setFilteredMarkers] = useState<Marker[]>([]);
  const [showMarkerDropdown, setShowMarkerDropdown] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);

  const [markerValue, setMarkerValue] = useState('');
  const [markerNotes, setMarkerNotes] = useState('');
  const [refMin, setRefMin] = useState<number | null>(null);
  const [refMax, setRefMax] = useState<number | null>(null);
  const [status, setStatus] = useState('Normal');

  const [batchMode, setBatchMode] = useState(false);
  const [addedEntries, setAddedEntries] = useState<string[]>([]);

  const [duplicateEntry, setDuplicateEntry] = useState<any>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (user) { loadUserProfile(user.id); loadMarkers(); }
  }, [user]);

  useEffect(() => {
    if (allMarkers.length > 0) {
      const search = markerSearch.toLowerCase();
      const filtered = allMarkers.filter(m =>
        m.marker_code.toLowerCase().includes(search) ||
        m.marker_name.toLowerCase().includes(search) ||
        m.domain.toLowerCase().includes(search)
      );
      setFilteredMarkers(filtered.slice(0, 10));
    }
  }, [markerSearch, allMarkers]);

  useEffect(() => {
    if (selectedMarker && userProfile) {
      const gender = userProfile.gender || 'Other';
      let min, max;
      if (gender === 'M') { min = selectedMarker.ref_min_male; max = selectedMarker.ref_max_male; }
      else if (gender === 'F') { min = selectedMarker.ref_min_female; max = selectedMarker.ref_max_female; }
      else { min = selectedMarker.ref_min_other; max = selectedMarker.ref_max_other; }
      setRefMin(min ?? null);
      setRefMax(max ?? null);
    }
  }, [selectedMarker, userProfile]);

  useEffect(() => {
    if (selectedMarker && markerValue && refMin !== null && refMax !== null) {
      const value = parseFloat(markerValue);
      if (selectedMarker.critical_low && value <= selectedMarker.critical_low) setStatus('Critical_Low');
      else if (selectedMarker.critical_high && value >= selectedMarker.critical_high) setStatus('Critical_High');
      else if (value < refMin) setStatus('Low');
      else if (value > refMax) setStatus('High');
      else setStatus('Normal');
    }
  }, [markerValue, selectedMarker, refMin, refMax]);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadUserProfile(userId: string) {
    try {
      const { data } = await supabase.from('user_preferences').select('gender').eq('user_id', userId).single();
      if (data) setUserProfile(data);
    } catch (e) { console.error(e); }
  }

  async function loadMarkers() {
    setMarkersLoading(true);
    try {
      const { data, error } = await supabase.from('health_markers_library').select('*').order('domain').order('display_order');
      if (error) throw error;
      if (data) setAllMarkers(data);
    } catch (e) { showMessage('Error loading markers', 'error'); }
    finally { setMarkersLoading(false); }
  }

  async function checkDuplicate(): Promise<any | null> {
    if (!user || !selectedMarker || !testDate) return null;
    const { data } = await supabase
      .from('blood_work_entries')
      .select('id, value, test_date, marker_name')
      .eq('user_id', user.id)
      .eq('marker_code', selectedMarker.marker_code)
      .eq('test_date', testDate)
      .single();
    return data || null;
  }

  async function handleSave() {
    if (!user || !selectedMarker || !markerValue || !testDate) {
      showMessage('Please fill all required fields', 'error'); return;
    }
    const existing = await checkDuplicate();
    if (existing) {
      setDuplicateEntry(existing);
      setShowDuplicateModal(true);
      return;
    }
    await performSave('save_new');
  }

  async function handleDuplicateAction(action: DuplicateAction) {
    setShowDuplicateModal(false);
    if (action === 'skip') {
      showMessage(`Skipped — keeping existing entry for ${selectedMarker?.marker_name} on ${testDate}.`, 'success');
      resetMarkerFields();
      return;
    }
    await performSave(action);
  }

  async function performSave(action: DuplicateAction) {
    if (!user || !selectedMarker) return;
    setSaving(true);
    try {
      const entryData = {
        user_id: user.id,
        test_date: testDate,
        source: source || null,
        lab_name: labName || null,
        marker_code: selectedMarker.marker_code,
        marker_name: selectedMarker.marker_name,
        domain: selectedMarker.domain,
        value: parseFloat(markerValue),
        unit: selectedMarker.unit,
        ref_range_min: refMin,
        ref_range_max: refMax,
        status: status,
        notes: markerNotes || null,
      };

      if (action === 'overwrite' && duplicateEntry) {
        const { error } = await supabase.from('blood_work_entries').update(entryData).eq('id', duplicateEntry.id);
        if (error) throw error;
        showMessage(`✓ ${selectedMarker.marker_name} updated (was: ${duplicateEntry.value}, now: ${markerValue})`, 'success');
      } else {
        const { error } = await supabase.from('blood_work_entries').insert([entryData]);
        if (error) throw error;
        showMessage(`✓ ${selectedMarker.marker_name} saved!`, 'success');
      }

      setAddedEntries(prev => [...prev, selectedMarker.marker_name]);
      setDuplicateEntry(null);
      if (batchMode) { resetMarkerFields(); }
      else { setTimeout(() => router.push('/blood-work'), 1500); }
    } catch (e: any) {
      showMessage('Error: ' + (e.message || 'Failed to save'), 'error');
    } finally { setSaving(false); }
  }

  function resetMarkerFields() {
    setMarkerValue(''); setMarkerNotes(''); setMarkerSearch('');
    setSelectedMarker(null); setStatus('Normal'); setRefMin(null); setRefMax(null);
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage(text); setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  }

  function getStatusColor(s: string) {
    switch (s) {
      case 'Normal': return 'bg-green-100 text-green-900 border-green-300';
      case 'Low': return 'bg-yellow-100 text-yellow-900 border-yellow-300';
      case 'High': return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'Critical_Low': case 'Critical_High': return 'bg-red-100 text-red-900 border-red-300';
      default: return 'bg-gray-100 text-gray-900 border-gray-300';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold flex items-center gap-2">
          <Loader className="animate-spin" size={24} /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">

      {/* DUPLICATE MODAL */}
      {showDuplicateModal && duplicateEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle size={22} className="text-yellow-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Duplicate Entry Found</h2>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-2">
                An entry for <strong>{duplicateEntry.marker_name}</strong> on <strong>{testDate}</strong> already exists:
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Existing value</div>
                  <div className="text-xl font-bold text-yellow-800">{duplicateEntry.value} {selectedMarker?.unit}</div>
                </div>
                <div className="text-2xl">→</div>
                <div>
                  <div className="text-xs text-gray-500">New value</div>
                  <div className="text-xl font-bold text-blue-800">{markerValue} {selectedMarker?.unit}</div>
                </div>
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-700 mb-3">What would you like to do?</p>

            <div className="space-y-2">
              <button onClick={() => handleDuplicateAction('skip')}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold transition text-left flex items-center gap-3">
                <span className="text-xl">⏭️</span>
                <div>
                  <div className="font-semibold text-gray-900">Skip — Keep existing entry</div>
                  <div className="text-xs text-gray-500">Don't save. Old value {duplicateEntry.value} stays unchanged.</div>
                </div>
              </button>

              <button onClick={() => handleDuplicateAction('overwrite')}
                className="w-full px-4 py-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg font-semibold transition text-left flex items-center gap-3">
                <span className="text-xl">🔄</span>
                <div>
                  <div className="font-semibold text-orange-900">Overwrite — Replace with new value</div>
                  <div className="text-xs text-orange-600">Replaces {duplicateEntry.value} with {markerValue} {selectedMarker?.unit}.</div>
                </div>
              </button>

              <button onClick={() => handleDuplicateAction('save_new')}
                className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg font-semibold transition text-left flex items-center gap-3">
                <span className="text-xl">➕</span>
                <div>
                  <div className="font-semibold text-blue-900">Save as New — Keep both entries</div>
                  <div className="text-xs text-blue-600">Both values saved. Use if genuinely tested twice same day.</div>
                </div>
              </button>
            </div>

            <button onClick={() => setShowDuplicateModal(false)}
              className="mt-4 w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/30 text-white">
        <div className="max-w-3xl mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/blood-work')}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold">
                <ChevronLeft size={16} /> Back
              </button>
              <h1 className="text-2xl md:text-3xl font-bold">🧪 Add Blood Work</h1>
            </div>
            <button onClick={() => router.push('/blood-work/upload')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold text-sm">
              <Upload size={16} /> Bulk Upload
            </button>
          </div>
          <p className="text-white/80 text-sm">
            Add one marker below — or{' '}
            <button onClick={() => router.push('/blood-work/upload')} className="underline font-semibold hover:text-white">
              use Bulk Upload
            </button>{' '}
            to import many markers at once from a CSV file.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {message && (
          <div className={`mb-6 p-4 rounded-lg font-semibold flex items-center gap-2 ${
            messageType === 'error' ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'
          }`}>
            {messageType === 'error' && <AlertCircle size={20} />}
            {message}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
          {markersLoading && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-center gap-2">
              <Loader className="animate-spin" size={18} />
              <span className="text-blue-900 font-semibold">Loading health markers...</span>
            </div>
          )}

          {/* SECTION 1: TEST INFORMATION */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-blue-500">📅 Test Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Test Date <span className="text-red-600">*</span></label>
                <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none">
                  <option value="">Select source...</option>
                  <option value="AHC">Annual Health Check Up (AHC)</option>
                  <option value="Independent Blood Work">Independent Lab</option>
                  <option value="Home Test">Home Test Kit</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lab Name (Optional)</label>
                <input type="text" value={labName} onChange={(e) => setLabName(e.target.value)}
                  placeholder="e.g., Apollo Diagnostics"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* SECTION 2: MARKER */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-purple-500">🔍 Health Marker</h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Marker <span className="text-red-600">*</span></label>
              <div className="relative">
                <div className="flex gap-2 items-center">
                  <Search size={18} className="absolute left-4 text-gray-400" />
                  <input type="text" value={markerSearch}
                    onChange={(e) => { setMarkerSearch(e.target.value); setShowMarkerDropdown(true); }}
                    onFocus={() => setShowMarkerDropdown(true)}
                    placeholder="Search by code, name, or domain (e.g., HGB, Hemoglobin, CBC)"
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none" />
                  {selectedMarker && (
                    <button onClick={resetMarkerFields} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X size={18} className="text-gray-500" />
                    </button>
                  )}
                </div>
                {showMarkerDropdown && filteredMarkers.length > 0 && !selectedMarker && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                    {filteredMarkers.map((marker) => (
                      <button key={marker.id}
                        onClick={() => { setSelectedMarker(marker); setMarkerSearch(''); setShowMarkerDropdown(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-purple-50 border-b last:border-b-0 transition">
                        <div className="font-semibold text-gray-900">{marker.marker_code}</div>
                        <div className="text-sm text-gray-600">{marker.marker_name}</div>
                        <div className="text-xs text-gray-500">{marker.domain} • {marker.unit}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedMarker && (
              <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div><div className="text-xs text-gray-500">Marker Code</div><div className="text-lg font-bold text-gray-900">{selectedMarker.marker_code}</div></div>
                  <div><div className="text-xs text-gray-500">Domain</div><div className="text-lg font-bold text-gray-900">{selectedMarker.domain}</div></div>
                  <div><div className="text-xs text-gray-500">Name</div><div className="text-sm text-gray-900">{selectedMarker.marker_name}</div></div>
                  <div><div className="text-xs text-gray-500">Unit</div><div className="text-sm text-gray-900">{selectedMarker.unit}</div></div>
                </div>
                {refMin !== null && refMax !== null && (
                  <div className="p-3 bg-white rounded border border-purple-200">
                    <div className="text-xs text-gray-500 mb-1">Reference Range (Your Gender)</div>
                    <div className="text-sm font-semibold text-purple-900">{refMin} – {refMax} {selectedMarker.unit}</div>
                  </div>
                )}
              </div>
            )}

            {selectedMarker && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Value <span className="text-red-600">*</span></label>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" value={markerValue} onChange={(e) => setMarkerValue(e.target.value)}
                      placeholder="Enter value"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
                    <div className="px-4 py-3 bg-gray-100 rounded-lg font-semibold text-gray-700">{selectedMarker.unit}</div>
                  </div>
                </div>
                {markerValue && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <div className={`px-4 py-3 rounded-lg font-semibold border-2 ${getStatusColor(status)}`}>
                      {status === 'Normal' ? '✓ Normal' : status === 'Low' ? '↓ Low' : status === 'High' ? '↑ High' : '⚠ Critical'}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
              <textarea value={markerNotes} onChange={(e) => setMarkerNotes(e.target.value)}
                placeholder="Add any notes about this test result..." rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {/* SECTION 3: BATCH MODE */}
          <div className="mb-8">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded cursor-pointer" />
              <span className="text-sm font-semibold text-gray-700">
                🔄 Batch Entry Mode — Add multiple markers from same test
              </span>
            </label>
            {batchMode && addedEntries.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Added ({addedEntries.length}):</h3>
                <div className="flex flex-wrap gap-2">
                  {addedEntries.map((entry, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-200 text-green-900 rounded-full text-sm font-medium">✓ {entry}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6 border-t-2 border-gray-200">
            <button onClick={handleSave}
              disabled={saving || !selectedMarker || !markerValue || !testDate}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Save size={20} />
              {saving ? 'Saving...' : batchMode && addedEntries.length > 0 ? 'Add Another' : 'Save Entry'}
            </button>
            {batchMode && addedEntries.length > 0 && (
              <button onClick={() => { setAddedEntries([]); setBatchMode(false); router.push('/blood-work'); }}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition">
                Done ({addedEntries.length})
              </button>
            )}
            <button onClick={() => router.push('/blood-work')}
              className="px-6 py-3 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 transition">
              Cancel
            </button>
          </div>
        </div>

        {/* Tips banner */}
        <div className="mt-6 p-4 bg-white/30 backdrop-blur-sm rounded-lg border-2 border-white/50">
          <h3 className="text-sm font-semibold text-white mb-2">💡 Tips</h3>
          <ul className="text-sm text-white/90 space-y-1">
            <li>• Reference ranges auto-adjust based on your gender from profile</li>
            <li>• Status (Normal/Low/High/Critical) updates in real-time as you type</li>
            <li>• Enable Batch Mode to add multiple markers from the same test quickly</li>
            <li>• Duplicates are detected — you choose to Skip, Overwrite, or Save New</li>
            <li>• Use <button onClick={() => router.push('/blood-work/upload')} className="underline font-semibold">Bulk Upload</button> to import many markers from a CSV file</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
