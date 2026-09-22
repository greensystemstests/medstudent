import React, { useState } from 'react';
import { TopNavbar } from './components/TopNavbar';
import { PublicSiteView } from './components/PublicSiteView';
import { WizardView } from './components/WizardView';
import { StudentPortalView } from './components/StudentPortalView';
import { StaffOpsView } from './components/StaffOpsView';
import { QuickFitModal } from './components/QuickFitModal';
import { AppView } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [isQuickFitOpen, setIsQuickFitOpen] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<{
    curriculum: string;
    citizenship: string;
    biology: number;
    chemistry: number;
    selectedUniversityId: string;
  } | null>(null);

  const handleStartFromQuickFit = (prefill: {
    curriculum: string;
    citizenship: string;
    biology: number;
    chemistry: number;
    selectedUniversityId: string;
  }) => {
    setWizardPrefill(prefill);
    setCurrentView('wizard');
  };

  const handleSelectUniversity = (uniId: string) => {
    setWizardPrefill(prev => ({
      curriculum: prev?.curriculum || 'tawjihi',
      citizenship: prev?.citizenship || 'Jordan',
      biology: prev?.biology || 94,
      chemistry: prev?.chemistry || 91,
      selectedUniversityId: uniId,
    }));
    setCurrentView('wizard');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0b1c30] flex flex-col font-sans selection:bg-[#006644] selection:text-white">
      {/* Persistent Global Top Navigation */}
      <TopNavbar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenQuickFit={() => setIsQuickFitOpen(true)}
      />

      {/* View Switcher Container */}
      <main className="flex-1">
        {currentView === 'home' && (
          <PublicSiteView
            onNavigate={(view) => setCurrentView(view)}
            onOpenQuickFit={() => setIsQuickFitOpen(true)}
            onSelectUniversity={handleSelectUniversity}
          />
        )}

        {currentView === 'wizard' && (
          <WizardView
            onNavigate={(view) => setCurrentView(view)}
            prefill={wizardPrefill}
            onCompleteToPortal={() => setCurrentView('student')}
          />
        )}

        {currentView === 'student' && (
          <StudentPortalView
            onNavigate={(view) => setCurrentView(view)}
          />
        )}

        {currentView === 'staff' && (
          <StaffOpsView
            onNavigate={(view) => setCurrentView(view)}
          />
        )}
      </main>

      {/* Interactive Quick Fit Eligibility Modal */}
      <QuickFitModal
        isOpen={isQuickFitOpen}
        onClose={() => setIsQuickFitOpen(false)}
        onStartApplication={handleStartFromQuickFit}
      />
    </div>
  );
}
