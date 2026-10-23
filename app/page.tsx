"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  role: "member" | "admin";
  unit: string | null;
};
type Submission = {
  id: string;
  title: string;
  category: string;
  unit: string;
  academic_year: string | null;
  description: string;
  data: Record<string, string>;
  file_urls: string[];
  status: string;
  feedback: string | null;
  created_at: string;
  submitted_by: string;
};

const categories: Record<string, string[]> = {
  Home: [
    "Hero Banner",
    "Announcements",
    "Why Sri Shakthi",
    "Programmes Highlight",
    "Placements Highlight",
    "Campus Events",
    "Special Laboratories",
    "Student Achievers",
    "Contact & Footer",
  ],
  About: [
    "Vision and Mission",
    "Chairman's Desk",
    "From the Principal",
    "Core Beliefs",
    "Leadership & Administration",
  ],
  Academics: [
    "Academic Overview",
    "UG & PG Programmes",
    "Curriculum",
    "Central Library",
    "Controller of Examinations",
    "Academic Calendar",
  ],
  Departments: [
    "Department Overview",
    "Vision & Mission",
    "Faculty",
    "Programmes & Intake",
    "Laboratories",
    "Curriculum & Syllabus",
    "PEOs / POs / PSOs",
    "Achievements",
    "Events",
    "Placements",
  ],
  Campus: [
    "Campus Life",
    "Facilities",
    "Hostel",
    "Transport",
    "Sports",
    "Student Clubs",
    "NCC & NSS",
  ],
  Accreditation: [
    "Governance & Committees",
    "Mandatory Disclosure",
    "Statutory Declaration",
    "NIRF",
    "NAAC",
    "NBA",
    "IQAC",
    "ARIIA Report",
  ],
  Admissions: [
    "Admission Overview",
    "Eligibility",
    "Programmes & Intake",
    "Fee Structure",
    "Scholarships",
    "Admission Enquiry",
    "Admission Referral",
  ],
  Placements: [
    "Placement Overview",
    "Training & Career Development",
    "Recruiters",
    "Placement Records",
    "Student Success Stories",
    "Higher Education",
  ],
  "Research & Innovation": [
    "Research & Development",
    "Innovation & Incubation",
    "Centres of Excellence",
    "Special Laboratories",
    "Entrepreneurship Development Cell",
  ],
  Community: ["Alumni", "Careers", "Contact Us", "News & Events"],
};
const departments = [
  "Agricultural Engineering",
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Biomedical Engineering",
  "Biotechnology",
  "Civil Engineering",
  "Computer Science and Engineering",
  "Computer Science and Engineering (Cyber Security)",
  "Electronics and Communication Engineering",
  "Electronics Engineering (VLSI Design)",
  "Electrical and Electronics Engineering",
  "Information Technology",
  "Mechanical Engineering",
  "Science and Humanities",
];
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 10;
const allowedFiles = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
const units = [
  "Institutional Administration",
  "Computer Science and Engineering",
  "Information Technology",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Artificial Intelligence and Data Science",
  "Other Department",
  "Club",
  "Sports",
  "Transport",
  "EDC",
  "Placement Office",
  "Library",
];
const demoAccounts = {
  "admin@siet.ac.in": {
    password: "Admin@2727",
    name: "SIET Administrator",
    role: "admin" as const,
    unit: "Institutional Administration",
  },
  "coordinator@siet.ac.in": {
    password: "User@2727",
    name: "Department Coordinator",
    role: "member" as const,
    unit: "Computer Science and Engineering",
  },
};
const demoSeed: Submission[] = [
  {
    id: "demo-submission-1",
    title: "CSE Department Profile 2026–2027",
    category: "Departments — Department Overview",
    unit: "Computer Science and Engineering",
    academic_year: "2026–2027",
    description:
      "Updated department overview, programmes, facilities and academic highlights for the institutional website.",
    data: {
      target_department: "Computer Science and Engineering",
      additional_text:
        "Use as the opening introduction on the department page.",
    },
    file_urls: [],
    status: "Pending",
    feedback: null,
    created_at: new Date().toISOString(),
    submitted_by: "demo-user",
  },
];

