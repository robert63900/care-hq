import React, { useEffect, useMemo, useState } from "react";
import { ensurePushSubscription, sendTestPush } from './pushClient.js';

const storageKey = "doctorTracker.v1";
const currency = (n) =>
  (n === "" || n === null || n === undefined || isNaN(+n))
    ? "—"
    : new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(+n);

const fmtDate = (v) => v ? new Date(v).toLocaleString() : "—";
const daysUntil = (v) => {
  if (!v) return null;
  const d = new Date(v);
  const now = new Date();
  const diff = d.setHours(0,0,0,0) - now.setHours(0,0,0,0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

const uid = () => Math.random().toString(36).slice(2, 10);

const seed = {
  doctors: [
    {
      id: uid(),
      name: "Dr. Singh",
      specialty: "Primary Care",
      location: "South Bend Clinic",
      phone: "574-555-0101",
      nextAppt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      notes: "Annual physical; bring labs.",
    },
  ],
  bills: [
    {
      id: uid(),
      doctorId: null,
      label: "Anthem premium",
      amount: 185,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 9).toISOString(),
      status: "due",
      notes: "Autopay off until Oct.",
    },
  ],
  settings: {
    notifyDaysBefore: 3,
    dark: true,
  },
};

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : seed;
    } catch (e) {
      return seed;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data]);

  // bootstrap userId for push
  useEffect(() => {
    if (!data.settings?.userId) {
      setData(d => ({...d, settings: {...d.settings, userId: Math.random().toString(36).slice(2,10)}}));
    }
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const soonAppts = data.doctors
      .filter((d) => d.nextAppt)
      .filter((d) => {
        const days = daysUntil(d.nextAppt);
        return days !== null && days <= (data.settings?.notifyDaysBefore ?? 3) && days >= 0;
      });
    const soonBills = data.bills
      .filter((b) => b.status !== "paid" && b.dueDate)
      .filter((b) => {
        const days = daysUntil(b.dueDate);
        return days !== null && days <= (data.settings?.notifyDaysBefore ?? 3) && days >= 0;
      });

    [...soonAppts, ...soonBills].forEach((item) => {
      const isAppt = !!item.specialty;
      const title = isAppt ? `Upcoming: ${item.name}` : `Bill due: ${item.label}`;
      const when = isAppt ? fmtDate(item.nextAppt) : fmtDate(item.dueDate);
      const body = isAppt ? `${item.specialty} • ${when}` : `${currency(item.amount)} • due ${when}`;
      try { new Notification(title, { body }); } catch {}
    });
  }, [data]);

  const upsertDoctor = (doc) => {
    setData((d) => ({ ...d, doctors: upsertById(d.doctors, doc) }));
  };
  const deleteDoctor = (id) => setData((d) => ({ ...d, doctors: d.doctors.filter((x) => x.id !== id), bills: d.bills.map(b => b.doctorId === id ? { ...b, doctorId: null } : b) }));
  const upsertBill = (bill) => setData((d) => ({ ...d, bills: upsertById(d.bills, bill) }));
  const deleteBill = (id) => setData((d) => ({ ...d, bills: d.bills.filter((x) => x.id !== id) }));

  const sortedDoctors = useMemo(() => {
    return [...data.doctors].sort((a, b) => (a.nextAppt || "").localeCompare(b.nextAppt || ""));
  }, [data.doctors]);
  const sortedBills = useMemo(() => {
    return [...data.bills].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [data.bills]);

  return (
    <div className={`min-h-screen ${data.settings?.dark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"}`}>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <Header data={data} setData={setData} />
        <Upcoming data={data} sortedDoctors={sortedDoctors} sortedBills={sortedBills} />

        <div className="grid md:grid-cols-5 gap-6 mt-6">
          <section className="md:col-span-3">
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">Doctors & Next Appointments</h2>
                <AddDoctorButton onAdd={(doc) => upsertDoctor(doc)} />
              </div>
              <DoctorsTable doctors={sortedDoctors} onSave={upsertDoctor} onDelete={deleteDoctor} />
            </Card>
          </section>
          <section className="md:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">Billing Reminders</h2>
                <AddBillButton doctors={data.doctors} onAdd={(bill) => upsertBill(bill)} />
              </div>
              <BillsTable bills={sortedBills} doctors={data.doctors} onSave={upsertBill} onDelete={deleteBill} />
            </Card>
          </section>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <Card>
            <h3 className="text-lg font-semibold mb-2">Import / Export</h3>
            <p className="text-sm opacity-80 mb-3">Your data is stored locally in your browser. Export a backup JSON or import on another device.</p>
            <ImportExport data={data} setData={setData} />
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-2">Tips</h3>
            <ul className="list-disc ml-5 space-y-1 text-sm opacity-90">
              <li>Click a field to edit inline. Changes auto-save.</li>
              <li>Use the ⏰ setting (top-right) to adjust how many days before you want reminders.</li>
              <li>Mark bills as Paid to archive them. Unpaid items stay top-of-list as they near due dates.</li>
            </ul>
          </Card>
        </div>

        <footer className="text-xs opacity-60 mt-10">Local-only MVP. No accounts, no cloud. Built for speed and privacy. ✌️</footer>
      </div>
    </div>
  );
}

