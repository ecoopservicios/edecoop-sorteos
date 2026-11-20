"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CheckCircle2, IdCard, ListChecks, LoaderCircle, Mail, MessageCircle, Monitor, Pencil, Search, Send, ShieldCheck, Smartphone } from "lucide-react";
import { notify } from "@/lib/toast";
import { IdentityDocumentCapture } from "@/components/identity-document-capture";
import { DataUpdateIdentityHandoff } from "@/components/data-update-identity-handoff";
import { emergencyContactRelationLabel, normalizeOtherEmergencyRelation } from "@/lib/emergency-contact-relation";
import { dataUpdatePhoneDigits, formatDataUpdatePhone } from "@/lib/data-update-phone";

type CompanyOption = { id: string; companyName: string; lookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" };
type FoundMember = { id: string; companyName: string; fullName: string; documentId: string | null; employeeNumber: string | null };
type DataUpdateTexts = { title: string; description: string; lookupQuestion: string; notFoundMessage: string; successMessage: string; whatsappMessage: string };
type DataUpdateQuestion = {
  id: string; fieldKey: string; label: string; section: "CONTACT" | "EMERGENCY" | "ADDITIONAL";
  type: "TEXT" | "NUMBER" | "PHONE" | "EMAIL" | "SELECT"; required: boolean; isSystem: boolean; helpText?: string; options?: string[];
};
type Stage = { key: string; title: string; question?: DataUpdateQuestion };
type WhatsappMode = "" | "SAME" | "OTHER" | "NONE";
type IdentityKind = "" | "DOCUMENT_ID" | "EMPLOYEE_CARD";
const inputClass = "h-14 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const primaryClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60";

function questionError(question: DataUpdateQuestion, value: string) {
  value = value.trim();
  if (!value) return question.required ? "Este campo es obligatorio." : "";
  if (question.type === "PHONE" && !/^\d{10}$/.test(value)) return "Ingresa un teléfono de 10 números.";
  if (question.type === "NUMBER" && !/^\d+$/.test(value)) return "Ingresa solo números.";
  if (question.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Ingresa un correo electrónico válido.";
  if (question.type === "SELECT" && !question.options?.includes(value)) return "Selecciona una opción válida.";
  if (question.fieldKey === "emergencyContactName" && (value.length < 2 || !/^[A-Z ]+$/.test(value))) return "Ingresa el nombre completo con letras y espacios.";
  if (question.fieldKey === "personalEmail" && ["edesur.com.do", "edeeste.com.do", "edenorte.com.do", "edecoop.com.do"].includes(value.split("@")[1]?.toLowerCase())) return "Ingresa tu correo personal, no el institucional.";
  return "";
}

export function DataUpdatePublicForm({ companies, texts, questions, emailEnabled = false }: {
  companies: CompanyOption[]; texts: DataUpdateTexts; questions: DataUpdateQuestion[]; emailEnabled?: boolean;
}) {
  const [companyId, setCompanyId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [member, setMember] = useState<FoundMember | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [documentVerified, setDocumentVerified] = useState(false);
  const [identityKind, setIdentityKind] = useState<IdentityKind>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [whatsappMode, setWhatsappMode] = useState<WhatsappMode>("");
  const [stageKey, setStageKey] = useState("company");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [desktopAdvice, setDesktopAdvice] = useState<"CHECKING" | "SHOW" | "HIDDEN">("CHECKING");
  const [desktopDevice, setDesktopDevice] = useState(false);
  const [mobileExperience, setMobileExperience] = useState(false);
  const [mobileWelcome, setMobileWelcome] = useState(true);
  const [done, setDone] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState<{ message: string; whatsappUrl: string } | null>(null);
  const [canResendEmail, setCanResendEmail] = useState(emailEnabled);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const busy = useRef(false);
  const editing = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = companies.find(c => c.id === companyId);
  const orderedCompanies = useMemo(() => [...companies].sort((left, right) => {
    const priority = (name: string) => {
      const key = name.trim().toUpperCase();
      return key === "EDESUR" ? 0 : key === "EDECOOP" ? 1 : 2;
    };
    return priority(left.companyName) - priority(right.companyName)
      || left.companyName.localeCompare(right.companyName, "es", { sensitivity: "base" });
  }), [companies]);
  const selectedCompanyKey = selected?.companyName.trim().toUpperCase() || "";
  const offersIdentityChoice = ["EDESUR", "EDECOOP"].includes(selectedCompanyKey) && Boolean(member?.employeeNumber);
  const employeeCardLabel = selectedCompanyKey === "EDECOOP" ? "Carnet de empleado EDECOOP" : "Carnet de empleado EDESUR";
  const stages = useMemo<Stage[]>(() => {
    const question = (key: string): Stage[] => {
      const q = questions.find(q => q.fieldKey === key);
      return q ? [{ key, title: key === "emergencyContactName" ? "Contacto de emergencia" : q.label, question: q }] : [];
    };
    return [
      { key: "company", title: "Selecciona tu empresa" },
      { key: "lookup", title: selected?.lookupField === "DOCUMENT_ID" ? "Consulta con tu cédula" : "Consulta con tu número de empleado" },
      ...(selected?.lookupField === "EMPLOYEE_NUMBER" ? [{ key: "document", title: "Valida tu cédula" }] : []),
      { key: "identityPhoto", title: offersIdentityChoice && !identityKind ? "Elige cómo validar tu identidad" : desktopDevice ? "Valida tu identidad con el teléfono" : identityKind === "EMPLOYEE_CARD" ? "Fotografía tu carnet de empleado" : "Fotografía tu cédula" },
      ...question("personalPhone"),
      { key: "whatsapp", title: "¿Tu teléfono personal tiene WhatsApp?" },
      ...(whatsappMode === "OTHER" ? question("whatsappPhone") : []),
      ...question("personalEmail"),
      ...question("emergencyContactName").map(stage => ({ ...stage, title: "¿A quién podemos contactar?" })),
      ...questions.filter(q => !q.isSystem).map(q => ({ key: q.fieldKey, title: q.label, question: q })),
      { key: "review", title: "Revisa tu actualización" }
    ];
  }, [desktopDevice, identityKind, offersIdentityChoice, questions, selected?.lookupField, whatsappMode]);
  const step = Math.max(0, stages.findIndex(s => s.key === stageKey));
  const current = stages[step];
  const effective: Record<string, string> = {
    ...values,
    emergencyContactName: [values.emergencyContactFirstName, values.emergencyContactLastName].filter(Boolean).join(" ").trim().replace(/\s+/g, " "),
    whatsappPhone: whatsappMode === "NONE" ? "" : whatsappMode === "SAME" ? values.personalPhone || "" : values.whatsappPhone || ""
  };
  useEffect(() => { if (stageKey !== "company" || done) heading.current?.focus(); }, [stageKey, done]);
  useEffect(() => {
    function clearRestoredForm(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setCompanyId(""); setLookupValue(""); setDocumentId(""); setMember(null);
      setVerificationToken(""); setDocumentVerified(false); setIdentityKind(""); setValues({}); setWhatsappMode("");
      setStageKey("company"); setDone(""); setAlreadySubmitted(false); setPendingSubmission(false); setEditingExisting(false);
      setCanResendEmail(emailEnabled); setEmailVerified(false); setResendMessage(""); setResendError("");
      setMobileWelcome(true); setDesktopAdvice(desktopDevice ? "SHOW" : "HIDDEN"); setError(""); setNotFound(null); editing.current = false;
    }
    window.addEventListener("pageshow", clearRestoredForm);
    return () => window.removeEventListener("pageshow", clearRestoredForm);
  }, [desktopDevice, emailEnabled]);
  useEffect(() => {
    if (!done || alreadySubmitted || emailVerified || !canResendEmail) return;
    let cancelled = false;
    let checking = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkStatus = async () => {
      if (cancelled || checking) return;
      checking = true;
      if (timer) clearTimeout(timer);
      try {
        const response = await fetch("/api/actualizacion-datos/estado-email", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store"
        });
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.verified) {
          setEmailVerified(true); setPendingSubmission(false); setCanResendEmail(false); setResendError(""); setResendMessage("");
          return;
        }
        if (response.ok && data.expired) setResendMessage("El enlace venció. Puedes reenviar el correo para recibir uno nuevo.");
      } catch { /* Keep the resend option available and check again. */ }
      finally { checking = false; }
      if (!cancelled) timer = setTimeout(checkStatus, 2500);
    };
    const checkWhenVisible = () => { if (!document.hidden) void checkStatus(); };
    const checkWhenFocused = () => void checkStatus();
    void checkStatus();
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", checkWhenFocused);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", checkWhenFocused);
    };
  }, [alreadySubmitted, canResendEmail, done, emailVerified]);
  useEffect(() => {
    if (done) window.scrollTo({ top: 0, behavior: "auto" });
  }, [done, emailVerified]);
  useEffect(() => {
    setReady(true);
    const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const touchFirst = window.matchMedia("(pointer: coarse)").matches;
    const compactScreen = window.innerWidth < 768;
    const desktop = !mobileUserAgent && !touchFirst && !compactScreen;
    setDesktopDevice(desktop);
    setMobileExperience(!desktop);
    setDesktopAdvice(desktop ? "SHOW" : "HIDDEN");
  }, []);
  function continueOnDesktop() {
    setDesktopAdvice("HIDDEN");
  }
  function selectCompany(nextCompanyId: string) {
    setCompanyId(nextCompanyId); setLookupValue(""); setDocumentId(""); setMember(null);
    setVerificationToken(""); setDocumentVerified(false); setIdentityKind(""); setValues({}); setWhatsappMode("");
    setDone(""); setAlreadySubmitted(false); setPendingSubmission(false); setEditingExisting(false); setError(""); setNotFound(null);
    setStageKey("lookup");
  }
  function goTo(key: string) { setError(""); setNotFound(null); setStageKey(key); }
  function goBack() {
    const target = stages[step - 1];
    if (!target) return;
    setValues({}); setWhatsappMode(""); setError(""); setNotFound(null); editing.current = false;
    if (target.key === "company") {
      setCompanyId(""); setLookupValue(""); setDocumentId(""); setMember(null);
      setVerificationToken(""); setDocumentVerified(false); setIdentityKind("");
    } else if (target.key === "lookup") {
      setLookupValue(""); setDocumentId(""); setMember(null);
      setVerificationToken(""); setDocumentVerified(false); setIdentityKind("");
    } else if (target.key === "document") {
      setDocumentId(""); setMember(null); setVerificationToken(""); setDocumentVerified(false); setIdentityKind("");
    } else if (target.key === "identityPhoto") {
      setDocumentVerified(false); setIdentityKind("");
    }
    setStageKey(target.key);
  }
  function changeValue(key: string, value: string) { setValues(previous => ({ ...previous, [key]: value })); setError(""); }
  function stageError(stage: Stage) {
    if (stage.key === "company" && !selected) return "Selecciona tu empresa.";
    if (stage.key === "lookup" && !(selected?.lookupField === "DOCUMENT_ID" ? /^\d{11}$/ : /^\d{1,5}$/).test(lookupValue)) return selected?.lookupField === "DOCUMENT_ID" ? "Ingresa los 11 números de tu cédula." : "Ingresa tu número de empleado (hasta 5 números).";
    if (stage.key === "document" && !/^\d{11}$/.test(documentId)) return "Ingresa los 11 números de tu cédula.";
    if (stage.key === "identityPhoto" && !identityKind) return "Selecciona si validarás con tu cédula dominicana o con tu carnet de empleado.";
    if (stage.key === "identityPhoto" && !documentVerified) return desktopDevice ? "Escanea el código QR y valida el documento desde tu teléfono para continuar." : "Toma una fotografía y valida el documento para continuar.";
    if (stage.key === "whatsapp" && !whatsappMode) return "Selecciona una opción de WhatsApp.";
    if (stage.key === "emergencyContactName") {
      if (!/^[A-Z ]{2,}$/.test((values.emergencyContactFirstName || "").trim())) return "Ingresa el nombre del contacto de emergencia (al menos dos letras).";
      if (!/^[A-Z ]{2,}$/.test((values.emergencyContactLastName || "").trim())) return "Ingresa el apellido del contacto de emergencia (al menos dos letras).";
      const phoneQuestion = questions.find(question => question.fieldKey === "emergencyContactPhone");
      const phoneError = phoneQuestion ? questionError(phoneQuestion, effective.emergencyContactPhone || "") : "";
      if (phoneError) return phoneError;
      const relationQuestion = questions.find(question => question.fieldKey === "emergencyContactRelation");
      const relationError = relationQuestion ? questionError(relationQuestion, effective.emergencyContactRelation || "") : "";
      if (relationError) return relationError;
    }
    if (stage.key === "emergencyContactName" && effective.emergencyContactRelation === "OTRO") {
      try { normalizeOtherEmergencyRelation(values.emergencyContactRelationOther); }
      catch (failure) { return failure instanceof Error ? failure.message : "Especifica la relación con el contacto de emergencia."; }
    }
    return stage.question ? questionError(stage.question, effective[stage.key] || "") : "";
  }
  function focusField(name?: string) { requestAnimationFrame(() => document.querySelector<HTMLElement>(name ? `[name="${name}"]` : "[data-current-field]")?.focus()); }
  async function loadPendingSubmission(token: string) {
    setLoadingEdit(true); setError("");
    try {
      const response = await fetch("/api/actualizacion-datos/solicitud-pendiente", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationToken: token })
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.verified) { setEmailVerified(true); setPendingSubmission(false); setDone("Esta actualización ya fue validada."); }
        throw new Error(data.error || "No se pudo recuperar la solicitud pendiente.");
      }
      setValues(data.values || {}); setWhatsappMode(data.whatsappMode || "");
      window.setTimeout(() => goTo("personalPhone"), 350);
    } catch (failure) {
      setDocumentVerified(false);
      setError(failure instanceof Error ? failure.message : "No se pudo recuperar la solicitud pendiente.");
    } finally { setLoadingEdit(false); }
  }
  function identityValidated(token?: string) {
    if (!token) return;
    setVerificationToken(token); setDocumentVerified(true); setError("");
    if (editingExisting) {
      void loadPendingSubmission(token);
      return;
    }
    if (desktopDevice) {
      const next = stages[step + 1];
      if (next) window.setTimeout(() => goTo(next.key), 650);
    }
  }
  async function startEditing() {
    if (loadingEdit || emailVerified) return;
    setLoadingEdit(true); setResendError("");
    try {
      const response = await fetch("/api/actualizacion-datos/iniciar-edicion", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.verified) { setEmailVerified(true); setPendingSubmission(false); setCanResendEmail(false); }
        throw new Error(data.error || "No se pudo iniciar la edición.");
      }
      setCompanyId(data.companyId); setLookupValue(data.lookupValue); setMember(data.member);
      setVerificationToken(data.verificationToken); setDocumentVerified(false); setValues({}); setWhatsappMode("");
      const companyKey = data.member.companyName.trim().toUpperCase();
      setIdentityKind(["EDESUR", "EDECOOP"].includes(companyKey) && data.member.employeeNumber ? "" : "DOCUMENT_ID");
      setEditingExisting(true); setDone(""); setStageKey("identityPhoto"); setError(""); setNotFound(null);
    } catch (failure) {
      setResendError(failure instanceof Error ? failure.message : "No se pudo iniciar la edición.");
    } finally { setLoadingEdit(false); }
  }
  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const invalid = current.key === "review" ? stages.find(s => stageError(s)) : stageError(current) ? current : undefined;
    if (invalid) {
      setStageKey(invalid.key); setError(stageError(invalid));
      let invalidField: string | undefined;
      if (invalid.key === "emergencyContactName") {
        if (!/^[A-Z ]{2,}$/.test((values.emergencyContactFirstName || "").trim())) invalidField = "emergencyContactFirstName";
        else if (!/^[A-Z ]{2,}$/.test((values.emergencyContactLastName || "").trim())) invalidField = "emergencyContactLastName";
        else if (!/^\d{10}$/.test(effective.emergencyContactPhone || "")) invalidField = "emergencyContactPhone";
        else invalidField = "emergencyContactRelation";
      }
      focusField(invalidField);
      return;
    }
    if (!["lookup", "document", "review"].includes(current.key)) {
      if (editing.current) {
        const incomplete = stages.find(s => s.question && stageError(s));
        if (incomplete) goTo(incomplete.key);
        else { editing.current = false; goTo("review"); }
      } else goTo(stages[step + 1].key);
      return;
    }
    busy.current = true; setLoading(true); setError(""); setNotFound(null);
    try {
      if (current.key !== "review") {
        const response = await fetch("/api/actualizacion-datos/buscar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentCompanyId: selected!.id, lookupValue, ...(current.key === "document" ? { documentId } : {}) })
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.code === "ALREADY_SUBMITTED" || data.code === "COMPLETED") { setAlreadySubmitted(true); setDone(data.error); return; }
          throw new Error(data.error || "No se pudo consultar el registro.");
        }
        if (data.requiresDocument) { goTo("document"); return; }
        if (!data.found) { setNotFound(data); return; }
        if (member?.id !== data.member.id) { setValues({}); setWhatsappMode(""); }
        setMember(data.member); setVerificationToken(data.verificationToken); setDocumentVerified(false);
        const companyKey = data.member.companyName.trim().toUpperCase();
        setIdentityKind(["EDESUR", "EDECOOP"].includes(companyKey) && data.member.employeeNumber ? "" : "DOCUMENT_ID");
        if (data.pendingValidation) {
          setPendingSubmission(true); setCanResendEmail(Boolean(data.emailConfigured)); setDone(data.message); return;
        }
        setPendingSubmission(false); setEditingExisting(false); goTo("identityPhoto");
      } else if (member) {
        const customResponses = Object.fromEntries(questions.filter(q => !q.isSystem).map(q => [q.fieldKey, effective[q.fieldKey] || ""]));
        const response = await fetch("/api/actualizacion-datos/solicitudes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...effective, whatsappMode, verificationToken, personalEmail: effective.personalEmail?.trim().toLowerCase(), memberDirectoryId: member.id, lookupValue, customResponses })
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.code === "ALREADY_SUBMITTED" || data.code === "COMPLETED") { setAlreadySubmitted(true); setDone(data.error); return; }
          if (response.status === 403) goTo("lookup");
          throw new Error(data.error || "No se pudo enviar la actualización.");
        }
        setCanResendEmail(Boolean(data.emailConfigured)); setPendingSubmission(true); setEditingExisting(false);
        setDone(data.message || texts.successMessage); setValues({}); setVerificationToken("");
        notify("Datos recibidos correctamente.", "success");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo conectar. Tus datos se conservan; inténtalo nuevamente.");
    } finally { busy.current = false; setLoading(false); }
  }
  async function resendEmail() {
    if (resendingEmail) return;
    setResendingEmail(true); setResendMessage(""); setResendError("");
    try {
      const response = await fetch("/api/actualizacion-datos/reenviar-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo reenviar el correo.");
      if (data.verified) {
        setEmailVerified(true); setPendingSubmission(false); setCanResendEmail(false); setResendError(""); setResendMessage("");
        return;
      }
      setResendMessage(data.message);
    } catch (failure) {
      setResendError(failure instanceof Error ? failure.message : "No se pudo reenviar el correo.");
    } finally { setResendingEmail(false); }
  }
  if (done) return <section className="mx-auto w-full max-w-xl rounded-lg border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
    <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-8 h-auto w-28" />
    <CheckCircle2 size={52} className="mx-auto mb-5 text-emerald-700" aria-hidden="true" />
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-black text-slate-950 outline-none">{emailVerified ? "Actualización validada" : alreadySubmitted ? "Actualización ya registrada" : "Actualización recibida"}</h1>
    <p role="status" className="mt-4 leading-relaxed text-slate-600">{emailVerified ? "Tu correo y tu actualización de datos fueron validados correctamente." : done}</p>
    {member ? <p className="mt-6 font-bold text-slate-900">{member.fullName}</p> : null}
    {emailVerified ? <div role="status" className="mt-7 border-l-4 border-emerald-600 bg-emerald-50 p-4 text-left"><div className="flex items-start gap-3"><CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /><div><p className="font-black text-emerald-950">Correo validado</p><p className="mt-1 text-sm text-emerald-900">La confirmación fue recibida. Ya no necesitas reenviar el correo.</p></div></div></div> : null}
    {pendingSubmission && !emailVerified && !alreadySubmitted ? <div className="mt-7 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={startEditing} disabled={loadingEdit || resendingEmail} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{loadingEdit ? <LoaderCircle size={19} className="animate-spin" /> : <Pencil size={19} />}{loadingEdit ? "Preparando..." : "Editar datos"}</button>
      {canResendEmail ? <button type="button" onClick={resendEmail} disabled={resendingEmail || loadingEdit} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-white px-5 py-3 font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">{resendingEmail ? <LoaderCircle size={19} className="animate-spin" /> : <Mail size={19} />}{resendingEmail ? "Reenviando..." : "Reenviar correo"}</button> : null}
    </div> : null}
    {resendMessage ? <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{resendMessage}</p> : null}
    {resendError ? <p role="alert" className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-left text-sm font-medium text-red-800">{resendError}</p> : null}
  </section>;
  if (desktopAdvice === "CHECKING") return <section aria-label="Preparando formulario" className="mx-auto flex min-h-72 w-full max-w-xl items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm"><LoaderCircle size={28} className="animate-spin text-emerald-700" /></section>;
  if (desktopAdvice === "SHOW") return <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]">
    <header className="flex items-center gap-4 border-b border-slate-200 px-6 py-5 sm:px-8"><img src="/edecoop-logo.png" alt="EDECOOP" className="h-auto w-20" /><h1 className="text-xl font-black text-slate-950 sm:text-2xl">Actualización de datos</h1></header>
    <div className="grid items-center gap-7 px-6 py-8 sm:grid-cols-[1fr_210px] sm:px-8">
      <div>
        <div className="mb-5 flex h-14 w-14 items-center justify-center bg-emerald-50 text-emerald-800"><Smartphone size={30} /></div>
        <h2 className="text-2xl font-black text-slate-950">Escanea con el teléfono o continúa desde este dispositivo</h2>
        <p className="mt-4 leading-relaxed text-slate-600">Necesitarás fotografiar tu cédula o carnet de empleado. Desde el teléfono podrás usar la cámara, encuadrar el documento y validarlo con mayor facilidad.</p>
        <DataUpdateSteps />
        <div className="mt-6 flex items-start gap-3 border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950"><Monitor size={20} className="mt-0.5 shrink-0" /><p>Si continúas en esta computadora, más adelante deberás escanear otro código QR para validar el documento desde tu teléfono.</p></div>
      </div>
      <div className="text-center"><div className="border border-slate-200 bg-white p-3"><img src="/api/actualizacion-datos/qr-publico" alt="Código QR para abrir la actualización de datos en el teléfono" className="h-auto w-full" /></div><p className="mt-3 text-sm font-bold text-slate-700">Escanea con la cámara de tu teléfono</p></div>
    </div>
    <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 sm:px-8"><button type="button" onClick={continueOnDesktop} className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 hover:bg-slate-100 sm:w-auto"><Monitor size={19} />Continuar desde este dispositivo</button></div>
  </section>;
  if (mobileExperience && mobileWelcome) return <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-xl items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]">
    <div className="w-full max-w-md">
      <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-7 h-auto w-32" />
      <p className="text-xs font-black uppercase text-emerald-800">Jornada de actualización</p>
      <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950">Mantén tus datos al día</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">Completa el proceso desde tu teléfono en pocos minutos.</p>
      <DataUpdateSteps compact />
      <p className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck size={19} aria-hidden="true" />Conexión segura</p>
      <button type="button" onClick={() => setMobileWelcome(false)} className={`${primaryClass} mt-7 w-full`}>Comenzar <ArrowRight size={19} /></button>
    </div>
  </section>;
  const identityVisible = member && !["company", "lookup", "document"].includes(current.key);
  const reviewQuestions = stages.filter(s => s.question && s.key !== "whatsappPhone");
  const emergencyPhoneQuestion = questions.find(question => question.fieldKey === "emergencyContactPhone");
  const emergencyRelationQuestion = questions.find(question => question.fieldKey === "emergencyContactRelation");
  const waitingForPhone = current.key === "identityPhoto" && desktopDevice && !documentVerified;
  return <section className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]">
    <header className="flex items-center gap-4 border-b border-slate-200 px-5 py-5 sm:px-8">
      <img src="/edecoop-logo.png" alt="EDECOOP" className="h-auto w-16 shrink-0 sm:w-20" />
      <div className="min-w-0"><h1 className="text-xl font-black leading-snug text-slate-950 sm:text-2xl">{texts.title}</h1></div>
    </header>
    {selected && current.key !== "company" ? <div aria-label={`Empresa seleccionada: ${selected.companyName}`} className="border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-600 sm:px-8"><span>Empresa seleccionada: </span><strong className="text-emerald-800">{selected.companyName}</strong></div> : null}
    {identityVisible ? <aside aria-label="Socio validado" className="sticky top-0 z-10 border-b border-emerald-100 bg-emerald-50 px-5 py-3 sm:px-8">
      <p className="break-words text-sm font-bold text-slate-950">{member.fullName}</p>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>Empleado: {member.employeeNumber || "No registrado"}</span><span>Cédula: {member.documentId || "No registrada"}</span></div>
    </aside> : null}
    <div className="bg-slate-50 px-5 py-4 sm:px-8">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-bold text-emerald-800">Paso {step + 1} de {stages.length}</span><span className="tabular-nums text-slate-500">{Math.round((step + 1) / stages.length * 100)}%</span></div>
      <div role="progressbar" aria-label="Progreso de la actualización" aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={step + 1} aria-valuetext={current.title} className="h-2 overflow-hidden rounded-sm bg-slate-200"><div className="h-full bg-emerald-700 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(step + 1) / stages.length * 100}%` }} /></div>
    </div>
    <form onSubmit={advance} method="post" autoComplete="off" noValidate aria-busy={loading} className="border-t border-slate-200 px-5 py-7 sm:px-8 sm:py-8">
      <fieldset disabled={!ready || loading || loadingEdit} className="contents">
      <div key={current.key} className="data-update-step">
      {current.key === "emergencyContactName" ? <p className="mb-2 text-xs font-black uppercase text-emerald-800">Contacto de emergencia</p> : null}
      <h2 ref={heading} tabIndex={-1} className="mb-6 text-xl font-black text-slate-950 outline-none">{current.title}</h2>
      {current.key === "company" ? <div className="grid gap-3">
        {orderedCompanies.map((company, index) => <button key={company.id} type="button" data-current-field={index === 0 ? true : undefined} onClick={() => selectCompany(company.id)} className="group flex min-h-16 w-full items-center gap-4 rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-600 hover:bg-emerald-50 focus-visible:border-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800"><Building2 size={21} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1 font-bold text-slate-900">{company.companyName}</span><ArrowRight size={18} className="shrink-0 text-slate-400 group-hover:text-emerald-700" aria-hidden="true" />
        </button>)}
      </div> : null}
      {current.key === "lookup" || current.key === "document" ? <div>
        <label htmlFor="data-update-lookup" className="sr-only">{current.key === "document" || selected?.lookupField === "DOCUMENT_ID" ? "Cédula" : "Número de empleado"}</label>
        <div className="relative"><Search size={20} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input data-current-field id="data-update-lookup" name="data-update-lookup" inputMode="numeric" autoComplete="off" data-lpignore="true" data-1p-ignore="true" disabled={loading} value={current.key === "document" ? documentId : lookupValue}
            onChange={event => { const value = event.target.value.replace(/\D/g, "").slice(0, current.key === "document" || selected?.lookupField === "DOCUMENT_ID" ? 11 : 5); if (current.key === "document") setDocumentId(value); else setLookupValue(value); setVerificationToken(""); setDocumentVerified(false); setIdentityKind(""); setError(""); setNotFound(null); }}
            className={`${inputClass} pl-12`} aria-describedby={error ? "data-update-error" : undefined} aria-invalid={Boolean(error)} />
        </div>
      </div> : null}
      {current.key === "identityPhoto" && member ? <div>
        {offersIdentityChoice ? <fieldset className="mb-6"><legend className="sr-only">Documento para validar identidad</legend><div className="grid gap-3 sm:grid-cols-2">
          {([ ["DOCUMENT_ID", "Cédula dominicana", IdCard], ["EMPLOYEE_CARD", employeeCardLabel, BadgeCheck] ] as const).map(([value, label, Icon]) => <button key={value} type="button" data-current-field={identityKind ? undefined : true} aria-pressed={identityKind === value} onClick={() => { setIdentityKind(value); setDocumentVerified(false); setError(""); }} className={`flex min-h-20 items-center gap-3 border-2 px-4 py-3 text-left font-bold transition-colors ${identityKind === value ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white text-slate-800 hover:border-emerald-500"}`}><Icon size={26} className="shrink-0" /><span>{label}</span></button>)}
        </div></fieldset> : null}
        {identityKind ? desktopDevice ? <DataUpdateIdentityHandoff key={`${member.id}-${identityKind}`} kind={identityKind} verificationToken={verificationToken} onVerified={identityValidated} /> : <IdentityDocumentCapture
          key={`${member.id}-${identityKind}`}
          kind={identityKind}
          verificationToken={verificationToken}
          verified={documentVerified}
          onVerified={identityValidated}
        /> : null}
      </div> : null}
      {current.key === "whatsapp" ? <fieldset><legend className="sr-only">Disponibilidad de WhatsApp</legend>
        <div className="divide-y divide-slate-200 border-y border-slate-200">{([["SAME", "Sí, uso este mismo número"], ["OTHER", "Uso WhatsApp con otro número"], ["NONE", "No tengo WhatsApp"]] as const).map(([value, label]) => <label key={value} className="flex min-h-14 cursor-pointer items-center gap-3 py-3 text-base text-slate-800"><input data-current-field type="radio" name="whatsappMode" value={value} checked={whatsappMode === value} onChange={() => { setWhatsappMode(value); setError(""); }} className="h-5 w-5 shrink-0 accent-emerald-700" />{label}</label>)}</div>
      </fieldset> : null}
      {current.key === "emergencyContactName" && current.question ? <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <QuestionField question={{ ...current.question, fieldKey: "emergencyContactFirstName", label: "Nombre", type: "TEXT" }} value={values.emergencyContactFirstName || ""} onChange={value => changeValue("emergencyContactFirstName", value)} invalid={Boolean(error) && !/^[A-Z ]{2,}$/.test((values.emergencyContactFirstName || "").trim())} showLabel />
          <QuestionField question={{ ...current.question, fieldKey: "emergencyContactLastName", label: "Apellido", type: "TEXT" }} value={values.emergencyContactLastName || ""} onChange={value => changeValue("emergencyContactLastName", value)} invalid={Boolean(error) && !/^[A-Z ]{2,}$/.test((values.emergencyContactLastName || "").trim())} showLabel />
        </div>
        {emergencyPhoneQuestion ? <QuestionField question={emergencyPhoneQuestion} value={effective.emergencyContactPhone || ""} onChange={value => changeValue("emergencyContactPhone", value)} invalid={Boolean(error) && !/^\d{10}$/.test(effective.emergencyContactPhone || "")} showLabel /> : null}
        {emergencyRelationQuestion ? <EmergencyRelationField question={emergencyRelationQuestion} value={effective.emergencyContactRelation || ""} other={values.emergencyContactRelationOther || ""} onChange={value => { changeValue("emergencyContactRelation", value); if (value !== "OTRO") changeValue("emergencyContactRelationOther", ""); }} onOtherChange={value => changeValue("emergencyContactRelationOther", value)} invalid={Boolean(error)} /> : null}
      </div> : current.question ? <QuestionField key={current.key} question={current.question} value={effective[current.key] || ""} onChange={value => changeValue(current.key, value)} invalid={Boolean(error)} /> : null}
      {current.key === "review" ? <dl className="divide-y divide-slate-200 border-y border-slate-200">
        {reviewQuestions.map(stage => stage.key === "emergencyContactName" ? <Fragment key={stage.key}>
          <ReviewRow label="Contacto de emergencia" value={effective.emergencyContactName || "No indicado"} onEdit={() => { editing.current = true; goTo(stage.key); }} disabled={loading} />
          <ReviewRow label="Teléfono de emergencia" value={formatDataUpdatePhone(effective.emergencyContactPhone || "")} onEdit={() => { editing.current = true; goTo(stage.key); }} disabled={loading} />
          <ReviewRow label="Relación" value={emergencyContactRelationLabel(effective.emergencyContactRelation || "", values.emergencyContactRelationOther || "")} onEdit={() => { editing.current = true; goTo(stage.key); }} disabled={loading} />
        </Fragment> : <ReviewRow key={stage.key} label={stage.title} value={stage.question?.type === "PHONE" ? formatDataUpdatePhone(effective[stage.key] || "") : effective[stage.key] || "No indicado"} onEdit={() => { editing.current = true; goTo(stage.key); }} disabled={loading} />)}
        <ReviewRow label="WhatsApp" value={whatsappMode === "NONE" ? "No tiene WhatsApp" : formatDataUpdatePhone(effective.whatsappPhone)} onEdit={() => { editing.current = true; goTo("whatsapp"); }} disabled={loading} />
      </dl> : null}
      {notFound ? <div role="status" className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-4"><p className="font-bold text-amber-950">{notFound.message}</p><p className="mt-2 text-sm text-amber-900">Si necesitas asistencia, comunícate con Servicio al cliente EDECOOP.</p><a href={notFound.whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#128c7e] px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-[#0f766e] focus:outline-none focus:ring-4 focus:ring-emerald-200 sm:w-auto"><MessageCircle size={20} fill="currentColor" aria-hidden="true" />Contactar Servicio al cliente EDECOOP por WhatsApp</a></div> : null}
      {error ? <p id="data-update-error" role="alert" className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
      </div>
      {current.key !== "company" ? <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
        {step > 0 ? <button type="button" disabled={loading} onClick={goBack} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"><ArrowLeft size={18} />Atrás</button> : <span />}
        {!waitingForPhone ? <button type="submit" disabled={loading || (current.key === "company" && !companies.length)} className={primaryClass}>
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : current.key === "review" ? <Send size={18} /> : current.key === "lookup" || current.key === "document" ? <Search size={18} /> : null}
          {loading ? (current.key === "review" ? "Enviando..." : "Validando...") : current.key === "review" ? "Enviar actualización" : editing.current ? "Volver al resumen" : current.key === "emergencyContactName" ? "Revisar información" : "Continuar"}
          {!loading && !["review", "lookup", "document"].includes(current.key) ? <ArrowRight size={18} /> : null}
        </button> : <p role="status" className="flex min-h-12 items-center justify-center gap-2 text-sm font-bold text-slate-600"><LoaderCircle size={18} className="animate-spin text-emerald-700" />Esperando validación desde el teléfono</p>}
      </div> : null}
      </fieldset>
    </form>
  </section>;
}

