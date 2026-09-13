"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import dynamic from "next/dynamic";

const PdfEditor = dynamic(
  () => import("./PdfEditor"),
  { ssr: false }
);

type Tool =
  | "home"
  | "pdf-toolbox"
  | "image-toolbox"
  | "background"
  | "pdf-convert"
  | "pdf-text"
  | "pdf-editor"
  | "pdf-ai"
  | "pdf-data"
  | "pdf-organize"
  | "auto"
  | "cv-career";

type AutoResultType = "image" | "pdf" | "file" | null;

type PdfPage = {
  page: number;
  text: string;
};

type PdfExtractedData = {
  document_type?: string | null;
  invoice_number?: string | number | null;
  vendor?: string | null;
  customer?: string | null;
  date?: string | null;
  due_date?: string | null;
  currency?: string | null;
  subtotal?: string | number | null;
  tax?: string | number | null;
  total?: string | number | null;
  payment_status?: string | null;
  line_items?: {
    description?: string | null;
    quantity?: string | number | null;
    unit_price?: string | number | null;
    amount?: string | number | null;
  }[];
  custom_fields?: Record<string, unknown>;
};

type WorkflowStep = {
  step: number;
  tool: string;
  status: string;
  reason: string;
};

type WorkflowResponse = {
  workflow?: {
    steps?: {
      tool: string;
      reason: string;
    }[];
  };
  steps?: WorkflowStep[];
  summary?: string | null;
  answer?: string | null;
  sources?: number[];
  extracted_text?: string;
  has_word_file?: boolean;
  download_id?: string | null;
};

type AutoResponse = {
  tool?: string;
  reason?: string;
  answer?: string;
  sources?: number[];
  pages?: PdfPage[];
};

type CvExperience = {
  role?: string;
  company?: string;
  dates?: string;
  bullets?: string[];
};

type CvActionCard = {
  id: string;
  priority?: string;
  title?: string;
  issue?: string;
  current_text?: string;
  suggested_text?: string;
  section?: string;
  rationale?: string;
  can_apply?: boolean;
};

type CvAnalysis = {
  candidate_name?: string;
  headline?: string;
  target_role?: string;
  summary?: string;
  skills?: string[];
  strengths?: string[];
  weaknesses?: string[];
  missing_keywords?: string[];
  matched_keywords?: string[];
  recommendations?: string[];
  experience?: CvExperience[];
  ats_score?: number;
  ats_breakdown?: {
    role_alignment?: number;
    skills?: number;
    experience?: number;
    evidence?: number;
    keywords?: number;
  };
  job_match_summary?: string;
  action_cards?: CvActionCard[];
};

type CvJob = {
  id: string;
  title?: string;
  company?: string;
  location?: string;
  employment_type?: string;
  remote?: boolean;
  salary?: number | string | null;
  salary_currency?: string;
  url?: string;
  description?: string;
};

type CvProfileExperience = {
  company: string;
  role: string;
  location: string;
  start_date: string;
  end_date: string;
  current: boolean;
  bullets: string[];
};

type CvProfileEducation = {
  institution: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
};

type CvProfileProject = {
  name: string;
  description: string;
  link: string;
  technologies: string[];
};

type CvProfile = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  summary: string;
  skills: string[];
  experience: CvProfileExperience[];
  education: CvProfileEducation[];
  projects: CvProfileProject[];
  certifications: string[];
  languages: string[];
  custom_sections: Record<string, string[]>;
};