function Header({ data, setData }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = data.settings?.userId;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Care HQ</h1>
        <p className="text-sm opacity-70">Track doctors, appointments, and bills in one place.</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setData((d) => ({ ...d, settings: { ...d.settings, dark: !d.settings?.dark } }))}
          className="px-3 py-2 rounded-xl border border-zinc-700/50 hover:border-zinc-500/70 shadow-sm"
          title="Toggle theme"
        >
          {data.settings?.dark ? "🌙" : "☀️"}
        </button>
        <button
          onClick={async () => { if (!busy) { try { setBusy(true); await ensurePushSubscription(userId); alert('Push enabled'); } catch(e){ alert(e.message || 'Push failed'); } finally { setBusy(false); } } }}
          className="px-3 py-2 rounded-xl border border-emerald-700/50 hover:border-emerald-500/70 shadow-sm"
          title="Enable Push"
        >🔔</button>
        <button
          onClick={async () => { try { await sendTestPush(userId); } catch(e) {} }}
          className="px-3 py-2 rounded-xl border border-emerald-700/50 hover:border-emerald-500/70 shadow-sm"
          title="Send test push"
        >🧪</button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-2 rounded-xl border border-zinc-700/50 hover:border-zinc-500/70 shadow-sm"
          title="Notifications & settings"
        >
          ⏰
        </button>
        {open && (
          <div className="absolute right-8 mt-14 p-4 rounded-2xl border border-zinc-700/50 bg-zinc-900/90 backdrop-blur shadow-xl w-72 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm">Notify days before</label>
              <input
                type="number"
                min={0}
                className="w-16 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700"
                value={data.settings?.notifyDaysBefore ?? 3}
                onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, notifyDaysBefore: +e.target.value } }))}
              />
            </div>
            <button
              className="w-full text-sm px-3 py-2 rounded-xl border border-zinc-700/50 hover:border-zinc-500/70"
              onClick={() => {
                localStorage.removeItem(storageKey);
                location.reload();
              }}
            >Reset demo data</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Upcoming({ data, sortedDoctors, sortedBills }) {
  const upcomingAppts = sortedDoctors.filter((d) => d.nextAppt).slice(0, 3);
  const dueBills = sortedBills.filter((b) => b.status !== "paid").slice(0, 4);
  return (
    <div className="grid md:grid-cols-2 gap-6 mt-6">
      <Card>
        <h3 className="text-lg font-semibold">Next Appointments</h3>
        <div className="mt-2 divide-y divide-zinc-700/40">
          {upcomingAppts.length === 0 && <div className="py-3 text-sm opacity-60">No appointments on the books.</div>}
          {upcomingAppts.map((d) => (
            <div key={d.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{d.name} <span className="opacity-70 text-sm">• {d.specialty}</span></div>
                <div className="text-sm opacity-80">{fmtDate(d.nextAppt)} — {d.location || "—"}</div>
              </div>
              <Pill when={d.nextAppt} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-lg font-semibold">Bills Due</h3>
        <div className="mt-2 divide-y divide-zinc-700/40">
          {dueBills.length === 0 && <div className="py-3 text-sm opacity-60">Nothing due. Nice.</div>}
          {dueBills.map((b) => (
            <div key={b.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{b.label} <span className="opacity-70 text-sm">• {b.amount ? currency(b.amount) : "—"}</span></div>
                <div className="text-sm opacity-80">Due {fmtDate(b.dueDate)}</div>
              </div>
              <Pill when={b.dueDate} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Pill({ when }) {
  const d = daysUntil(when);
  const label = d === null ? "—" : d === 0 ? "today" : d > 0 ? `${d}d` : `${Math.abs(d)}d past`;
  const tone = d === null ? "bg-zinc-700/50" : d < 0 ? "bg-red-600/20 text-red-300" : d <= 3 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-600/20 text-emerald-200";
  return <span className={`text-xs px-2 py-1 rounded-full ${tone}`}>{label}</span>;
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/60 shadow-xl p-4">
      {children}
    </div>
  );
}

function AddDoctorButton({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: uid(), name: "", specialty: "", location: "", phone: "", nextAppt: "", notes: "" });
  const reset = () => setForm({ id: uid(), name: "", specialty: "", location: "", phone: "", nextAppt: "", notes: "" });
  return (
    <>
      <button className="px-3 py-2 rounded-xl border border-zinc-700/50 hover:border-zinc-500/70" onClick={() => setOpen(true)}>+ Add</button>
      {open && (
        <Modal title="Add doctor" onClose={() => setOpen(false)}>
          <DoctorForm form={form} setForm={setForm} onSubmit={() => { onAdd(form); reset(); setOpen(false); }} />
        </Modal>
      )}
    </>
  );
}

function AddBillButton({ doctors, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: uid(), doctorId: "", label: "", amount: "", dueDate: "", status: "due", notes: "" });
  const reset = () => setForm({ id: uid(), doctorId: "", label: "", amount: "", dueDate: "", status: "due", notes: "" });
  return (
    <>
      <button className="px-3 py-2 rounded-xl border border-zinc-700/50 hover:border-zinc-500/70" onClick={() => setOpen(true)}>+ Add</button>
      {open && (
        <Modal title="Add bill reminder" onClose={() => setOpen(false)}>
          <BillForm doctors={doctors} form={form} setForm={setForm} onSubmit={() => { onAdd({ ...form, amount: +form.amount || "" }); reset(); setOpen(false); }} />
        </Modal>
      )}
    </>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-700/40 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700/40">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="px-3 py-1 rounded-lg border border-zinc-700/50" onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="opacity-80">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input(props) {
  return <input {...props} className={`w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/50 focus:outline-none ${props.className || ""}`} />;
}

function Textarea(props) {
  return <textarea {...props} className={`w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/50 focus:outline-none ${props.className || ""}`} />;
}

function Select(props) {
  return <select {...props} className={`w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/50 focus:outline-none ${props.className || ""}`} />;
}

function DoctorForm({ form, setForm, onSubmit }) {
  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Labeled label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Labeled>
      <Labeled label="Specialty"><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></Labeled>
      <Labeled label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Labeled>
      <Labeled label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Labeled>
      <Labeled label="Next appointment"><Input type="datetime-local" value={form.nextAppt} onChange={(e) => setForm({ ...form, nextAppt: e.target.value })} /></Labeled>
      <Labeled label="Notes" className="md:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Labeled>
      <div className="md:col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onSubmit} className="px-4 py-2 rounded-xl border border-zinc-700/50">Save</button>
      </div>
    </form>
  );
}

function BillForm({ doctors, form, setForm, onSubmit }) {
  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Labeled label="Label"><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></Labeled>
      <Labeled label="Amount (USD)"><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Labeled>
      <Labeled label="Due date"><Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Labeled>
      <Labeled label="Related doctor (optional)">
        <Select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
          <option value="">—</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name} • {d.specialty}</option>
          ))}
        </Select>
      </Labeled>
      <Labeled label="Status">
        <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="due">Due</option>
          <option value="paid">Paid</option>
        </Select>
      </Labeled>
      <Labeled label="Notes" className="md:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Labeled>
      <div className="md:col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onSubmit} className="px-4 py-2 rounded-xl border border-zinc-700/50">Save</button>
      </div>
    </form>
  );
}

function EditableCell({ value, onChange, type = "text" }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <input
      value={v}
      type={type}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onChange(v)}
      className="w-full bg-transparent px-2 py-1 rounded-lg border border-transparent focus:border-zinc-600"
    />
  );
}