export default function Home() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({
    title: "",
    category: "Home",
    item: "Hero Banner",
    target_department: departments[0],
    unit: units[0],
    academic_year: "2026–2027",
    description: "",
    fields: "",
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>(
    {},
  );
  const [activeArea, setActiveArea] = useState("Home");
  const [activeSection, setActiveSection] = useState("All sections");
  const [auth, setAuth] = useState({
    email: "",
    password: "",
    full_name: "",
    unit: units[0],
  });
  const selectedBytes = files
    ? Array.from(files).reduce((sum, file) => sum + file.size, 0)
    : 0;

  useEffect(() => {
    const savedDemo = DEMO_ENABLED
      ? localStorage.getItem("siet-demo-session")
      : null;
    if (savedDemo) {
      queueMicrotask(() => setSessionUser(JSON.parse(savedDemo)));
      return;
    }
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSessionUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSessionUser(session?.user ?? null),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  async function loadData() {
    if (!sessionUser) return;
    if (sessionUser.demo) {
      const account =
        demoAccounts[sessionUser.email as keyof typeof demoAccounts];
      setProfile({
        id: sessionUser.id,
        full_name: account.name,
        role: account.role,
        unit: account.unit,
      });
      if (account.role === "admin") {
        setActiveArea("All pages");
        setActiveSection("All sections");
      }
      const stored = localStorage.getItem("siet-demo-submissions");
      const all = stored ? (JSON.parse(stored) as Submission[]) : demoSeed;
      setSubmissions(
        account.role === "admin"
          ? all
          : all.filter(
              (s) =>
                s.submitted_by === sessionUser.id ||
                s.submitted_by === "demo-user",
            ),
      );
      return;
    }
    if (!supabase) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionUser.id)
      .maybeSingle();
    if (p) {
      setProfile(p as Profile);
      setForm((v) => ({ ...v, unit: p.unit || v.unit }));
      if (p.role === "admin") {
        setActiveArea("All pages");
        setActiveSection("All sections");
      }
    }
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setNotice(error.message);
    else setSubmissions((data || []) as Submission[]);
  }

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setNotice("");
    setLoading(true);
    if (mode === "signin") {
      const demo = DEMO_ENABLED
        ? demoAccounts[auth.email.toLowerCase() as keyof typeof demoAccounts]
        : undefined;
      if (demo) {
        if (auth.password !== demo.password) {
          setNotice(
            "Incorrect demo password. Use the credentials shown below.",
          );
          setLoading(false);
          return;
        }
        const user = {
          id: demo.role === "admin" ? "demo-admin" : "demo-user",
          email: auth.email.toLowerCase(),
          demo: true,
        };
        localStorage.setItem("siet-demo-session", JSON.stringify(user));
        if (!localStorage.getItem("siet-demo-submissions"))
          localStorage.setItem(
            "siet-demo-submissions",
            JSON.stringify(demoSeed),
          );
        setSessionUser(user);
        setLoading(false);
        return;
      }
      if (!supabase) {
        setNotice(
          "Use one of the demo accounts below, or configure Supabase for live accounts.",
        );
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: auth.email,
        password: auth.password,
      });
      if (error) setNotice(error.message);
    } else {
      if (!supabase) {
        setNotice(
          "Supabase must be configured to create live accounts. You can use a demo login below.",
        );
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: auth.email,
        password: auth.password,
        options: { data: { full_name: auth.full_name, unit: auth.unit } },
      });
      if (error) setNotice(error.message);
      else if (data.user)
        setNotice(
          "Account created. If email confirmation is enabled, verify your email before signing in. Ask the portal administrator to assign your correct role and unit.",
        );
    }
    setLoading(false);
  }

  async function submitContent(e: FormEvent) {
    e.preventDefault();
    setNotice("");
    if (!sessionUser || !profile) {
      setNotice(
        "Your profile is not ready. Refresh or contact the portal administrator.",
      );
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      setNotice("Please complete the submission title and description.");
      return;
    }
    if (files && files.length > MAX_FILES) {
      setNotice(`Choose no more than ${MAX_FILES} media files per submission.`);
      return;
    }
    if (
      files &&
      Array.from(files).some((file) => !allowedFiles.includes(file.type))
    ) {
      setNotice(
        "Unsupported file type. Use approved images, videos, PDF, Word, Excel or PowerPoint files.",
      );
      return;
    }
    if (files && Array.from(files).some((file) => file.size > MAX_FILE_BYTES)) {
      setNotice("Each media file must be 50 MB or smaller.");
      return;
    }
    if (selectedBytes > MAX_TOTAL_BYTES) {
      setNotice("The combined media size must be 100 MB or smaller.");
      return;
    }
    setLoading(true);
    const fileUrls: string[] = [];
    if (sessionUser.demo) {
      const dataFields: Record<string, string> = {
        additional_text: form.fields.trim(),
        target_department:
          form.category === "Departments" ? form.target_department : "",
      };
      const stored = localStorage.getItem("siet-demo-submissions");
      const all = stored ? (JSON.parse(stored) as Submission[]) : demoSeed;
      const created: Submission = {
        id: `demo-${Date.now()}`,
        submitted_by: sessionUser.id,
        title: form.title.trim(),
        category: `${form.category} — ${form.item}`,
        unit: profile.unit || form.unit,
        academic_year: form.academic_year || null,
        description: form.description.trim(),
        data: dataFields,
        file_urls: [],
        status: "Pending",
        feedback: null,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(
        "siet-demo-submissions",
        JSON.stringify([created, ...all]),
      );
      setNotice(
        files?.length
          ? "Demo submission saved. File contents are not stored in demo mode."
          : "Demo submission received successfully.",
      );
      setForm((v) => ({ ...v, title: "", description: "", fields: "" }));
      setFiles(null);
      await loadData();
      setLoading(false);
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    const uploadedPaths: string[] = [];
    if (files?.length) {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${sessionUser.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("content-files")
          .upload(path, file, { upsert: false });
        if (uploadError) {
          if (uploadedPaths.length) {
            await supabase.storage.from("content-files").remove(uploadedPaths);
          }
          setNotice(
            `File upload failed: ${uploadError.message}. Check that the content-files bucket is configured.`,
          );
          setLoading(false);
          return;
        }
        uploadedPaths.push(path);
        fileUrls.push(`storage://${path}`);
      }
    }
    const dataFields: Record<string, string> = {
      additional_text: form.fields.trim(),
      target_department:
        form.category === "Departments" ? form.target_department : "",
    };
    const { error } = await supabase.from("submissions").insert({
      submitted_by: sessionUser.id,
      title: form.title.trim(),
      category: `${form.category} — ${form.item}`,
      unit: profile.unit || form.unit,
      academic_year: form.academic_year || null,
      description: form.description.trim(),
      data: dataFields,
      file_urls: fileUrls,
      status: "Pending",
    });
    if (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from("content-files").remove(uploadedPaths);
      }
      setNotice(error.message);
    } else {
      setNotice("Submission received successfully.");
      setForm((v) => ({ ...v, title: "", description: "", fields: "" }));
      setFiles(null);
      await loadData();
    }
    setLoading(false);
  }

  async function openStoredFile(value: string) {
    if (!supabase) return;
    const path = value.startsWith("storage://")
      ? value.slice("storage://".length)
      : value;
    if (/^https?:\/\//.test(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage
      .from("content-files")
      .createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      setNotice(error?.message || "Unable to open this file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadStoredFile(
    value: string,
    title: string,
    index: number,
  ) {
    if (!supabase) return;
    const path = value.startsWith("storage://")
      ? value.slice("storage://".length)
      : value;
    let url = path;
    if (!/^https?:\/\//.test(path)) {
      const { data, error } = await supabase.storage
        .from("content-files")
        .createSignedUrl(path, 60 * 5);
      if (error || !data?.signedUrl) {
        setNotice(error?.message || "Unable to download this media file.");
        return;
      }
      url = data.signedUrl;
    }
    const response = await fetch(url);
    if (!response.ok) {
      setNotice("Unable to download this media file.");
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}-media-${index + 1}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function copySubmission(s: Submission) {
    const extra = s.data?.additional_text
      ? `\n\nAdditional content:\n${s.data.additional_text}`
      : "";
    const department = s.data?.target_department
      ? `\nDepartment: ${s.data.target_department}`
      : "";
    const content = `Page / section: ${s.category}${department}\nTitle: ${s.title}\nAcademic year: ${s.academic_year || "Not applicable"}\n\n${s.description}${extra}`;
    try {
      await navigator.clipboard.writeText(content);
      setNotice(
        "Submission text copied. It is ready to paste into the website editor.",
      );
    } catch {
      setNotice(
        "Copy was blocked by the browser. Select the text from the preview instead.",
      );
    }
  }

  async function updateStatus(s: Submission, status: string) {
    if (sessionUser?.demo) {
      const stored = localStorage.getItem("siet-demo-submissions");
      const all = stored ? (JSON.parse(stored) as Submission[]) : demoSeed;
      const updated = all.map((item) =>
        item.id === s.id
          ? { ...item, status, feedback: reviewFeedback[s.id] || null }
          : item,
      );
      localStorage.setItem("siet-demo-submissions", JSON.stringify(updated));
      setNotice(`Submission marked ${status.toLowerCase()}.`);
      await loadData();
      return;
    }
    if (!supabase) return;
    const { error } = await supabase
      .from("submissions")
      .update({
        status,
        feedback: reviewFeedback[s.id] || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    if (error) setNotice(error.message);
    else {
      setNotice(`Submission marked ${status.toLowerCase()}.`);
      await loadData();
    }
  }

  async function signOut() {
    localStorage.removeItem("siet-demo-session");
    if (supabase && !sessionUser?.demo) await supabase.auth.signOut();
    setProfile(null);
    setSessionUser(null);
  }
  function selectArea(area: string) {
    const firstItem = categories[area]?.[0] || "";
    setActiveArea(area);
    setActiveSection(isAdmin ? "All sections" : firstItem);
    setForm((value) => ({ ...value, category: area, item: firstItem }));
  }

  function selectSection(area: string, item: string) {
    setActiveArea(area);
    setActiveSection(item);
    setForm((value) => ({ ...value, category: area, item }));
    if (!isAdmin) {
      requestAnimationFrame(() =>
        document
          .getElementById("submission-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  function showAllContent() {
    setActiveArea("All pages");
    setActiveSection("All sections");
    setFilter("All");
  }

  const visible = useMemo(
    () =>
      submissions.filter((s) => {
        const statusMatches = filter === "All" || s.status === filter;
        const areaMatches =
          activeArea === "All pages" ||
          s.category.startsWith(`${activeArea} —`);
        const sectionMatches =
          activeSection === "All sections" ||
          s.category === `${activeArea} — ${activeSection}`;
        return statusMatches && areaMatches && sectionMatches;
      }),
    [submissions, filter, activeArea, activeSection],
  );

  if (!sessionUser)
    return (
      <main className="auth-layout">
        <section className="hero-panel">
          <div className="brand-line">
            <Image
              className="brand-logo"
              src="/brand/siet-institution-logo.png"
              alt="Sri Shakthi Institute logo"
              width={54}
              height={54}
              priority
            />
            <span>
              SRI SHAKTHI{" "}
              <small>INSTITUTE OF ENGINEERING &amp; TECHNOLOGY</small>
            </span>
          </div>
          <div className="hero-copy">
            <p className="eyebrow">SIET · CONTENT OPERATIONS</p>
            <h1>
              One campus.
              <br />
              Every story.
              <br />
              <em>Ready for the world.</em>
            </h1>
            <p>
              A trusted workspace for departments and coordinators to collect,
              review and prepare accurate institutional content.
            </p>
            <div className="feature-list">
              <span>✓ Structured department submissions</span>
              <span>✓ Documents, achievements and campus records</span>
              <span>✓ Transparent review and approval workflow</span>
            </div>
          </div>
          <div className="hero-foot">
            Powering the youth. Empowering the nation.
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <p className="eyebrow">SECURE PORTAL ACCESS</p>
            <h2>
              {mode === "signin" ? "Welcome to SIET" : "Create your account"}
            </h2>
            <p className="muted">Sign in as a coordinator or administrator.</p>
            <form onSubmit={handleAuth} className="stack">
              {mode === "signup" && (
                <>
                  <label>
                    Full name
                    <input
                      required
                      value={auth.full_name}
                      onChange={(e) =>
                        setAuth({ ...auth, full_name: e.target.value })
                      }
                      placeholder="Your full name"
                    />
                  </label>
                  <label>
                    Department / Unit
                    <select
                      value={auth.unit}
                      onChange={(e) =>
                        setAuth({ ...auth, unit: e.target.value })
                      }
                    >
                      {units.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                Institutional email
                <input
                  type="email"
                  required
                  value={auth.email}
                  onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                  placeholder="name@siet.ac.in"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  minLength={6}
                  required
                  value={auth.password}
                  onChange={(e) =>
                    setAuth({ ...auth, password: e.target.value })
                  }
                  placeholder="Enter your password"
                />
              </label>
              <button disabled={loading} className="primary">
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in to portal"
                    : "Create account"}
              </button>
            </form>
            {notice && <p className="notice">{notice}</p>}
            {mode === "signin" && DEMO_ENABLED && (
              <div className="demo-access">
                <div className="demo-title">
                  <span>DEMO ACCESS</span>
                  <small>Choose a role to fill credentials</small>
                </div>
                <button
                  type="button"
                  className="demo-account"
                  onClick={() =>
                    setAuth({
                      ...auth,
                      email: "admin@siet.ac.in",
                      password: "Admin@2727",
                    })
                  }
                >
                  <span className="demo-icon">A</span>
                  <span>
                    <strong>Administrator</strong>
                    <small>admin@siet.ac.in · Admin@2727</small>
                  </span>
                  <b>Use →</b>
                </button>
                <button
                  type="button"
                  className="demo-account"
                  onClick={() =>
                    setAuth({
                      ...auth,
                      email: "coordinator@siet.ac.in",
                      password: "User@2727",
                    })
                  }
                >
                  <span className="demo-icon user-icon">U</span>
                  <span>
                    <strong>Content Coordinator</strong>
                    <small>coordinator@siet.ac.in · User@2727</small>
                  </span>
                  <b>Use →</b>
                </button>
              </div>
            )}
            <p className="switch-text">
              {mode === "signin"
                ? "New coordinator?"
                : "Already have an account?"}{" "}
              <button
                className="text-button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setNotice("");
                }}
              >
                {mode === "signin" ? "Request access" : "Sign in"}
              </button>
            </p>
            <p className="small">
              Demo data stays in this browser. Live accounts use the configured
              Supabase project.
            </p>
          </div>
        </section>
      </main>
    );

  if (!profile)
    return (
      <main className="setup">
        <div className="setup-card">
          <h2>Profile setup pending</h2>
          <p>
            Your account exists, but the portal profile has not been created or
            assigned yet. Ask the administrator to run the profile setup SQL and
            assign your unit and role.
          </p>
          <button className="primary" onClick={() => void loadData()}>
            Retry
          </button>
          <button className="secondary" onClick={signOut}>
            Sign out
          </button>
          {notice && <p className="notice">{notice}</p>}
        </div>
      </main>
    );

  const isAdmin = profile.role === "admin";
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-line">
          <Image
            className="brand-logo"
            src="/brand/siet-institution-logo.png"
            alt="Sri Shakthi Institute logo"
            width={48}
            height={48}
          />
          <span>
            SIET <small>CONTENT MANAGER</small>
          </span>
        </div>
        <div className="side-label">WEBSITE PAGES</div>
        <button
          type="button"
          className={`nav-item nav-all ${activeArea === "All pages" ? "active" : ""}`}
          onClick={showAllContent}
        >
          <span>All content</span>
          <b>{submissions.length}</b>
        </button>
        <nav className="website-nav" aria-label="SIET website page structure">
          {Object.entries(categories).map(([area, items]) => (
            <div className="website-nav-group" key={area}>
              <button
                type="button"
                className={`nav-item ${activeArea === area ? "active" : ""}`}
                onClick={() => selectArea(area)}
              >
                <span>{area}</span>
                <b>{items.length}</b>
              </button>
              {activeArea === area && (
                <div className="submenu-list">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={activeSection === item ? "selected" : ""}
                      onClick={() => selectSection(area, item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <label className="mobile-section-select">
          Section
          <select
            value={activeSection}
            onChange={(event) =>
              event.target.value === "All sections"
                ? setActiveSection("All sections")
                : selectSection(activeArea, event.target.value)
            }
          >
            {isAdmin && <option>All sections</option>}
            {(categories[activeArea] || []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="sidebar-bottom">
          <div className="avatar">
            {profile.full_name?.slice(0, 1)?.toUpperCase() || "M"}
          </div>
          <div className="user-meta">
            <strong>{profile.full_name || sessionUser.email}</strong>
            <span>{isAdmin ? "Administrator" : "Content coordinator"}</span>
          </div>
          <button
            className="logout"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">SIET WEBSITE / {activeArea.toUpperCase()}</p>
            <h1>
              Good to see you,{" "}
              {(profile.full_name || "Coordinator").split(" ")[0]}
            </h1>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="header-action"
              onClick={
                isAdmin
                  ? showAllContent
                  : () =>
                      document
                        .getElementById("submission-form")
                        ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {isAdmin ? "View all content" : "+ New submission"}
            </button>
            <span className={`role-pill ${isAdmin ? "admin-pill" : ""}`}>
              {isAdmin ? "Administrator" : "Member"}
            </span>
            <span className="unit-pill">
              {profile.unit || "Unit not assigned"}
            </span>
          </div>
        </header>
        <div className="content-area">
          <div className="welcome-banner">
            <div>
              <p className="eyebrow">CONTENT COLLECTION CYCLE · 2026–2027</p>
              <h2>
                {isAdmin
                  ? "Review and publish institutional content"
                  : "Let’s get your website content ready."}
              </h2>
              <p>
                {isAdmin
                  ? "Review submissions from departments and institutional coordinators."
                  : "Submit verified information, images, documents, and achievements for your assigned unit."}
              </p>
            </div>
            <div className="banner-icon">✳</div>
          </div>
          <div className="stats-grid">
            <Stat
              label="Total submissions"
              value={submissions.length}
              note="All accessible records"
              active={filter === "All"}
              onClick={() => setFilter("All")}
            />
            <Stat
              label="Pending review"
              value={submissions.filter((s) => s.status === "Pending").length}
              note="Awaiting admin action"
              active={filter === "Pending"}
              onClick={() => setFilter("Pending")}
            />
            <Stat
              label="Approved"
              value={submissions.filter((s) => s.status === "Approved").length}
              note="Ready for website update"
              active={filter === "Approved"}
              onClick={() => setFilter("Approved")}
            />
            <Stat
              label="Needs correction"
              value={
                submissions.filter((s) => s.status === "Needs Correction")
                  .length
              }
              note="Follow-up required"
              active={filter === "Needs Correction"}
              onClick={() => setFilter("Needs Correction")}
            />
          </div>
          {!isAdmin && (
            <section className="panel" id="submission-form">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">NEW CONTENT</p>
                  <h2>Submit website content</h2>
                  <p className="muted">
                    Choose the exact website page and section, then provide
                    copy-ready text and approved media.
                  </p>
                </div>
                <span className="required-tag">* Required fields</span>
              </div>
              <form onSubmit={submitContent} className="submission-form">
                <div className="form-grid">
                  <label>
                    Content area *
                    <select
                      value={form.category}
                      onChange={(e) => {
                        const c = e.target.value;
                        setActiveArea(c);
                        setActiveSection(categories[c][0]);
                        setForm({
                          ...form,
                          category: c,
                          item: categories[c][0],
                        });
                      }}
                    >
                      {Object.keys(categories).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Content type *
                    <select
                      value={form.item}
                      onChange={(e) => {
                        setActiveSection(e.target.value);
                        setForm({ ...form, item: e.target.value });
                      }}
                    >
                      {categories[form.category].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  {form.category === "Departments" && (
                    <label className="span-2">
                      Department *
                      <select
                        value={form.target_department}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            target_department: e.target.value,
                          })
                        }
                      >
                        {departments.map((department) => (
                          <option key={department}>{department}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="span-2">
                    Website title / heading *
                    <input
                      required
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder="Enter the exact heading to publish"
                    />
                  </label>
                  <label>
                    Academic year
                    <select
                      value={form.academic_year}
                      onChange={(e) =>
                        setForm({ ...form, academic_year: e.target.value })
                      }
                    >
                      <option>2026–2027</option>
                      <option>2025–2026</option>
                      <option>2024–2025</option>
                      <option>Not applicable</option>
                    </select>
                  </label>
                  <label>
                    Responsible unit
                    <input value={profile.unit || form.unit} readOnly />
                  </label>
                  <label className="span-2">
                    Main website content *
                    <textarea
                      required
                      rows={5}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Write the complete, verified page content. Administrators can copy this text directly into the SIET website."
                    />
                  </label>
                  <label className="span-2">
                    Additional text / caption{" "}
                    <span className="optional">Optional</span>
                    <textarea
                      rows={3}
                      value={form.fields}
                      onChange={(e) =>
                        setForm({ ...form, fields: e.target.value })
                      }
                      placeholder="Add image captions, button labels, links, dates, contact details, or publishing notes."
                    />
                  </label>
                  <label className="span-2 upload-box">
                    <span className="upload-icon">↥</span>
                    <strong>Attach images, videos or documents</strong>
                    <span className="muted">
                      JPG, PNG, WebP, GIF, MP4, WebM, PDF, Word, Excel or
                      PowerPoint · maximum 10 files · 50 MB each · 100 MB total
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(e) => setFiles(e.target.files)}
                    />
                    {files?.length ? (
                      <>
                        <span className="file-count">
                          {files.length} file(s) ·{" "}
                          {(selectedBytes / 1024 / 1024).toFixed(1)} MB of 100
                          MB
                        </span>
                        <span className="storage-meter">
                          <i
                            style={{
                              width: `${Math.min(100, (selectedBytes / MAX_TOTAL_BYTES) * 100)}%`,
                            }}
                          />
                        </span>
                      </>
                    ) : null}
                  </label>
                </div>
                <div className="form-footer">
                  <span className="muted small">
                    Your submission will be marked Pending until reviewed.
                  </span>
                  <button className="primary" disabled={loading}>
                    {loading ? "Submitting…" : "Submit for review →"}
                  </button>
                </div>
              </form>
            </section>
          )}
          <section className="panel">
            <div className="panel-heading list-heading">
              <div>
                <p className="eyebrow">CONTENT REGISTER</p>
                <h2>{isAdmin ? "Submission review" : "Your submissions"}</h2>
                <p className="muted">
                  Showing{" "}
                  {activeArea === "All pages"
                    ? "all website pages"
                    : activeArea}
                  {activeSection !== "All sections"
                    ? ` / ${activeSection}`
                    : ""}
                  .
                </p>
              </div>
              <div className="register-actions">
                <select
                  className="filter-select"
                  aria-label="Filter submissions by status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All</option>
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Needs Correction</option>
                </select>
                <button
                  type="button"
                  className="clear-filter"
                  onClick={showAllContent}
                >
                  Reset filters
                </button>
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="empty-state">
                <div>▤</div>
                <strong>No submissions found</strong>
                <p>New content submissions will appear here.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Content</th>
                      <th>Unit</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Files</th>
                      {isAdmin && <th>Review action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.title}</strong>
                          <span className="table-sub">{s.category}</span>
                          <span className="table-desc">{s.description}</span>
                          {s.data?.additional_text && (
                            <span className="table-extra">
                              {s.data.additional_text}
                            </span>
                          )}
                          {s.data?.target_department && (
                            <span className="department-tag">
                              {s.data.target_department}
                            </span>
                          )}
                          {s.feedback && (
                            <span className="feedback">
                              Feedback: {s.feedback}
                            </span>
                          )}
                        </td>
                        <td>{s.unit}</td>
                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td>
                          <span
                            className={`status status-${s.status.toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td>
                          {s.file_urls?.length ? (
                            s.file_urls.map((u, i) => (
                              <div className="media-actions" key={u}>
                                <button
                                  className="file-link file-button"
                                  onClick={() => void openStoredFile(u)}
                                >
                                  Preview {i + 1} ↗
                                </button>
                                {isAdmin && (
                                  <button
                                    className="download-button"
                                    onClick={() =>
                                      void downloadStoredFile(u, s.title, i)
                                    }
                                  >
                                    Download ↓
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="review-cell">
                            <button
                              className="copy-button"
                              onClick={() => void copySubmission(s)}
                            >
                              Copy all text
                            </button>
                            {s.status === "Pending" ||
                            s.status === "Needs Correction" ? (
                              <>
                                <input
                                  className="feedback-input"
                                  value={reviewFeedback[s.id] || ""}
                                  onChange={(e) =>
                                    setReviewFeedback({
                                      ...reviewFeedback,
                                      [s.id]: e.target.value,
                                    })
                                  }
                                  placeholder="Feedback (optional)"
                                />
                                <div className="review-actions">
                                  <button
                                    className="approve"
                                    onClick={() =>
                                      void updateStatus(s, "Approved")
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="correct"
                                    onClick={() =>
                                      void updateStatus(s, "Needs Correction")
                                    }
                                  >
                                    Request changes
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span className="muted">Reviewed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="footer-note">
            SIET Content Collection Portal · Submit only accurate, approved
            content. Personal and confidential information must not be uploaded.
          </p>
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
function Stat({
  label,
  value,
  note,
  active,
  onClick,
}: {
  label: string;
  value: number;
  note: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`stat-card ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <small>{note}</small>
    </button>
  );
}
