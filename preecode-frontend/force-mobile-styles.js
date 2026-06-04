// Force Mobile Styles Script
// Ensures mobile styles are properly applied to internal app pages

(function() {
  'use strict';

  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth < 768;
  const shouldApplyMobileStyles = isMobile || isSmallScreen;

  if (!shouldApplyMobileStyles) return;

  // Force mobile viewport
  function forceMobileViewport() {
    // Ensure viewport meta tag is correct
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';

    // Set CSS custom properties for mobile
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Add mobile classes
    document.body.classList.add('mobile-device', 'mobile-app-viewport');
    document.documentElement.classList.add('mobile-html');
  }

  // Force mobile styles for dashboard
  function forceDashboardMobile() {
    const dashV4 = document.querySelector('.dash-v4');
    if (dashV4) {
      dashV4.style.padding = '12px';
      dashV4.style.gap = '12px';
    }

    // Force stats grid to 2x2 on mobile, 1 column on very small screens
    const statsGrid = document.querySelector('.dash-v4-stats');
    if (statsGrid) {
      if (window.innerWidth < 480) {
        statsGrid.style.gridTemplateColumns = '1fr';
        statsGrid.style.gap = '6px';
      } else {
        statsGrid.style.gridTemplateColumns = '1fr 1fr';
        statsGrid.style.gap = '8px';
      }
    }

    // Hide unnecessary elements on mobile
    const mobileHideElements = document.querySelectorAll('.mobile-hide');
    mobileHideElements.forEach(el => {
      el.style.display = 'none';
    });

    // Hide complex sections on mobile
    const rankSection = document.getElementById('rankSection');
    if (rankSection) rankSection.style.display = 'none';
    
    const twoCols = document.querySelectorAll('.dash-v4-twocol');
    twoCols.forEach(col => {
      col.style.display = 'none';
    });

    // Force practice section mobile layout
    const practiceStats = document.querySelector('.dash-v4-practice__stats');
    if (practiceStats) {
      practiceStats.style.display = 'flex';
      practiceStats.style.justifyContent = 'space-around';
      practiceStats.style.gap = '8px';
      practiceStats.style.textAlign = 'center';
    }

    // Force table responsiveness
    const tables = document.querySelectorAll('.dash-v4-table');
    tables.forEach(table => {
      table.style.fontSize = '11px';
      table.style.minWidth = '300px';
      
      const wrapper = table.closest('div') || table.parentElement;
      if (wrapper) {
        wrapper.style.overflowX = 'auto';
        wrapper.style.webkitOverflowScrolling = 'touch';
        wrapper.style.borderRadius = '8px';
      }
      
      const cells = table.querySelectorAll('th, td');
      cells.forEach(cell => {
        cell.style.padding = '6px 8px';
        cell.style.whiteSpace = 'nowrap';
      });
    });

    // Force mobile streak layout
    const streakMobile = document.querySelector('.dash-v4-streak__mobile');
    if (streakMobile) {
      streakMobile.style.display = 'flex';
      streakMobile.style.flexDirection = 'column';
      streakMobile.style.gap = '12px';
    }

    const streakCurrent = document.querySelector('.dash-v4-streak__current');
    if (streakCurrent) {
      streakCurrent.style.display = 'flex';
      streakCurrent.style.alignItems = 'center';
      streakCurrent.style.gap = '12px';
      streakCurrent.style.padding = '12px';
      streakCurrent.style.background = 'var(--bg-tertiary)';
      streakCurrent.style.borderRadius = '8px';
    }
  }

  // Force mobile styles for problems page
  function forceProblemsMobile() {
    const pageContent = document.querySelector('.page-content');
    if (pageContent) {
      pageContent.style.padding = '16px';
      pageContent.style.maxWidth = '100%';
    }

    // Force filter bar to stack
    const filterBar = document.querySelector('.prob-filter-bar');
    if (filterBar) {
      filterBar.style.flexDirection = 'column';
      filterBar.style.alignItems = 'stretch';
      filterBar.style.gap = '12px';
    }

    // Force chip group to scroll horizontally
    const chipGroup = document.querySelector('.prob-chip-group');
    if (chipGroup) {
      chipGroup.style.overflowX = 'auto';
      chipGroup.style.paddingBottom = '4px';
      chipGroup.style.scrollbarWidth = 'none';
      chipGroup.style.msOverflowStyle = 'none';
      chipGroup.style.webkitOverflowScrolling = 'touch';
    }

    // Force search input mobile styles
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.style.fontSize = '16px'; // Prevents zoom on iOS
      searchInput.style.padding = '12px 16px 12px 44px';
    }

    // Force table mobile styles
    const probTable = document.querySelector('.prob-table');
    if (probTable) {
      probTable.style.minWidth = '500px';
      probTable.style.fontSize = '12px';
      
      const cells = probTable.querySelectorAll('th, td');
      cells.forEach(cell => {
        cell.style.padding = '8px 12px';
      });
    }
  }

  // Force mobile styles for profile page
  function forceProfileMobile() {
    // Force header to stack
    const headerInner = document.querySelector('.prof-header-inner');
    if (headerInner) {
      headerInner.style.flexDirection = 'column';
      headerInner.style.textAlign = 'center';
      headerInner.style.gap = '16px';
    }

    // Force stats to single column
    const statsGrid = document.querySelector('.prof-stats-grid');
    if (statsGrid) {
      statsGrid.style.gridTemplateColumns = '1fr';
      statsGrid.style.gap = '12px';
    }

    // Force tabs to wrap
    const tabBar = document.querySelector('.prof-tab-bar');
    if (tabBar) {
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

    // Force badges to single column
    const badgesGrid = document.querySelector('.prof-badges-grid');
    if (badgesGrid) {
      badgesGrid.style.gridTemplateColumns = '1fr';
      badgesGrid.style.gap = '8px';
    }
  }

  // Force mobile styles for topbar
  function forceTopbarMobile() {
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.style.padding = '8px 16px';
      topbar.style.minHeight = '56px';
    }

    // Force topbar elements to be mobile-friendly
    const topbarLeft = document.querySelector('.topbar-left');
    if (topbarLeft) {
      topbarLeft.style.gap = '16px';
    }

    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight) {
      topbarRight.style.gap = '8px';
    }

    // Hide navigation on mobile (hamburger menu will show)
    const topbarNav = document.querySelector('.topbar-nav');
    if (topbarNav && window.innerWidth < 768) {
      topbarNav.style.display = 'none';
    }

    // Show hamburger menu
    const hamburger = document.querySelector('.topbar-hamburger');
    if (hamburger) {
      hamburger.style.display = 'flex';
    }

    // Force dropdown to full width on mobile
    const dropdown = document.querySelector('.topbar-dropdown');
    if (dropdown) {
      dropdown.style.width = 'calc(100vw - 32px)';
      dropdown.style.right = '16px';
    }
  }

  // Force mobile styles for all tables
  function forceTablesMobile() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      table.style.fontSize = '12px';
      
      const wrapper = table.closest('.overflow-x-auto') || table.parentElement;
      if (wrapper) {
        wrapper.style.overflowX = 'auto';
        wrapper.style.webkitOverflowScrolling = 'touch';
        wrapper.style.scrollbarWidth = 'thin';
      }
      
      const cells = table.querySelectorAll('th, td');
      cells.forEach(cell => {
        cell.style.padding = '8px 12px';
      });
    });
  }

  // Force mobile styles for forms
  function forceFormsMobile() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea, select');
    inputs.forEach(input => {
      input.style.fontSize = '16px'; // Prevents zoom on iOS
      input.style.minHeight = '44px'; // Better touch target
    });

    const buttons = document.querySelectorAll('button, .btn, a[role="button"]');
    buttons.forEach(button => {
      button.style.minHeight = '44px'; // Better touch target
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
    });
  }

  // Add mobile-specific CSS
  function addMobileCSSOverrides() {
    const style = document.createElement('style');
    style.id = 'force-mobile-styles';
    style.textContent = `
      /* Force mobile styles */
      @media (max-width: 767px) {
        .mobile-device {
          overflow-x: hidden !important;
        }
        
        .mobile-app-viewport {
          height: 100vh !important;
          height: calc(var(--vh, 1vh) * 100) !important;
        }
        
        .app-shell {
          min-height: 100vh !important;
          min-height: calc(var(--vh, 1vh) * 100) !important;
        }
        
        .page-content {
          padding: 16px !important;
          max-width: 100% !important;
        }
        
        .dash-v4 {
          padding: 12px !important;
          gap: 12px !important;
        }
        
        .dash-v4-stats {
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
        }
        
        .dash-v4-stat {
          padding: 12px 16px !important;
          min-height: auto !important;
        }
        
        .dash-v4-stat__label {
          font-size: 10px !important;
          margin-bottom: 6px !important;
        }
        
        .dash-v4-stat__num {
          font-size: 20px !important;
        }
        
        .dash-v4-stat__num--xl {
          font-size: 24px !important;
        }
        
        .dash-v4-stat__unit {
          font-size: 11px !important;
        }
        
        .dash-v4-stat__trend {
          font-size: 9px !important;
          margin-top: 4px !important;
        }
        
        .dash-v4-card {
          padding: 12px 16px !important;
          border-radius: 12px !important;
        }
        
        .dash-v4-card__title {
          font-size: 11px !important;
        }
        
        .dash-v4-practice {
          padding: 12px 16px !important;
        }
        
        .dash-v4-practice__cta {
          padding: 10px 16px !important;
          font-size: 13px !important;
          border-radius: 8px !important;
        }
        
        .dash-v4-twocol {
          display: none !important;
        }
        
        #rankSection {
          display: none !important;
        }
        
        .mobile-hide {
          display: none !important;
        }
        
        .prof-header-inner {
          flex-direction: column !important;
          text-align: center !important;
          gap: 16px !important;
        }
        
        .prof-stats-grid {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }
        
        .prob-filter-bar {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 12px !important;
        }
        
        .prob-chip-group {
          overflow-x: auto !important;
          padding-bottom: 4px !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        .prob-chip-group::-webkit-scrollbar {
          display: none !important;
        }
        
        .topbar-nav {
          display: none !important;
        }
        
        .topbar-hamburger {
          display: flex !important;
          width: 44px !important;
          height: 44px !important;
        }
        
        /* Ensure mobile menu is properly styled */
        .topbar-mobile-menu {
          display: flex !important;
          flex-direction: column !important;
          background: var(--bg-topbar) !important;
          border-bottom: 1px solid var(--border-subtle) !important;
          padding: 8px 16px 12px !important;
        }
        
        .topbar-mobile-menu.hidden {
          display: none !important;
        }
        
        .topbar-dropdown {
          width: calc(100vw - 32px) !important;
          right: 16px !important;
        }
        
        /* Better touch targets */
        button, .btn, a[role="button"], .prob-chip, .prof-tab {
          min-height: 44px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        
        /* Prevent zoom on iOS */
        input[type="text"], input[type="email"], input[type="password"], textarea, select {
          font-size: 16px !important;
        }
        
        /* Table responsiveness */
        table {
          font-size: 11px !important;
          min-width: 300px !important;
        }
        
        table th, table td {
          padding: 6px 8px !important;
          white-space: nowrap !important;
        }
        
        /* Prevent horizontal scroll */
        body {
          overflow-x: hidden !important;
        }
        
        /* Better tap highlighting */
        * {
          -webkit-tap-highlight-color: rgba(255, 161, 22, 0.2) !important;
        }
      }
      
      @media (max-width: 480px) {
        .page-content {
          padding: 12px !important;
        }
        
        .dash-v4 {
          padding: 8px !important;
          gap: 8px !important;
        }
        
        .dash-v4-stats {
          grid-template-columns: 1fr !important;
          gap: 6px !important;
        }
        
        .dash-v4-stat {
          padding: 10px 12px !important;
        }
        
        .dash-v4-stat__num {
          font-size: 18px !important;
        }
        
        .dash-v4-stat__num--xl {
          font-size: 22px !important;
        }
        
        .dash-v4-card {
          padding: 10px 12px !important;
        }
        
        .dash-v4-practice {
          padding: 10px 12px !important;
        }
        
        table {
          font-size: 10px !important;
        }
        
        table th, table td {
          padding: 4px 6px !important;
        }
      }
    `;
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById('force-mobile-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    document.head.appendChild(style);
  }

  // Main initialization function
  function init() {
    forceMobileViewport();
    addMobileCSSOverrides();
    forceTopbarMobile();
    forceTablesMobile();
    forceFormsMobile();

    // Apply page-specific mobile styles
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('dashboard')) {
      forceDashboardMobile();
    } else if (currentPage.includes('problems')) {
      forceProblemsMobile();
    } else if (currentPage.includes('profile')) {
      forceProfileMobile();
    }

    // Handle viewport changes
    window.addEventListener('resize', function() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    });

    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
      setTimeout(() => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        init(); // Re-apply styles
      }, 100);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also initialize after a short delay to ensure all other scripts have loaded
  setTimeout(init, 100);

})();