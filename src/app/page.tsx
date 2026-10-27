"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowUpLeft, CalendarDays, ChevronLeft, ClipboardList, Package, Search,
  Truck, UserRound, Mic, Plus, Trash2, Pencil, X, Save, Boxes, CheckCircle2,
} from "lucide-react";

type Item = { id: string; quantity: string; unit: string; description: string };
type Shipment = { id: string; person: string; date: string; note: string; items: Item[]; createdAt: number };

const STORAGE_KEY = "barang.shipments.v1";
const UNITS = ["جفت", "عدد", "کارتن", "بسته", "کیلو", "تن", "حلقه", "کیسه", "متر", "شاخه", "دستگاه", "سایر"];

function persianDate(date = new Date()) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function digitsFa(value: string | number) {
  return String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
function digitsEn(value: string) {
  return value.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
function emptyItem(): Item {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, quantity: "", unit: "جفت", description: "" };
}
function normalizeItems(items: Item[]) {
  return items.map(item => ({ ...item, quantity: digitsEn(item.quantity).trim() }));
}
function speechSupported() {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export default function HomePage() {
  const [today, setToday] = useState("امروز");
  const [records, setRecords] = useState<Shipment[]>([]);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [error, setError] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");

  useEffect(() => {
    setToday(persianDate());
    setDate(persianDate());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRecords(JSON.parse(saved) as Shipment[]);
    } catch {
      setVoiceMessage("خواندن اطلاعات ذخیره‌شده با مشکل روبه‌رو شد.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
      catch { setVoiceMessage("ذخیره‌سازی در این مرورگر در دسترس نیست."); }
    }
  }, [records, ready]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return [...records].sort((a, b) => b.createdAt - a.createdAt);
    return records.filter(record =>
      record.person.toLocaleLowerCase().includes(term) ||
      record.items.some(item => item.unit.includes(term) || item.description.includes(term))
    ).sort((a, b) => b.createdAt - a.createdAt);
  }, [records, search]);

  const peopleCount = useMemo(() => new Set(records.map(r => r.person.trim().toLocaleLowerCase())).size, [records]);
  const itemCount = useMemo(() => records.reduce((sum, record) => sum + record.items.length, 0), [records]);

  function openNew() {
    setEditingId(null);
    setPerson("");
    setDate(persianDate());
    setNote("");
    setItems([emptyItem()]);
    setError("");
    setVoiceMessage("");
    setFormOpen(true);
  }

  function openEdit(record: Shipment) {
    setEditingId(record.id);
    setPerson(record.person);
    setDate(record.date);
    setNote(record.note);
    setItems(record.items.map(item => ({ ...item })));
    setError("");
    setVoiceMessage("");
    setFormOpen(true);
  }

  function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanPerson = person.trim();
    const cleanItems = normalizeItems(items).filter(item => item.quantity !== "" || item.description.trim());
    if (!cleanPerson) { setError("نام شخص را وارد کن."); return; }
    if (!cleanItems.length) { setError("حداقل یک قلم بار اضافه کن."); return; }
    if (cleanItems.some(item => !item.quantity || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      setError("برای هر قلم، تعداد معتبر و بیشتر از صفر وارد کن."); return;
    }
    const record: Shipment = {
      id: editingId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      person: cleanPerson,
      date: date.trim() || persianDate(),
      note: note.trim(),
      items: cleanItems,
      createdAt: editingId ? (records.find(r => r.id === editingId)?.createdAt ?? Date.now()) : Date.now(),
    };
    setRecords(current => editingId ? current.map(r => r.id === editingId ? record : r) : [record, ...current]);
    setFormOpen(false);
    setError("");
  }

  function deleteRecord(id: string) {
    if (window.confirm("این ارسال حذف شود؟ این کار قابل بازگشت نیست.")) {
      setRecords(current => current.filter(record => record.id !== id));
    }
  }

  function updateItem(id: string, field: keyof Item, value: string) {
    setItems(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  function startVoiceEntry() {
    type Recognition = new () => {
      lang: string; interimResults: boolean; maxAlternatives: number;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void;
    };
    const speechWindow = window as unknown as { SpeechRecognition?: Recognition; webkitSpeechRecognition?: Recognition };
    const RecognitionClass = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionClass) {
      setVoiceMessage("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود؛ از تایپ استفاده کن یا Safari/Chrome به‌روز را امتحان کن.");
      return;
    }
    setVoiceMessage("در حال گوش دادن… نام شخص و اقلام را بگو. بعد از تشخیص، متن را بررسی و اصلاح کن.");
    const recognition = new RecognitionClass();
    recognition.lang = "fa-IR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (!transcript) { setVoiceMessage("گفتاری تشخیص داده نشد؛ دوباره تلاش کن."); return; }
      const knownUnits = ["جفت","عدد","کارتن","بسته","کیلو","تن","حلقه","کیسه","متر","شاخه","دستگاه"];
      const unitPattern = knownUnits.join("|");
      const matcher = new RegExp("(\\d+(?:[.,]\\d+)?|[۰-۹٠-٩]+(?:[٫.,][۰-۹٠-٩]+)?)\\s*(" + unitPattern + ")", "g");
      const matches = [...transcript.matchAll(matcher)];
      let guessedName = transcript;
      if (matches.length) guessedName = transcript.slice(0, matches[0].index).trim().replace(/[،,؛;\s]+$/, "");
      if (guessedName) setPerson(current => current || guessedName);
      if (matches.length) {
        setItems(matches.map(match => {
          const unit = match[2];
          return { ...emptyItem(), quantity: digitsEn(match[1].replace(",", ".")), unit, description: "" };
        }));
        setVoiceMessage("متن تشخیص داده شد. نام و تعدادها را بررسی کن؛ تشخیص گفتار ممکن است اشتباه کند.");
      } else {
        setNote(current => current ? current + " " + transcript : transcript);
        setVoiceMessage("متن شنیده‌شده در توضیحات قرار گرفت؛ نام و اقلام را دستی تکمیل کن.");
      }
    };
    recognition.onerror = event => {
      const messages: Record<string, string> = {
        "not-allowed": "اجازه استفاده از میکروفون داده نشده است. در تنظیمات سایت، دسترسی میکروفون را فعال کن.",
        "service-not-allowed": "مرورگر اجازه استفاده از سرویس تشخیص گفتار را نمی‌دهد. Chrome را به‌روز کن و دوباره امتحان کن.",
        "audio-capture": "میکروفون پیدا نشد یا توسط برنامه دیگری استفاده می‌شود.",
        "network": "سرویس تشخیص گفتار به اینترنت وصل نشد. اتصال اینترنت را بررسی کن.",
        "no-speech": "صدایی دریافت نشد. دوباره بزن و واضح صحبت کن.",
        "language-not-supported": "تشخیص گفتار فارسی در این مرورگر پشتیبانی نمی‌شود.",
        "aborted": "ضبط صدا متوقف شد. برای تلاش دوباره روی میکروفون بزن.",
      };
      setVoiceMessage(messages[event.error ?? ""] ?? "شروع یا تشخیص صدا ناموفق بود. دسترسی میکروفون و اتصال اینترنت را بررسی کن.");
    };
    recognition.onend = () => {};
    try { recognition.start(); } catch { setVoiceMessage("شروع میکروفون ناموفق بود؛ دوباره تلاش کن."); }
  }

  function exportData(format: "json" | "csv") {
    const content = format === "json"
      ? JSON.stringify(records, null, 2)
      : ["نام شخص,تاریخ,شرح قلم,تعداد,واحد,توضیحات", ...records.flatMap(record => record.items.map(item =>
          [record.person, record.date, item.description, item.quantity, item.unit, record.note]
            .map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")
        ))].join("\n");
    const blob = new Blob([format === "csv" ? "\uFEFF" + content : content], { type: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `barang-backup-${Date.now()}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-icon"><Truck size={22} strokeWidth={2.1} /></div>
          <div><p className="brand-name">بارنگ</p><p className="brand-caption">مدیریت ارسال بار</p></div>
        </div>
        <div className="date-chip"><CalendarDays size={16} /><span>{today}</span></div>
      </header>

      <section className="welcome">
        <div><p className="eyebrow">پنل مدیریت</p><h1>سلام، خوش اومدی 👋</h1><p className="welcome-copy">ارسال‌هات رو یک‌جا ثبت و پیگیری کن.</p></div>
        <div className="welcome-art" aria-hidden="true"><div className="art-circle circle-one" /><div className="art-circle circle-two" /><Package size={42} strokeWidth={1.35} /></div>
      </section>

      <section className="stats-grid" aria-label="خلاصه ارسال‌ها">
        <article className="stat-card stat-primary">
          <div className="stat-top"><span className="stat-icon"><ClipboardList size={19} /></span><span className="stat-trend"><ArrowUpLeft size={14} /> ثبت‌شده</span></div>
          <p className="stat-label">کل ارسال‌ها</p><div className="stat-value">{digitsFa(records.length)} <span>مورد</span></div><p className="stat-foot">تعداد ثبت‌های ذخیره‌شده</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-blue"><UserRound size={19} /></span><span className="stat-trend muted"><Boxes size={13} /> اقلام</span></div>
          <p className="stat-label">اشخاص / اقلام</p><div className="stat-value">{digitsFa(peopleCount)} <span>نفر</span></div><p className="stat-foot">{digitsFa(itemCount)} قلم در همه ارسال‌ها</p>
        </article>
      </section>

      <section className="quick-section">
        <div className="section-heading"><div><h2>شروع سریع</h2><p>ثبت بار با تایپ یا گفتار</p></div></div>
        <button className="quick-action" type="button" onClick={openNew}>
          <span className="quick-icon"><Plus size={23} /></span><span className="quick-text"><strong>ثبت ارسال جدید</strong><small>نام شخص و یک یا چند قلم بار</small></span><ChevronLeft className="quick-chevron" size={20} />
        </button>
        <button className="quick-action voice-action" type="button" onClick={() => { openNew(); startVoiceEntry(); }}>
          <span className="quick-icon voice-icon"><Mic size={22} /></span><span className="quick-text"><strong>ثبت با صدا</strong><small>مثلاً: علی ۲۰ جفت و ۳ کارتن</small></span><ChevronLeft className="quick-chevron" size={20} />
        </button>
      </section>

      <section className="records-section">
        <div className="section-heading records-heading"><div><h2>آخرین ارسال‌ها</h2><p>ثبت‌های اخیر شما</p></div><div className="export-actions"><button className="text-link" type="button" onClick={() => exportData("csv")}>خروجی CSV</button><button className="text-link" type="button" onClick={() => exportData("json")}>پشتیبان JSON</button></div></div>
        <label className="search-box"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="جست‌وجو نام شخص یا نوع بار..." aria-label="جست‌وجو بین ارسال‌ها" /></label>
        {filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><Package size={27} strokeWidth={1.5} /></div><strong>{search ? "موردی پیدا نشد" : "هنوز ارسالی نداری"}</strong><p>{search ? "عبارت دیگری را امتحان کن." : "اولین ارسال را ثبت کن تا اینجا نمایش داده شود."}</p>{!search && <button type="button" className="empty-cta" onClick={openNew}>ثبت اولین ارسال <ChevronLeft size={16} /></button>}</div> :
          <div className="record-list">{filtered.map(record => <article className="record-card" key={record.id}>
            <div className="record-head"><div className="record-avatar"><UserRound size={19} /></div><div className="record-person"><strong>{record.person}</strong><span>{record.date}</span></div><div className="record-actions"><button type="button" aria-label="ویرایش ارسال" onClick={() => openEdit(record)}><Pencil size={16} /></button><button type="button" aria-label="حذف ارسال" onClick={() => deleteRecord(record.id)}><Trash2 size={16} /></button></div></div>
            <div className="record-items">{record.items.map(item => <div className="record-item" key={item.id}><span>{item.description || "بار ارسالی"}</span><strong>{digitsFa(item.quantity)} {item.unit}</strong></div>)}</div>
            {record.note && <p className="record-note">{record.note}</p>}
          </article>)}</div>}
      </section>

      <div className="storage-note"><CheckCircle2 size={14} /> در این نسخه اطلاعات روی همین مرورگر ذخیره می‌شود.</div>

      <nav className="bottom-nav" aria-label="منوی اصلی">
        <button className="nav-item active" type="button"><ClipboardList size={21} /><span>خانه</span></button>
        <button className="nav-item" type="button" onClick={() => document.querySelector(".records-section")?.scrollIntoView({ behavior: "smooth" })}><Package size={21} /><span>ارسال‌ها</span></button>
        <button className="nav-item" type="button" onClick={() => { setSearch(""); document.querySelector(".records-section")?.scrollIntoView({ behavior: "smooth" }); }}><UserRound size={21} /><span>اشخاص</span></button>
        <button className="nav-item" type="button" onClick={() => exportData("csv")}><CalendarDays size={21} /><span>گزارش‌ها</span></button>
      </nav>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
          <div className="modal-header"><div><p className="eyebrow">{editingId ? "ویرایش اطلاعات" : "ثبت اطلاعات جدید"}</p><h2 id="form-title">{editingId ? "ویرایش ارسال" : "ثبت ارسال بار"}</h2></div><button className="close-modal" type="button" onClick={() => setFormOpen(false)} aria-label="بستن"><X size={21} /></button></div>
          <form onSubmit={saveRecord}>
            <label className="field-label">نام شخص <span>*</span><input autoFocus value={person} onChange={event => setPerson(event.target.value)} placeholder="مثلاً: علی رضایی" /></label>
            <label className="field-label">تاریخ شمسی<input value={date} onChange={event => setDate(event.target.value)} placeholder="مثلاً ۱۴۰۵/۰۷/۰۵" /></label>
            <div className="items-title"><strong>اقلام بار</strong><span>برای هر نوع بار یک ردیف</span></div>
            <div className="item-form-list">{items.map((item, index) => <div className="item-form-card" key={item.id}>
              <div className="item-form-head"><span>قلم {digitsFa(index + 1)}</span>{items.length > 1 && <button type="button" className="remove-item" onClick={() => setItems(current => current.filter(x => x.id !== item.id))}><Trash2 size={14} /> حذف</button>}</div>
              <label className="field-label">شرح بار (اختیاری)<input value={item.description} onChange={event => updateItem(item.id, "description", event.target.value)} placeholder="مثلاً: کفش، پارچه..." /></label>
              <div className="quantity-row"><label className="field-label">تعداد <span>*</span><input inputMode="decimal" value={item.quantity} onChange={event => updateItem(item.id, "quantity", event.target.value)} placeholder="مثلاً ۲۰" /></label><label className="field-label">واحد<select value={item.unit} onChange={event => updateItem(item.id, "unit", event.target.value)}>{UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label></div>
            </div>)}</div>
            <button type="button" className="add-item-button" onClick={() => setItems(current => [...current, emptyItem()])}><Plus size={17} /> افزودن قلم دیگر</button>
            <label className="field-label">توضیحات (اختیاری)<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="یادداشت مربوط به این ارسال..." /></label>
            <div className="voice-entry-inline"><button type="button" onClick={startVoiceEntry}><Mic size={17} /> ورود با گفتار فارسی</button><p>ممکن است متن تشخیص داده‌شده نیاز به اصلاح داشته باشد.</p>{voiceMessage && <p className="voice-message" role="status">{voiceMessage}</p>}</div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-footer"><button type="button" className="cancel-button" onClick={() => setFormOpen(false)}>انصراف</button><button type="submit" className="save-button"><Save size={17} /> {editingId ? "ذخیره تغییرات" : "ثبت ارسال"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
