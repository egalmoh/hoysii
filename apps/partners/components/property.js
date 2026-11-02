"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch } from "../lib/api";
export default function Property({ hotelId }) {
  const [property, setProperty] = useState(null),
    [images, setImages] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch(`/v1/partner/hotels/${hotelId}`)
      .then((r) => {
        if (active) {
          setProperty(r.hotel);
          setImages(r.hotel.images);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [hotelId]);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch("/v1/partner/media", {
        method: "POST",
        body: form,
      });
      setImages((list) => [...list, result.url]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    data.address = data.address
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    data.amenities = data.amenities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    data.images = images;
    try {
      await apiFetch(`/v1/partner/hotels/${hotelId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setNotice("Property details saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <h2>Property information</h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!property ? (
        <p>Loading property…</p>
      ) : (
        <form onSubmit={save} className="stack">
          <div className="grid">
            <label>
              Hotel name
              <input
                name="name"
                defaultValue={property.name}
                required
                maxLength={120}
              />
            </label>
            <label>
              City
              <input value={property.city} readOnly />
              <span>Contact Hoysii to change the property city.</span>
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={property.description || ""}
              maxLength={5000}
            />
          </label>
          <label>
            Address · one line per part
            <textarea
              name="address"
              defaultValue={property.address.join("\n")}
            />
          </label>
          <label>
            Amenities · separate with commas
            <input
              name="amenities"
              defaultValue={property.amenities.join(", ")}
            />
          </label>
          <div className="grid">
            {[
              ["manager_name", "Hotel contact name"],
              ["manager_email", "Reservation notification email"],
              ["manager_phone", "Hotel contact phone"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type={key === "manager_email" ? "email" : "text"}
                  defaultValue={property[key] || ""}
                  maxLength={254}
                />
              </label>
            ))}
          </div>
          <div className="grid">
            <label>
              Check-in time
              <input
                name="check_in_time"
                type="time"
                defaultValue={property.check_in_time}
                required
              />
            </label>
            <label>
              Check-out time
              <input
                name="check_out_time"
                type="time"
                defaultValue={property.check_out_time}
                required
              />
            </label>
          </div>
          <p className="muted">
            Hoysii manages the Verified control and cancellation rule.
          </p>
          <div>
            <h3>Hotel photos</h3>
            <div className="photos">
              {images.map((src, i) => (
                <div key={`${src}:${i}`}>
                  <Image
                    src={src}
                    width={120}
                    height={90}
                    alt={`Hotel photo ${i + 1}`}
                    unoptimized
                  />
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      setImages((list) =>
                        list.filter((_, index) => index !== i),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <label>
              Add a real property photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={upload}
                disabled={busy || images.length >= 30}
              />
            </label>
            <p className="muted">
              JPEG, PNG, WebP or AVIF, up to 8 MB. Save property details to
              publish photo changes.
            </p>
          </div>
          <button disabled={busy}>
            {busy ? "Saving…" : "Save property details"}
          </button>
        </form>
      )}
    </section>
  );
}
