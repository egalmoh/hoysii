"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/api";
import { ArrowLeft, Save, Trash2, BedDouble, Building2, Loader2, Plus, AlertCircle, CheckCircle, MapPin } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HotelEditor({ params }) {
  // Unwrap params using React.use() as per Next.js 15+ / recent React patterns effectively required for some versions,
  // or just access it directly if using older versions. Since package.json says "next": "16.1.4", params is a Promise.
  // We need to handle that. Wait, in 15+ layout/pages params are promises.
  // Safe approach: use React.use() or await in async component. But this is "use client", so we use `use`.

  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Fetch Hotel
      const { data: hotelData, error: hotelError } = await api
        .from("hotels")
        .select("*")
        .eq("id", id)
        .single();

      if (hotelError) {
        setStatus({ type: "error", message: "Failed to load hotel: " + hotelError.message });
        setLoading(false);
        return;
      }

      setHotel(hotelData);

      // Fetch Rooms
      const { data: roomsData, error: roomsError } = await api
        .from("rooms")
        .select("*")
        .eq("hotel_id", id);

      if (roomsError) {
        console.error("Error loading rooms:", roomsError);
      } else {
        setRooms(roomsData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Helper to capitalize each word in a name
  const capitalizeName = (str) => {
    if (!str) return str;
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Fields that should have names capitalized
  const nameFields = ['name', 'city', 'manager_name'];

  // Handlers
  const handleHotelChange = (e) => {
    const { name, value } = e.target;
    const processedValue = nameFields.includes(name) ? capitalizeName(value) : value;
    setHotel((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setHotel((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    setStatus({ type: "", message: "" });

    try {
      // Ensure arrays are strings if they came from inputs as strings, or arrays if untouched.
      // The inputs for images/amenities use string splitting logic in local state?
      // Wait, the input fields bind to `hotel.amenities`.
      // If it came from DB, it's an array. The input expects a string.
      // We need to convert array -> string for display, and string -> array for save.
      // Ah, complex. Let's handle generic inputs carefully.

      // Actually, for simplicity/consistency with the Create form, let's assume we treat them as strings in the INPUT
      // but we need to convert them.
      // BUT `hotel` state currently holds the DB object (arrays).
      // We should probably transform it for the form, or handle the input value prop logic.

      // Let's parse on save.
      const payload = { ...hotel };

      // Helper to ensure array
      const ensureArray = (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(s => s !== "");
        return [];
      };

      payload.images = ensureArray(hotel.images);
      payload.amenities = ensureArray(hotel.amenities);
      payload.address = ensureArray(hotel.address);
      payload.google_map_link = hotel.google_map_link;
      payload.starting_price = parseInt(hotel.starting_price);
      payload.rating = hotel.rating ? parseFloat(hotel.rating) : null;

      const { error } = await api
        .from("hotels")
        .update(payload)
        .eq("id", id);

      if (error) throw error;

      setStatus({ type: "success", message: "Changes saved successfully!" });
    } catch (error) {
       setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (window.confirm("Delete this room permanently?")) {
      const { error } = await api.from("rooms").delete().eq("id", roomId);
      if (error) {
        alert("Error deleting room: " + error.message);
      } else {
        setRooms(prev => prev.filter(r => r.id !== roomId));
      }
    }
  };

  // Helper for inputs handling arrays vs strings
  // If hotel.images is array, join it for the input.
  const getInputValue = (val) => {
    if (Array.isArray(val)) return val.join(", ");
    return val || "";
  };

  // Handler for array inputs
  const handleArrayInputChange = (e) => {
    const { name, value } = e.target;
    // We store the string temporary in state?
    // Or we keep it as string?
    // If we change the type of `hotel.name` from array to string mid-flight, React might complain or logic might break.
    // Better: Allow `hotel` state to hold strings for these fields if modified.
    setHotel(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900">
        <p className="text-xl font-semibold">Hotel not found</p>
        <Link href="/" className="text-brand-500 hover:underline">Go back home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans text-slate-800 dark:text-slate-100">
       <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Edit Property</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{hotel.name}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {status.message && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {status.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            <span className="font-medium">{status.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Section A: Hotel Details */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
               <div className="bg-slate-50 dark:bg-gray-800/50 px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h2 className="font-semibold text-lg">Hotel Details</h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hotel Name</label>
                  <input
                    type="text" name="name" value={hotel.name} onChange={handleHotelChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <input
                    type="text" name="city" value={hotel.city || ""} onChange={handleHotelChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Addresses (Comma separated)</label>
                  <input
                    type="text" name="address" value={getInputValue(hotel.address)} onChange={handleArrayInputChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Google Map Link</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="url" name="google_map_link" value={hotel.google_map_link || ""} onChange={handleHotelChange}
                      className="w-full pl-9 p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    name="description" value={hotel.description || ""} onChange={handleHotelChange}
                    rows={3}
                     className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                 <div className="space-y-2">
                  <label className="text-sm font-medium">Starting Price ($)</label>
                  <input
                    type="number" name="starting_price" value={hotel.starting_price} onChange={handleHotelChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rating</label>
                  <input
                    type="number" name="rating" value={hotel.rating || ""} onChange={handleHotelChange}
                     min="0" max="5" step="0.1"
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Manager Phone</label>
                  <input
                    type="text" name="manager_phone" value={hotel.manager_phone || ""} onChange={handleHotelChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Manager Email</label>
                  <input
                    type="email" name="manager_email" value={hotel.manager_email || ""} onChange={handleHotelChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Manager Name</label>
                  <input
                    type="text" name="manager_name" value={hotel.manager_name || ""} onChange={handleHotelChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_verified"
                      checked={hotel.is_verified}
                      onChange={handleCheckboxChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
                    <span className="ml-3 text-sm font-medium text-slate-900 dark:text-gray-300">Verified</span>
                  </label>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Images (Comma separated)</label>
                  <input
                    type="text" name="images" value={getInputValue(hotel.images)} onChange={handleArrayInputChange}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Amenities (Comma separated)</label>
                  <input
                    type="text" name="amenities" value={getInputValue(hotel.amenities)} onChange={handleArrayInputChange}
                     className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Section B: Room Management */}
          <div className="lg:col-span-1">
             <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden sticky top-8">
               <div className="bg-slate-50 dark:bg-gray-800/50 px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="font-semibold text-lg">Existing Rooms</h2>
                </div>
                <span className="bg-slate-200 dark:bg-gray-700 text-xs font-bold px-2 py-1 rounded-full">{rooms.length}</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-gray-700">
                {rooms.map((room) => (
                  <div key={room.id} className="p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between group">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">{room.name}</h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2">
                        <span>${room.price}</span>
                        <span>•</span>
                        <span>{room.capacity_adults} Adults</span>
                        <span>•</span>
                        <span>{room.total_units || 1} Units</span>
                        {room.bed_size && (
                          <>
                             <span>•</span>
                             <span>{room.bed_size}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Room"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {rooms.length === 0 && (
                   <div className="p-8 text-center text-slate-400 text-sm">
                     No rooms found for this hotel.
                   </div>
                )}
              </div>
             </section>
          </div>

        </div>
       </div>
    </div>
  );
}
