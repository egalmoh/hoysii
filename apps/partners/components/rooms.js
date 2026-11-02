"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch } from "../lib/api";
export default function Rooms({ hotelId }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = () =>
    apiFetch(`/v1/partner/hotels/${hotelId}`).then((r) => setRows(r.rooms));
  useEffect(() => {
    let active = true;
    apiFetch(`/v1/partner/hotels/${hotelId}`)
      .then((r) => {
        if (active) setRows(r.rooms);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [hotelId]);
  const save = async (e, room, images) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    body.images = images;
    body.amenities = body.amenities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(
        room
          ? `/v1/partner/rooms/${room.id}`
          : `/v1/partner/hotels/${hotelId}/rooms`,
        { method: room ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      await load();
      setNotice("Room details saved.");
      if (!room) {
        form.reset();
        return true;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
    return false;
  };
  const remove = async (room) => {
    if (
      !window.confirm(
        `Delete ${room.name}? Rooms with booking history must be closed using availability blocks instead.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/partner/rooms/${room.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="panel">
        <h2>Rooms, rates and availability</h2>
        <p>
          Each room type has a quantity. Confirmed stays, active payment holds
          and closed units reduce availability for each occupied night; checkout
          day is available again.
        </p>
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
      </section>
      {!rows ? (
        <p>Loading rooms…</p>
      ) : (
        rows.map((r) => (
          <section className="panel" key={r.id}>
            <RoomForm room={r} save={save} busy={busy} />
            <button
              className="danger"
              disabled={busy}
              onClick={() => remove(r)}
            >
              Delete room type
            </button>
            <Inventory room={r} />
          </section>
        ))
      )}
      <section className="panel">
        <h2>Add a room type</h2>
        <RoomForm save={save} busy={busy} />
      </section>
    </>
  );
}
function RoomForm({ room, save, busy }) {
  const [images, setImages] = useState(room?.images || []),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
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
      setUploading(false);
      e.target.value = "";
    }
  };
  return (
    <form
      onSubmit={async (e) => {
        if (await save(e, room, images)) setImages([]);
      }}
      className="stack"
    >
      <h3>{room?.name || "New room"}</h3>
      <div className="grid">
        <label>
          Room type name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={room?.name}
          />
        </label>
        <label>
          Nightly rate · USD
          <input
            type="number"
            name="price"
            min="0.01"
            step="0.01"
            required
            defaultValue={room?.price}
          />
        </label>
        <label>
          Number of units
          <input
            type="number"
            name="total_units"
            min={1}
            max={10000}
            required
            defaultValue={room?.total_units || 1}
          />
        </label>
        <label>
          Guest capacity
          <input
            type="number"
            name="capacity_adults"
            min={1}
            max={20}
            required
            defaultValue={room?.capacity_adults || 2}
          />
        </label>
        <label>
          Bed size
          <input
            name="bed_size"
            maxLength={120}
            defaultValue={room?.bed_size || ""}
          />
        </label>
        <label>
          Amenities · comma-separated
          <input
            name="amenities"
            defaultValue={room?.amenities?.join(", ") || ""}
          />
        </label>
      </div>
      <div className="photos">
        {images.map((src, i) => (
          <div key={`${src}:${i}`}>
            <Image
              src={src}
              width={120}
              height={90}
              alt={`Room photo ${i + 1}`}
              unoptimized
            />
            <button
              type="button"
              className="danger"
              disabled={busy || uploading}
              onClick={() =>
                setImages((list) => list.filter((_, n) => n !== i))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <label>
        Add room photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={busy || uploading || images.length >= 30}
          onChange={upload}
        />
      </label>
      <button disabled={busy || uploading}>
        {uploading
          ? "Uploading…"
          : room
            ? "Save room and rate"
            : "Create room type"}
      </button>
    </form>
  );
}
function Inventory({ room }) {
  const [blocks, setBlocks] = useState([]),
    [days, setDays] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const refresh = async () => {
    const [b, d] = await Promise.all([
      apiFetch(`/v1/partner/rooms/${room.id}/blocks`),
      apiFetch(`/v1/partner/rooms/${room.id}/calendar?from=${from}`),
    ]);
    setBlocks(b);
    setDays(d);
  };
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch(`/v1/partner/rooms/${room.id}/blocks`),
      apiFetch(`/v1/partner/rooms/${room.id}/calendar?from=${from}`),
    ])
      .then(([b, d]) => {
        if (active) {
          setBlocks(b);
          setDays(d);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [room.id, room.total_units, from]);
  const add = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/partner/rooms/${room.id}/blocks`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      await refresh();
      form.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/partner/inventory-blocks/${id}`, {
        method: "DELETE",
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 24 }}>
      <h3>Availability · units remaining each night</h3>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <label>
        Calendar starts
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <div className="calendar" style={{ margin: "16px 0" }}>
        {days.map((d) => (
          <div
            key={d.day}
            className={`day ${d.available === 0 ? "closed" : ""}`}
          >
            <small>{d.day}</small>
            <p>{d.available} available</p>
          </div>
        ))}
      </div>
      <h3>Close units for outside bookings or maintenance</h3>
      <form className="grid" onSubmit={add}>
        <label>
          First occupied night
          <input name="start_date" type="date" required />
        </label>
        <label>
          Checkout / reopen date
          <input name="end_date" type="date" required />
        </label>
        <label>
          Units to close
          <input
            name="units"
            type="number"
            min={1}
            max={room.total_units}
            required
            defaultValue={1}
          />
        </label>
        <label>
          Reason
          <input name="reason" minLength={3} maxLength={1000} required />
        </label>
        <button disabled={busy}>Close units</button>
      </form>
      {blocks.map((b) => (
        <div className="row panel" key={b.id}>
          <p>
            {b.start_date} → {b.end_date} · {b.units} units · {b.reason}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => remove(b.id)}
          >
            Release block
          </button>
        </div>
      ))}
    </div>
  );
}
