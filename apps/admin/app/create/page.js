"use client";

import { useState } from "react";
import { api, apiFetch } from "@/lib/api";
import { Plus, Trash2, Save, Building2, BedDouble, CheckCircle, AlertCircle, Loader2, ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";

export default function CreateHotel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  // Hotel State
  const [hotel, setHotel] = useState({
    name: "",
    city: "",
    address: "",
    google_map_link: "",
    description: "",
    starting_price: "",
    images: "", // comma separated string for input
    amenities: "", // comma separated string for input
    manager_phone: "",
    manager_email: "",
    manager_name: "",
    is_verified: true,
    rating: "",
  });

  // Rooms State
  const [rooms, setRooms] = useState([
    { name: "", price: "", amenities: "", images: "", capacity_adults: 2, bed_size: "", total_units: 1 },
  ]);

  const [uploading, setUploading] = useState(false);

  // Helper to parse comma-separated strings to arrays
  const parseToArray = (str) => {
    if (!str) return [];
    return str.split(",").map((item) => item.trim()).filter((item) => item !== "");
  };

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

  const handleImageUpload = async (e, field, index = null) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls = [];

    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const { url } = await apiFetch('/v1/admin/media', { method: 'POST', body: form });
        uploadedUrls.push(url);
      }

      const newUrlsString = uploadedUrls.join(', ');

      if (index !== null) {
        // Room image upload
        const currentImages = rooms[index][field];
        const updatedImages = currentImages ? `${currentImages}, ${newUrlsString}` : newUrlsString;
        handleRoomChange(index, field, updatedImages);
      } else {
        // Hotel image upload
        const currentImages = hotel[field];
        const updatedImages = currentImages ? `${currentImages}, ${newUrlsString}` : newUrlsString;
        setHotel(prev => ({ ...prev, [field]: updatedImages }));
      }

    } catch (error) {
      console.error('Error uploading images:', error);
      setStatus({ type: "error", message: "Failed to upload images: " + error.message });
    } finally {
      setUploading(false);
      // Clear the input value to allow uploading the same file again if needed
      e.target.value = null;
    }
  };

  const handleRoomChange = (index, field, value) => {
    const newRooms = [...rooms];
    // Capitalize room name field
    const processedValue = field === 'name' ? capitalizeName(value) : value;
    newRooms[index][field] = processedValue;
    setRooms(newRooms);
  };

  const addRoom = () => {
    setRooms([
      ...rooms,
      { name: "", price: "", amenities: "", images: "", capacity_adults: 2, bed_size: "", total_units: 1 },
    ]);
  };

  const removeRoom = (index) => {
    const newRooms = rooms.filter((_, i) => i !== index);
    setRooms(newRooms);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      // 1. Prepare Hotel Data
      const hotelPayload = {
        name: hotel.name,
        city: hotel.city,
        address: parseToArray(hotel.address),
        google_map_link: hotel.google_map_link,
        description: hotel.description,
        starting_price: parseInt(hotel.starting_price) || 0,
        images: parseToArray(hotel.images),
        amenities: parseToArray(hotel.amenities),
        manager_phone: hotel.manager_phone,
        manager_email: hotel.manager_email,
        manager_name: hotel.manager_name,
        is_verified: hotel.is_verified,
        rating: hotel.rating ? parseFloat(hotel.rating) : null,
        payment_methods: ['EVC Plus', 'Waafi'],
        security_features: ['24/7 Guard'],
      };

      // 2. Insert Hotel
      const { data: hotelData, error: hotelError } = await api
        .from("hotels")
        .insert(hotelPayload)
        .select()
        .single();

      if (hotelError) throw new Error(`Hotel Error: ${hotelError.message}`);

      const hotelId = hotelData.id;

      // 3. Prepare Rooms Data
      const roomsPayload = rooms.map((room) => {
        const amenitiesList = parseToArray(room.amenities);

        return {
          hotel_id: hotelId,
          name: room.name,
          price: parseInt(room.price) || 0,
          amenities: amenitiesList,
          images: parseToArray(room.images),
          capacity_adults: parseInt(room.capacity_adults) || 2,
          bed_size: room.bed_size,
          total_units: parseInt(room.total_units) || 1,
        };
      });

      // 4. Insert Rooms
      if (roomsPayload.length > 0) {
        const { error: roomsError } = await api
          .from("rooms")
          .insert(roomsPayload);

        if (roomsError) throw new Error(`Rooms Error: ${roomsError.message}`);
      }

      // Success
      setStatus({ type: "success", message: "Hotel and Rooms uploaded successfully!" });
      // Reset Form
      setHotel({
        name: "",
        city: "",
        address: "",
        google_map_link: "",
        description: "",
        starting_price: "",
        images: "",
        amenities: "",
        manager_phone: "",
        manager_name: "",
        is_verified: true,
        rating: "",
      });
      setRooms([{ name: "", price: "", amenities: "", images: "", capacity_adults: 2, bed_size: "", total_units: 1 }]);

    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

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
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Add New Hotel</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Create a new hotel listing and its rooms</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {loading ? "Saving..." : "Save All"}
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

        {/* Hotel Form Card */}
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
                placeholder="e.g. Jazeera Palace Hotel"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <input
                type="text" name="city" value={hotel.city} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Mogadishu"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Addresses (Comma separated)</label>
              <input
                type="text" name="address" value={hotel.address} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Km4, Makka Al Mukarama Rd"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Google Map Link</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="url" name="google_map_link" value={hotel.google_map_link} onChange={handleHotelChange}
                  className="w-full pl-9 p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>
            </div>

             <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                name="description" value={hotel.description} onChange={handleHotelChange}
                rows={3}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Brief description of the hotel..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Starting Price ($)</label>
              <input
                type="number" name="starting_price" value={hotel.starting_price} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Manager Name</label>
              <input
                type="text" name="manager_name" value={hotel.manager_name} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Contact Person"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Manager Phone</label>
              <input
                type="text" name="manager_phone" value={hotel.manager_phone} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="+252 61..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Manager Email</label>
              <input
                type="email" name="manager_email" value={hotel.manager_email} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="manager@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rating (1-5)</label>
              <input
                type="number" name="rating" value={hotel.rating} onChange={handleHotelChange}
                min="0" max="5" step="0.1"
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="4.5"
              />
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_verified"
                  checked={hotel.is_verified}
                  onChange={(e) => setHotel(prev => ({ ...prev, is_verified: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
                <span className="ml-3 text-sm font-medium text-slate-900 dark:text-gray-300">Verified Hotel</span>
              </label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Images (Comma separated URLs)</label>
              <div className="flex gap-2">
                <input
                  type="text" name="images" value={hotel.images} onChange={handleHotelChange}
                  className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                />
                <label className="flex items-center gap-2 cursor-pointer bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md transition-colors whitespace-nowrap">
                   {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                   <span className="text-sm">Upload</span>
                   <input
                     type="file"
                     multiple
                     accept="image/*"
                     className="hidden"
                     onChange={(e) => handleImageUpload(e, 'images')}
                     disabled={uploading}
                   />
                </label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Amenities (Comma separated)</label>
              <input
                type="text" name="amenities" value={hotel.amenities} onChange={handleHotelChange}
                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-gray-600 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="WiFi, Pool, Gym, Breakfast"
              />
            </div>
          </div>
        </section>

        {/* Rooms Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BedDouble className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              <h2 className="font-bold text-xl">Rooms Configuration</h2>
            </div>
            <button
              onClick={addRoom}
              className="flex items-center gap-2 text-sm bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 px-4 py-2 rounded-full font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Another Room
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {rooms.map((room, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-gray-700 relative group">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

                  <div className="md:col-span-1 flex justify-center pt-2">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-slate-500">
                      {index + 1}
                    </span>
                  </div>

                  <div className="md:col-span-11 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase text-slate-500">Room Name</label>
                      <input
                        type="text" value={room.name} onChange={(e) => handleRoomChange(index, "name", e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                        placeholder="e.g. Deluxe Single"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase text-slate-500">Price ($)</label>
                      <input
                        type="number" value={room.price} onChange={(e) => handleRoomChange(index, "price", e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                        placeholder="50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase text-slate-500">Bed Size</label>
                      <input
                        type="text" value={room.bed_size || ""} onChange={(e) => handleRoomChange(index, "bed_size", e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                        placeholder="e.g. King, Queen"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase text-slate-500">Adults (Capacity)</label>
                      <input
                        type="number" value={room.capacity_adults} onChange={(e) => handleRoomChange(index, "capacity_adults", e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                        placeholder="2"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase text-slate-500">Total Units</label>
                      <input
                        type="number" value={room.total_units} onChange={(e) => handleRoomChange(index, "total_units", e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                        placeholder="1"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                       <label className="text-xs font-semibold uppercase text-slate-500">Images (Comma separated)</label>
                       <div className="flex gap-2">
                         <input
                          type="text" value={room.images} onChange={(e) => handleRoomChange(index, "images", e.target.value)}
                          className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                          placeholder="Image URLs..."
                        />
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 px-3 py-2 rounded transition-colors whitespace-nowrap">
                           {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                           <span className="text-xs font-bold">Upload</span>
                           <input
                             type="file"
                             multiple
                             accept="image/*"
                             className="hidden"
                             onChange={(e) => handleImageUpload(e, 'images', index)}
                             disabled={uploading}
                           />
                        </label>
                       </div>
                    </div>

                     <div className="space-y-1 md:col-span-2">
                       <label className="text-xs font-semibold uppercase text-slate-500">Amenities (Comma separated)</label>
                       <input
                        type="text" value={room.amenities} onChange={(e) => handleRoomChange(index, "amenities", e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-gray-600 bg-transparent text-sm focus:border-brand-500 outline-none"
                        placeholder="AC, TV, Balcony..."
                      />
                    </div>
                  </div>
                </div>

                {rooms.length > 1 && (
                  <button
                    onClick={() => removeRoom(index)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove Room"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
