import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Upload, 
  FileText, 
  Calendar, 
  Video, 
  MessageSquare, 
  ChevronRight, 
  ShieldCheck, 
  X, 
  Check, 
  ExternalLink,
  Download,
  AlertCircle,
  Eye,
  RefreshCw,
  Send,
  User,
  Building,
  GraduationCap,
  Sparkles,
  PhoneCall,
  Lock
} from 'lucide-react';
import { INITIAL_STUDENT_PROFILE, INITIAL_DOCUMENTS, INITIAL_TASKS, APP_IMAGES } from '../data/constants';
import { AppView, StudentDocument, TaskItem } from '../types';

interface StudentPortalViewProps {
  onNavigate: (view: AppView) => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({ onNavigate }) => {
  const [student, setStudent] = useState(INITIAL_STUDENT_PROFILE);
  const [documents, setDocuments] = useState<StudentDocument[]>(INITIAL_DOCUMENTS);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'tasks' | 'visa' | 'messages'>('overview');

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<StudentDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocToUpload, setSelectedDocToUpload] = useState<StudentDocument | null>(null);
  const [uploadSuccessAlert, setUploadSuccessAlert] = useState(false);
  const [uverenieToast, setUverenieToast] = useState(false);

  // Chat drawer state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: 'advisor' | 'student'; text: string; time: string }[]>([
    {
      sender: 'advisor',
      text: 'Здравей Tariq! I am Elena Dimitrova from the Sofia legal desk. I reviewed your academic marksheet and your Biology (94%) and Chemistry (91%) are exceptional.',
      time: 'Yesterday 10:15'
    },
    {
      sender: 'advisor',
      text: 'One critical note: On your Tawjihi certificate, we received the front side scan, but MOES in Sofia strictly requires the reverse leaf containing the Jordan MOFA Apostille sticker. Could you upload the back page when ready?',
      time: 'Yesterday 10:18'
    },
    {
      sender: 'student',
      text: 'Hello Elena! Thank you for the quick check. Yes, I have the MOFA apostilled Tawjihi right here with me. I will scan and upload the back page now.',
      time: 'Today 09:20'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    const newMsg = { sender: 'student' as const, text: inputMessage, time: 'Just now' };
    setChatMessages(prev => [...prev, newMsg]);
    setInputMessage('');

    // Simulate Elena auto-reply
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'advisor',
          text: 'Thank you Tariq! I will review the file immediately and dispatch it to our accredited Sofia sworn translator.',
          time: 'Just now'
        }
      ]);
    }, 1200);
  };

  const handleToggleTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleUploadReplacement = () => {
    if (!selectedDocToUpload) return;
    // Mark the document as in_review with apostilleConfirmed
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === selectedDocToUpload.id
          ? {
              ...doc,
              status: 'in_review',
              statusMessage: 'Back-Page Apostille Uploaded - Sofia Review Pending',
              actionRequiredText: undefined,
              apostilleConfirmed: true,
              uploadDate: 'Just now'
            }
          : doc
      )
    );

    // Also mark the immediate task as completed
    setTasks(prev =>
      prev.map(t => (t.id === 't-1' ? { ...t, completed: true } : t))
    );

    setIsUploadModalOpen(false);
    setSelectedDocToUpload(null);
    setUploadSuccessAlert(true);
    setTimeout(() => setUploadSuccessAlert(false), 4000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Banner with Student Info */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={student.avatar}
                alt={student.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-[#006644] shadow-xs"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold font-heading text-slate-900">{student.name}</h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active Applicant
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>ID: <strong className="text-slate-700">{student.applicationId}</strong></span>
                  <span>•</span>
                  <span>Target: <strong className="text-slate-700">MU Sofia (Medicine MD)</strong></span>
                  <span>•</span>
                  <span>Intake: <strong className="text-slate-700">2025/2026</strong></span>
                  <span>•</span>
                  <span>Passport: <strong className="text-slate-700">{student.isPassportMasked ? 'P89*****0B' : student.passportNumber}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsChatOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                id="portal-chat-advisor-btn"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#006644]" />
                <span>Advisor Elena Chat</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </button>

              <button
                onClick={() => onNavigate('staff')}
                className="px-3.5 py-2 bg-[#0f1e36] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                id="portal-switch-staff-btn"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Staff Review View</span>
              </button>
            </div>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex items-center space-x-2 mt-4 border-t border-slate-100 pt-3 text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'overview'
                  ? 'bg-[#006644] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Dashboard Overview
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'documents'
                  ? 'bg-[#006644] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Document Dossier ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-[#006644] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Action Items ({tasks.filter(t => !t.completed).length} Pending)
            </button>
            <button
              onClick={() => setActiveTab('visa')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'visa'
                  ? 'bg-[#006644] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Visa & Residence (84 Days)
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload Success Alert Toast */}
        {uploadSuccessAlert && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reverse page with Jordan MOFA Apostille uploaded successfully! Sent to Sofia legal queue.</span>
            </div>
            <button onClick={() => setUploadSuccessAlert(false)} className="text-emerald-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Uverenie Request Feedback Toast */}
        {uverenieToast && (
          <div className="bg-[#006644] text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Enrollment Uverenie certificate request submitted to Dean Office protocol desk! Priority processing registered.</span>
            </div>
            <button onClick={() => setUverenieToast(false)} className="text-emerald-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* URGENT ACTION BANNER: Tawjihi Back Page Apostille */}
        {documents.some(d => d.status === 'action_needed') && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-extrabold text-sm text-amber-950">
                      Action Required: Jordanian Tawjihi Diploma — Reverse Apostille Stamp Missing
                    </span>
                    <span className="bg-amber-200/80 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      Urgent Prerequisite
                    </span>
                  </div>
                  <p className="text-amber-900 leading-relaxed max-w-3xl">
                    The front side of your Jordanian Tawjihi was approved. However, the Bulgarian Ministry of Education & Science (MOES) mandates the reverse page bearing the <strong>Jordan Ministry of Foreign Affairs (MOFA) Hague Apostille Certificate</strong> before filing sworn Bulgarian translation.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    const doc = documents.find(d => d.id === 'doc-1');
                    if (doc) setSelectedDocToUpload(doc);
                    setIsUploadModalOpen(true);
                  }}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                  id="portal-upload-tawjihi-btn"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Reverse Scan</span>
                </button>
                <button
                  onClick={() => {
                    const doc = documents.find(d => d.id === 'doc-1');
                    if (doc) setPreviewDoc(doc);
                  }}
                  className="px-3 py-2 bg-white hover:bg-amber-100/50 text-amber-900 font-semibold rounded-xl text-xs border border-amber-300 transition-colors"
                >
                  Inspect Front Scan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6-Stage Progress Stepper Bar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Application Pipeline
              </span>
              <h2 className="text-base font-bold font-heading text-slate-900 mt-0.5">
                Stage 2 of 6: Document Sworn Legalization & MOES Accreditation
              </h2>
            </div>
            <span className="text-xs font-bold text-[#006644] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Active Stage
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { num: 1, title: 'Eligibility & GPA', status: 'completed', duration: 'Completed Jan 18' },
              { num: 2, title: 'Apostille & MOES', status: 'current', duration: 'In Progress (Active)' },
              { num: 3, title: 'Entrance Exam', status: 'upcoming', duration: 'Scheduled Aug 20' },
              { num: 4, title: 'Type-D Visa', status: 'upcoming', duration: 'Consular Dossier' },
              { num: 5, title: 'Sofia Arrival', status: 'upcoming', duration: 'Dean Enrollment' },
              { num: 6, title: 'VRN Permit', status: 'upcoming', duration: '84 Days Countdown' },
            ].map((st) => (
              <div
                key={st.num}
                className={`p-3 rounded-xl border transition-all ${
                  st.status === 'completed'
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : st.status === 'current'
                    ? 'bg-[#0f1e36] text-white border-slate-800 ring-2 ring-emerald-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className={`font-bold ${st.status === 'current' ? 'text-emerald-400' : 'text-slate-700'}`}>
                    Stage {st.num}
                  </span>
                  {st.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : st.status === 'current' ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  ) : null}
                </div>
                <div className={`font-bold text-xs truncate ${st.status === 'current' ? 'text-white' : 'text-slate-800'}`}>
                  {st.title}
                </div>
                <div className={`text-[10px] truncate mt-0.5 ${st.status === 'current' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {st.duration}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Dashboard Grid: Left Dossier / Tasks, Right Advisor & Residence countdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Document Dossier & Action Tasks */}
          <div className="lg:col-span-8 space-y-6">
            {/* Document Dossier Hub */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">
                    Official Document Dossier
                  </h3>
                  <p className="text-xs text-slate-500">
                    Legal certificates required for Sofia Ministry accreditation and Dean’s Office registration.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDocToUpload(documents[0]);
                    setIsUploadModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-[#006644] hover:bg-[#005538] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              </div>

              <div className="space-y-3">
                {documents.map((doc) => {
                  const isActionNeeded = doc.status === 'action_needed';
                  const isVerified = doc.status === 'verified';
                  const isInReview = doc.status === 'in_review';
                  const isPending = doc.status === 'pending_upload';

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActionNeeded
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            isVerified
                              ? 'bg-emerald-100 text-emerald-800'
                              : isActionNeeded
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{doc.title}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isVerified
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isActionNeeded
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : isInReview
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {doc.statusMessage || doc.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                            <span>{doc.fileName}</span>
                            <span>•</span>
                            <span>{doc.fileSize}</span>
                            <span>•</span>
                            <span>Date: {doc.uploadDate}</span>
                          </div>
                          {doc.actionRequiredText && (
                            <div className="text-[11px] text-amber-800 font-medium">
                              ⚠️ {doc.actionRequiredText}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        {isActionNeeded && (
                          <button
                            onClick={() => {
                              setSelectedDocToUpload(doc);
                              setIsUploadModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Replace / Fix</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Action Items / Task Split */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">
                    Live Action Task List
                  </h3>
                  <p className="text-xs text-slate-500">
                    Key milestones to maintain your October 2025 semester start.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {tasks.filter(t => t.completed).length} of {tasks.length} Completed
                </span>
              </div>

              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      task.completed
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : task.isUrgent
                        ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => {}} // handled by row click
                        className="mt-1 w-4 h-4 text-[#006644] rounded border-slate-300 focus:ring-[#006644]"
                      />
                      <div className="text-xs">
                        <div className={`font-bold ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.title}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{task.subtitle}</div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        task.isUrgent
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.deadline}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Residence Permit 84-Day Countdown & Dedicated Legal Advisor */}
          <div className="lg:col-span-4 space-y-6">
            {/* Bulgarian Annual Residence Permit (VRN) 84-Day Countdown Widget */}
            <div className="bg-gradient-to-br from-[#0f1e36] to-[#00281b] text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  MVR Migration Compliance
                </span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>

              <div>
                <div className="text-xs text-slate-300">Continuous Residence Permit (VRN)</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-extrabold font-heading text-emerald-400">84</span>
                  <span className="text-xs font-semibold text-slate-300">Days to Stage 6 Deposit</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Bulgarian law requires Non-EU students to present enrollment certificate (Uverenie) and housing lease at the Sofia Migration Directorate at least 14 days before start date.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-300">
                  <span>Permit Readiness</span>
                  <span className="text-emerald-300 font-bold">65% Prepared</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[65%] rounded-full"></div>
                </div>
              </div>

              <button
                onClick={() => {
                  setUverenieToast(true);
                  setTimeout(() => setUverenieToast(false), 5000);
                }}
                className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Request Enrollment Uverenie</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dedicated Sofia Legal Advisor Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Assigned Sofia Legal Officer
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={student.advisorAvatar}
                  alt={student.advisorName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#006644] shadow-xs"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="font-heading font-bold text-sm text-slate-900">{student.advisorName}</div>
                  <div className="text-xs text-slate-500">{student.advisorRole}</div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Online at Sofia Desk</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#006644]" />
                    <span>Next Video Strategy Session:</span>
                  </span>
                </div>
                <div className="text-slate-900 font-bold text-sm">{student.nextConsultationDate}</div>
                <a
                  href={student.nextConsultationZoomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 px-3 bg-[#006644] hover:bg-[#005538] text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors text-xs"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Join Zoom Meeting</span>
                </a>
              </div>

              <button
                onClick={() => setIsChatOpen(true)}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#006644]" />
                <span>Open Instant Message Thread</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">{previewDoc.title}</span>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Document metadata strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">File Name:</span>
                  <div className="font-bold text-slate-800 truncate">{previewDoc.fileName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Size:</span>
                  <div className="font-bold text-slate-800">{previewDoc.fileSize}</div>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>
                  <div className="font-bold text-[#006644]">{previewDoc.statusMessage || previewDoc.status}</div>
                </div>
                <div>
                  <span className="text-slate-500">Hague Apostille:</span>
                  <div className="font-bold text-slate-800">
                    {previewDoc.apostilleConfirmed ? 'Confirmed' : 'Pending Reverse Scan'}
                  </div>
                </div>
              </div>

              {/* Simulated Visual PDF / Image Scan */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-100/60 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
                <FileText className="w-12 h-12 text-slate-400" />
                <div>
                  <div className="font-bold text-sm text-slate-800">{previewDoc.title}</div>
                  <div className="text-xs text-slate-500">Official Authenticated Document on file</div>
                </div>
                {previewDoc.id === 'doc-1' && (
                  <div className="bg-amber-100 text-amber-900 p-2.5 rounded-lg text-xs max-w-md">
                    Note: Front page scanned in 400 DPI. Reverse page with MOFA Hague Apostille seal is required for Bulgarian MOES submission.
                  </div>
                )}
              </div>

              {previewDoc.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>Officer Review Notes:</strong> {previewDoc.notes}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close Preview
              </button>
              {previewDoc.status === 'action_needed' && (
                <button
                  onClick={() => {
                    setSelectedDocToUpload(previewDoc);
                    setPreviewDoc(null);
                    setIsUploadModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#006644] hover:bg-[#005538] transition-colors"
                >
                  Upload Required Reverse Page
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD / REPLACEMENT MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-[#0f1e36] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Upload Document / Replacement</span>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Target Document
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-800">
                  {selectedDocToUpload?.title || 'Jordanian General Secondary Certificate (Tawjihi)'}
                </div>
              </div>

              {/* Drag and Drop Box */}
              <div
                onClick={handleUploadReplacement}
                className="border-2 border-dashed border-emerald-500/60 bg-emerald-50/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-50 transition-colors space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-[#006644]">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Click to select Tawjihi Reverse Page (Apostilled)
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Supports PDF, JPG, PNG up to 25 MB (Color scan, 300+ DPI)
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#006644] bg-white px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
                  Simulate Instant Upload
                </span>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl">
                🔒 Uploaded files are encrypted under EU GDPR and transmitted directly to the accredited Sofia sworn translator.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadReplacement}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#006644] hover:bg-[#005538] transition-colors"
              >
                Submit & Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADVISOR CHAT DRAWER */}
      {isChatOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-4 bg-[#0f1e36] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={student.advisorAvatar}
                alt="Elena"
                className="w-9 h-9 rounded-full object-cover border border-emerald-400"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="font-bold text-xs">Elena Dimitrova</div>
                <div className="text-[10px] text-emerald-300">Senior Legal Officer (Sofia Desk)</div>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                    msg.sender === 'student'
                      ? 'bg-[#006644] text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-2xs'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type message to Elena..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-[#006644] outline-none"
            />
            <button
              onClick={handleSendMessage}
              className="p-2 bg-[#006644] hover:bg-[#005538] text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