function DataUpdateSteps({ compact = false }: { compact?: boolean }) {
  const items = [
    ["Identificación", "Introduce tu número de empleado y cédula."],
    ["Datos personales", "Registra tus medios de contacto personales."],
    ["Contacto de emergencia", "Completa la información de tu contacto."],
    ["Documentos", "Escanea tu documento y revisa la información."],
    ["Validación", "Abre el enlace enviado a tu correo. Si no aparece, revisa Spam."]
  ];
  return <div className={`${compact ? "mt-6" : "mt-7"} text-left`}>
    <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><ListChecks size={19} className="text-emerald-700" />Pasos para completar la actualización</p>
    <ul className="grid gap-2.5">{items.map(([title, description]) => <li key={title} className="flex items-start gap-3 text-sm leading-snug text-slate-600">
      <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-2 border-emerald-600 bg-white" />
      <span><strong className="text-slate-800">{title}:</strong> {description}</span>
    </li>)}</ul>
  </div>;
}

function ReviewRow({ label, value, onEdit, disabled }: { label: string; value: string; onEdit: () => void; disabled: boolean }) {
  return <div className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900 [overflow-wrap:anywhere]">{value}</dd></div><button type="button" onClick={onEdit} disabled={disabled} aria-label={`Editar ${label.toLowerCase()}`} title={`Editar ${label.toLowerCase()}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"><Pencil size={18} /></button></div>;
}