function DoctorsTable({ doctors, onSave, onDelete }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left opacity-70">
          <tr>
            <th className="py-2 pr-3">Doctor</th>
            <th className="py-2 pr-3">Specialty</th>
            <th className="py-2 pr-3">Location</th>
            <th className="py-2 pr-3">Phone</th>
            <th className="py-2 pr-3">Next appointment</th>
            <th className="py-2 pr-3">Notes</th>
            <th className="py-2 pr-3 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700/40 align-top">
          {doctors.map((d) => (
            <tr key={d.id} className="hover:bg-zinc-800/30">
              <td className="py-2 pr-3 min-w-[14ch]">
                <EditableCell value={d.name} onChange={(v) => onSave({ ...d, name: v })} />
              </td>
              <td className="py-2 pr-3 min-w-[12ch]">
                <EditableCell value={d.specialty} onChange={(v) => onSave({ ...d, specialty: v })} />
              </td>
              <td className="py-2 pr-3 min-w-[16ch]">
                <EditableCell value={d.location} onChange={(v) => onSave({ ...d, location: v })} />
              </td>
              <td className="py-2 pr-3 min-w-[12ch]">
                <EditableCell value={d.phone} onChange={(v) => onSave({ ...d, phone: v })} />
              </td>
              <td className="py-2 pr-3 min-w-[22ch]">
                <EditableCell type="datetime-local" value={d.nextAppt} onChange={(v) => onSave({ ...d, nextAppt: v })} />
                <div className="text-xs opacity-70 mt-1">{fmtDate(d.nextAppt)} {d.nextAppt && <span className="ml-2"><Pill when={d.nextAppt} /></span>}</div>
              </td>
              <td className="py-2 pr-3 min-w-[18ch]">
                <EditableCell value={d.notes} onChange={(v) => onSave({ ...d, notes: v })} />
              </td>
              <td className="py-2 pr-3 text-right">
                <button className="px-2 py-1 rounded-lg border border-red-800/60 text-red-300 hover:bg-red-900/30" onClick={() => onDelete(d.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillsTable({ bills, doctors, onSave, onDelete }) {
  const docName = (id) => doctors.find((d) => d.id === id)?.name || "—";
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left opacity-70">
          <tr>
            <th className="py-2 pr-3">Label</th>
            <th className="py-2 pr-3">Doctor</th>
            <th className="py-2 pr-3">Amount</th>
            <th className="py-2 pr-3">Due</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Notes</th>
            <th className="py-2 pr-3 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700/40 align-top">
          {bills.map((b) => (
            <tr key={b.id} className="hover:bg-zinc-800/30">
              <td className="py-2 pr-3 min-w-[16ch]"><EditableCell value={b.label} onChange={(v) => onSave({ ...b, label: v })} /></td>
              <td className="py-2 pr-3 min-w-[12ch]">
                <select
                  className="w-full bg-transparent px-2 py-1 rounded-lg border border-transparent focus:border-zinc-600"
                  value={b.doctorId || ""}
                  onChange={(e) => onSave({ ...b, doctorId: e.target.value || null })}
                >
                  <option value="">—</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </td>
              <td className="py-2 pr-3 min-w-[10ch]">
                <EditableCell value={b.amount} onChange={(v) => onSave({ ...b, amount: +v || "" })} />
                <div className="text-xs opacity-70 mt-1">{currency(b.amount)}</div>
              </td>
              <td className="py-2 pr-3 min-w-[20ch]">
                <EditableCell type="datetime-local" value={b.dueDate} onChange={(v) => onSave({ ...b, dueDate: v })} />
                <div className="text-xs opacity-70 mt-1">{fmtDate(b.dueDate)} {b.dueDate && <span className="ml-2"><Pill when={b.dueDate} /></span>}</div>
              </td>
              <td className="py-2 pr-3 min-w-[10ch]">
                <select
                  className="w-full bg-transparent px-2 py-1 rounded-lg border border-transparent focus:border-zinc-600"
                  value={b.status}
                  onChange={(e) => onSave({ ...b, status: e.target.value })}
                >
                  <option value="due">Due</option>
                  <option value="paid">Paid</option>
                </select>
              </td>
              <td className="py-2 pr-3 min-w-[16ch]"><EditableCell value={b.notes} onChange={(v) => onSave({ ...b, notes: v })} /></td>
              <td className="py-2 pr-3 text-right"><button className="px-2 py-1 rounded-lg border border-red-800/60 text-red-300 hover:bg-red-900/30" onClick={() => onDelete(b.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportExport({ data, setData }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 items-start">
      <button
        className="px-3 py-2 rounded-xl border border-zinc-700/50 hover:border-zinc-500/70"
        onClick={() => {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `care-hq-backup-${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >Export JSON</button>

      <label className="px-3 py-2 rounded-xl border border-zinc-700/50 cursor-pointer hover:border-zinc-500/70">
        Import JSON
        <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          try {
            const next = JSON.parse(text);
            if (!next || typeof next !== "object") throw new Error("Invalid file");
            setData(next);
          } catch (err) {
            alert("Invalid JSON file.");
          }
        }} />
      </label>
    </div>
  );
}

function upsertById(arr, item) {
  const idx = arr.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...arr];
  const copy = [...arr];
  copy[idx] = item;
  return copy;
}
