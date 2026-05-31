'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ChevronLeft, AlertCircle, Loader } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form state
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weight, setWeight] = useState('');
  const [weightDate, setWeightDate] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [preferredUnitSystem, setPreferredUnitSystem] = useState('Metric');
  
  // Calculated values
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Calculate age from DOB
  useEffect(() => {
    if (dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      setCalculatedAge(age >= 0 ? age : null);
    } else {
      setCalculatedAge(null);
    }
  }, [dateOfBirth]);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        // Load profile data after user is set
        await loadProfile(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(userId: string) {
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is expected for new users
        console.error('Error loading profile:', error);
      }

      if (data) {
        // Data exists - populate all fields
        console.log('Profile data found:', data);
        if (data.date_of_birth) setDateOfBirth(data.date_of_birth);
        if (data.gender) setGender(data.gender);
        if (data.height_cm !== null && data.height_cm !== undefined) setHeight(data.height_cm.toString());
        if (data.height_unit) setHeightUnit(data.height_unit);
        if (data.weight_kg !== null && data.weight_kg !== undefined) setWeight(data.weight_kg.toString());
        if (data.weight_date) setWeightDate(data.weight_date);
        if (data.weight_unit) setWeightUnit(data.weight_unit);
        if (data.preferred_unit_system) setPreferredUnitSystem(data.preferred_unit_system);
        showMessage('Profile data loaded! ✓', 'success');
      } else {
        console.log('No profile data found - first time user');
        // First time user - form stays empty
      }
    } catch (error) {
      console.error('Exception loading profile:', error);
    } finally {
      setDataLoading(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    
    if (!dateOfBirth || !gender) {
      showMessage('Please fill in Date of Birth and Gender', 'error');
      return;
    }

    setSaving(true);

    try {
      const profileData = {
        user_id: user.id,
        date_of_birth: dateOfBirth,
        gender: gender,
        height_cm: height ? parseFloat(height) : null,
        height_unit: heightUnit,
        weight_kg: weight ? parseFloat(weight) : null,
        weight_date: weightDate || null,
        weight_unit: weightUnit,
        preferred_unit_system: preferredUnitSystem,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving profile data:', profileData);

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(profileData, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      console.log('Profile saved successfully');
      showMessage('Profile saved successfully! ✓ Data will auto-load next time.', 'success');
      
      // Reload data to confirm it was saved
      setTimeout(() => {
        loadProfile(user.id);
      }, 500);
    } catch (error: any) {
      console.error('Save error:', error);
      showMessage('Error: ' + (error.message || 'Failed to save profile'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold flex items-center gap-2">
          <Loader className="animate-spin" size={24} />
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {/* Top Navigation */}
      <div className="bg-black/30 text-white">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold"
            >
              <ChevronLeft size={16} />
              Dashboard
            </button>
            <h1 className="text-2xl md:text-3xl font-bold">👤 Health Profile</h1>
          </div>
          
          <p className="text-white/80">
            Set up your health profile to get personalized health insights and accurate reference ranges for blood work markers.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6">
        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg font-semibold flex items-center gap-2 ${
            message.includes('Error') 
              ? 'bg-red-100 text-red-900' 
              : 'bg-green-100 text-green-900'
          }`}>
            {message.includes('Error') && <AlertCircle size={20} />}
            {message}
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
          
          {dataLoading && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-center gap-2">
              <Loader className="animate-spin" size={18} />
              <span className="text-blue-900 font-semibold">Loading your profile data...</span>
            </div>
          )}

          {/* SECTION 1: BASIC INFORMATION */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-blue-500">
              📋 Basic Information
            </h2>

            {/* Date of Birth */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date of Birth <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              {calculatedAge !== null && (
                <p className="text-sm text-gray-600 mt-2">
                  Current Age: <span className="font-semibold text-blue-600">{calculatedAge} years</span>
                </p>
              )}
            </div>

            {/* Gender */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Gender <span className="text-red-600">*</span>
              </label>
              <div className="space-y-3">
                {['M', 'F', 'Other', 'Prefer not to say'].map((option) => (
                  <label key={option} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={option}
                      checked={gender === option}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-4 h-4 text-blue-600 cursor-pointer"
                    />
                    <span className="text-gray-700 font-medium">
                      {option === 'M' ? '👨 Male' : option === 'F' ? '👩 Female' : option === 'Other' ? '🤝 Other' : '🤐 Prefer not to say'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: PHYSICAL MEASUREMENTS */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-purple-500">
              📏 Physical Measurements (Optional)
            </h2>

            {/* Height */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Height</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Enter height"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <select
                  value={heightUnit}
                  onChange={(e) => setHeightUnit(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none font-semibold"
                >
                  <option value="cm">cm</option>
                  <option value="inches">inches</option>
                </select>
              </div>
            </div>

            {/* Weight with Date */}
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">⚖️ Current Weight</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Weight</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="Enter weight"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    <select
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value)}
                      className="px-3 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-semibold text-sm"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Weight As On Date</label>
                  <input
                    type="date"
                    value={weightDate}
                    onChange={(e) => setWeightDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-600">
                💡 When you add weight, please specify the date it was measured. This helps track your weight journey accurately.
              </p>
            </div>
          </div>

          {/* SECTION 3: PREFERENCES */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-pink-500">
              ⚙️ Preferences
            </h2>

            {/* Unit System */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Preferred Unit System
              </label>
              <div className="space-y-3">
                {['Metric', 'Imperial'].map((option) => (
                  <label key={option} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="unitSystem"
                      value={option}
                      checked={preferredUnitSystem === option}
                      onChange={(e) => setPreferredUnitSystem(e.target.value)}
                      className="w-4 h-4 text-pink-600 cursor-pointer"
                    />
                    <span className="text-gray-700 font-medium">
                      {option === 'Metric' ? '🌍 Metric (kg, cm, mg/dL)' : '🇺🇸 Imperial (lbs, inches, mg/dL)'}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                💡 This affects how measurements are displayed throughout the app.
              </p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ How This Information Is Used</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ <strong>Date of Birth & Gender:</strong> Auto-calculate your age and provide gender-specific health reference ranges</li>
              <li>✓ <strong>Weight & Date:</strong> Track your weight journey with accurate dates for trend analysis</li>
              <li>✓ <strong>Height:</strong> Calculate BMI and other health metrics</li>
              <li>✓ <strong>Unit Preference:</strong> Display measurements in your preferred system</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t-2 border-gray-200">
            <button
              onClick={saveProfile}
              disabled={saving || !dateOfBirth || !gender}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Required Fields Note */}
        <p className="text-white/80 text-sm mt-4 text-center">
          <span className="text-red-400">*</span> Required fields. Height and Weight are optional.
        </p>
      </div>
    </div>
  );
}