// Local development keeps using FastAPI on :8000.
// Production sets NEXT_PUBLIC_API_BASE=/api so Nginx can proxy
// browser requests to the FastAPI container without exposing :8000.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function Home() {
  const [activeTool, setActiveTool] =
    useState<Tool>("home");

  // ----------------------------------------------------------
  // Global
  // ----------------------------------------------------------

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.dataset.activeTool = activeTool;
    return () => {
      delete document.body.dataset.activeTool;
    };
  }, [activeTool]);

  // ----------------------------------------------------------
  // Background Removal
  // ----------------------------------------------------------

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [imageResult, setImageResult] =
    useState<string | null>(null);

  // ----------------------------------------------------------
  // Image Toolbox
  // ----------------------------------------------------------

  type ImageOperation = "resize" | "crop" | "convert" | "compress" | "background";
  type ImageOutputFormat = "png" | "jpg" | "webp";

  const [imageOperation, setImageOperation] =
    useState<ImageOperation>("resize");

  const [imageOutputFormat, setImageOutputFormat] =
    useState<ImageOutputFormat>("png");

  const [imageQuality, setImageQuality] =
    useState(85);

  const [imageWidth, setImageWidth] =
    useState("");

  const [imageHeight, setImageHeight] =
    useState("");

  const [imageKeepRatio, setImageKeepRatio] =
    useState(true);

  const [imageCropX, setImageCropX] =
    useState("0");

  const [imageCropY, setImageCropY] =
    useState("0");

  const [imageCropWidth, setImageCropWidth] =
    useState("");

  const [imageCropHeight, setImageCropHeight] =
    useState("");

  const [imageToolResultUrl, setImageToolResultUrl] =
    useState<string | null>(null);

  const [imageToolResultFormat, setImageToolResultFormat] =
    useState<ImageOutputFormat | null>(null);

  // ----------------------------------------------------------
  // PDF
  // ----------------------------------------------------------

  const [pdfFile, setPdfFile] =
    useState<File | null>(null);

  const [pdfText, setPdfText] =
    useState<PdfPage[]>([]);

  type PdfOutputFormat = "docx" | "txt" | "png";

  const [pdfOutputFormat, setPdfOutputFormat] =
    useState<PdfOutputFormat>("docx");

  const [pdfExtractedData, setPdfExtractedData] =
    useState<PdfExtractedData | null>(null);

  const [pdfDataOcrUsed, setPdfDataOcrUsed] =
    useState(false);

  const [pdfOrganizeOperation, setPdfOrganizeOperation] =
    useState<"merge" | "split" | "reorder">("merge");

  const [pdfOrganizeFiles, setPdfOrganizeFiles] =
    useState<File[]>([]);

  const [pdfPageRanges, setPdfPageRanges] =
    useState("");

  const [pdfPageOrder, setPdfPageOrder] =
    useState("");

  // ----------------------------------------------------------
  // PDF AI Q&A
  // ----------------------------------------------------------

  const [question, setQuestion] =
    useState("");

  const [answer, setAnswer] =
    useState<string | null>(null);

  const [sources, setSources] =
    useState<number[]>([]);

  // ----------------------------------------------------------
  // Auto Mode
  // ----------------------------------------------------------

  const [autoFiles, setAutoFiles] =
    useState<File[]>([]);

  const autoFile = autoFiles[0] ?? null;

  const [autoPrompt, setAutoPrompt] =
    useState("");

  const [autoResult, setAutoResult] =
    useState<AutoResponse | null>(null);

  const [autoResultType, setAutoResultType] =
    useState<AutoResultType>(null);

  const [workflowResult, setWorkflowResult] =
    useState<WorkflowResponse | null>(null);

  // ----------------------------------------------------------
  // CV & Career Workspace
  // ----------------------------------------------------------

  const [cvFile, setCvFile] =
    useState<File | null>(null);

  const [cvTargetJob, setCvTargetJob] =
    useState("");

  const [cvAnalysis, setCvAnalysis] =
    useState<CvAnalysis | null>(null);

  const [cvRawText, setCvRawText] =
    useState("");

  const [cvAppliedActions, setCvAppliedActions] =
    useState<CvActionCard[]>([]);

  const [cvAtsRefreshing, setCvAtsRefreshing] =
    useState(false);

  const [cvJobLocation, setCvJobLocation] = useState("");
  const [cvJobs, setCvJobs] = useState<CvJob[]>([]);
  const [cvJobsLoading, setCvJobsLoading] = useState(false);
  const [cvShowDetails, setCvShowDetails] = useState(false);
  const [cvProfile, setCvProfile] = useState<CvProfile | null>(null);
  const [cvSourceMode, setCvSourceMode] = useState<"cv" | "linkedin">("cv");
  const [cvLinkedInUrl, setCvLinkedInUrl] = useState("");
  const [cvTemplate, setCvTemplate] = useState<"ats-classic" | "modern" | "executive" | "minimal">("ats-classic");
  const [cvProfileLoading, setCvProfileLoading] = useState(false);
  const [cvExportLoading, setCvExportLoading] = useState(false);
  const [cvBuilderTab, setCvBuilderTab] = useState<"profile" | "builder">("profile");

  // ----------------------------------------------------------
  // Refs
  // ----------------------------------------------------------

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const pdfInputRef =
    useRef<HTMLInputElement | null>(null);

  const pdfOrganizeInputRef =
    useRef<HTMLInputElement | null>(null);

  const autoInputRef =
    useRef<HTMLInputElement | null>(null);

  const cvInputRef =
    useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  function clearError() {
    setError(null);
  }

  function goHome() {
    setActiveTool("home");
    setError(null);
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "0 Bytes";

    const sizes = [
      "Bytes",
      "KB",
      "MB",
      "GB",
    ];

    const i = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(
      bytes /
      Math.pow(1024, i)
    ).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }

  function handleImageSelect(
    file: File | null
  ) {
    if (!file) return;

    const name = file.name.toLowerCase();
    const allowed =
      file.type.startsWith("image/") ||
      name.endsWith(".heic") ||
      name.endsWith(".heif");

    if (!allowed) {
      setError("Please select an image file (PNG, JPG, JPEG, WebP, HEIC, or HEIF).");
      return;
    }

    clearError();

    setImageFile(file);
    setImageResult(null);

    const url =
      URL.createObjectURL(file);

    setImagePreview(url);
  }

  function handlePdfSelect(
    file: File | null
  ) {
    if (!file) return;

    clearError();

    setPdfFile(file);
    setPdfText([]);
    setAnswer(null);
    setSources([]);
    setPdfExtractedData(null);
    setPdfDataOcrUsed(false);
  }

  function handlePdfOrganizeFiles(
    incoming: FileList | File[] | null
  ) {
    if (!incoming) return;

    clearError();
    const selected = Array.from(incoming).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (!selected.length) {
      setError("Please select PDF files only.");
      return;
    }

    setPdfOrganizeFiles((current) => {
      const combined = [...current, ...selected];
      const unique = combined.filter(
        (file, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.name === file.name &&
              candidate.size === file.size &&
              candidate.lastModified === file.lastModified
          ) === index
      );
      return unique.slice(0, 20);
    });
  }

  function removePdfOrganizeFile(index: number) {
    setPdfOrganizeFiles((files) => files.filter((_, i) => i !== index));
  }

  function clearPdfOrganizeFiles() {
    setPdfOrganizeFiles([]);
    setPdfPageRanges("");
    setPdfPageOrder("");
    clearError();
  }

  async function organizePdfs() {
    if (!pdfOrganizeFiles.length) {
      setError("Please select at least one PDF.");
      return;
    }

    if (pdfOrganizeOperation !== "merge" && pdfOrganizeFiles.length !== 1) {
      setError("Split and reorder require exactly one PDF.");
      return;
    }

    if (pdfOrganizeOperation === "split" && !pdfPageRanges.trim()) {
      setError("Enter the pages you want to split, for example 1-3,5.");
      return;
    }

    if (pdfOrganizeOperation === "reorder" && !pdfPageOrder.trim()) {
      setError("Enter the new page order, for example 3,1,2,4.");
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData = new FormData();
      formData.append("operation", pdfOrganizeOperation);
      formData.append("page_ranges", pdfPageRanges);
      formData.append("page_order", pdfPageOrder);
      pdfOrganizeFiles.forEach((file) => formData.append("files", file));

      const response = await fetch(`${API_BASE}/pdf/organize`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "PDF organization failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const extension = pdfOrganizeOperation === "split" ? "zip" : "pdf";
      const suffix =
        pdfOrganizeOperation === "merge"
          ? "merged"
          : pdfOrganizeOperation === "split"
            ? "split-pages"
            : "reordered";

      await downloadBlob(
        response,
        `${pdfOrganizeFiles[0]?.name.replace(/\.pdf$/i, "") || "document"}-${suffix}.${extension}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleCvSelect(file: File | null) {
    if (!file) return;

    const name = file.name.toLowerCase();
    const allowed =
      name.endsWith(".pdf") ||
      name.endsWith(".docx");

    if (!allowed) {
      setError("Please select a PDF or DOCX CV.");
      return;
    }

    clearError();
    setCvFile(file);
    setCvAnalysis(null);
    setCvRawText("");
    setCvAppliedActions([]);
    setCvProfile(null);
    setCvLinkedInUrl("");
  }

  async function analyzeCv() {
    if (!cvFile) {
      setError("Upload your CV first.");
      return;
    }

    setLoading(true);
    clearError();
    setCvAnalysis(null);

    try {
      const formData = new FormData();
      formData.append("file", cvFile);
      formData.append("target_job", cvTargetJob.trim());

      const response = await fetch(`${API_BASE}/cv/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "CV analysis failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      setCvAnalysis(data.analysis || null);
      setCvAppliedActions([]);
      setCvRawText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function buildCvProfileFromSource() {
    if (cvSourceMode === "cv" && !cvFile) {
      setError("Upload a PDF or DOCX CV first.");
      return;
    }
    if (cvSourceMode === "linkedin" && !cvLinkedInUrl.trim()) {
      setError("Enter your LinkedIn profile URL first.");
      return;
    }

    setCvProfileLoading(true);
    clearError();
    try {
      const formData = new FormData();
      if (cvSourceMode === "cv" && cvFile) {
        formData.append("file", cvFile);
      }
      formData.append("source_type", cvSourceMode);
      formData.append("profile_text", "");
      formData.append("linkedin_url", cvSourceMode === "linkedin" ? cvLinkedInUrl.trim() : "");

      const response = await fetch(`${API_BASE}/cv/profile`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Profile building failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      setCvProfile(data.profile || null);
      setCvBuilderTab("builder");
      if (data.analysis) setCvAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile building failed.");
    } finally {
      setCvProfileLoading(false);
    }
  }

  function updateCvProfileField(field: keyof CvProfile, value: string | string[]) {
    setCvProfile((current) => current ? { ...current, [field]: value } : current);
  }

  function updateCvExperience(index: number, field: keyof CvProfileExperience, value: string | boolean | string[]) {
    setCvProfile((current) => {
      if (!current) return current;
      const experience = [...current.experience];
      experience[index] = { ...experience[index], [field]: value };
      return { ...current, experience };
    });
  }

  function addCvExperience() {
    setCvProfile((current) => current ? {
      ...current,
      experience: [...current.experience, { company: "", role: "", location: "", start_date: "", end_date: "", current: false, bullets: [""] }],
    } : current);
  }

  function removeCvExperience(index: number) {
    setCvProfile((current) => current ? { ...current, experience: current.experience.filter((_, i) => i !== index) } : current);
  }

  function updateCvEducation(index: number, field: keyof CvProfileEducation, value: string) {
    setCvProfile((current) => {
      if (!current) return current;
      const education = [...current.education];
      education[index] = { ...education[index], [field]: value };
      return { ...current, education };
    });
  }

  function addCvEducation() {
    setCvProfile((current) => current ? {
      ...current,
      education: [...current.education, { institution: "", degree: "", field: "", start_date: "", end_date: "" }],
    } : current);
  }

  function removeCvEducation(index: number) {
    setCvProfile((current) => current ? { ...current, education: current.education.filter((_, i) => i !== index) } : current);
  }

  function updateCvProject(index: number, field: keyof CvProfileProject, value: string | string[]) {
    setCvProfile((current) => {
      if (!current) return current;
      const projects = [...current.projects];
      projects[index] = { ...projects[index], [field]: value };
      return { ...current, projects };
    });
  }

  function addCvProject() {
    setCvProfile((current) => current ? {
      ...current,
      projects: [...current.projects, { name: "", description: "", link: "", technologies: [] }],
    } : current);
  }

  function removeCvProject(index: number) {
    setCvProfile((current) => current ? { ...current, projects: current.projects.filter((_, i) => i !== index) } : current);
  }

  function addCvExperienceBullet(index: number) {
    setCvProfile((current) => {
      if (!current) return current;
      const experience = [...current.experience];
      experience[index] = { ...experience[index], bullets: [...experience[index].bullets, ""] };
      return { ...current, experience };
    });
  }

  function updateCvExperienceBullet(index: number, bulletIndex: number, value: string) {
    setCvProfile((current) => {
      if (!current) return current;
      const experience = [...current.experience];
      const bullets = [...experience[index].bullets];
      bullets[bulletIndex] = value;
      experience[index] = { ...experience[index], bullets };
      return { ...current, experience };
    });
  }

  function removeCvExperienceBullet(index: number, bulletIndex: number) {
    setCvProfile((current) => {
      if (!current) return current;
      const experience = [...current.experience];
      experience[index] = { ...experience[index], bullets: experience[index].bullets.filter((_, i) => i !== bulletIndex) };
      return { ...current, experience };
    });
  }

  async function exportCvBuilder() {
    if (!cvProfile) {
      setError("Build your profile first.");
      return;
    }
    setCvExportLoading(true);
    clearError();
    try {
      const formData = new FormData();
      formData.append("profile_json", JSON.stringify(cvProfile));
      formData.append("template", cvTemplate);
      const response = await fetch(`${API_BASE}/cv/build`, { method: "POST", body: formData });
      if (!response.ok) {
        let message = "CV export failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }
      await downloadBlob(response, `${(cvProfile.name || "mytoolbox-cv").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "mytoolbox-cv"}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CV export failed.");
    } finally {
      setCvExportLoading(false);
    }
  }

  function replaceCvText(
    source: string | undefined,
    currentText: string,
    suggestedText: string
  ): { value: string | undefined; changed: boolean } {
    if (!source || !currentText.trim() || !suggestedText.trim()) {
      return { value: source, changed: false };
    }

    if (source.includes(currentText)) {
      return {
        value: source.replace(currentText, suggestedText),
        changed: true,
      };
    }

    // AI output can differ only in whitespace/capitalization. Match that safely
    // without changing any unrelated text in the CV draft.
    const normalize = (value: string) =>
      value.trim().replace(/\s+/g, " ").toLowerCase();

    const normalizedCurrent = normalize(currentText);
    const sourceWords = source.split(/(\s+)/);
    let rebuilt = "";
    let changed = false;

    for (let i = 0; i < sourceWords.length; i++) {
      if (i % 2 === 0) {
        let candidate = sourceWords[i];
        let j = i;

        while (j + 2 < sourceWords.length) {
          const nextCandidate = `${candidate}${sourceWords[j + 1]}${sourceWords[j + 2]}`;
          if (normalize(nextCandidate) === normalizedCurrent) {
            rebuilt += suggestedText;
            i = j + 2;
            changed = true;
            break;
          }
          candidate = nextCandidate;
          j += 2;
        }

        if (changed) continue;
      }

      rebuilt += sourceWords[i];
    }

    return { value: changed ? rebuilt : source, changed };
  }

  async function applyCvAction(action: CvActionCard) {
    if (!cvAnalysis || !action.can_apply || !action.suggested_text) return;

    const currentText = action.current_text || "";
    const suggestedText = action.suggested_text;
    const section = (action.section || "").toLowerCase();

    if (!currentText.trim()) {
      setError("This suggestion has no source text to replace, so it cannot be applied safely.");
      return;
    }

    const next: CvAnalysis = {
      ...cvAnalysis,
      experience: (cvAnalysis.experience || []).map((experience) => ({
        ...experience,
        bullets: [...(experience.bullets || [])],
      })),
    };

    let changed = false;

    if (section.includes("summary")) {
      const result = replaceCvText(next.summary, currentText, suggestedText);
      next.summary = result.value;
      changed = result.changed;
    } else if (section.includes("headline")) {
      const result = replaceCvText(next.headline, currentText, suggestedText);
      next.headline = result.value;
      changed = result.changed;
    } else {
      // Experience actions are applied to the first matching bullet only.
      const nextExperience = (next.experience || []).map((experience) => {
        if (changed) return experience;

        const bullets = (experience.bullets || []).map((bullet) => {
          if (changed) return bullet;
          const result = replaceCvText(bullet, currentText, suggestedText);
          if (result.changed) changed = true;
          return result.value || bullet;
        });

        return { ...experience, bullets };
      });

      next.experience = nextExperience;
    }

    if (!changed) {
      setError("I couldn't safely locate the original CV text for this suggestion, so nothing was changed.");
      return;
    }

    // The analyzed profile itself is the live structured draft. Updating this
    // state makes the approved change persist across the workspace immediately.
    setCvAnalysis(next);

    const nextApplied = [
      ...cvAppliedActions.filter((item) => item.id !== action.id),
      action,
    ];
    setCvAppliedActions(nextApplied);

    if (!cvTargetJob.trim()) return;

    setCvAtsRefreshing(true);
    clearError();

    try {
      const formData = new FormData();
      formData.append("target_job", cvTargetJob.trim());
      formData.append("analysis_json", JSON.stringify(next));
      formData.append("applied_actions_json", JSON.stringify(nextApplied));

      const response = await fetch(`${API_BASE}/cv/recalculate-ats`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "ATS recalculation failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      setCvAnalysis((current) => current ? {
        ...current,
        ats_score: data.ats_score ?? current.ats_score,
        job_match_summary: data.job_match_summary || current.job_match_summary,
        matched_keywords: data.matched_keywords || current.matched_keywords,
        missing_keywords: data.remaining_missing_keywords || current.missing_keywords,
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ATS recalculation failed.");
    } finally {
      setCvAtsRefreshing(false);
    }
  }

  async function findMatchingJobs() {
    if (!cvAnalysis?.target_role && !cvAnalysis?.headline) {
      setError("Analyze your CV first so we can identify a target role.");
      return;
    }
    setCvJobsLoading(true);
    clearError();
    try {
      const formData = new FormData();
      formData.append("target_role", cvAnalysis.target_role || cvAnalysis.headline || "");
      formData.append("location", cvJobLocation.trim());
      formData.append("skills_json", JSON.stringify(cvAnalysis.skills || []));
      const response = await fetch(`${API_BASE}/cv/jobs`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Live job search failed.");
      setCvJobs(data.jobs || []);
      if (data.configured === false) setError(data.message || "Live job search is not configured yet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live job search failed.");
    } finally {
      setCvJobsLoading(false);
    }
  }

  function clearCvWorkspace() {
    setCvFile(null);
    setCvTargetJob("");
    setCvAnalysis(null);
    setCvRawText("");
    setCvAppliedActions([]);
    setCvJobs([]);
    setCvJobLocation("");
    setCvShowDetails(false);
    setCvProfile(null);
    setCvLinkedInUrl("");
    setCvSourceMode("cv");
    setCvBuilderTab("profile");
    clearError();
  }

  function handleAutoSelect(
    files: File[] | null
  ) {
    if (!files || files.length === 0) {
      setAutoFiles([]);
      setAutoResult(null);
      setWorkflowResult(null);
      setAutoResultType(null);
      return;
    }

    clearError();

    const limitedFiles = files.slice(0, 10);
    setAutoFiles(limitedFiles);
    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);

    if (files.length > 10) {
      setError("You can attach up to 10 files at a time.");
    }
  }

  function removeAutoFile(index: number) {
    setAutoFiles((current) => current.filter((_, i) => i !== index));
    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);
  }

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>,
    handler: (file: File | null) => void
  ) {
    const file =
      event.target.files?.[0] ?? null;

    handler(file);

    event.target.value = "";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    handler: (file: File | null) => void
  ) {
    event.preventDefault();

    const file =
      event.dataTransfer.files?.[0] ?? null;

    handler(file);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
  }

  async function downloadBlob(
    response: Response,
    filename: string
  ) {
    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------
  // Unified Image Toolbox
  // ----------------------------------------------------------

  async function processImage() {
    if (!imageFile) {
      setError("Please select an image first.");
      return;
    }

    if (imageOperation === "resize") {
      if (!imageWidth && !imageHeight) {
        setError("Enter a width or height for resizing.");
        return;
      }
    }

    if (imageOperation === "crop") {
      if (!imageCropWidth || !imageCropHeight) {
        setError("Enter crop width and crop height.");
        return;
      }
    }

    setLoading(true);
    clearError();

    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("operation", imageOperation);
      formData.append("output_format", imageOutputFormat);
      formData.append("quality", String(imageQuality));
      formData.append("keep_ratio", String(imageKeepRatio));
      formData.append("width", imageWidth);
      formData.append("height", imageHeight);
      formData.append("crop_x", imageCropX);
      formData.append("crop_y", imageCropY);
      formData.append("crop_width", imageCropWidth);
      formData.append("crop_height", imageCropHeight);

      const response = await fetch(`${API_BASE}/image/process`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Image processing failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (imageToolResultUrl) {
        URL.revokeObjectURL(imageToolResultUrl);
      }

      setImageToolResultUrl(url);
      setImageToolResultFormat(imageOutputFormat);
      setImageResult(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function setResizePreset(percent: number) {
    if (!imageFile) return;

    const img = new Image();
    img.onload = () => {
      const width = Math.max(1, Math.round(img.naturalWidth * percent / 100));
      const height = Math.max(1, Math.round(img.naturalHeight * percent / 100));
      setImageWidth(String(width));
      setImageHeight(String(height));
    };
    img.src = URL.createObjectURL(imageFile);
  }

  function handleImageOperationChange(operation: ImageOperation) {
    setImageOperation(operation);
    clearError();

    if (operation === "resize" && imageFile && !imageWidth && !imageHeight) {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);
      img.onload = () => {
        setImageWidth(String(img.naturalWidth));
        setImageHeight(String(img.naturalHeight));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }

  // ----------------------------------------------------------
  // Background Removal
  // ----------------------------------------------------------

  async function removeBackground() {
    if (!imageFile) {
      setError(
        "Please select an image first."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        imageFile
      );

      const response =
        await fetch(
          `${API_BASE}/image/remove-background`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Background removal failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      setImageResult(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // PDF → Word
  // ----------------------------------------------------------

  async function convertPdfToWord() {
    if (!pdfFile) {
      setError(
        "Please select a PDF first."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pdfFile
      );

      const response =
        await fetch(
          `${API_BASE}/pdf/to-word`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "PDF to Word conversion failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const filename =
        pdfFile.name.replace(
          /\.pdf$/i,
          ""
        ) + ".docx";

      await downloadBlob(
        response,
        filename
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }


  // ----------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      if (imageResult) {
        URL.revokeObjectURL(
          imageResult
        );
      }

      if (imageToolResultUrl && imageToolResultUrl !== imageResult) {
        URL.revokeObjectURL(imageToolResultUrl);
      }

      if (
        autoResultType ===
        "image" &&
        autoResult?.answer
      ) {
        URL.revokeObjectURL(
          autoResult.answer
        );
      }
    };
  }, [
    imagePreview,
    imageResult,
    imageToolResultUrl,
    autoResult,
    autoResultType,
  ]);

  // ----------------------------------------------------------
  // Image Toolbox
  // ----------------------------------------------------------

  if (activeTool === "image-toolbox") {
    const operationLabel =
      imageOperation === "resize"
        ? "Resize Image"
        : imageOperation === "crop"
          ? "Crop Image"
          : imageOperation === "convert"
            ? "Convert Image"
            : imageOperation === "compress"
              ? "Compress Image"
              : "Remove Background";

    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header onHome={goHome} />
        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-3xl">
            <div className="toolbox-hero-icon toolbox-hero-icon-image">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>

            <div className="toolbox-kicker toolbox-kicker-image">IMAGE WORKSPACE</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
              Image Toolbox
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Resize, crop, convert, compress, and remove backgrounds in one unified workspace.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <UploadZone
                accept="image/*,.heic,.heif"
                file={imageFile}
                inputRef={imageInputRef}
                onSelect={handleImageSelect}
                label="Drop your image here"
                description="PNG, JPG, WebP, and other common image formats"
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                }
              />

              {imagePreview && (
                <div className="mt-5 rounded-3xl border border-black/8 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-black/35">
                      Original
                    </span>
                    {imageFile && (
                      <span className="text-xs text-black/40">
                        {formatBytes(imageFile.size)}
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-[#f7f7f5] p-4">
                    {imageFile?.name.toLowerCase().endsWith(".heic") || imageFile?.name.toLowerCase().endsWith(".heif") ? (
                      <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl px-6 text-center">
                        <div className="text-sm font-semibold">HEIC / HEIF image loaded</div>
                        <div className="mt-2 max-w-sm text-xs leading-5 text-black/45">
                          Your browser may not preview HEIC directly, but the file is ready for processing.
                        </div>
                      </div>
                    ) : (
                      <img
                        src={imagePreview}
                        alt="Original"
                        className="max-h-[420px] max-w-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-black/8 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                Operation
              </div>

              <div className="mt-4 rounded-2xl border border-black/8 bg-[#fafaf8] p-3">
                <div className="px-1 pb-2">
                  <div className="text-sm font-semibold">Image tools</div>
                  <div className="mt-1 text-xs text-black/40">Everyday editing and conversion</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["resize", "Resize"],
                    ["crop", "Crop"],
                    ["convert", "Convert"],
                    ["compress", "Compress"],
                    ["background", "Background"],
                  ] as [ImageOperation, string][]).map(([operation, label]) => (
                    <button
                      key={operation}
                      onClick={() => handleImageOperationChange(operation)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                        imageOperation === operation
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white text-black/60 hover:border-black/20 hover:text-black"
                      }`}
                    >
                      {label}
                    </button>
                  ))}

                  {["Watermark", "Rotate / Flip"].map((label) => (
                    <div key={label} className="relative">
                      <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-black/40 shadow-sm">
                        Soon
                      </div>
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-medium text-black/30"
                      >
                        {label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-black/8 bg-black/[0.025] p-3">
                <div className="px-1 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">AI & Smart</div>
                    <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                      Coming soon
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-black/40">Smarter image tools and automated workflows</div>
                </div>

                <div className="grid gap-2">
                  {[
                    ["AI Upscaler", "Enhance image resolution with AI"],
                    ["AI Image Analyzer", "Understand, describe, and extract insights"],
                    ["Smart Image Workflow", "Describe what you want and let AI handle the steps"],
                  ].map(([label, description]) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between rounded-2xl border border-black/8 bg-white px-4 py-3 text-left opacity-70"
                    >
                      <span>
                        <span className="block text-sm font-medium text-black/45">{label}</span>
                        <span className="mt-1 block text-xs text-black/30">{description}</span>
                      </span>
                      <span className="ml-3 shrink-0 rounded-full border border-black/8 bg-[#f7f7f5] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-black/35">
                        Soon
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="image-output-format"
                  className="text-xs font-semibold uppercase tracking-wider text-black/40"
                >
                  Download as
                </label>
                <select
                  id="image-output-format"
                  value={imageOutputFormat}
                  onChange={(event) =>
                    setImageOutputFormat(event.target.value as ImageOutputFormat)
                  }
                  className="mt-3 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3.5 text-sm font-medium outline-none focus:border-black/30"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG / JPEG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>

              {(imageOperation === "convert" || imageOperation === "compress") && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                      Quality
                    </label>
                    <span className="text-sm font-semibold">{imageQuality}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={imageQuality}
                    onChange={(event) => setImageQuality(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                </div>
              )}

              {imageOperation === "resize" && (
                <div className="mt-5">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                      Width
                      <input
                        type="number"
                        min="1"
                        value={imageWidth}
                        onChange={(event) => setImageWidth(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm font-medium outline-none focus:border-black/30"
                        placeholder="Width px"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                      Height
                      <input
                        type="number"
                        min="1"
                        value={imageHeight}
                        onChange={(event) => setImageHeight(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm font-medium outline-none focus:border-black/30"
                        placeholder="Height px"
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex items-center gap-2 text-sm text-black/60">
                    <input
                      type="checkbox"
                      checked={imageKeepRatio}
                      onChange={(event) => setImageKeepRatio(event.target.checked)}
                    />
                    Keep aspect ratio
                  </label>

                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                      Presets
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[25, 50, 100, 200].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => setResizePreset(percent)}
                          className="rounded-xl border border-black/10 px-3 py-2 text-xs font-medium text-black/60 hover:border-black/20 hover:text-black"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {imageOperation === "crop" && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["X", imageCropX, setImageCropX],
                    ["Y", imageCropY, setImageCropY],
                    ["Width", imageCropWidth, setImageCropWidth],
                    ["Height", imageCropHeight, setImageCropHeight],
                  ].map(([label, value, setter]) => (
                    <label key={label as string} className="text-xs font-semibold uppercase tracking-wider text-black/40">
                      {label as string}
                      <input
                        type="number"
                        min="0"
                        value={value as string}
                        onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm font-medium outline-none focus:border-black/30"
                      />
                    </label>
                  ))}
                </div>
              )}

              {imageOperation === "background" && (
                <div className="mt-5 rounded-2xl bg-[#f7f7f5] px-4 py-4 text-sm leading-6 text-black/55">
                  Remove the image background and download the result in your selected format.
                </div>
              )}

              <button
                onClick={processImage}
                disabled={loading || !imageFile}
                className="mt-6 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading ? "Processing..." : operationLabel}
              </button>
            </div>
          </div>

          {imageToolResultUrl && (
            <div className="mt-6 rounded-3xl border border-black/8 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-black/35">
                  Result
                </span>
                <a
                  href={imageToolResultUrl}
                  download={`${imageFile?.name.replace(/\.[^.]+$/, "") || "image"}-processed.${imageToolResultFormat || imageOutputFormat}`}
                  className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white"
                >
                  Download {imageToolResultFormat?.toUpperCase() || imageOutputFormat.toUpperCase()}
                </a>
              </div>
              <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-[#f7f7f5] p-4">
                <img
                  src={imageToolResultUrl}
                  alt="Processed result"
                  className="max-h-[520px] max-w-full object-contain"
                />
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // PDF Converter

  if (activeTool === "pdf-convert") {
    const outputLabel =
      pdfOutputFormat === "docx"
        ? "Word (.docx)"
        : pdfOutputFormat === "txt"
          ? "Plain Text (.txt)"
          : "PNG Pages (.zip)";

    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header onHome={goHome} />
        <ErrorBanner />

        <section className="mx-auto max-w-5xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h4" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Convert PDF
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Upload your PDF once, choose the file type you need, and download the result.
            </p>
          </div>

          <div className="mt-10 max-w-3xl">
            <UploadZone
              accept="application/pdf"
              file={pdfFile}
              inputRef={pdfInputRef}
              onSelect={handlePdfSelect}
              label="Drop your PDF here"
              description="PDF documents only"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M12 17V9" />
                  <path d="m9 12 3-3 3 3" />
                </svg>
              }
            />

            <div className="mt-5 rounded-3xl border border-black/8 bg-white p-5">
              <label
                htmlFor="pdf-output-format"
                className="text-xs font-semibold uppercase tracking-wider text-black/40"
              >
                File type
              </label>

              <select
                id="pdf-output-format"
                value={pdfOutputFormat}
                onChange={(event) =>
                  setPdfOutputFormat(event.target.value as PdfOutputFormat)
                }
                className="mt-3 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3.5 text-sm font-medium outline-none transition focus:border-black/30"
              >
                <option value="docx">Word document (.docx)</option>
                <option value="txt">Plain text (.txt)</option>
                <option value="png">PNG page images (.zip)</option>
              </select>

              <button
                onClick={convertSelectedPdf}
                disabled={loading || !pdfFile}
                className="mt-4 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading ? "Converting..." : `Convert to ${outputLabel}`}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/8 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/35">DOCX</div>
                <div className="mt-1 text-sm text-black/55">Editable Word document</div>
              </div>

              <div className="rounded-2xl border border-black/8 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/35">TXT</div>
                <div className="mt-1 text-sm text-black/55">Clean text for Notepad</div>
              </div>

              <div className="rounded-2xl border border-black/8 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/35">PNG</div>
                <div className="mt-1 text-sm text-black/55">Every page as an image</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // PDF Text Extraction
  // ----------------------------------------------------------

  async function extractPdfText() {
    if (!pdfFile) {
      setError(
        "Please select a PDF first."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pdfFile
      );

      const response =
        await fetch(
          `${API_BASE}/pdf/extract-text`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "PDF text extraction failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const data =
        await response.json();

      setPdfText(
        Array.isArray(data.pages)
          ? data.pages
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function convertPdfToTxt() {
    if (!pdfFile) {
      setError("Please select a PDF first.");
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const response = await fetch(`${API_BASE}/pdf/extract-text`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "PDF to TXT conversion failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      const pages = Array.isArray(data.pages) ? data.pages : [];
      const text = pages
        .map((page: PdfPage) => `--- Page ${page.page} ---\n${page.text || ""}`)
        .join("\n\n");

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFile.name.replace(/\.pdf$/i, "") + ".txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function extractPdfData() {
    if (!pdfFile) {
      setError("Please select a PDF first.");
      return;
    }

    setLoading(true);
    clearError();
    setPdfExtractedData(null);
    setPdfDataOcrUsed(false);

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);

      const response = await fetch(`${API_BASE}/pdf/extract-data`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Could not extract structured data.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const result = await response.json();
      setPdfExtractedData(result.data ?? null);
      setPdfDataOcrUsed(Boolean(result.ocr_used));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function downloadExtractedJson() {
    if (!pdfExtractedData) return;
    const blob = new Blob([JSON.stringify(pdfExtractedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pdfFile?.name.replace(/\.pdf$/i, "") || "document"}-data.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvValue(value: unknown) {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadExtractedCsv() {
    if (!pdfExtractedData) return;

    const rows: string[][] = [];
    const lineItems = Array.isArray(pdfExtractedData.line_items) ? pdfExtractedData.line_items : [];
    const summaryFields: [string, unknown][] = [
      ["Document Type", pdfExtractedData.document_type],
      ["Invoice Number", pdfExtractedData.invoice_number],
      ["Vendor", pdfExtractedData.vendor],
      ["Customer", pdfExtractedData.customer],
      ["Date", pdfExtractedData.date],
      ["Due Date", pdfExtractedData.due_date],
      ["Currency", pdfExtractedData.currency],
      ["Subtotal", pdfExtractedData.subtotal],
      ["Tax", pdfExtractedData.tax],
      ["Total", pdfExtractedData.total],
      ["Payment Status", pdfExtractedData.payment_status],
    ];

    rows.push(["Field", "Value"]);
    for (const [field, value] of summaryFields) {
      rows.push([field, value == null ? "" : String(value)]);
    }

    if (pdfExtractedData.custom_fields) {
      for (const [key, value] of Object.entries(pdfExtractedData.custom_fields)) {
        rows.push([key, typeof value === "object" ? JSON.stringify(value) : String(value ?? "")]);
      }
    }

    if (lineItems.length > 0) {
      rows.push([]);
      rows.push(["Line Item", "Quantity", "Unit Price", "Amount"]);
      for (const item of lineItems) {
        rows.push([String(item.description ?? ""), String(item.quantity ?? ""), String(item.unit_price ?? ""), String(item.amount ?? "")]);
      }
    }

    const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pdfFile?.name.replace(/\.pdf$/i, "") || "document"}-data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function convertSelectedPdf() {
    if (!pdfFile) {
      setError("Please select a PDF first.");
      return;
    }

    if (pdfOutputFormat === "docx") {
      await convertPdfToWord();
    } else if (pdfOutputFormat === "txt") {
      await convertPdfToTxt();
    } else {
      await convertPdfToImages();
    }
  }

  async function convertPdfToImages() {
    if (!pdfFile) {
      setError("Please select a PDF first.");
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const response = await fetch(`${API_BASE}/pdf/to-images`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "PDF to images conversion failed.";
        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {}
        throw new Error(message);
      }

      const filename = pdfFile.name.replace(/\.pdf$/i, "") + "-pages.zip";
      await downloadBlob(response, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Ask PDF
  // ----------------------------------------------------------

  async function askPdf() {
    if (!pdfFile) {
      setError(
        "Please select a PDF first."
      );
      return;
    }

    if (!question.trim()) {
      setError(
        "Please enter a question."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pdfFile
      );

      formData.append(
        "question",
        question.trim()
      );

      const response =
        await fetch(
          `${API_BASE}/pdf/ask`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Could not answer the question.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const data =
        await response.json();

      setAnswer(
        data.answer ?? null
      );

      setSources(
        Array.isArray(data.sources)
          ? data.sources
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Auto Mode
  // ----------------------------------------------------------

  async function runAuto() {
    if (autoFiles.length === 0) {
      setError(
        "Please attach at least one file first."
      );
      return;
    }

    if (!autoPrompt.trim()) {
      setError(
        "Please describe what you want to do."
      );
      return;
    }

    setLoading(true);
    clearError();

    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);

    try {
      const formData =
        new FormData();

      autoFiles.forEach((file) => {
        formData.append("files", file);
      });

      formData.append(
        "request",
        autoPrompt.trim()
      );

      const response =
        await fetch(
          `${API_BASE}/auto`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Auto Mode failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        const data =
          await response.json();

        setAutoResult(data);
        setAutoResultType(null);
      } else {
        const blob =
          await response.blob();

        const url =
          URL.createObjectURL(blob);

        const resultTool =
          response.headers.get("X-Toolbox-Tool") ||
          "Processed result";

        const resultReason =
          response.headers.get("X-Toolbox-Reason") ||
          "Auto Mode processed the uploaded file.";

        const isPdf =
          contentType.includes("application/pdf");

        const isImage =
          contentType.startsWith("image/");

        setAutoResultType(
          isPdf ? "pdf" : isImage ? "image" : "file"
        );

        setAutoResult({
          tool: resultTool,
          reason: resultReason,
          answer: url,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Auto Workflow
  // ----------------------------------------------------------

  async function runWorkflow() {
    if (autoFiles.length === 0) {
      setError(
        "Please attach at least one file first."
      );
      return;
    }

    if (autoFiles.length > 1) {
      setError(
        "Multi-step workflow currently supports one PDF at a time."
      );
      return;
    }

    if (!autoPrompt.trim()) {
      setError(
        "Please describe the workflow."
      );
      return;
    }

    setLoading(true);
    clearError();

    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        autoFile
      );

      formData.append(
        "request",
        autoPrompt.trim()
      );

      const response =
        await fetch(
          `${API_BASE}/auto/workflow`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Workflow execution failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const data =
        await response.json();

      setWorkflowResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }


  // ----------------------------------------------------------
  // Header
  // ----------------------------------------------------------

  function Header({
    onHome,
  }: {
    onHome: () => void;
  }) {
    return (
      <header className="app-header sticky top-0 z-50 border-b border-black/5 bg-[#f7f7f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {activeTool !== "home" && (
              <button
                type="button"
                onClick={onHome}
                className="workspace-back group hidden items-center gap-1.5 rounded-full border border-black/8 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-black/45 shadow-[0_2px_10px_rgba(0,0,0,0.025)] transition-all hover:-translate-x-0.5 hover:border-black/15 hover:text-black sm:inline-flex"
                aria-label="Back to all toolboxes"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span className="back-label">Back</span>
              </button>
            )}

            <button
              onClick={onHome}
              className="flex items-center gap-3"
            >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v18" />
                <path d="M3 12h18" />
                <path d="m7 7 10 10" />
                <path d="m17 7-10 10" />
              </svg>
            </div>

            <div className="text-left">
              <div className="text-sm font-semibold tracking-tight">
                MyToolbox AI
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-black/40">
                Intelligent tools
              </div>
            </div>
          </button>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-black/50">
              AI-powered productivity
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ----------------------------------------------------------
  // Error Banner
  // ----------------------------------------------------------

  function ErrorBanner() {
    if (!error) return null;

    return (
      <div className="mx-auto mt-6 max-w-7xl px-6">
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div>
            <div className="font-medium">
              Something went wrong
            </div>

            <div className="mt-0.5 text-red-600/80">
              {error}
            </div>
          </div>

          <button
            onClick={clearError}
            className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-100"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Tool Card
  // ----------------------------------------------------------

  function ToolCard({
    title,
    description,
    icon,
    onClick,
    badge,
  }: {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    badge?: string;
  }) {
    return (
      <button
        onClick={onClick}
        className="tool-card group relative flex min-h-[190px] flex-col rounded-3xl border border-black/8 bg-white p-6 text-left shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1.5 hover:border-black/15 hover:shadow-[0_20px_55px_rgba(0,0,0,0.09)]"
      >
        {badge && (
          <span className="tool-card-badge absolute right-5 top-5 rounded-full bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white shadow-[0_3px_10px_rgba(0,0,0,0.08)]">
            {badge}
          </span>
        )}

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3f3f1] text-black transition-colors group-hover:bg-black group-hover:text-white">
          {icon}
        </div>

        <div className="mt-5">
          <h3 className="text-base font-semibold tracking-tight">
            {title}
          </h3>

          <p className="mt-2 max-w-[260px] text-sm leading-6 text-black/50">
            {description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-1 pt-5 text-xs font-medium text-black/40 transition-colors group-hover:text-black">
          Open tool
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </div>
      </button>
    );
  }

  // ----------------------------------------------------------
  // Upload Zone
  // ----------------------------------------------------------

  function UploadZone({
    accept,
    file,
    inputRef,
    onSelect,
    label,
    description,
    icon,
  }: {
    accept: string;
    file: File | null;
    inputRef: React.MutableRefObject<HTMLInputElement | null>;
    onSelect: (file: File | null) => void;
    label: string;
    description: string;
    icon: React.ReactNode;
  }) {
    return (
      <div
        onDragOver={handleDragOver}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const file = event.dataTransfer.files?.[0] ?? null;
          if (file) onSelect(file);
        }}
        className="group rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center transition-all hover:border-black/30 hover:bg-white/80"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            event.stopPropagation();
            handleFileInput(event, onSelect);
          }}
        />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f3f1] text-black transition-transform group-hover:scale-105">
          {icon}
        </div>

        {file ? (
          <>
            <div className="mt-5 text-sm font-semibold">
              {file.name}
            </div>

            <div className="mt-1 text-xs text-black/40">
              {formatBytes(file.size)}
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 text-sm font-semibold">
              {label}
            </div>

            <div className="mx-auto mt-2 max-w-sm text-xs leading-5 text-black/40">
              {description}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
          className="mt-4 inline-flex cursor-pointer rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-xs font-medium text-black/60 hover:border-black/20 hover:text-black"
        >
          {file ? "Replace file" : "Choose file"}
        </button>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Home / Toolboxes
  // ----------------------------------------------------------

  if (
    activeTool ===
    "home"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pt-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-black/50 shadow-[0_2px_12px_rgba(0,0,0,0.025)]">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              Your AI productivity workspace
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              One workspace.
              <br />
              <span className="text-black/35">
                Every workflow.
              </span>
            </h1>

            <p className="hero-subtext mt-6 max-w-2xl text-base leading-7 text-black/50 sm:text-lg">
              MyToolbox AI organizes powerful utilities into focused
              toolboxes — so you can find the right capability without
              searching through a long list of individual tools.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ToolCard
              title="PDF Toolbox"
              description="Convert, extract, edit, make searchable, and ask AI questions about your PDFs."
              badge="4+ TOOLS"
              onClick={() =>
                setActiveTool("pdf-toolbox")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>
              }
            />

            <ToolCard
              title="CV & Career Workspace"
              description="Turn your CV into a career intelligence workspace with AI analysis, ATS matching, skill gaps, and actionable recommendations."
              onClick={() =>
                setActiveTool("cv-career")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M9 8h6" />
                  <path d="M9 12h6" />
                  <path d="M9 16h3" />
                </svg>
              }
            />

            <ToolCard
              title="Image Toolbox"
              description="Resize, crop, convert, compress, background removal, and AI upscaling in one workspace."
              badge="6 TOOLS"
              onClick={() =>
                setActiveTool("image-toolbox")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                  />
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              }
            />

            <ToolCard
              title="MyToolbox Copilot"
              description="Tell it what you need. MyToolbox Copilot understands your request, works across files, and uses the right capability."
              badge="AI"
              onClick={() =>
                setActiveTool("auto")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
                </svg>
              }
            />
          </div>

          <div className="mt-10 rounded-3xl border border-black/8 bg-white px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">
                  Built to grow with your work.
                </div>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-black/45">
                  New capabilities can be added inside the relevant
                  toolbox without turning the home screen into a wall
                  of unrelated tools.
                </p>
              </div>

              <button
                onClick={() =>
                  setActiveTool("auto")
                }
                className="shrink-0 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
              >
                Open MyToolbox Copilot
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // CV & Career Workspace
  // ----------------------------------------------------------

  if (activeTool === "cv-career") {
    const atsScore = cvAnalysis?.ats_score ?? 0;
    const hasJob = Boolean(cvTargetJob.trim());
    const scoreLabel = !hasJob ? "No target" : atsScore >= 80 ? "Strong match" : atsScore >= 60 ? "Good foundation" : "Needs tailoring";

    const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10";
    const labelClass = "text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400";
    const cardClass = "rounded-2xl border border-slate-200 bg-white p-5";

    return (
      <main className="page-shell min-h-screen bg-[#f8fafc] text-slate-900">
        <Header onHome={goHome} />
        <ErrorBanner />
        <section className="mx-auto max-w-[1500px] px-5 pb-12 pt-6 sm:px-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button onClick={goHome} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">← All toolboxes</button>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">CV & Career Toolbox</div>
          </div>

          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="cv-workspace-heading">
              <div className="toolbox-hero-icon toolbox-hero-icon-cv">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M9 8h6" />
                  <path d="M9 12h6" />
                  <path d="M9 16h3" />
                </svg>
              </div>
              <div className="toolbox-kicker toolbox-kicker-cv">CAREER WORKSPACE</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Build a profile. Edit it. Ship a better CV.</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Import a CV or paste LinkedIn content, turn it into a structured professional profile, edit every section, then export a clean Word CV.</p>
            </div>
            {cvAnalysis && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="relative h-14 w-14 rounded-full" style={{ background: `conic-gradient(#0284c7 ${hasJob ? atsScore * 3.6 : 0}deg, #e2e8f0 0deg)` }}>
                  <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-white text-xs font-bold">{hasJob ? `${atsScore}%` : "—"}</div>
                </div>
                <div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ATS Match</div><div className="mt-0.5 text-sm font-semibold">{scoreLabel}</div></div>
              </div>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="flex items-center justify-between">
                <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">1 · Source</div><h2 className="mt-1 text-lg font-semibold">Import your profile</h2></div>
                {(cvFile || cvProfile) && <button onClick={clearCvWorkspace} className="text-xs font-medium text-slate-400 hover:text-slate-900">Reset</button>}
              </div>

              <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button onClick={() => { setCvSourceMode("cv"); clearError(); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${cvSourceMode === "cv" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>CV / Resume</button>
                <button onClick={() => { setCvSourceMode("linkedin"); clearError(); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${cvSourceMode === "linkedin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>LinkedIn profile</button>
              </div>

              {cvSourceMode === "cv" ? (
                <div className="mt-4">
                  <UploadZone accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" file={cvFile} inputRef={cvInputRef} onSelect={handleCvSelect} label="Drop your CV here" description="PDF or DOCX · We extract only supported facts" icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>} />
                </div>
              ) : (
                <div className="mt-4">
                  <label className={labelClass}>LinkedIn profile URL</label>
                  <input value={cvLinkedInUrl} onChange={(event) => setCvLinkedInUrl(event.target.value)} placeholder="https://www.linkedin.com/in/your-name/" className={`${inputClass} py-3.5`} />
                  <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-[11px] leading-5 text-sky-800">
                    <strong>Public profile required.</strong> We’ll try to read the publicly visible profile and turn it into an editable CV draft. LinkedIn may restrict automated access, so if the profile is private or requires sign-in, use the CV upload option instead.
                  </div>
                </div>
              )}

              <button onClick={buildCvProfileFromSource} disabled={cvProfileLoading || (cvSourceMode === "cv" ? !cvFile : !cvLinkedInUrl.trim())} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">{cvProfileLoading ? "Building profile…" : "Build my profile →"}</button>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <label className={labelClass}>Target job · optional</label>
                <textarea value={cvTargetJob} onChange={(event) => setCvTargetJob(event.target.value)} placeholder="Paste a job description to tailor the profile and calculate ATS match." className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-sky-500 focus:bg-white" />
                <button onClick={analyzeCv} disabled={!cvFile || loading} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-40">{loading ? "Analyzing…" : "Run career / ATS analysis"}</button>
              </div>
            </section>

            <section className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
                <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">2 · Profile Builder</div><h2 className="mt-1 text-lg font-semibold">{cvProfile?.name || cvAnalysis?.candidate_name || "Your professional profile"}</h2></div>
                <div className="flex gap-2">
                  <button onClick={() => setCvBuilderTab("profile")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${cvBuilderTab === "profile" ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>Profile</button>
                  <button onClick={() => setCvBuilderTab("builder")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${cvBuilderTab === "builder" ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>CV Builder</button>
                  <button onClick={exportCvBuilder} disabled={!cvProfile || cvExportLoading} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{cvExportLoading ? "Exporting…" : "Export DOCX"}</button>
                </div>
              </div>

              {!cvProfile ? (
                <div className="flex min-h-[600px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-8 text-center"><div className="max-w-md"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">✦</div><h3 className="mt-5 text-lg font-semibold">Build the profile first</h3><p className="mt-2 text-sm leading-6 text-slate-500">The AI will extract your information into editable fields. Nothing unsupported by your source should be invented.</p></div></div>
              ) : cvBuilderTab === "profile" ? (
                <div className="space-y-4">
                  <div className={cardClass}>
                    <div className="mb-4"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">CV template</div><div className="mt-1 text-xs text-slate-500">Choose the visual style first. Your profile stays editable and the selected template is applied only when you export.</div></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["ats-classic", "ATS Classic", "Clean, recruiter-friendly, safest for ATS"],
                        ["modern", "Modern", "Contemporary with subtle accent styling"],
                        ["executive", "Executive", "Polished, formal, leadership-focused"],
                        ["minimal", "Minimal", "Compact, simple, content-first layout"],
                      ].map(([value, label, description]) => (
                        <button key={value} type="button" onClick={() => setCvTemplate(value as typeof cvTemplate)} className={`rounded-2xl border p-4 text-left transition ${cvTemplate === value ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/10" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-900">{label}</span><span className={`h-4 w-4 rounded-full border-2 ${cvTemplate === value ? "border-sky-600 bg-sky-600" : "border-slate-300"}`} /></div>
                          <div className="mt-1 text-[11px] leading-5 text-slate-500">{description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={cardClass}>
                    <div className="mb-4"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Identity</div><div className="mt-1 text-xs text-slate-500">Correct anything the extraction got wrong before generating your CV.</div></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={labelClass}>Name<input className={inputClass} value={cvProfile.name} onChange={(e) => updateCvProfileField("name", e.target.value)} /></label>
                      <label className={labelClass}>Headline<input className={inputClass} value={cvProfile.headline} onChange={(e) => updateCvProfileField("headline", e.target.value)} /></label>
                      <label className={labelClass}>Email<input className={inputClass} value={cvProfile.email} onChange={(e) => updateCvProfileField("email", e.target.value)} /></label>
                      <label className={labelClass}>Phone<input className={inputClass} value={cvProfile.phone} onChange={(e) => updateCvProfileField("phone", e.target.value)} /></label>
                      <label className={labelClass}>Location<input className={inputClass} value={cvProfile.location} onChange={(e) => updateCvProfileField("location", e.target.value)} /></label>
                      <label className={labelClass}>Website<input className={inputClass} value={cvProfile.website} onChange={(e) => updateCvProfileField("website", e.target.value)} /></label>
                      <label className={labelClass}>LinkedIn<input className={inputClass} value={cvProfile.linkedin} onChange={(e) => updateCvProfileField("linkedin", e.target.value)} /></label>
                    </div>
                    <label className={`${labelClass} mt-3 block`}>Professional summary<textarea className={`${inputClass} min-h-[120px] resize-y leading-6`} value={cvProfile.summary} onChange={(e) => updateCvProfileField("summary", e.target.value)} /></label>
                    <label className={`${labelClass} mt-3 block`}>Skills · comma separated<textarea className={`${inputClass} min-h-[80px] resize-y`} value={cvProfile.skills.join(", ")} onChange={(e) => updateCvProfileField("skills", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label>
                  </div>

                  <div className={cardClass}>
                    <div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Experience</div><div className="mt-1 text-xs text-slate-500">Edit roles and evidence, or add missing positions.</div></div><button onClick={addCvExperience} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">+ Add experience</button></div>
                    <div className="mt-4 space-y-4">
                      {cvProfile.experience.map((item, index) => (
                        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Experience {index + 1}</span><button onClick={() => removeCvExperience(index)} className="text-xs text-slate-400 hover:text-red-600">Remove</button></div>
                          <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Role<input className={inputClass} value={item.role} onChange={(e) => updateCvExperience(index, "role", e.target.value)} /></label><label className={labelClass}>Company<input className={inputClass} value={item.company} onChange={(e) => updateCvExperience(index, "company", e.target.value)} /></label><label className={labelClass}>Location<input className={inputClass} value={item.location} onChange={(e) => updateCvExperience(index, "location", e.target.value)} /></label><label className={labelClass}>Start date<input className={inputClass} value={item.start_date} onChange={(e) => updateCvExperience(index, "start_date", e.target.value)} /></label><label className={labelClass}>End date<input className={inputClass} value={item.end_date} disabled={item.current} onChange={(e) => updateCvExperience(index, "end_date", e.target.value)} /></label><label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" checked={item.current} onChange={(e) => updateCvExperience(index, "current", e.target.checked)} /> Current role</label></div>
                          <div className="mt-3"><div className={labelClass}>Achievement / responsibility bullets</div>{item.bullets.map((bullet, bulletIndex) => <div key={bulletIndex} className="mt-2 flex gap-2"><textarea className="min-h-[60px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:border-sky-500" value={bullet} onChange={(e) => updateCvExperienceBullet(index, bulletIndex, e.target.value)} /><button onClick={() => removeCvExperienceBullet(index, bulletIndex)} className="px-2 text-xs text-slate-400 hover:text-red-600">×</button></div>)}<button onClick={() => addCvExperienceBullet(index)} className="mt-2 text-xs font-semibold text-sky-700">+ Add bullet</button></div>
                        </div>
                      ))}
                      {!cvProfile.experience.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No experience was extracted. Add it if you want it in the CV.</p>}
                    </div>
                  </div>

                  <div className={cardClass}>
                    <div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Education</div></div><button onClick={addCvEducation} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">+ Add education</button></div>
                    <div className="mt-4 space-y-3">{cvProfile.education.map((item, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex justify-between"><span className="text-xs font-semibold text-slate-500">Education {index + 1}</span><button onClick={() => removeCvEducation(index)} className="text-xs text-slate-400 hover:text-red-600">Remove</button></div><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Institution<input className={inputClass} value={item.institution} onChange={(e) => updateCvEducation(index, "institution", e.target.value)} /></label><label className={labelClass}>Degree<input className={inputClass} value={item.degree} onChange={(e) => updateCvEducation(index, "degree", e.target.value)} /></label><label className={labelClass}>Field<input className={inputClass} value={item.field} onChange={(e) => updateCvEducation(index, "field", e.target.value)} /></label><label className={labelClass}>Dates<input className={inputClass} value={`${item.start_date}${item.start_date || item.end_date ? " — " : ""}${item.end_date}`} onChange={(e) => { const parts = e.target.value.split("—"); updateCvEducation(index, "start_date", (parts[0] || "").trim()); updateCvEducation(index, "end_date", (parts[1] || "").trim()); }} /></label></div></div>)}{!cvProfile.education.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No education was extracted. Add it if needed.</p>}</div>
                  </div>

                  <div className={cardClass}>
                    <div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Projects</div></div><button onClick={addCvProject} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">+ Add project</button></div>
                    <div className="mt-4 space-y-3">{cvProfile.projects.map((item, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex justify-between"><span className="text-xs font-semibold text-slate-500">Project {index + 1}</span><button onClick={() => removeCvProject(index)} className="text-xs text-slate-400 hover:text-red-600">Remove</button></div><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Name<input className={inputClass} value={item.name} onChange={(e) => updateCvProject(index, "name", e.target.value)} /></label><label className={labelClass}>Link<input className={inputClass} value={item.link} onChange={(e) => updateCvProject(index, "link", e.target.value)} /></label></div><label className={`${labelClass} mt-3 block`}>Description<textarea className={`${inputClass} min-h-[80px] resize-y`} value={item.description} onChange={(e) => updateCvProject(index, "description", e.target.value)} /></label><label className={`${labelClass} mt-3 block`}>Technologies · comma separated<input className={inputClass} value={item.technologies.join(", ")} onChange={(e) => updateCvProject(index, "technologies", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label></div>)}{!cvProfile.projects.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Projects are optional. Add them when they strengthen the target role.</p>}</div>
                  </div>

                  <div className={cardClass}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Additional profile data</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Certifications · comma separated<textarea className={`${inputClass} min-h-[70px] resize-y`} value={cvProfile.certifications.join(", ")} onChange={(e) => updateCvProfileField("certifications", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label><label className={labelClass}>Languages · comma separated<textarea className={`${inputClass} min-h-[70px] resize-y`} value={cvProfile.languages.join(", ")} onChange={(e) => updateCvProfileField("languages", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Live CV preview</div>
                        <div className="mt-1 text-sm text-slate-500">This preview updates instantly as you edit your profile or switch templates.</div>
                      </div>
                      <button onClick={() => setCvBuilderTab("profile")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300">Edit profile</button>
                    </div>

                    <div className="mt-5 flex justify-center overflow-auto rounded-2xl bg-slate-100 p-4 sm:p-6">
                      <div className={`w-full max-w-[760px] min-h-[980px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)] ${cvTemplate === "modern" ? "border-l-[7px] border-sky-600" : cvTemplate === "executive" ? "border-t-[8px] border-slate-900" : ""}`}>
                        {cvTemplate === "modern" ? (
                          <div className="px-8 py-9 sm:px-12 sm:py-11">
                            <div className="flex flex-col gap-5 border-b border-sky-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
                              <div><div className="text-3xl font-bold tracking-tight text-slate-950">{cvProfile.name || "Your Name"}</div><div className="mt-1 text-base font-semibold text-sky-700">{cvProfile.headline || "Professional Headline"}</div></div>
                              <div className="text-xs leading-5 text-slate-500 sm:text-right">{[cvProfile.email, cvProfile.phone, cvProfile.location, cvProfile.website, cvProfile.linkedin].filter(Boolean).map((x) => <div key={x}>{x}</div>)}</div>
                            </div>
                            {cvProfile.summary && <div className="mt-7"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Profile</div><p className="mt-2 text-sm leading-6 text-slate-700">{cvProfile.summary}</p></div>}
                            {cvProfile.skills.length > 0 && <div className="mt-7"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Core skills</div><div className="mt-2 text-sm leading-6 text-slate-700">{cvProfile.skills.join(" · ")}</div></div>}
                            {cvProfile.experience.length > 0 && <div className="mt-7"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Experience</div>{cvProfile.experience.map((item, i) => <div key={i} className="mt-4"><div className="flex flex-wrap justify-between gap-2"><div className="text-sm font-bold text-slate-900">{item.role || "Role"}{item.company ? ` · ${item.company}` : ""}</div><div className="text-xs text-slate-400">{item.start_date}{item.start_date || item.end_date || item.current ? " — " : ""}{item.current ? "Present" : item.end_date}</div></div>{item.location && <div className="mt-0.5 text-xs text-slate-400">{item.location}</div>}{item.bullets.filter(Boolean).map((b,j)=><div key={j} className="mt-1.5 pl-4 text-xs leading-5 text-slate-600">• {b}</div>)}</div>)}</div>}
                            {cvProfile.education.length > 0 && <div className="mt-7"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Education</div>{cvProfile.education.map((item,i)=><div key={i} className="mt-3 text-sm text-slate-700"><span className="font-bold">{[item.degree,item.field].filter(Boolean).join(" ") || "Education"}</span>{item.institution ? ` · ${item.institution}` : ""}</div>)}</div>}
                            {cvProfile.projects.length > 0 && <div className="mt-7"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Projects</div>{cvProfile.projects.map((item,i)=><div key={i} className="mt-3"><div className="text-sm font-bold">{item.name || "Project"}</div><div className="mt-1 text-xs leading-5 text-slate-600">{item.description}</div></div>)}</div>}
                          </div>
                        ) : cvTemplate === "executive" ? (
                          <div className="px-8 py-9 sm:px-12 sm:py-11">
                            <div className="border-b-2 border-slate-900 pb-5"><div className="text-3xl font-semibold tracking-tight text-slate-950">{cvProfile.name || "YOUR NAME"}</div><div className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">{cvProfile.headline || "Professional Headline"}</div><div className="mt-3 text-xs text-slate-500">{[cvProfile.email,cvProfile.phone,cvProfile.location,cvProfile.website,cvProfile.linkedin].filter(Boolean).join("  •  ")}</div></div>
                            {cvProfile.summary && <div className="mt-7"><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">Executive Profile</div><p className="mt-2 text-sm leading-6 text-slate-700">{cvProfile.summary}</p></div>}
                            {cvProfile.experience.length > 0 && <div className="mt-7"><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">Professional Experience</div>{cvProfile.experience.map((item,i)=><div key={i} className="mt-5"><div className="flex justify-between gap-4"><div><div className="text-sm font-bold">{item.role || "Role"}</div><div className="mt-0.5 text-xs font-medium text-slate-500">{item.company}{item.location ? ` · ${item.location}` : ""}</div></div><div className="text-xs text-slate-500">{item.start_date}{item.start_date || item.end_date || item.current ? " — " : ""}{item.current ? "Present" : item.end_date}</div></div>{item.bullets.filter(Boolean).map((b,j)=><div key={j} className="mt-2 pl-4 text-xs leading-5 text-slate-600">• {b}</div>)}</div>)}</div>}
                            <div className="mt-7 grid gap-8 sm:grid-cols-2"><div>{cvProfile.skills.length > 0 && <><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">Core Competencies</div><div className="mt-2 text-xs leading-6 text-slate-600">{cvProfile.skills.join(" · ")}</div></>}</div><div>{cvProfile.education.length > 0 && <><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">Education</div>{cvProfile.education.map((item,i)=><div key={i} className="mt-2 text-xs text-slate-600"><span className="font-semibold">{[item.degree,item.field].filter(Boolean).join(" ")}</span>{item.institution ? ` · ${item.institution}` : ""}</div>)}</>}</div></div>
                          </div>
                        ) : cvTemplate === "minimal" ? (
                          <div className="px-8 py-9 sm:px-12 sm:py-11">
                            <div><div className="text-3xl font-bold tracking-tight">{cvProfile.name || "Your Name"}</div><div className="mt-1 text-sm text-slate-600">{cvProfile.headline || "Professional Headline"}</div><div className="mt-2 text-[11px] text-slate-400">{[cvProfile.email,cvProfile.phone,cvProfile.location,cvProfile.website,cvProfile.linkedin].filter(Boolean).join(" · ")}</div></div>
                            {cvProfile.summary && <div className="mt-8"><div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">Summary</div><p className="mt-2 text-sm leading-6 text-slate-700">{cvProfile.summary}</p></div>}
                            {cvProfile.experience.length > 0 && <div className="mt-8"><div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">Experience</div>{cvProfile.experience.map((item,i)=><div key={i} className="mt-4"><div className="flex justify-between gap-3 text-sm"><span className="font-semibold">{item.role || "Role"}{item.company ? `, ${item.company}` : ""}</span><span className="text-xs text-slate-400">{item.start_date}{item.start_date || item.end_date || item.current ? " — " : ""}{item.current ? "Present" : item.end_date}</span></div>{item.bullets.filter(Boolean).map((b,j)=><div key={j} className="mt-1 text-xs leading-5 text-slate-600">• {b}</div>)}</div>)}</div>}
                            {cvProfile.skills.length > 0 && <div className="mt-8"><div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">Skills</div><div className="mt-2 text-xs leading-6 text-slate-600">{cvProfile.skills.join(" · ")}</div></div>}
                            {cvProfile.education.length > 0 && <div className="mt-8"><div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">Education</div>{cvProfile.education.map((item,i)=><div key={i} className="mt-2 text-xs text-slate-600"><span className="font-semibold">{[item.degree,item.field].filter(Boolean).join(" ")}</span>{item.institution ? ` · ${item.institution}` : ""}</div>)}</div>}
                          </div>
                        ) : (
                          <div className="px-8 py-9 sm:px-12 sm:py-11">
                            <div className="text-center"><div className="text-3xl font-bold tracking-tight">{cvProfile.name || "Your Name"}</div><div className="mt-1 text-sm font-semibold text-slate-600">{cvProfile.headline || "Professional Headline"}</div><div className="mt-2 text-[11px] text-slate-400">{[cvProfile.email,cvProfile.phone,cvProfile.location,cvProfile.website,cvProfile.linkedin].filter(Boolean).join(" · ")}</div></div>
                            {cvProfile.summary && <div className="mt-7 border-t border-slate-200 pt-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Professional Summary</div><p className="mt-2 text-sm leading-6 text-slate-700">{cvProfile.summary}</p></div>}
                            {cvProfile.skills.length > 0 && <div className="mt-6"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Skills</div><div className="mt-2 flex flex-wrap gap-1.5">{cvProfile.skills.map((skill,i)=><span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-700">{skill}</span>)}</div></div>}
                            {cvProfile.experience.length > 0 && <div className="mt-7 border-t border-slate-200 pt-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Experience</div>{cvProfile.experience.map((item,i)=><div key={i} className="mt-4"><div className="flex flex-wrap justify-between gap-2"><div className="text-sm font-semibold">{item.role || "Role"}{item.company ? ` · ${item.company}` : ""}</div><div className="text-xs text-slate-400">{item.start_date}{item.start_date || item.end_date || item.current ? " — " : ""}{item.current ? "Present" : item.end_date}</div></div>{item.bullets.filter(Boolean).map((b,j)=><div key={j} className="mt-1.5 text-xs leading-5 text-slate-600">• {b}</div>)}</div>)}</div>}
                            {cvProfile.education.length > 0 && <div className="mt-7 border-t border-slate-200 pt-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Education</div>{cvProfile.education.map((item,i)=><div key={i} className="mt-3 text-xs text-slate-700"><span className="font-semibold">{[item.degree,item.field].filter(Boolean).join(" ") || "Education"}</span>{item.institution ? ` · ${item.institution}` : ""}</div>)}</div>}
                            {cvProfile.projects.length > 0 && <div className="mt-7 border-t border-slate-200 pt-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Projects</div>{cvProfile.projects.map((item,i)=><div key={i} className="mt-3"><div className="text-sm font-semibold">{item.name || "Project"}</div>{item.description && <div className="mt-1 text-xs leading-5 text-slate-600">{item.description}</div>}</div>)}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-5 text-sky-800"><strong>{cvTemplate === "ats-classic" ? "ATS Classic" : cvTemplate === "modern" ? "Modern" : cvTemplate === "executive" ? "Executive" : "Minimal"} template selected.</strong> This is a live preview of your editable profile. Change the template or edit the profile anytime before exporting.</div>
                </div>
              )}
            </section>
          </div>

          {cvAnalysis && (
            <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className={cardClass}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Career intelligence</div>
                <div className="mt-1 text-sm text-slate-500">AI analysis stays separate from the editable profile so you remain in control of changes.</div>
                <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Skills</div><div className="mt-1 text-lg font-semibold">{(cvAnalysis.skills || []).length}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Strengths</div><div className="mt-1 text-lg font-semibold">{(cvAnalysis.strengths || []).length}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Gaps</div><div className="mt-1 text-lg font-semibold">{(cvAnalysis.missing_keywords || []).length}</div></div></div>
              </div>
              {hasJob ? <div className={cardClass}><div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">ATS snapshot</div><div className="mt-1 text-xs text-slate-500">Same profile + target job.</div></div>{cvAtsRefreshing && <span className="text-xs text-sky-600">Updating…</span>}</div><div className="mt-4 grid grid-cols-5 gap-2">{[["Role",cvAnalysis.ats_breakdown?.role_alignment],["Skills",cvAnalysis.ats_breakdown?.skills],["Experience",cvAnalysis.ats_breakdown?.experience],["Evidence",cvAnalysis.ats_breakdown?.evidence],["Keywords",cvAnalysis.ats_breakdown?.keywords]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-base font-semibold">{Number(value ?? 0)}%</div></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{(cvAnalysis.missing_keywords || []).slice(0,10).map((x,i)=><span key={i} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">{x}</span>)}</div></div> : <div className={cardClass}><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Next step</div><div className="mt-2 text-sm font-semibold">Paste a target job description</div><p className="mt-1 text-xs leading-5 text-slate-500">We can then score role alignment, skills, evidence, and keywords against it.</p></div>}
            </section>
          )}
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // PDF Toolbox
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-toolbox"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-7xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-3xl">
            <div className="toolbox-hero-icon toolbox-hero-icon-pdf">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </div>

            <div className="toolbox-kicker toolbox-kicker-pdf">PDF WORKSPACE</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              PDF Toolbox
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">
              Everything for working with PDFs, organized by task.
              More PDF capabilities can be added here without changing
              the main MyToolbox AI workspace.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ToolCard
              title="Convert PDF"
              description="Convert a PDF to Word, plain text, or page images from one simple tool."
              onClick={() => setActiveTool("pdf-convert")}
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h4" />
                  <path d="m15 16 2 2 3-3" />
                </svg>
              }
            />

            <ToolCard
              title="Organize PDF"
              description="Merge files, split selected pages, or reorder a PDF from one tool."
              badge="New"
              onClick={() => setActiveTool("pdf-organize")}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 6h13" />
                  <path d="M8 12h13" />
                  <path d="M8 18h13" />
                  <path d="M3 6h.01" />
                  <path d="M3 12h.01" />
                  <path d="M3 18h.01" />
                </svg>
              }
            />

            <ToolCard
              title="PDF Editor"
              description="Select text inside a PDF, replace it, and export the edited document."
              badge="FLAGSHIP"
              onClick={() =>
                setActiveTool("pdf-editor")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                </svg>
              }
            />

            <ToolCard
              title="Ask Your PDF"
              description="Ask natural-language questions and get answers grounded in the document."
              badge="AI"
              onClick={() =>
                setActiveTool("pdf-ai")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-4-.9L3 21l1.8-4.2A8.4 8.4 0 1 1 21 11.5Z" />
                  <path d="M8 11h.01" />
                  <path d="M12 11h.01" />
                  <path d="M16 11h.01" />
                </svg>
              }
            />

            <ToolCard
              title="OCR / Make Searchable"
              description="Make scanned PDFs searchable and prepare them for downstream document workflows."
              badge="Soon"
              onClick={() => {
                setError(
                  "OCR / Make Searchable is planned for the PDF Toolbox and will be connected next."
                );
              }}
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <path d="M7 12h10" />
                  <path d="M7 8h10" />
                  <path d="M7 16h6" />
                </svg>
              }
            />

            <ToolCard
              title="Extract Data"
              description="Use AI to turn invoices and business PDFs into structured fields and line items."
              badge="AI"
              onClick={() => setActiveTool("pdf-data")}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                  <path d="M14 3v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                  <path d="m15 12 2 2 3-3" />
                </svg>
              }
            />

            <ToolCard
              title="More PDF Tools"
              description="Merge, split, compress, and more can be added here as the toolbox grows."
              badge="Roadmap"
              onClick={() => {
                setError(
                  "More PDF tools are planned for this toolbox."
                );
              }}
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="5" cy="12" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                </svg>
              }
            />
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // PDF Editor
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-editor"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <PdfEditor
          apiBase={API_BASE}
          error={error}
          onError={setError}
        />
      </main>
    );
  }

  // ----------------------------------------------------------
  // Background Tool
  // ----------------------------------------------------------

  if (
    activeTool ===
    "background"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="3"
                />
                <circle
                  cx="8.5"
                  cy="8.5"
                  r="1.5"
                />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Remove Background
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Upload an image and MyToolbox AI
              will automatically remove its
              background.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div>
              <UploadZone
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif,.heic,.heif"
                file={imageFile}
                inputRef={imageInputRef}
                onSelect={
                  handleImageSelect
                }
                label="Drop your image here"
                description="PNG, JPG, JPEG, or WebP"
                icon={
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                }
              />

              <button
                onClick={removeBackground}
                disabled={
                  loading ||
                  !imageFile
                }
                className="mt-4 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading
                  ? "Removing background..."
                  : "Remove Background"}
              </button>
            </div>

            <div className="rounded-3xl border border-black/8 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  Result
                </div>

                {imageResult && (
                  <a
                    href={
                      imageResult
                    }
                    download="mytoolbox-ai-no-background.png"
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black hover:text-white"
                  >
                    Download
                  </a>
                )}
              </div>

              <div className="flex min-h-[390px] items-center justify-center overflow-hidden rounded-2xl bg-[#f3f3f1]">
                {imageResult ? (
                  <img
                    src={
                      imageResult
                    }
                    alt="Background removed"
                    className="max-h-[500px] max-w-full object-contain"
                  />
                ) : imagePreview ? (
                  <img
                    src={
                      imagePreview
                    }
                    alt="Original"
                    className="max-h-[500px] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-sm text-black/30">
                    Your processed image
                    will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // PDF Organize
  // ----------------------------------------------------------

  if (activeTool === "pdf-organize") {
    const operationLabel =
      pdfOrganizeOperation === "merge"
        ? "Merge PDFs"
        : pdfOrganizeOperation === "split"
          ? "Split PDF"
          : "Reorder Pages";

    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header onHome={goHome} />
        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6h13" />
                <path d="M8 12h13" />
                <path d="M8 18h13" />
                <path d="M3 6h.01" />
                <path d="M3 12h.01" />
                <path d="M3 18h.01" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Organize your PDFs.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">
              Merge multiple PDFs, split selected pages, or reorder every page without leaving the toolbox.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-black/8 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  Operation
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["merge", "split", "reorder"] as const).map((operation) => (
                    <button
                      key={operation}
                      onClick={() => {
                        setPdfOrganizeOperation(operation);
                        clearError();
                      }}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                        pdfOrganizeOperation === operation
                          ? "bg-black text-white"
                          : "bg-[#f5f5f3] text-black/55 hover:bg-[#eeeeec] hover:text-black"
                      }`}
                    >
                      {operation === "merge" ? "Merge" : operation === "split" ? "Split" : "Reorder"}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs leading-5 text-black/40">
                  {pdfOrganizeOperation === "merge"
                    ? "Combine PDFs in the order shown below."
                    : pdfOrganizeOperation === "split"
                      ? "Choose pages such as 1-3,5,8-10. The selected pages are returned as separate PDFs in a ZIP."
                      : "Enter every page number exactly once, in the new order, such as 3,1,2,4."}
                </p>
              </div>

              {pdfOrganizeOperation === "split" && (
                <div className="rounded-3xl border border-black/8 bg-white p-5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                    Pages to split
                  </label>
                  <input
                    value={pdfPageRanges}
                    onChange={(event) => setPdfPageRanges(event.target.value)}
                    placeholder="e.g. 1-3,5,8-10"
                    className="mt-3 w-full rounded-xl border border-black/10 bg-[#fafaf8] px-4 py-3 text-sm outline-none transition focus:border-black/30"
                  />
                </div>
              )}

              {pdfOrganizeOperation === "reorder" && (
                <div className="rounded-3xl border border-black/8 bg-white p-5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                    New page order
                  </label>
                  <input
                    value={pdfPageOrder}
                    onChange={(event) => setPdfPageOrder(event.target.value)}
                    placeholder="e.g. 3,1,2,4"
                    className="mt-3 w-full rounded-xl border border-black/10 bg-[#fafaf8] px-4 py-3 text-sm outline-none transition focus:border-black/30"
                  />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <input
                ref={pdfOrganizeInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(event) => {
                  handlePdfOrganizeFiles(event.target.files);
                  event.target.value = "";
                }}
              />

              <div
                onDragOver={handleDragOver}
                onDrop={(event) => {
                  event.preventDefault();
                  handlePdfOrganizeFiles(event.dataTransfer.files);
                }}
                onClick={() => pdfOrganizeInputRef.current?.click()}
                className="cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] p-8 text-center transition hover:border-black/30"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                </div>
                <div className="mt-5 text-sm font-semibold">
                  {pdfOrganizeOperation === "merge" ? "Drop your PDFs here" : "Drop your PDF here"}
                </div>
                <div className="mt-2 text-xs leading-5 text-black/40">
                  {pdfOrganizeOperation === "merge" ? "Add multiple PDFs. Up to 20 files." : "One PDF for split or reorder."}
                </div>
                <div className="mt-4 inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/60">
                  Choose PDF{pdfOrganizeOperation === "merge" ? "s" : ""}
                </div>
              </div>

              {pdfOrganizeFiles.length > 0 && (
                <div className="mt-5 space-y-2">
                  {pdfOrganizeFiles.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 rounded-xl bg-[#f7f7f5] px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-[10px] font-bold text-white">PDF</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{index + 1}. {file.name}</div>
                        <div className="mt-0.5 text-xs text-black/35">{formatBytes(file.size)}</div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removePdfOrganizeFile(index);
                        }}
                        className="rounded-lg px-2 py-1 text-xs text-black/35 hover:bg-white hover:text-black"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={organizePdfs}
                  disabled={loading || !pdfOrganizeFiles.length}
                  className="flex-1 rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loading ? "Processing..." : operationLabel}
                </button>
                {pdfOrganizeFiles.length > 0 && (
                  <button
                    onClick={clearPdfOrganizeFiles}
                    disabled={loading}
                    className="rounded-2xl border border-black/10 px-5 py-3.5 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black disabled:opacity-30"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // PDF Data Extraction
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-data"
  ) {
    const data = pdfExtractedData;
    const lineItems = Array.isArray(data?.line_items) ? data.line_items : [];
    const customFields = data?.custom_fields ?? {};

    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header onHome={goHome} />
        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button onClick={goHome} className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            All toolboxes
          </button>

          <div className="max-w-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 3v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Extract structured data.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">Turn invoices, receipts, quotes, statements, and similar PDFs into clean structured fields with AI.</p>
          </div>

          <div className="mt-10 max-w-4xl">
            <UploadZone accept="application/pdf" file={pdfFile} inputRef={pdfInputRef} onSelect={handlePdfSelect} label="Drop your PDF here" description="PDF documents only" icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>} />
            <button onClick={extractPdfData} disabled={loading || !pdfFile} className="mt-5 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30">{loading ? "Extracting data..." : "Extract Data with AI"}</button>
          </div>

          {data && (
            <div className="mt-10 max-w-5xl space-y-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-black/8 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-black/35">Detected document</div>
                  <div className="mt-2 text-xl font-semibold capitalize">{data.document_type || "Document"}</div>
                  {pdfDataOcrUsed && <div className="mt-1 text-xs text-black/40">OCR was used because the PDF had little or no text layer.</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={downloadExtractedJson} className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold hover:bg-black hover:text-white">Download JSON</button>
                  <button onClick={downloadExtractedCsv} className="rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-black/85">Download CSV</button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Invoice #", data.invoice_number], ["Vendor", data.vendor], ["Customer", data.customer],
                  ["Date", data.date], ["Due date", data.due_date], ["Currency", data.currency],
                  ["Subtotal", data.subtotal], ["Tax", data.tax], ["Total", data.total], ["Payment status", data.payment_status],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-black/8 bg-white p-5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-black/35">{label}</div>
                    <div className="mt-2 break-words text-sm font-medium text-black/80">{value == null || value === "" ? "—" : String(value)}</div>
                  </div>
                ))}
              </div>

              {lineItems.length > 0 && (
                <div className="overflow-hidden rounded-3xl border border-black/8 bg-white">
                  <div className="border-b border-black/8 px-6 py-5"><h2 className="font-semibold">Line items</h2><p className="mt-1 text-xs text-black/40">Items detected in the document.</p></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#f7f7f5] text-xs uppercase tracking-wider text-black/40"><tr><th className="px-6 py-3">Description</th><th className="px-6 py-3">Qty</th><th className="px-6 py-3">Unit price</th><th className="px-6 py-3">Amount</th></tr></thead>
                      <tbody>{lineItems.map((item, index) => <tr key={index} className="border-t border-black/6"><td className="px-6 py-4 font-medium">{item.description || "—"}</td><td className="px-6 py-4 text-black/60">{item.quantity ?? "—"}</td><td className="px-6 py-4 text-black/60">{item.unit_price ?? "—"}</td><td className="px-6 py-4 text-black/60">{item.amount ?? "—"}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {Object.keys(customFields).length > 0 && (
                <div className="rounded-3xl border border-black/8 bg-white p-6">
                  <h2 className="font-semibold">Additional fields</h2>
                  <div className="mt-4 space-y-3">
                    {Object.entries(customFields).map(([key, value]) => <div key={key} className="flex flex-col gap-1 border-b border-black/6 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"><span className="text-sm font-medium text-black/60">{key}</span><span className="max-w-xl break-words text-sm text-black/80">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</span></div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  // PDF Text
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-text"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Extract PDF Text
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Extract text page-by-page from
              your PDF document.
            </p>
          </div>

          <div className="mt-10">
            <UploadZone
              accept="application/pdf"
              file={pdfFile}
              inputRef={pdfInputRef}
              onSelect={
                handlePdfSelect
              }
              label="Drop your PDF here"
              description="PDF documents only"
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                </svg>
              }
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={
                extractPdfText
              }
              disabled={
                loading ||
                !pdfFile
              }
              className="w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading
                ? "Extracting..."
                : "Extract Text"}
            </button>
              <button
                onClick={convertPdfToTxt}
                disabled={loading || !pdfFile}
                className="w-full rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-black transition-all hover:border-black/20 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading ? "Working..." : "Download .TXT"}
              </button>
            </div>
          </div>

          {pdfText.length >
            0 && (
            <div className="mt-10 space-y-4">
              {pdfText.map(
                (page) => (
                  <div
                    key={
                      page.page
                    }
                    className="rounded-3xl border border-black/8 bg-white p-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                        Page{" "}
                        {
                          page.page
                        }
                      </div>
                    </div>

                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-black/70">
                      {
                        page.text
                      }
                    </pre>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  // PDF AI
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-ai"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All toolboxes
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-4-.9L3 21l1.8-4.2A8.4 8.4 0 1 1 21 11.5Z" />
                <path d="M8 11h.01" />
                <path d="M12 11h.01" />
                <path d="M16 11h.01" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Ask Your PDF
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Ask questions about your
              document and get answers grounded
              in its contents.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <UploadZone
                accept="application/pdf"
                file={pdfFile}
                inputRef={pdfInputRef}
                onSelect={
                  handlePdfSelect
                }
                label="Drop your PDF here"
                description="PDF documents only"
                icon={
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                }
              />

              <div className="mt-4 rounded-3xl border border-black/8 bg-white p-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  Your question
                </label>

                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  placeholder="What is this document about?"
                  rows={5}
                  className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm outline-none transition focus:border-black/30"
                />

                <button
                  onClick={
                    askPdf
                  }
                  disabled={
                    loading ||
                    !pdfFile ||
                    !question.trim()
                  }
                  className="mt-3 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loading
                    ? "Thinking..."
                    : "Ask PDF"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  AI Answer
                </div>

                {sources.length >
                  0 && (
                  <div className="rounded-full bg-[#f3f3f1] px-3 py-1 text-[11px] font-medium text-black/50">
                    {sources.length}{" "}
                    source
                    {sources.length ===
                    1
                      ? ""
                      : "s"}
                  </div>
                )}
              </div>

              {answer ? (
                <div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-black/75">
                    {answer}
                  </div>

                  {sources.length >
                    0 && (
                    <div className="mt-8 border-t border-black/8 pt-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                        Sources
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {sources.map(
                          (
                            source
                          ) => (
                            <span
                              key={
                                source
                              }
                              className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black/50"
                            >
                              Page{" "}
                              {
                                source
                              }
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-[#f3f3f1] px-8 text-center text-sm leading-6 text-black/30">
                  Upload a PDF and ask a
                  question. Your grounded AI
                  answer will appear here.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // AI Assistant
  // ----------------------------------------------------------

  if (
    activeTool ===
    "auto"
  ) {
    return (
      <main className="page-shell workspace-page min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-4xl px-5 pb-20 pt-8 sm:px-6 sm:pt-10">
          <div className="mb-7 flex items-center justify-between">
            <button
              onClick={goHome}
              className="group inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3.5 py-2 text-xs font-medium text-black/50 shadow-[0_2px_10px_rgba(0,0,0,0.025)] transition-all hover:-translate-x-0.5 hover:border-black/15 hover:text-black"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              All toolboxes
            </button>

            <span className="hidden rounded-full border border-black/8 bg-white px-3 py-1.5 text-[11px] font-medium text-black/40 sm:inline-flex">
              AI-powered workspace
            </span>
          </div>

          <div className="mx-auto max-w-2xl text-center">
            <div className="toolbox-hero-icon toolbox-hero-icon-copilot mx-auto">
              <svg
                width="34"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
              </svg>
            </div>

            <div className="toolbox-kicker toolbox-kicker-copilot mt-5">AI WORKSPACE</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              MyToolbox Copilot
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/45 sm:text-[15px]">
              Ask naturally. Attach a file when you need it. MyToolbox AI will
              understand typos, choose the right capability, and do the work.
            </p>
          </div>

          <div className="mt-9 overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_12px_50px_rgba(0,0,0,0.045)]">
            <div className="min-h-[520px] px-4 py-5 sm:px-7 sm:py-7">
              {!autoResult && !workflowResult && (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="max-w-xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f3f1] text-black">
                      <svg
                        width="25"
                        height="25"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
                      </svg>
                    </div>

                    <h2 className="mt-5 text-lg font-semibold tracking-tight">
                      How can I help?
                    </h2>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/40">
                      Upload a PDF or image, then ask naturally. Typos and casual wording are okay.
                    </p>

                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {[
                        "Extract data from this PDF",
                        "What is this image about?",
                        "Describe this image",
                        "Remove the background",
                        "Convert this PDF to Word",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setAutoPrompt(suggestion)}
                          className="rounded-full border border-black/8 bg-[#f8f8f6] px-3.5 py-2 text-xs text-black/50 transition-all hover:border-black/15 hover:bg-white hover:text-black"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(autoResult || workflowResult) && (
                <div className="mx-auto max-w-2xl space-y-6 py-2">
                  {autoPrompt.trim() && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-black px-4 py-3 text-sm leading-6 text-white">
                        {autoPrompt}
                      </div>
                    </div>
                  )}

                  {autoResult && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-black/45">
                          MyToolbox Copilot
                        </div>

                        <div className="mt-2 rounded-3xl rounded-tl-lg border border-black/8 bg-[#f8f8f6] p-4 sm:p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/30">
                                Completed
                              </div>
                              <h2 className="mt-1 text-base font-semibold tracking-tight">
                                {autoResult.tool || "Your result"}
                              </h2>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-black/40">
                              AI selected
                            </span>
                          </div>

                          {autoResult.reason && (
                            <div className="mt-4 text-sm leading-6 text-black/55">
                              {autoResult.reason}
                            </div>
                          )}

                          {autoResultType === "image" && autoResult.answer && (
                            <div className="mt-4">
                              <img
                                src={autoResult.answer}
                                alt="Auto processed result"
                                className="max-h-[520px] w-full rounded-2xl border border-black/6 bg-white object-contain"
                              />
                              <a
                                href={autoResult.answer}
                                download="mytoolbox-ai-result.png"
                                className="mt-3 inline-flex rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-black/85"
                              >
                                Download result
                              </a>
                            </div>
                          )}

                          {autoResultType === "pdf" && autoResult.answer && (
                            <div className="mt-4 rounded-2xl border border-black/8 bg-white p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
                                  <span className="text-xs font-bold">PDF</span>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold">Your PDF is ready</div>
                                  <div className="text-xs text-black/45">Image converted without AI.</div>
                                </div>
                              </div>
                              <a
                                href={autoResult.answer}
                                download="mytoolbox-image.pdf"
                                className="mt-4 inline-flex rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-black/85"
                              >
                                Download PDF
                              </a>
                            </div>
                          )}

                          {autoResult.answer && autoResultType !== "image" && (
                            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/70">
                              {autoResult.answer}
                            </div>
                          )}

                          {autoResult.sources && autoResult.sources.length > 0 && (
                            <div className="mt-5 border-t border-black/8 pt-4">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/30">
                                Sources
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {autoResult.sources.map((source) => (
                                  <span key={source} className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs text-black/45">
                                    Page {source}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {workflowResult && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v18M3 12h18" />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-black/45">
                          Workflow complete
                        </div>

                        <div className="mt-2 rounded-3xl rounded-tl-lg border border-black/8 bg-[#f8f8f6] p-4 sm:p-5">
                          <h2 className="text-base font-semibold tracking-tight">
                            Multi-step execution
                          </h2>

                          {workflowResult.summary && (
                            <p className="mt-2 text-sm leading-6 text-black/50">
                              {workflowResult.summary}
                            </p>
                          )}

                          {workflowResult.workflow?.steps && workflowResult.workflow.steps.length > 0 && (
                            <div className="mt-5 space-y-2">
                              {workflowResult.workflow.steps.map((step, index) => (
                                <div key={`${step.tool}-${index}`} className="flex gap-3 rounded-2xl bg-white p-3">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-[10px] font-semibold text-white">
                                    {index + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold">{step.tool}</div>
                                    <div className="mt-1 text-xs leading-5 text-black/40">{step.reason}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {workflowResult.steps && workflowResult.steps.length > 0 && (
                            <div className="mt-5 space-y-2">
                              {workflowResult.steps.map((step) => (
                                <div key={step.step} className="flex gap-3 rounded-2xl bg-white p-3">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-[10px] font-semibold text-white">
                                    {step.step}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-semibold">{step.tool}</span>
                                      <span className="rounded-full bg-[#f3f3f1] px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-black/40">
                                        {step.status}
                                      </span>
                                    </div>
                                    {step.reason && (
                                      <div className="mt-1 text-xs leading-5 text-black/40">{step.reason}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {workflowResult.answer && (
                            <div className="mt-5 border-t border-black/8 pt-4 whitespace-pre-wrap text-sm leading-7 text-black/70">
                              {workflowResult.answer}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-black/8 bg-[#fcfcfb] p-3 sm:p-4">
              {autoFiles.length > 0 && (
                <div className="mb-2 rounded-2xl border border-black/8 bg-white p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                      Attachments · {autoFiles.length}/10
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAutoSelect(null)}
                      className="text-[10px] font-medium text-black/35 transition hover:text-black"
                    >
                      Remove all
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {autoFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex max-w-full items-center gap-2 rounded-xl border border-black/7 bg-[#f8f8f6] px-2.5 py-2"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-black/40">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                            <path d="M14 2v6h6" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="max-w-[180px] truncate text-[11px] font-medium">{file.name}</div>
                          <div className="text-[9px] text-black/30">{formatBytes(file.size)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAutoFile(index)}
                          className="rounded-full px-1.5 py-0.5 text-xs text-black/30 hover:bg-white hover:text-black"
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2 rounded-[22px] border border-black/10 bg-white p-2 shadow-[0_4px_18px_rgba(0,0,0,0.035)] focus-within:border-black/20">
                <input
                  ref={autoInputRef}
                  type="file"
                  accept="image/*,application/pdf,.docx,.txt,.csv"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    event.stopPropagation();
                    handleAutoSelect(
                      Array.from(event.target.files ?? [])
                    );
                    event.target.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={() => autoInputRef.current?.click()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black/40 transition hover:bg-[#f3f3f1] hover:text-black"
                  aria-label="Attach file"
                  title="Attach up to 10 files"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>

                <textarea
                  value={autoPrompt}
                  onChange={(event) => setAutoPrompt(event.target.value)}
                  placeholder="Ask anything about your file…"
                  rows={1}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!loading && autoFiles.length > 0 && autoPrompt.trim()) {
                        runAuto();
                      }
                    }
                  }}
                  className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-black/30"
                />

                <button
                  onClick={runAuto}
                  disabled={loading || autoFiles.length === 0 || !autoPrompt.trim()}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  {loading ? (
                    <>
                      <span className="ai-spinner h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white" />
                      <span className="hidden sm:inline">Working</span>
                    </>
                  ) : (
                    <>
                      Send
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 14-7-4 14-3-6-7-1Z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-[10px] text-black/30">
                  Up to 10 files · PDF, images & common documents · Typos are okay
                </span>

                <button
                  onClick={runWorkflow}
                  disabled={loading || autoFiles.length !== 1 || !autoPrompt.trim()}
                  className="text-[11px] font-medium text-black/40 transition hover:text-black disabled:cursor-not-allowed disabled:opacity-25"
                >
                  Use multi-step workflow →
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-4 flex max-w-2xl items-center justify-center gap-2 text-[10px] text-black/30">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 3 6v6c0 5.25 3.84 8.9 9 10 5.16-1.1 9-4.75 9-10V6l-9-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Controlled routing — AI can only use supported MyToolbox capabilities.
          </div>
        </section>
      </main>
    );
  }

  return null;
}

