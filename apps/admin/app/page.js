"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Edit, MapPin, Search } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";
import Image from "next/image";

export default function Dashboard() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHotels = async () => {
    const { data, error } = await api
      .from("hotels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching hotels:", error);
    } else {
      setHotels(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    api.from("hotels").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Error fetching hotels:", error);
      else setHotels(data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this hotel? This action cannot be undone.")) {
      // Optimistic update
      setHotels(hotels.filter(h => h.id !== id));

      const { error } = await api.from("hotels").delete().eq("id", id);

      if (error) {
        alert("Error deleting hotel: " + error.message);
        fetchHotels(); // Revert on error
      }
    }
  };

  const filteredHotels = hotels.filter(hotel =>
    hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hotel.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-100/50 p-6 dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-brand-900/20">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Hoysii Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your properties and bookings</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search hotels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none w-full sm:w-56"
              />
            </div>
            <Link
              href="/create"
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow transition-all whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Add New Hotel
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-slate-300 dark:border-gray-700">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No hotels found</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Get started by creating your first property.</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 mt-4 text-brand-600 dark:text-brand-400 font-medium hover:underline"
            >
              <Plus className="w-4 h-4" />
              Create Hotel
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHotels.map((hotel) => (
              <div key={hotel.id} className="group bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
                {/* Image Preview - First image or placeholder */}
                <div className="h-48 bg-slate-100 dark:bg-gray-950 relative overflow-hidden">
                  {hotel.images && hotel.images.length > 0 ? (
                    <img
                      src={hotel.images[0]}
                      alt={hotel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 ">
                      <Building2 className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  {hotel.is_verified && (
                    <span className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 backdrop-blur text-brand-600 dark:text-brand-400 text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                      Verified
                    </span>
                  )}
                  <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur">
                    ${hotel.starting_price}/night
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{hotel.name}</h3>
                    {hotel.rating && (
                      <span className="flex items-center text-amber-500 text-sm font-bold">
                        ★ {hotel.rating}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm mb-4">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span className="line-clamp-1">{hotel.city}, {hotel.address[0]}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-gray-800">
                    <Link
                      href={`/hotel/${hotel.id}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-900 dark:text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(hotel.id)}
                      className="flex items-center justify-center bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-lg transition-colors"
                      title="Delete Hotel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Building2({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
      <path d="M10 6h4"/>
      <path d="M10 10h4"/>
      <path d="M10 14h4"/>
      <path d="M10 18h4"/>
    </svg>
  )
}
