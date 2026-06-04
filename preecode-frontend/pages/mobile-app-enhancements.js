// Mobile Enhancement Script for Internal App Pages
// Handles mobile-specific interactions for dashboard, problems, practice, etc.

(function() {
  'use strict';

  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Add mobile class to body
  if (isMobile || isTouch) {
    document.body.classList.add('is-mobile-app');
  }

  // Dashboard mobile enhancements
  function enhanceDashboardMobile() {
    // Make stat cards more touch-friendly
    const statCards = document.querySelectorAll('.dash-v4-stat');
    statCards.forEach(card => {
      card.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.98)';
      });
      
      card.addEventListener('touchend', function() {
        setTimeout(() => {
          this.style.transform = '';
        }, 150);
      });
    });

    // Optimize practice section for mobile
    const practiceSection = document.querySelector('.dash-v4-practice');
    if (practiceSection && window.innerWidth < 768) {
      const stats = practiceSection.querySelector('.dash-v4-practice__stats');
      if (stats) {
        stats.style.gridTemplateColumns = '1fr';
        stats.style.textAlign = 'center';
      }
    }

    // Make tables horizontally scrollable on mobile
    const tables = document.querySelectorAll('.dash-v4-table');
    tables.forEach(table => {
      if (window.innerWidth < 768) {
        const wrapper = table.closest('.overflow-x-auto') || table.parentElement;
        wrapper.style.webkitOverflowScrolling = 'touch';
        wrapper.style.scrollbarWidth = 'thin';
      }
    });
  }

  // Problems page mobile enhancements
  function enhanceProblemsPageMobile() {
    const searchInput = document.getElementById('searchInput');
    const filterChips = document.querySelectorAll('.prob-chip');
    
    // Enhance search input for mobile
    if (searchInput && window.innerWidth < 768) {
      searchInput.style.fontSize = '16px'; // Prevents zoom on iOS
      
      // Auto-scroll to search when focused
      searchInput.addEventListener('focus', function() {
        setTimeout(() => {
          this.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300);
      });
    }

    // Make filter chips horizontally scrollable
    const chipGroup = document.querySelector('.prob-chip-group');
    if (chipGroup && window.innerWidth < 768) {
      chipGroup.style.overflowX = 'auto';
      chipGroup.style.scrollbarWidth = 'none';
      chipGroup.style.msOverflowStyle = 'none';
      chipGroup.style.webkitOverflowScrolling = 'touch';
      
      // Hide scrollbar
      const style = document.createElement('style');
      style.textContent = '.prob-chip-group::-webkit-scrollbar { display: none; }';
      document.head.appendChild(style);
    }

    // Enhance filter chips for touch
    filterChips.forEach(chip => {
      chip.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.95)';
      });
      
      chip.addEventListener('touchend', function() {
        setTimeout(() => {
          this.style.transform = '';
        }, 150);
      });
    });
  }

  // Practice Here mobile enhancements
  function enhancePracticeHereMobile() {
    if (window.innerWidth < 1024) {
      // Adjust layout for mobile
      const main = document.querySelector('.ph-main');
      const problem = document.querySelector('.ph-problem');
      const editorWrap = document.querySelector('.ph-editor-wrap');
      
      if (main && problem && editorWrap) {
        main.style.flexDirection = 'column';
        problem.style.width = '100%';
        problem.style.height = '40vh';
        problem.style.borderRight = 'none';
        problem.style.borderBottom = '1px solid var(--border-subtle, rgba(255,255,255,0.07))';
        editorWrap.style.height = '60vh';
      }
    }

    // Optimize topbar for mobile
    const topbar = document.querySelector('.ph-topbar');
    if (topbar && window.innerWidth < 768) {
      topbar.style.flexWrap = 'wrap';
      topbar.style.gap = '8px';
      topbar.style.padding = '8px 12px';
      
      // Hide button text on very small screens
      if (window.innerWidth < 480) {
        const buttons = topbar.querySelectorAll('.ph-btn span');
        buttons.forEach(span => {
          span.style.display = 'none';
        });
      }
    }

    // Enhance Monaco Editor for mobile
    if (typeof monaco !== 'undefined' && window.innerWidth < 768) {
      // Add mobile-specific editor options
      const editorOptions = {
        fontSize: 12,
        lineHeight: 18,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8
        }
      };
      
      // Apply to existing editor if available
      if (window.editor) {
        window.editor.updateOptions(editorOptions);
      }
    }
  }

  // Profile page mobile enhancements
  function enhanceProfilePageMobile() {
    const headerInner = document.querySelector('.prof-header-inner');
    const statsGrid = document.querySelector('.prof-stats-grid');
    const tabBar = document.querySelector('.prof-tab-bar');
    
    // Stack profile header on mobile
    if (headerInner && window.innerWidth < 1024) {
      headerInner.style.flexDirection = 'column';
      headerInner.style.textAlign = 'center';
      headerInner.style.gap = '16px';
    }

    // Single column stats on mobile
    if (statsGrid && window.innerWidth < 1024) {
      statsGrid.style.gridTemplateColumns = '1fr';
      statsGrid.style.gap = '12px';
    }

    // Enhance tabs for mobile
    if (tabBar && window.innerWidth < 768) {
      tabBar.style.flexWrap = 'wrap';
      tabBar.style.gap = '8px';
      
      const tabs = tabBar.querySelectorAll('.prof-tab');
      tabs.forEach(tab => {
        tab.style.flex = '1';
        tab.style.minWidth = '120px';
        tab.style.padding = '8px 16px';
        tab.style.fontSize = '12px';
      });
    }
  }

  // Submissions page mobile enhancements
  function enhanceSubmissionsPageMobile() {
    const statsRow = document.querySelector('.stats-row');
    
    // Adjust stats layout for mobile
    if (statsRow && window.innerWidth < 768) {
      if (window.innerWidth < 480) {
        statsRow.style.gridTemplateColumns = '1fr';
      } else {
        statsRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
      }
      statsRow.style.gap = '8px';
    }

    // Enhance filter controls
    const filterControls = document.querySelectorAll('.filter-control');
    filterControls.forEach(control => {
      if (window.innerWidth < 768) {
        control.style.width = '100%';
        control.style.minHeight = '44px';
        control.style.fontSize = '16px'; // Prevents zoom on iOS
      }
    });
  }

  // Settings page mobile enhancements
  function enhanceSettingsPageMobile() {
    const settingsLayout = document.querySelector('.settings-layout');
    const settingsNav = document.querySelector('.settings-nav');
    
    // Stack settings layout on mobile
    if (settingsLayout && window.innerWidth < 1024) {
      settingsLayout.style.gridTemplateColumns = '1fr';
      settingsLayout.style.gap = '16px';
    }

    // Horizontal scrollable nav on mobile
    if (settingsNav && window.innerWidth < 1024) {
      settingsNav.style.position = 'static';
      settingsNav.style.flexDirection = 'row';
      settingsNav.style.overflowX = 'auto';
      settingsNav.style.gap = '8px';
      settingsNav.style.paddingBottom = '4px';
      settingsNav.style.scrollbarWidth = 'none';
      settingsNav.style.msOverflowStyle = 'none';
      settingsNav.style.webkitOverflowScrolling = 'touch';
      
      // Hide scrollbar
      const style = document.createElement('style');
      style.textContent = '.settings-nav::-webkit-scrollbar { display: none; }';
      document.head.appendChild(style);
      
      const navItems = settingsNav.querySelectorAll('.settings-nav-item');
      navItems.forEach(item => {
        item.style.whiteSpace = 'nowrap';
        item.style.flexShrink = '0';
      });
    }
  }

  // Interview pages mobile enhancements
  function enhanceInterviewPagesMobile() {
    const recordBtn = document.querySelector('.record-btn');
    const interviewQuestion = document.querySelector('.interview-question');
    
    // Adjust record button size for mobile
    if (recordBtn && window.innerWidth < 768) {
      recordBtn.style.width = '72px';
      recordBtn.style.height = '72px';
      
      if (window.innerWidth < 480) {
        recordBtn.style.width = '64px';
        recordBtn.style.height = '64px';
      }
    }

    // Optimize question display for mobile
    if (interviewQuestion && window.innerWidth < 768) {
      interviewQuestion.style.padding = '16px';
      interviewQuestion.style.fontSize = '14px';
      
      if (window.innerWidth < 480) {
        interviewQuestion.style.padding = '12px';
        interviewQuestion.style.fontSize = '13px';
      }
    }
  }

  // General mobile table enhancements
  function enhanceTablesForMobile() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      if (window.innerWidth < 768) {
        // Make tables scrollable
        const wrapper = table.closest('.overflow-x-auto') || table.parentElement;
        wrapper.style.webkitOverflowScrolling = 'touch';
        wrapper.style.scrollbarWidth = 'thin';
        
        // Reduce font size
        table.style.fontSize = '12px';
        
        // Adjust padding
        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
          cell.style.padding = '8px 12px';
        });
        
        if (window.innerWidth < 480) {
          table.style.fontSize = '11px';
          cells.forEach(cell => {
            cell.style.padding = '6px 8px';
          });
        }
      }
    });
  }

  // Handle orientation changes
  function handleOrientationChange() {
    window.addEventListener('orientationchange', function() {
      setTimeout(() => {
        // Recalculate viewport height
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Re-apply mobile enhancements
        init();
      }, 100);
    });
  }

  // Optimize performance for mobile
  function optimizePerformanceForMobile() {
    if (window.innerWidth < 768) {
      // Reduce animation duration
      const style = document.createElement('style');
      style.textContent = `
        .dash-v4-anim,
        .animate-fade-in,
        .animate-fade-in-1,
        .animate-fade-in-2 {
          animation-duration: 0.3s !important;
        }
        
        .app-card:hover,
        .dash-v4-stat:hover,
        .prof-badge:hover {
          transform: none !important;
        }
        
        .is-mobile-app .hover\\:scale-105:hover {
          transform: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Initialize mobile enhancements based on current page
  function init() {
    // Set viewport height
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    // Apply general enhancements
    enhanceTablesForMobile();
    optimizePerformanceForMobile();
    handleOrientationChange();

    // Apply page-specific enhancements
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('dashboard')) {
      enhanceDashboardMobile();
    } else if (currentPage.includes('problems')) {
      enhanceProblemsPageMobile();
    } else if (currentPage.includes('practice-here')) {
      enhancePracticeHereMobile();
    } else if (currentPage.includes('profile')) {
      enhanceProfilePageMobile();
    } else if (currentPage.includes('submissions')) {
      enhanceSubmissionsPageMobile();
    } else if (currentPage.includes('settings')) {
      enhanceSettingsPageMobile();
    } else if (currentPage.includes('interview')) {
      enhanceInterviewPagesMobile();
    }

    // Add mobile-specific CSS classes
    if (window.innerWidth < 768) {
      document.body.classList.add('mobile-app-viewport');
    }

    // Handle viewport changes
    window.addEventListener('resize', function() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      if (window.innerWidth < 768) {
        document.body.classList.add('mobile-app-viewport');
      } else {
        document.body.classList.remove('mobile-app-viewport');
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Add CSS for mobile app enhancements
  const mobileAppCSS = `
    .is-mobile-app .touch-active {
      transform: scale(0.98) !important;
      opacity: 0.8;
    }
    
    .mobile-app-viewport {
      height: 100vh;
      height: calc(var(--vh, 1vh) * 100);
    }
    
    @media (max-width: 767px) {
      .app-shell {
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
      }
      
      .page-content {
        padding: 16px;
        max-width: 100%;
      }
      
      .modal-overlay,
      .ea-overlay {
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);
      }
      
      /* Better touch targets */
      button, .btn, a[role="button"], .prob-chip, .prof-tab {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Prevent horizontal scroll */
      body {
        overflow-x: hidden;
      }
      
      /* Better text selection */
      * {
        -webkit-tap-highlight-color: rgba(255, 161, 22, 0.2);
      }
    }
    
    @media (max-width: 480px) {
      .page-content {
        padding: 12px;
      }
    }
  `;

  // Inject mobile app CSS
  const style = document.createElement('style');
  style.textContent = mobileAppCSS;
  document.head.appendChild(style);

})();