function QuestionField({ question, value, onChange, invalid, showLabel = false }: { question: DataUpdateQuestion; value: string; onChange: (value: string) => void; invalid: boolean; showLabel?: boolean }) {
  const id = `field-${question.fieldKey}`;
  const shared = { id, name: question.fieldKey, className: inputClass, autoComplete: "off", "data-lpignore": "true", "data-1p-ignore": "true", "data-current-field": true, "aria-invalid": invalid, "aria-describedby": invalid ? "data-update-error" : undefined };
  return <div><label htmlFor={id} className={showLabel ? "mb-2 block text-sm font-bold text-slate-700" : "sr-only"}>{question.label}</label>
    {question.type === "SELECT" ? <select {...shared} value={value} onChange={event => onChange(event.target.value)}><option value="">Seleccione</option>{question.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> :
      <input {...shared} value={question.type === "PHONE" ? formatDataUpdatePhone(value) : value} type={question.type === "EMAIL" ? "email" : question.type === "PHONE" ? "tel" : "text"} inputMode={question.type === "PHONE" || question.type === "NUMBER" ? "numeric" : question.type === "EMAIL" ? "email" : "text"} maxLength={question.type === "PHONE" ? 16 : undefined} placeholder={question.type === "PHONE" ? "(809) 354 - 2752" : undefined}
        onChange={event => { let value = event.target.value; if (question.type === "PHONE") value = dataUpdatePhoneDigits(value); else if (question.type === "NUMBER") value = value.replace(/\D/g, ""); else if (question.type === "TEXT") value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, ""); onChange(value); }} />}
  </div>;
}

