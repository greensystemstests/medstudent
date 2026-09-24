import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Eye, 
  EyeOff, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Filter, 
  ExternalLink, 
  UserCheck, 
  ShieldAlert, 
  Lock, 
  ChevronRight, 
  Check, 
  RotateCcw,
  Sparkles,
  Fingerprint,
  Building,
  GraduationCap,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { INITIAL_STUDENT_PROFILE, INITIAL_DOCUMENTS, INITIAL_AUDIT_LOGS, APP_IMAGES } from '../data/constants';
import { AppView, AuditLogEntry, StudentDocument } from '../types';

interface StaffOpsViewProps {
  onNavigate: (view: AppView) => void;
}

export const StaffOpsView: React.FC<StaffOpsViewProps> = ({ onNavigate }) => {
  const [student, setStudent] = useState(INITIAL_STUDENT_PROFILE);
  const [documents, setDocuments] = useState<StudentDocument[]>(INITIAL_DOCUMENTS);
  const [selectedDocId, setSelectedDocId] = useState<string>('doc-1');
  const [isPassportMasked, setIsPassportMasked] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [officerNote, setOfficerNote] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const selectedDoc = documents.find(d => d.id === selectedDocId) || documents[0];

  const handleTemplateClick = (templateText: string) => {
    setOfficerNote(templateText);
  };

  const handleFlagActionNeeded = () => {
    setDocuments(prev =>
      prev.map(d =>
        d.id === selectedDocId
          ? {
              ...d,
              status: 'action_needed',
              statusMessage: 'Apostille Certificate Missing',
              actionRequiredText: officerNote || 'Jordan MOFA Hague Apostille stamp required on reverse leaf before Sofia MOES filing.',
              notes: officerNote || 'Flagged by Elena Dimitrova: Tawjihi reverse leaf missing.'
            }
          : d
      )
    );

    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      officer: 'Elena Dimitrova',
      role: 'Senior Legal Officer',
      action: 'FLAGGED_ACTION_NEEDED',
      details: `Flagged Document ${selectedDoc.title}: ${officerNote || 'Missing Hague Apostille'}`,
      hash: '0x' + Math.random().toString(16).substring(2, 12),
      ipAddress: '194.141.21.84 (Sofia Desk)'
    };
    setAuditLogs(prev => [newLog, ...prev]);

    setFeedbackToast('Flagged Action Needed alert dispatched to Tariq Al-Mansoor portal.');
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleApproveDocument = () => {
    setDocuments(prev =>
      prev.map(d =>
        d.id === selectedDocId
          ? {
              ...d,
              status: 'verified',
              statusMessage: 'Verified & Approved by Elena Dimitrova',
              actionRequiredText: undefined,
              apostilleConfirmed: true,
              swornTranslationDone: true,
              moesLegalized: true,
              verifiedDate: new Date().toISOString().split('T')[0]
            }
          : d
      )
    );

    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      officer: 'Elena Dimitrova',
      role: 'Senior Legal Officer',
      action: 'APPROVED_FOR_MOES',
      details: `Approved Document ${selectedDoc.title} for Bulgarian MOES accreditation.`,
      hash: '0x' + Math.random().toString(16).substring(2, 12),
      ipAddress: '194.141.21.84 (Sofia Desk)'
    };
    setAuditLogs(prev => [newLog, ...prev]);

    setFeedbackToast('Document verified and dispatched to Sofia sworn translation queue.');
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Staff Header with Role & RBAC status */}
      <div className="bg-[#0f1e36] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={APP_IMAGES.elenaAdvisor}
                alt="Elena Dimitrova"
                className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold font-heading">Staff Operations & Legal Review</h1>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full">
                    RBAC Tier-2 (Full Legal Dossier Access)
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  Officer: <strong>Elena Dimitrova</strong> • Sofia Central Desk • Active Queue: 14 Candidates
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('student')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                id="staff-view-as-student-btn"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Student Portal (Tariq)</span>
              </button>

              <button
                onClick={() => onNavigate('home')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Public Site
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast Alert */}
        {feedbackToast && (
          <div className="bg-[#006644] text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Active Candidate Dossier Banner */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={student.avatar}
              alt={student.name}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-lg text-slate-900">{student.name}</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Application ID: {student.applicationId}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span>Target: <strong className="text-slate-700">{student.targetUniversity}</strong></span>
                <span>•</span>
                <span>Program: <strong className="text-slate-700">{student.targetDegree} (MD)</strong></span>
                <span>•</span>
                <span>Citizenship: <strong className="text-slate-700">{student.nationality} ({student.originCountry})</strong></span>
              </div>
            </div>
          </div>

          {/* Privacy & Compliance Toggle */}
          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-0.5">
              <div className="text-[0.6875rem] text-slate-500 font-medium">Passport Masking (GDPR):</div>
              <div className="font-mono font-bold text-slate-800">
                {isPassportMasked ? 'P89*****0B' : student.passportNumber}
              </div>
            </div>
            <button
              onClick={() => setIsPassportMasked(!isPassportMasked)}
              className="p-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors"
              title={isPassportMasked ? 'Unmask Passport' : 'Mask Passport'}
            >
              {isPassportMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 2-Column Inspector: Left Document Selector & Right Live Side-by-side Inspection Pad */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (4 cols): Candidate Documents Queue */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-heading font-bold text-sm text-slate-900">
                Dossier Verification Checklist
              </h3>
              <span className="text-[0.6875rem] text-slate-500">5 Documents</span>
            </div>

            <div className="space-y-2">
              {documents.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                const isActionNeeded = doc.status === 'action_needed';
                const isVerified = doc.status === 'verified';
                const isInReview = doc.status === 'in_review';

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-[#006644] bg-emerald-50/70 ring-1 ring-[#006644]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {doc.title}
                      </span>
                      <span
                        className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isVerified
                            ? 'bg-emerald-100 text-emerald-800'
                            : isActionNeeded
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isInReview
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isActionNeeded ? 'Action Needed' : isVerified ? 'Verified' : 'In Review'}
                      </span>
                    </div>
                    <div className="text-[0.6875rem] text-slate-500 truncate">{doc.fileName}</div>
                  </button>
                );
              })}
            </div>

            {/* Stage 2 Officer Progression Protocol */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#006644]" />
                <span>Stage 2 Sign-off Prerequisite</span>
              </div>
              <p className="text-[0.6875rem] text-slate-600 leading-relaxed">
                Tawjihi diploma must possess authenticated Hague Apostille stamp before Sofia sworn translation can be dispatched to the Ministry.
              </p>
            </div>
          </div>

          {/* Right Column (8 cols): Document Inspection Canvas & Verification Pad */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Legal Inspection Pad: {selectedDoc.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Authenticity checks against Bulgarian Higher Education Act & MOES decrees.
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                  selectedDoc.status === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedDoc.status === 'action_needed'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                Status: {selectedDoc.statusMessage || selectedDoc.status}
              </span>
            </div>

            {/* Simulated Document Canvas */}
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[260px]">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#006644] mb-3">
                <FileText className="w-8 h-8" />
              </div>
              <div className="font-heading font-bold text-sm text-slate-900">
                {selectedDoc.fileName}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                High-Resolution Scan (300 DPI) • {selectedDoc.fileSize} • Uploaded {selectedDoc.uploadDate}
              </div>

              {selectedDoc.id === 'doc-1' && (
                <div className="mt-4 max-w-lg bg-amber-50 border border-amber-300 text-amber-950 p-3 rounded-xl text-xs text-left space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Officer Diagnostic Inspection Note</span>
                  </div>
                  <p className="text-[0.6875rem] leading-relaxed">
                    Front page displays official Jordanian General Secondary Examination credentials (Marks: Bio 94, Chem 91). Reverse leaf bearing Jordan Ministry of Foreign Affairs (MOFA) Hague Apostille stamp is currently missing from upload.
                  </p>
                </div>
              )}
            </div>

            {/* Verification Checklist */}
            <div className="space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-slate-700 mb-1">
                Mandatory Legal Validation Checks
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>Candidate identity matches Passport</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>Ministry of Education seal legible</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>Science GPA &gt; 62% statutory minimum</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                  selectedDoc.apostilleConfirmed
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}>
                  {selectedDoc.apostilleConfirmed ? (
                    <Check className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  )}
                  <span>Hague Apostille Stamp (Convention of 1961)</span>
                </div>
              </div>
            </div>

            {/* Quick-Fill Canned Templates */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Quick-Fill Review Templates
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Missing Jordan MOFA Apostille stamp on reverse leaf.',
                  'Scan resolution below 300 DPI — please re-upload in clear color.',
                  'Approved for Bulgarian MOES accreditation deposit.',
                  'Forwarded to Sofia Sworn Translation Agency.'
                ].map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTemplateClick(tpl)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    "{tpl}"
                  </button>
                ))}
              </div>
            </div>

            {/* Officer Note Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-700">
                Officer Finding / Instruction to Candidate
              </label>
              <textarea
                rows={2}
                value={officerNote}
                onChange={(e) => setOfficerNote(e.target.value)}
                placeholder="Enter feedback or select a template above..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:border-[#006644] outline-none"
              />
            </div>

            {/* Review Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={handleFlagActionNeeded}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
                id="staff-flag-action-btn"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Flag Action Needed (Alert Student)</span>
              </button>

              <button
                onClick={handleApproveDocument}
                className="px-5 py-2.5 bg-[#006644] hover:bg-[#005538] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                id="staff-approve-doc-btn"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Dispatch to Sworn Translation</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bulgarian Residence Permit Renewal Queue Table */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">
                Bulgarian Residence Permit (VRN) Annual Renewal Queue
              </h3>
              <p className="text-xs text-slate-500">
                Monitoring 84-day countdowns for all enrolled international medical students across Sofia, Plovdiv & Varna.
              </p>
            </div>
            <span className="text-xs font-bold text-[#006644] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              MVR Sofia Migration Sync Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[0.6875rem]">
                <tr>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Faculty</th>
                  <th className="p-3">Days to Renewal</th>
                  <th className="p-3">MVR Status</th>
                  <th className="p-3">Enrollment Uverenie</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-emerald-50/30">
                  <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                    <img src={APP_IMAGES.tariqStudent} alt="Tariq" className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <span>Tariq Al-Mansoor</span>
                  </td>
                  <td className="p-3 text-slate-600">MU Sofia (Medicine)</td>
                  <td className="p-3 font-bold text-emerald-700">84 Days</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[0.6875rem] font-bold">
                      On Track
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">Pending Stage 5 Enrollment</td>
                  <td className="p-3 text-right">
                    <button className="text-[#006644] font-bold hover:underline">
                      Review Dossier
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-bold text-slate-900">Sara Khoury (Lebanon)</td>
                  <td className="p-3 text-slate-600">MU Plovdiv (Dentistry)</td>
                  <td className="p-3 font-bold text-amber-700">42 Days</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[0.6875rem] font-bold">
                      Prepare Uverenie
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">Uverenie Ready for MVR</td>
                  <td className="p-3 text-right">
                    <button className="text-[#006644] font-bold hover:underline">
                      Issue MVR Booking
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="p-3 font-bold text-slate-900">Omar Hassan (Egypt)</td>
                  <td className="p-3 text-slate-600">MU Varna (Medicine)</td>
                  <td className="p-3 font-bold text-rose-600">18 Days</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[0.6875rem] font-bold">
                      Urgent Biometrics
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">Submitted to Dean Desk</td>
                  <td className="p-3 text-right">
                    <button className="text-rose-700 font-bold hover:underline">
                      Fast-Track MVR
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cryptographic Immutable Audit Trail */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">
                Cryptographic Compliance Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Immutable SHA-256 event log complying with EU GDPR Article 30 and Bulgarian Higher Education Regulations.
              </p>
            </div>
            <Fingerprint className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.6875rem] text-slate-400">{log.timestamp}</span>
                    <span className="font-bold text-slate-800">{log.officer}</span>
                    <span className="text-slate-400">({log.role})</span>
                  </div>
                  <div className="text-slate-700">{log.details}</div>
                </div>

                <div className="flex items-center gap-2 text-[0.6875rem] text-slate-400 font-mono self-start sm:self-auto">
                  <span>Hash: {log.hash}</span>
                  <span>•</span>
                  <span>{log.ipAddress}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