function EmergencyRelationField({ question, value, other, onChange, onOtherChange, invalid }: { question: DataUpdateQuestion; value: string; other: string; onChange: (value: string) => void; onOtherChange: (value: string) => void; invalid: boolean }) {
  return <div className="grid gap-4">
    <label htmlFor="field-emergencyContactRelation" className="mb-2 block text-sm font-bold text-slate-700">{question.label}</label>
    <select data-current-field id="field-emergencyContactRelation" name="emergencyContactRelation" value={value} onChange={event => onChange(event.target.value)} className={inputClass} aria-invalid={invalid} aria-describedby={invalid ? "data-update-error" : undefined}>
      <option value="">Seleccione</option>
      {question.options?.map(option => <option key={option} value={option}>{emergencyContactRelationLabel(option)}</option>)}
    </select>
    {value === "OTRO" ? <div>
      <label htmlFor="field-emergencyContactRelationOther" className="mb-2 block text-sm font-bold text-slate-700">Especifica la relación</label>
      <input id="field-emergencyContactRelationOther" name="emergencyContactRelationOther" value={other} onChange={event => onOtherChange(event.target.value.toUpperCase().slice(0, 50))} autoComplete="off" maxLength={50} className={inputClass} aria-invalid={invalid} aria-describedby={invalid ? "data-update-error" : undefined} />
    </div> : null}
  </div>;
}
